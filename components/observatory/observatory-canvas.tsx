"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { LensRenderer, LensState } from "./lens-renderer";

type ObservatoryCanvasProps = LensState & {
  onReady?: (drive: (state: LensState) => void) => void;
};

export function ObservatoryCanvas({ divergence, violation, onReady }: ObservatoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LensRenderer | null>(null);
  const stateRef = useRef<LensState>({ divergence, violation });
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
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
        if (cancelled || !ok) return;
        setLive(true);
        onReadyRef.current?.((state) => rendererRef.current?.setState(state));
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
