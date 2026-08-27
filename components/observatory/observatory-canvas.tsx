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

    void import("./lens-renderer").then((module) => {
      if (cancelled) return;
      renderer = module.createLensRenderer(canvas, !reduceMotion);
      rendererRef.current = renderer;
      renderer.setState(stateRef.current);
      void renderer.ready.then((ok) => {
        if (!cancelled && ok) setLive(true);
      });
    });

    return () => {
      cancelled = true;
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} className={`aperture-lens${live ? " is-live" : ""}`} aria-hidden="true" />;
}
