"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { ObservatoryCanvas } from "@/components/observatory/observatory-canvas";
import type { GoldenPreview } from "@/paradox/explorer/golden-preview";

const AUTOPLAY_STEP_MS = 2600;

const steps = ["Inspect", "Change", "Approve", "Commit"] as const;

const phaseAnnouncements = [
  "Agent inspected 2,399 dollars at version 7 and created a version 7 review.",
  "Human changed the live expense to 23,999 dollars and version 8. The agent belief remains at version 7.",
  "Agent attempts approval using the stale version 7 review while the live expense is version 8.",
  "System commits the version 8 expense at 23,999 dollars. The reviewed-version invariant is violated.",
] as const;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const lensByPhase = [
  { divergence: 0.1, violation: 0 },
  { divergence: 0.5, violation: 0 },
  { divergence: 0.8, violation: 0 },
  { divergence: 1, violation: 1 },
] as const;

export function Observatory({ preview }: { preview: GoldenPreview }) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const interacted = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      if (!interacted.current) setPhase(3);
      return;
    }
    const timer = setInterval(() => {
      if (interacted.current) {
        clearInterval(timer);
        return;
      }
      setPhase((current) => {
        if (current >= 3) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, AUTOPLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const selectPhase = (index: number) => {
    interacted.current = true;
    setPhase(index);
  };

  const isViolation = phase >= 3;
  const believed = money.format(preview.believed.amountCents / 100);
  const changed = money.format(preview.changed.amountCents / 100);
  const phaseStatus = [
    `The agent inspects ${believed} · v${preview.believed.version}`,
    `The human changes it to ${changed} · v${preview.changed.version}`,
    `The agent approves from its stale v${preview.believed.version} review`,
    `${changed} committed from a v${preview.believed.version} review — invariant violated`,
  ] as const;

  return (
    <>
      <ObservatoryCanvas divergence={lensByPhase[phase].divergence} violation={lensByPhase[phase].violation} />
      <div className="observatory-hero">
        <div className="hero-copy">
          <h1>Explore every future<br />{" "}before your users do.</h1>
          <p>An agent read {believed}. A human changed it to {changed}. The agent approved it anyway. Paradox finds these races — and proves the fix.</p>
          <div className="hero-actions">
            <Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the race <ArrowRight aria-hidden="true" /></Link>
            <a className="hero-text-link" href="#how-it-works">How it works</a>
          </div>
        </div>
      </div>
      <div className="observatory-steps">
        <span className="obs-strip-label">The race</span>
        <div className="observatory-steps-row" role="group" aria-label="The race, step by step">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              className="obs-step"
              aria-pressed={phase === index}
              onClick={() => selectPhase(index)}
              onFocus={() => selectPhase(index)}
            >
              <small aria-hidden="true">0{index + 1}</small>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className={`obs-status ${isViolation ? "is-violated" : ""}`} aria-live="polite">
          {phaseStatus[phase]}
          <span className="sr-only"> {phaseAnnouncements[phase]}</span>
        </p>
      </div>
    </>
  );
}
