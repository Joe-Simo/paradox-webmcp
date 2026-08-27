// Browser lifecycle for the baked black-hole pipeline, ported from the vgpu
// optimized example (MIT, Vercel Labs). Paradox adds two semantic drives —
// divergence and violation — plus a static single-frame branch for reduced
// motion, and resolves readiness as a boolean so the page can keep its
// deep-field fallback when WebGPU is unavailable.

import { frame, init, surface as createSurface, type Frame, type Gpu, type Surface } from "vgpu";

import {
  createEffects,
  createTargets,
  destroyTargets,
  prewarm,
  renderChain,
  setBakeUniforms,
  setBindings,
  setPostUniforms,
  setShadeUniforms,
  type Effects,
  type Targets,
} from "./pipeline";
import { defaultHeroSettings } from "./settings";

export type LensState = { divergence: number; violation: number };

export type LensRenderer = {
  ready: Promise<boolean>;
  setState(state: LensState): void;
  dispose(): void;
};

const SCENE_YAW_TAU_S = 0.325;
const MAX_FRAME_DT_S = 0.1;
const TARGET_FPS = 60;
const FRAME_PACING_EPSILON_MS = 2;
const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FPS - FRAME_PACING_EPSILON_MS;
const MOBILE_QUERY = "(max-width: 767px)";
const STATIC_TIME = 26.0;

