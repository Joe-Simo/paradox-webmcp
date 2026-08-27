"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { ObservatoryCanvas } from "@/components/observatory/observatory-canvas";
import type { LensState } from "@/components/observatory/lens-renderer";
import type { GoldenPreview } from "@/paradox/explorer/golden-preview";

const AUTOPLAY_STEP_MS = 2600;
const ARRIVAL_FALLBACK_MS = 1400;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const steps = ["Inspect", "Change", "Approve", "Commit"] as const;

const phaseAnnouncements = [
  "Agent inspected 2,399 dollars at version 7 and created a version 7 review.",
  "Human changed the live expense to 23,999 dollars and version 8. The agent belief remains at version 7.",
  "Agent attempts approval using the stale version 7 review while the live expense is version 8.",
  "System commits the version 8 expense at 23,999 dollars. The reviewed-version invariant is violated.",
] as const;

const lensByPhase = [
  { divergence: 0.1, violation: 0 },
  { divergence: 0.5, violation: 0 },
  { divergence: 0.8, violation: 0 },
  { divergence: 1, violation: 1 },
] as const;

// The journey drains the violation back out of the universe: crimson while
// the race and its counterexamples stand, monochrome again once the guard
// holds. Anchors are act positions along the scene scroll.
const journeyAnchors: Array<{ at: number; state: LensState }> = [
  { at: 0, state: { divergence: 1, violation: 1 } },
  { at: 0.28, state: { divergence: 1, violation: 1 } },
  { at: 0.55, state: { divergence: 0.85, violation: 0.9 } },
  { at: 0.78, state: { divergence: 0.6, violation: 0.28 } },
  { at: 1, state: { divergence: 0.22, violation: 0 } },
];

function journeyState(progress: number): LensState {
  let previous = journeyAnchors[0];
  for (const anchor of journeyAnchors) {
    if (progress <= anchor.at) {
      const span = Math.max(anchor.at - previous.at, 0.0001);
      const t = (progress - previous.at) / span;
      return {
        divergence: previous.state.divergence + (anchor.state.divergence - previous.state.divergence) * t,
        violation: previous.state.violation + (anchor.state.violation - previous.state.violation) * t,
      };
    }
    previous = anchor;
  }
  return journeyAnchors[journeyAnchors.length - 1].state;
}

function GravityLink({ href, onClick, children, className, reduce }: {
  href: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
  className?: string;
  reduce: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 22 });
  const sy = useSpring(y, { stiffness: 260, damping: 22 });

  const pull = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    x.set(Math.max(-7, Math.min(7, dx * 0.12)));
    y.set(Math.max(-5, Math.min(5, dy * 0.18)));
  };
  const release = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <span className="gravity-well" onPointerMove={pull} onPointerLeave={release}>
      <motion.span style={{ x: sx, y: sy, display: "inline-flex" }}>
        <Link className={className} href={href} onClick={onClick}>{children}</Link>
      </motion.span>
    </span>
  );
}

