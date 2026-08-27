"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ObservatoryCanvas } from "@/components/observatory/observatory-canvas";
import type { GoldenPreview } from "@/paradox/explorer/golden-preview";

const steps = ["Inspect", "Change", "Approve", "Commit"] as const;

const phaseAnnouncements = [
  "Agent inspected 2,399 dollars at version 7 and created a version 7 review.",
  "Human changed the live expense to 23,999 dollars and version 8. The agent belief remains at version 7.",
  "Agent attempts approval using the stale version 7 review while the live expense is version 8.",
  "System commits the version 8 expense at 23,999 dollars. The reviewed-version invariant is violated.",
] as const;

const phaseStatus = [
  "The agent inspects $2,399 · v7",
  "The human changes it to $23,999 · v8",
  "The agent approves from its stale v7 review",
  "$23,999 committed from a v7 review — invariant violated",
] as const;

const lensByPhase = [
  { divergence: 0.1, violation: 0 },
  { divergence: 0.5, violation: 0 },
  { divergence: 0.8, violation: 0 },
  { divergence: 1, violation: 1 },
] as const;

export function Observatory({ preview }: { preview: GoldenPreview }) {
  const [phase, setPhase] = useState(3);
  const isViolation = phase >= 3;

  return (
    <>
      <ObservatoryCanvas divergence={lensByPhase[phase].divergence} violation={lensByPhase[phase].violation} />
      <div className="observatory-hero">
        <div className="hero-copy">
          <h1>Explore every future<br />{" "}before your users do.</h1>
          <p>A ChatGPT agent and a human operate one live app. Paradox explores every ordering of their actions and finds the race that corrupts state.</p>
          <div className="hero-actions">
            <Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the race <ArrowRight aria-hidden="true" /></Link>
            <Link className="hero-text-link" href="/docs">How it works</Link>
          </div>
        </div>
      </div>
      <div className="observatory-steps">
        <div className="observatory-steps-row" role="group" aria-label="Counterexample steps">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              className="obs-step"
              aria-pressed={phase === index}
              onClick={() => setPhase(index)}
              onFocus={() => setPhase(index)}
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
        <p className="hero-proof"><span>{preview.schedulesExplored} schedules</span><span>{preview.uniqueStatesReached} states</span><span>{preview.counterexamples} counterexamples</span><span>Computed, not scripted</span></p>
      </div>
    </>
  );
}
