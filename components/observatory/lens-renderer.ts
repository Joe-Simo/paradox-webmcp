import { clock, effect, frame, frameLoop, init, sampler, surface, target, type Clock, type Effect, type Frame, type FrameLoopHandle, type Gpu, type Surface, type Target } from "vgpu";
import { blurWgsl, brightPassWgsl, compositeWgsl, sceneWgsl } from "./black-hole-shaders";

export type LensState = { divergence: number; violation: number };

export type LensRenderer = {
  ready: Promise<boolean>;
  setState(state: LensState): void;
  setPointer(x: number, y: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

const STATIC_TIME = 26.0;
const CLEAR = [0, 0, 0, 1] as const;
const BLURS = [
  { direction: [1, 0], radius: 1 },
  { direction: [0, 1], radius: 1 },
  { direction: [1, 0], radius: 2.4 },
  { direction: [0, 1], radius: 2.4 },
] as const;

type Effects = {
  scene: Effect;
  bright: Effect;
  blur: Effect[];
  composite: Effect;
};

type Targets = {
  scene: Target;
  bloom: readonly [Target, Target];
};

function createTargets(gpu: Gpu, size: readonly [number, number]): Targets {
  const height = Math.min(360, size[1]);
  const bloom: [number, number] = [Math.max(1, Math.round((height * size[0]) / size[1])), height];
  let scene: Target | undefined;
  let bloomA: Target | undefined;
  try {
    scene = target(gpu, { size, format: "rgba16float" });
    bloomA = target(gpu, { size: bloom, format: "rgba16float" });
    return { scene, bloom: [bloomA, target(gpu, { size: bloom, format: "rgba16float" })] as const };
  } catch (error) {
    destroy(bloomA);
    destroy(scene);
    throw error;
  }
}

function destroyTargets(targets: Targets): void {
  destroy(targets.bloom[1]);
  destroy(targets.bloom[0]);
  destroy(targets.scene);
}

function destroy(color: Target | undefined): void {
  (color as { destroy?: () => void } | undefined)?.destroy?.();
}

function setBindings(effects: Effects, targets: Targets): void {
  effects.scene.set({ params: { resolution: targets.scene.size } });
  effects.bright.set({ src: targets.scene });
  effects.blur.forEach((blur, i) =>
    blur.set({ src: targets.bloom[i % 2], blur: { texelSize: targets.bloom[i % 2].texelSize } }),
  );
  effects.composite.set({ scene: targets.scene, bloom: targets.bloom[0] });
}

export function createLensRenderer(canvas: HTMLCanvasElement, animate: boolean): LensRenderer {
  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let effects: Effects | undefined;
  let targets: Targets | undefined;
  let gpuClock: Clock | undefined;
  let loop: FrameLoopHandle | undefined;
  let running = false;
  let observer: ResizeObserver | undefined;
  let resizeFrame = 0;
  let pendingSize: { width: number; height: number; dpr: number } | undefined;

  const state: LensState = { divergence: 0, violation: 0 };
  const current: LensState = { divergence: 0, violation: 0 };
  const pointerTarget = { yaw: 0, pitch: 0.07 };
  const pointer = { yaw: 0, pitch: 0.07 };

  const wide = () => (canvasSurface ? canvasSurface.size[0] / Math.max(canvasSurface.size[1], 1) > 1.05 : true);

  const applyUniforms = (time: number) => {
    if (!effects) return;
    effects.scene.set({
      params: {
        center: wide() ? [0.52, 0.02] : [0.0, 0.34],
        pointer: [pointer.yaw, pointer.pitch],
        time,
        divergence: current.divergence,
        violation: current.violation,
      },
    });
  };

  const renderChain = (activeFrame: Frame) => {
    if (!effects || !targets || !canvasSurface) return;
    const chain = { effects, targets, output: canvasSurface };
    activeFrame.pass({ target: chain.targets.scene, clear: CLEAR }, (pass) => pass.draw(chain.effects.scene));
    activeFrame.pass({ target: chain.targets.bloom[0], clear: CLEAR }, (pass) => pass.draw(chain.effects.bright));
    chain.effects.blur.forEach((blur, i) => {
      activeFrame.pass({ target: chain.targets.bloom[(i + 1) % 2], clear: CLEAR }, (pass) => pass.draw(blur));
    });
    activeFrame.pass({ target: chain.output, clear: CLEAR }, (pass) => pass.draw(chain.effects.composite));
  };

  const renderOnce = () => {
    if (disposed || !gpu || !effects || !targets || !canvasSurface) return;
    applyUniforms(STATIC_TIME);
    frame(gpu, (f) => renderChain(f));
  };

  const startLoop = () => {
    if (disposed || !animate || running || !gpu || !effects || !canvasSurface) return;
    running = true;
    loop = frameLoop(gpu, (f) => {
      current.divergence += (state.divergence - current.divergence) * 0.045;
      current.violation += (state.violation - current.violation) * 0.05;
      pointer.yaw += (pointerTarget.yaw - pointer.yaw) * 0.045;
      pointer.pitch += (pointerTarget.pitch - pointer.pitch) * 0.045;
      applyUniforms(gpuClock?.time ?? 0);
      renderChain(f);
    });
  };

  const stopLoop = () => {
    running = false;
    loop?.stop();
    loop = undefined;
  };

  const applyResize = () => {
    resizeFrame = 0;
    const size = pendingSize;
    pendingSize = undefined;
    if (disposed || !size || !gpu || !effects || !targets) return;
    try {
      const next = createTargets(gpu, [
        Math.max(1, Math.round(size.width * size.dpr)),
        Math.max(1, Math.round(size.height * size.dpr)),
      ]);
      try {
        setBindings(effects, next);
      } catch (error) {
        destroyTargets(next);
        throw error;
      }
      const previous = targets;
      targets = next;
      destroyTargets(previous);
      if (!animate) renderOnce();
    } catch {
      stopLoop();
    }
  };

  const measure = () => {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pendingSize = { width: rect.width, height: rect.height, dpr: Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)) };
    if (!resizeFrame) resizeFrame = requestAnimationFrame(applyResize);
  };

  const initialize = async (): Promise<boolean> => {
    const nextGpu = await init();
    if (disposed) {
      nextGpu.dispose();
      return false;
    }
    const activeGpu = nextGpu;
    gpu = activeGpu;
    canvasSurface = surface(activeGpu, canvas, { dpr: [1, 1.5] });
    const samp = sampler(activeGpu, { minFilter: "linear", magFilter: "linear" });
    effects = {
      scene: effect(activeGpu, sceneWgsl, {
        set: {
          params: {
            resolution: canvasSurface.size,
            center: [0.52, 0.02],
            pointer: [pointer.yaw, pointer.pitch],
            time: STATIC_TIME,
            divergence: 0,
            violation: 0,
          },
        },
      }),
      bright: effect(activeGpu, brightPassWgsl, { set: { samp } }),
      blur: BLURS.map((blur) => effect(activeGpu, blurWgsl, { set: { samp, blur } })),
      composite: effect(activeGpu, compositeWgsl, { set: { samp } }),
    };
    targets = createTargets(activeGpu, canvasSurface.size);
    setBindings(effects, targets);
    observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(canvas);
    if (animate) {
      gpuClock = clock(activeGpu);
      startLoop();
    } else {
      current.divergence = state.divergence;
      current.violation = state.violation;
      renderOnce();
    }
    return true;
  };

  const ready = initialize().catch(() => false);

  return {
    ready,
    setState(next) {
      state.divergence = next.divergence;
      state.violation = next.violation;
      if (!animate) {
        current.divergence = next.divergence;
        current.violation = next.violation;
        void ready.then((ok) => {
          if (ok) renderOnce();
        });
      }
    },
    setPointer(x, y) {
      pointerTarget.yaw = -x * 0.16;
      pointerTarget.pitch = 0.07 + y * 0.1;
    },
    start() {
      void ready.then((ok) => {
        if (ok) startLoop();
      });
    },
    stop() {
      stopLoop();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      stopLoop();
      gpu?.dispose();
    },
  };
}
