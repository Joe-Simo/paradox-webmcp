"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CircleAlert, Diamond, Orbit } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { ObservatoryCanvas } from "@/components/observatory/observatory-canvas";
import type { GoldenPreview } from "@/paradox/explorer/golden-preview";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const steps = [
  { actor: "agent", label: "Inspect", detail: "$2,399 · v7" },
  { actor: "human", label: "Change", detail: "$23,999 · v8" },
  { actor: "agent", label: "Approve", detail: "review · v7" },
  { actor: "system", label: "Commit", detail: "approved · v8" },
] as const;

const phaseAnnouncements = [
  "Agent inspected 2,399 dollars at version 7 and created a version 7 review.",
  "Human changed the live expense to 23,999 dollars and version 8. The agent belief remains at version 7.",
  "Agent attempts approval using the stale version 7 review while the live expense is version 8.",
  "System commits the version 8 expense at 23,999 dollars. The reviewed-version invariant is violated.",
] as const;

const phaseSummaries = [
  "Review token bound to version 7",
  "Live state diverged by one version",
  "Stale belief crossed the seam",
  "Unsafe future found",
] as const;

const lensByPhase = [
  { divergence: 0.14, violation: 0 },
  { divergence: 0.55, violation: 0 },
  { divergence: 0.85, violation: 0 },
  { divergence: 1, violation: 1 },
] as const;

function ActorMark({ actor }: { actor: (typeof steps)[number]["actor"] }) {
  if (actor === "agent") return <Bot aria-hidden="true" />;
  if (actor === "human") return <Orbit aria-hidden="true" />;
  return <Diamond aria-hidden="true" />;
}

export function Observatory({ preview }: { preview: GoldenPreview }) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(3);
  const hasChanged = phase >= 1;
  const isCrossing = phase >= 2;
  const isViolation = phase >= 3;
  const crossingDuration = reduceMotion ? 0 : isCrossing ? 0.62 : 0.16;

  return (
    <>
      <ObservatoryCanvas divergence={lensByPhase[phase].divergence} violation={lensByPhase[phase].violation} />
      <div className="observatory-hero">
        <div className="hero-copy">
          <span className="section-label">Model checking / Human + Agent / One live state</span>
          <h1>Explore every future<br />{" "}before your users do.</h1>
          <p>Paradox is a live WebMCP app where a ChatGPT agent and a human operate the same expense ledger. A bounded model checker then explores every ordering of their actions and returns the exact race that corrupts state.</p>
          <div className="hero-actions">
            <Link className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger">Run the race <ArrowRight aria-hidden="true" /></Link>
            <Link className="hero-text-link" href="/docs">How it works</Link>
          </div>
          <p className="hero-proof"><span>{preview.schedulesExplored} schedules</span><span>{preview.uniqueStatesReached} states</span><span>{preview.counterexamples} counterexamples</span><span>Computed, not scripted</span></p>
        </div>

        <figure className="observatory-field" aria-labelledby="aperture-title" aria-describedby="aperture-description">
          <figcaption id="aperture-title" className="field-caption">
            <span><i aria-hidden="true" /> Computed counterexample</span>
            <code>{preview.scheduleId}</code>
          </figcaption>
          <p id="aperture-description" className="sr-only">
            An interactive comparison of the state the agent reviewed and the state the system committed. Select any semantic step to inspect the divergence.
          </p>

          <motion.section
            className="obs-state obs-belief"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Agent belief"
          >
            <div className="obs-state-heading">
              <span className="actor-symbol actor-symbol-agent"><Bot aria-hidden="true" /></span>
              <span>Agent believed</span>
              <code>review v{preview.believed.version}</code>
            </div>
            <strong>{money.format(preview.believed.amountCents / 100)}</strong>
            <div className="obs-state-meta"><span>Inspected state</span><code>version {preview.believed.version}</code></div>
          </motion.section>

          <motion.section
            className={`obs-state obs-reality ${hasChanged ? "has-changed" : ""} ${isViolation ? "is-violated" : ""}`}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Live system state"
          >
            <div className="obs-state-heading">
              <span className={`actor-symbol ${isViolation || !hasChanged ? "actor-symbol-system" : "actor-symbol-human"}`}>
                {isViolation || !hasChanged ? <Diamond aria-hidden="true" /> : <Orbit aria-hidden="true" />}
              </span>
              <span>{isViolation ? "System approved" : hasChanged ? "Human changed" : "Live state"}</span>
              <code>{isViolation ? "committed" : "current"}</code>
            </div>
            <motion.strong
              key={hasChanged ? preview.changed.amountCents : preview.believed.amountCents}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {money.format((hasChanged ? preview.changed.amountCents : preview.believed.amountCents) / 100)}
            </motion.strong>
            <div className="obs-state-meta"><span>{isViolation ? "Approved state" : "Current state"}</span><code>version {hasChanged ? preview.changed.version : preview.believed.version}</code></div>
          </motion.section>

          <motion.div
            className={`stale-approval ${isViolation ? "is-violated" : ""}`}
            initial={false}
            animate={{ left: isCrossing ? "56%" : "18%", opacity: isCrossing ? 1 : 0 }}
            transition={{ duration: crossingDuration, ease: [0.65, 0, 0.35, 1] }}
            aria-hidden="true"
          >
            <Bot />
            <span>approve from review v{preview.believed.version}</span>
            <ArrowSignal />
          </motion.div>

          <motion.div
            className="aperture-verdict"
            initial={false}
            animate={{ opacity: isViolation ? 1 : 0, y: isViolation ? 0 : 8 }}
            transition={{ duration: reduceMotion ? 0 : isViolation ? 0.26 : 0.12, delay: reduceMotion || !isViolation ? 0 : 0.22 }}
            aria-hidden={!isViolation}
          >
            <CircleAlert aria-hidden="true" />
            <span>Invariant violated</span>
            <strong>{preview.invariantId}</strong>
          </motion.div>
        </figure>
      </div>

      <div className="observatory-steps" aria-label="Counterexample steps">
        <div className="observatory-steps-row">
          {steps.map((step, index) => (
            <button
              key={step.label}
              type="button"
              className="obs-step"
              aria-pressed={phase === index}
              onClick={() => setPhase(index)}
              onFocus={() => setPhase(index)}
            >
              <span className={`obs-step-mark actor-symbol-${step.actor}`}><ActorMark actor={step.actor} /></span>
              <span className="obs-step-copy"><small>0{index + 1}</small><strong>{step.label}</strong><code>{step.detail}</code></span>
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{phaseAnnouncements[phase]}</p>
        <div className={`obs-status ${isViolation ? "is-violated" : ""}`}>
          <strong>{isViolation ? `${phaseSummaries[3]} — ${preview.counterexamples} counterexamples` : `Step ${phase + 1} of 4 — ${phaseSummaries[phase]}`}</strong>
          <code>{preview.schedulesExplored} schedules · {preview.uniqueStatesReached} states</code>
        </div>
      </div>
    </>
  );
}

function ArrowSignal() {
  return (
    <svg viewBox="0 0 36 8" aria-hidden="true">
      <path d="M0 4h34M30 1l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
