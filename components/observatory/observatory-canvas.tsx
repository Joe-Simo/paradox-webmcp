"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { LensRenderer, LensState } from "./lens-renderer";

export function ObservatoryCanvas({ divergence, violation }: LensState) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LensRenderer | null>(null);
  const stateRef = useRef<LensState>({ divergence, violation });
  const [live, setLive] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    stateRef.current = { divergence, violation };
    rendererRef.current?.setState(stateRef.current);
  }, [divergence, violation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof navigator === "undefined" || !("gpu" in navigator)) return;

    let cancelled = false;
    let renderer: LensRenderer | null = null;
    let observer: IntersectionObserver | null = null;
    let intersecting = true;
    const stage = canvas.parentElement;

    const syncActivity = () => {
      if (!renderer) return;
      if (intersecting && !document.hidden) renderer.start();
      else renderer.stop();
    };

    const onVisibility = () => syncActivity();
    const onPointerMove = (event: PointerEvent) => {
      if (!stage || !renderer) return;
      const rect = stage.getBoundingClientRect();
      renderer.setPointer(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1,
      );
    };

    void import("./lens-renderer").then((module) => {
      if (cancelled) return;
      renderer = module.createLensRenderer(canvas, !reduceMotion);
      rendererRef.current = renderer;
      renderer.setState(stateRef.current);
      void renderer.ready.then((ok) => {
        if (!cancelled && ok) setLive(true);
      });
      if (!reduceMotion) {
        observer = new IntersectionObserver((entries) => {
          intersecting = entries[0]?.isIntersecting ?? true;
          syncActivity();
        }, { threshold: 0.04 });
        observer.observe(canvas);
        document.addEventListener("visibilitychange", onVisibility);
        stage?.addEventListener("pointermove", onPointerMove);
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stage?.removeEventListener("pointermove", onPointerMove);
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} className={`aperture-lens${live ? " is-live" : ""}`} aria-hidden="true" />;
}