export function createLensRenderer(canvas: HTMLCanvasElement, animate: boolean): LensRenderer {
  const settings = defaultHeroSettings();
  const desktopLayout = {
    centerX: settings.centerX,
    centerY: settings.centerY,
    cameraRoll: settings.cameraRoll,
    mouseYaw: settings.mouseYaw,
    centerFade: settings.centerFade,
  };
  const mobileQuery = window.matchMedia(MOBILE_QUERY);
  const applyResponsiveLayout = () => {
    Object.assign(
      settings,
      mobileQuery.matches
        ? { centerX: 0, centerY: -0.1, cameraRoll: -0.16, mouseYaw: 0, centerFade: 1 }
        : desktopLayout,
    );
  };
  applyResponsiveLayout();
  const bloomScale = Math.min(Math.max(window.devicePixelRatio, 1), 2) / 2;
  settings.bloom.radius *= bloomScale;
  settings.bloom.strength *= bloomScale;

  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let effects: Effects | undefined;
  let targets: Targets | undefined;
  let loop: { stop(): void } | undefined;
  let observer: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let documentVisible = typeof document === "undefined" ? true : !document.hidden;
  let canvasIntersecting = true;

  let started = false;
  let animationTime = 0;
  let lastFrameAt: number | undefined;
  let resizeFrame = 0;
  let pendingSize: { width: number; height: number } | undefined;
  let forceBake = true;
  let pointerXNormalized = 0;
  let currentSceneYaw = 0;
  let lastYawAt: number | undefined;

  const state: LensState = { divergence: 0, violation: 0 };
  const current: LensState = { divergence: 0, violation: 0 };

  const onLayoutChange = () => {
    applyResponsiveLayout();
    forceBake = true;
    if (!animate) renderOnce();
  };
  mobileQuery.addEventListener("change", onLayoutChange);

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const width = Math.max(window.innerWidth, 1);
    pointerXNormalized = Math.min(1, Math.max(-1, (event.clientX / width) * 2 - 1));
  };
  const recenterPointer = () => {
    pointerXNormalized = 0;
  };
  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget === null) recenterPointer();
  };
  const onVisibilityChange = () => {
    if (document.hidden) recenterPointer();
    documentVisible = !document.hidden;
    reconcileLoop();
  };

  function reconcileLoop(): void {
    if (!started || !gpu || !animate) return;
    const shouldRun = !disposed && documentVisible && canvasIntersecting;
    if (shouldRun === Boolean(loop)) return;
    if (shouldRun) {
      lastFrameAt = undefined;
      lastYawAt = undefined;
      loop = startPacedLoop(gpu);
    } else {
      loop?.stop();
      loop = undefined;
    }
  }

  function startPacedLoop(activeGpu: Gpu): { stop(): void } {
    let stopped = false;
    let lastPresentedAt: number | undefined;
    const tick = (timestamp: number): void => {
      if (stopped) return;
      if (lastPresentedAt === undefined || timestamp - lastPresentedAt >= MIN_FRAME_INTERVAL_MS) {
        lastPresentedAt = timestamp;
        try {
          frame(activeGpu, renderFrame);
        } catch {
          stopped = true;
          return;
        }
      }
      if (!stopped) frameHandle = requestAnimationFrame(tick);
    };
    let frameHandle = requestAnimationFrame(tick);
    return {
      stop(): void {
        stopped = true;
        cancelAnimationFrame(frameHandle);
      },
    };
  }

  const advanceAnimationTime = (now: number): number => {
    animationTime += lastFrameAt === undefined ? 0 : Math.max(0, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    return animationTime;
  };

  const advanceSceneYaw = (now: number): number => {
    if (settings.mouseYaw <= 0) {
      currentSceneYaw = 0;
      lastYawAt = now;
      return 0;
    }
    const dt = lastYawAt === undefined ? 0 : Math.min(Math.max((now - lastYawAt) / 1000, 0), MAX_FRAME_DT_S);
    lastYawAt = now;
    const target = pointerXNormalized * Math.max(0, settings.mouseYaw);
    currentSceneYaw += (target - currentSceneYaw) * (1 - Math.exp(-dt / SCENE_YAW_TAU_S));
    return currentSceneYaw;
  };

  const renderFrame = (activeFrame: Frame): void => {
    if (disposed || !effects || !targets || !canvasSurface) return;
    const now = clockMs();
    const runBake = forceBake;
    forceBake = false;
    if (runBake) setBakeUniforms(effects, targets, settings);
    current.divergence += (state.divergence - current.divergence) * 0.05;
    current.violation += (state.violation - current.violation) * 0.055;
    setShadeUniforms(
      effects,
      targets,
      settings,
      advanceAnimationTime(now),
      advanceSceneYaw(now),
      current.divergence,
      current.violation,
    );
    renderChain(activeFrame, effects, targets, canvasSurface, runBake);
  };

  const renderOnce = () => {
    if (disposed || !gpu || !effects || !targets || !canvasSurface) return;
    const staticEffects = effects;
    const staticTargets = targets;
    const output = canvasSurface;
    const runBake = forceBake;
    forceBake = false;
    if (runBake) setBakeUniforms(staticEffects, staticTargets, settings);
    setShadeUniforms(staticEffects, staticTargets, settings, STATIC_TIME, 0, current.divergence, current.violation);
    try {
      frame(gpu, (f) => renderChain(f, staticEffects, staticTargets, output, runBake));
    } catch {
      // A lost device leaves the static fallback in place.
    }
  };

  const applyResize = () => {
    resizeFrame = 0;
    const size = pendingSize;
    pendingSize = undefined;
    if (disposed || !size || !gpu || !effects || !targets) return;
    try {
      const previousTargets = targets;
      const nextTargets = createTargets(gpu, [Math.max(1, Math.round(size.width)), Math.max(1, Math.round(size.height))]);
      try {
        setBindings(effects, nextTargets);
        setPostUniforms(effects, nextTargets, settings);
      } catch (error) {
        destroyTargets(nextTargets);
        throw error;
      }
      targets = nextTargets;
      destroyTargets(previousTargets);
      forceBake = true;
      if (!animate) renderOnce();
    } catch {
      loop?.stop();
      loop = undefined;
    }
  };

  const resize = (size: { width: number; height: number }) => {
    if (disposed || size.width <= 0 || size.height <= 0) return;
    pendingSize = size;
    if (!resizeFrame) resizeFrame = requestAnimationFrame(applyResize);
  };

  const measure = () => {
    resize({ width: canvas.clientWidth, height: canvas.clientHeight });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loop?.stop();
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    observer?.disconnect();
    intersection?.disconnect();
    if (typeof window !== "undefined") {
      mobileQuery.removeEventListener("change", onLayoutChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", recenterPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    gpu?.dispose();
  };

  const initialize = async (): Promise<boolean> => {
    const nextGpu = await init();
    if (disposed) {
      nextGpu.dispose();
      return false;
    }
    gpu = nextGpu;
    canvasSurface = createSurface(nextGpu, canvas, { dpr: 1 });
    effects = createEffects(nextGpu);
    targets = createTargets(nextGpu, canvasSurface.size);
    setBindings(effects, targets);
    setPostUniforms(effects, targets, settings);
    await prewarm(effects, targets, canvasSurface);
    if (disposed) return false;
    observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(canvas);
    measure();
    if (animate) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerout", onPointerOut, { passive: true });
      window.addEventListener("blur", recenterPointer);
      document.addEventListener("visibilitychange", onVisibilityChange);
      if (typeof IntersectionObserver !== "undefined") {
        intersection = new IntersectionObserver(
          (entries) => {
            canvasIntersecting = entries[entries.length - 1]?.isIntersecting ?? canvasIntersecting;
            reconcileLoop();
          },
          { threshold: 0 },
        );
        intersection.observe(canvas);
      }
      started = true;
      documentVisible = !document.hidden;
      reconcileLoop();
    } else {
      current.divergence = state.divergence;
      current.violation = state.violation;
      renderOnce();
    }
    return true;
  };

  const ready = initialize().catch(() => {
    if (!disposed) dispose();
    return false;
  });

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
    dispose,
  };
}

function clockMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
