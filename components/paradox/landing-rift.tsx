"use client";

import { useState } from "react";
import { Bot, CircleAlert, Diamond, Orbit } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
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
  "Counterexamples found",
] as const;

function ActorMark({ actor }: { actor: (typeof steps)[number]["actor"] }) {
  if (actor === "agent") return <Bot aria-hidden="true" />;
  if (actor === "human") return <Orbit aria-hidden="true" />;
  return <Diamond aria-hidden="true" />;
}

export function LandingRift({ preview }: { preview: GoldenPreview }) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(3);
  const hasChanged = phase >= 1;
  const isCrossing = phase >= 2;
  const isViolation = phase >= 3;
  const crossingDuration = reduceMotion ? 0 : isCrossing ? 0.62 : 0.16;

  return (
    <figure
      className="temporal-aperture"
      data-phase={phase}
      aria-labelledby="aperture-title"
      aria-describedby="aperture-description"
    >
      <figcaption id="aperture-title" className="aperture-header">
        <span><i aria-hidden="true" /> Computed counterexample</span>
        <code>{preview.scheduleId}</code>
      </figcaption>
      <p id="aperture-description" className="sr-only">
        An interactive comparison of the state the agent reviewed and the state the system committed. Select any semantic step to inspect the divergence.
      </p>

      <div className="aperture-stage">
        <div className="aperture-grid" aria-hidden="true" />
        <motion.div
          className="aperture-signal aperture-signal-human"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: hasChanged ? 1 : 0, scaleX: hasChanged ? 1 : 0.2 }}
          transition={{ duration: reduceMotion ? 0 : hasChanged ? 0.36 : 0.16, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="aperture-signal aperture-signal-danger"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: isViolation ? 1 : 0, scaleY: isViolation ? 1 : 0.2 }}
          transition={{ duration: reduceMotion ? 0 : isViolation ? 0.42 : 0.14, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.section
          className="aperture-state aperture-belief"
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Agent belief"
        >
          <div className="aperture-state-heading">
            <span className="actor-symbol actor-symbol-agent"><Bot aria-hidden="true" /></span>
            <span>Agent believed</span>
            <code>review v{preview.believed.version}</code>
          </div>
          <strong>{money.format(preview.believed.amountCents / 100)}</strong>
          <div className="aperture-state-meta"><span>Inspected state</span><code>version {preview.believed.version}</code></div>
        </motion.section>

        <div className={`aperture-seam ${isViolation ? "is-violated" : ""}`} aria-hidden="true">
          <span>temporal divergence</span>
        </div>

        <motion.section
          className={`aperture-state aperture-reality ${hasChanged ? "has-changed" : ""} ${isViolation ? "is-violated" : ""}`}
          initial={reduceMotion ? false : { opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Live system state"
        >
          <div className="aperture-state-heading">
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
          <div className="aperture-state-meta"><span>{isViolation ? "Approved state" : "Current state"}</span><code>version {hasChanged ? preview.changed.version : preview.believed.version}</code></div>
        </motion.section>

        <motion.div
          className={`stale-approval ${isViolation ? "is-violated" : ""}`}
          initial={false}
          animate={{ left: isCrossing ? "57%" : "27%", opacity: isCrossing ? 1 : 0 }}
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
      </div>

      <div className="aperture-steps" aria-label="Counterexample steps">
        {steps.map((step, index) => (
          <Button
            key={step.label}
            type="button"
            variant="tertiary"
            className="aperture-step"
            aria-pressed={phase === index}
            onClick={() => setPhase(index)}
            onFocus={() => setPhase(index)}
          >
            <span className={`aperture-step-mark actor-symbol-${step.actor}`}><ActorMark actor={step.actor} /></span>
            <span><small>0{index + 1}</small><strong>{step.label}</strong><code>{step.detail}</code></span>
          </Button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">{phaseAnnouncements[phase]}</p>
      <div className={`aperture-footer ${isViolation ? "is-violated" : ""}`}>
        <span>{isViolation ? "Unsafe future found" : `Step ${phase + 1} of 4`}</span>
        <strong>{isViolation ? `${preview.counterexamples} counterexamples` : phaseSummaries[phase]}</strong>
        <code>{preview.schedulesExplored} schedules · {preview.uniqueStatesReached} states</code>
      </div>
    </figure>
  );
}

function ArrowSignal() {
  return (
    <svg viewBox="0 0 36 8" aria-hidden="true">
      <path d="M0 4h34M30 1l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