export function Observatory({ preview }: { preview: GoldenPreview }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const [phase, setPhase] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [exiting, setExiting] = useState(false);
  const interacted = useRef(false);
  const scrolled = useRef(false);
  const driveRef = useRef<((state: LensState) => void) | null>(null);
  const scenesRef = useRef<HTMLDivElement>(null);

  const believed = money.format(preview.believed.amountCents / 100);
  const changed = money.format(preview.changed.amountCents / 100);

  const phaseStatus = [
    `The agent inspects ${believed} · v${preview.believed.version}`,
    `The human changes it to ${changed} · v${preview.changed.version}`,
    `The agent approves from its stale v${preview.believed.version} review`,
    `${changed} committed from a v${preview.believed.version} review — invariant violated`,
  ] as const;

  const scenes = [
    {
      act: "Act 01 — Record",
      title: "The race is real.",
      body: `Play it yourself: inspect as the agent from ChatGPT, change the amount as the human, then complete the stale review. Every semantic operation is recorded.`,
      datum: `${believed} · v${preview.believed.version} → ${changed} · v${preview.changed.version}`,
      tools: ["inspect_expense", "approve_reviewed_expense"],
    },
    {
      act: "Act 02 — Explore",
      title: "Every ordering, explored.",
      body: "Paradox then tries every ordering of the recorded actions — a bounded model checker — and evaluates each committed state against rules that must always hold, like approved amount = reviewed amount.",
      datum: `${preview.schedulesExplored} schedules · ${preview.counterexamples} counterexamples`,
      tools: ["explore_futures"],
    },
    {
      act: "Act 03 — Repair",
      title: "The guard goes in.",
      body: "The failing ordering is minimized to three essential operations, then a semantic version guard is applied to the approval implementation.",
      datum: "9 microsteps → 3 essential operations",
      tools: ["inspect_counterexample", "apply_version_guard"],
    },
    {
      act: "Act 04 — Verify",
      title: "The color leaves the universe.",
      body: "The counterexample — the shortest failing sequence — replays as blocked with STATE_CHANGED, and the full bounded space re-explores to zero counterexamples.",
      datum: "STATE_CHANGED · 0 counterexamples survive",
      tools: ["verify_repair"],
    },
  ];

  // Arrival: the universe ignites first, then the words. A fallback timer
  // covers browsers where the render never comes up.
  useEffect(() => {
    const timer = setTimeout(() => setArrived(true), reduceMotion ? 0 : ARRIVAL_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!arrived) return;
    if (reduceMotion) {
      const jump = setTimeout(() => {
        if (!interacted.current) setPhase(3);
      }, 0);
      return () => clearTimeout(jump);
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
  }, [arrived, reduceMotion]);

  const selectPhase = (index: number) => {
    interacted.current = true;
    setPhase(index);
  };

  // Scroll journey: scenes drive the uniforms directly on the renderer.
  const { scrollYProgress } = useScroll({ target: scenesRef, offset: ["start 0.85", "end end"] });
  const stripOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0]);
  const push = useTransform(scrollYProgress, [0, 1], [1, 1.07]);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (value) => {
      if (value <= 0.001) {
        if (scrolled.current) {
          scrolled.current = false;
          driveRef.current?.(lensByPhase[3]);
        }
        return;
      }
      if (!scrolled.current) {
        scrolled.current = true;
        interacted.current = true;
      }
      driveRef.current?.(journeyState(value));
    });
    return unsubscribe;
  }, [scrollYProgress]);

  const exitToLab = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduceMotion || exiting) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setExiting(true);
    setTimeout(() => router.push("/lab/expense-approval/ledger"), 520);
  };

  useEffect(() => {
    router.prefetch("/lab/expense-approval/ledger");
  }, [router]);

  const reveal = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 18 },
    animate: arrived ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <>
      <div className="observatory-stage">
        <motion.div className="stage-canvas" style={reduceMotion ? undefined : { scale: push }}>
          <ObservatoryCanvas
            divergence={lensByPhase[phase].divergence}
            violation={lensByPhase[phase].violation}
            onReady={(drive) => {
              driveRef.current = drive;
              setArrived(true);
            }}
          />
        </motion.div>
        <motion.div className="observatory-hero" style={reduceMotion ? undefined : { opacity: heroOpacity }}>
          <div className="hero-copy">
            <motion.h1 {...reveal(0.1)}>Explore every future<br />{" "}before your users do.</motion.h1>
            <motion.p {...reveal(0.32)}>An agent read {believed}. A human changed it to {changed}. The agent approved it anyway. Paradox finds these races — and proves the fix.</motion.p>
            <motion.div className="hero-actions" {...reveal(0.5)}>
              <GravityLink className={buttonVariants({ size: "lg" })} href="/lab/expense-approval/ledger" onClick={exitToLab} reduce={reduceMotion}>
                Run the race <ArrowRight aria-hidden="true" />
              </GravityLink>
              <a className="hero-text-link" href="#how-it-works">How it works</a>
            </motion.div>
          </div>
        </motion.div>
        <motion.div className="observatory-steps" style={reduceMotion ? undefined : { opacity: stripOpacity }} {...reveal(0.66)}>
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
                <i className={`obs-step-dot${index === 3 ? " is-violation" : ""}`} aria-hidden="true" />
                <small aria-hidden="true">0{index + 1}</small>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className={`obs-status ${phase >= 3 ? "is-violated" : ""}`} aria-live="polite">
            {phaseStatus[phase]}
            <span className="sr-only"> {phaseAnnouncements[phase]}</span>
          </p>
        </motion.div>
      </div>

      <div className="journey-scenes" id="how-it-works" ref={scenesRef}>
        {scenes.map((scene) => (
          <section key={scene.act} className="journey-scene" aria-label={scene.act}>
            <motion.article
              className="scene-card"
              initial={reduceMotion ? false : { opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="act-index">{scene.act}</span>
              <h2>{scene.title}</h2>
              <p>{scene.body}</p>
              <p className="scene-datum"><code>{scene.datum}</code></p>
              <p className="act-tools">{scene.tools.map((tool) => <code key={tool}>{tool}</code>)}</p>
            </motion.article>
          </section>
        ))}
      </div>

      <AnimatePresence>
        {exiting && (
          <motion.div
            className="lab-iris"
            initial={{ clipPath: "circle(0% at 66% 46%)" }}
            animate={{ clipPath: "circle(142% at 66% 46%)" }}
            transition={{ duration: 0.52, ease: [0.65, 0, 0.35, 1] }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </>
  );
}
