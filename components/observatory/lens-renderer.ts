import { clock, effect, frame, frameLoop, init, surface, type Clock, type Effect, type FrameLoopHandle, type Gpu, type Surface } from "vgpu";
import { lensFieldWgsl } from "./lens-shader";

export type LensState = { divergence: number; violation: number };

export type LensRenderer = {
  ready: Promise<boolean>;
  setState(state: LensState): void;
  setPointer(x: number, y: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

const STATIC_TIME = 14.0;

export function createLensRenderer(canvas: HTMLCanvasElement, animate: boolean): LensRenderer {
  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let lens: Effect | undefined;
  let gpuClock: Clock | undefined;
  let loop: FrameLoopHandle | undefined;
  let running = false;

  const target: LensState = { divergence: 0, violation: 0 };
  const current: LensState = { divergence: 0, violation: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };

  const applyUniforms = (time: number) => {
    if (!lens || !canvasSurface) return;
    const [width, height] = canvasSurface.size;
    const wide = width / Math.max(height, 1) > 1.05;
    lens.set({
      params: {
        resolution: canvasSurface.size,
        center: wide ? [0.56, 0.12] : [0.0, 0.30],
        pointer: [pointer.x, pointer.y],
        time,
        divergence: current.divergence,
        violation: current.violation,
      },
    });
  };

  const renderOnce = () => {
    if (disposed || !gpu || !lens || !canvasSurface) return;
    const output = canvasSurface;
    const effectRef = lens;
    applyUniforms(STATIC_TIME);
    frame(gpu, (f) => f.pass(output, effectRef));
  };

  const startLoop = () => {
    if (disposed || !animate || running || !gpu || !lens || !canvasSurface) return;
    const output = canvasSurface;
    const effectRef = lens;
    running = true;
    loop = frameLoop(gpu, (f) => {
      current.divergence += (target.divergence - current.divergence) * 0.055;
      current.violation += (target.violation - current.violation) * 0.06;
      pointer.x += (pointerTarget.x - pointer.x) * 0.05;
      pointer.y += (pointerTarget.y - pointer.y) * 0.05;
      applyUniforms(gpuClock?.time ?? 0);
      f.pass(output, effectRef);
    });
  };

  const stopLoop = () => {
    running = false;
    loop?.stop();
    loop = undefined;
  };

  const initialize = async (): Promise<boolean> => {
    const nextGpu = await init();
    if (disposed) {
      nextGpu.dispose();
      return false;
    }
    gpu = nextGpu;
    canvasSurface = surface(gpu, canvas, { dpr: [1, 1.5] });
    lens = effect(gpu, lensFieldWgsl, {
      set: {
        params: {
          resolution: canvasSurface.size,
          center: [0.56, 0.12],
          pointer: [0, 0],
          time: STATIC_TIME,
          divergence: 0,
          violation: 0,
        },
      },
    });
    if (animate) {
      gpuClock = clock(gpu);
      startLoop();
    } else {
      current.divergence = target.divergence;
      current.violation = target.violation;
      renderOnce();
    }
    return true;
  };

  const ready = initialize().catch(() => false);

  return {
    ready,
    setState(state) {
      target.divergence = state.divergence;
      target.violation = state.violation;
      if (!animate) {
        current.divergence = state.divergence;
        current.violation = state.violation;
        void ready.then((ok) => {
          if (ok) renderOnce();
        });
      }
    },
    setPointer(x, y) {
      pointerTarget.x = x;
      pointerTarget.y = y;
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
      stopLoop();
      gpu?.dispose();
    },
  };
}
