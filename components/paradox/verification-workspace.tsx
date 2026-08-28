"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleAlert, CircleStop, LoaderCircle, RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useParadoxStore } from "@/stores/paradox-store";
import { verifyRepairService } from "@/stores/services";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function VerificationWorkspace() {
  const hydrated = useParadoxStore((state) => state.hydrated);
  const verification = useParadoxStore((state) => state.verification);
  const exploring = useParadoxStore((state) => state.exploring);
  const progress = useParadoxStore((state) => state.progress);
  const guardMode = useParadoxStore((state) => state.session.ledger.guardMode);
  const finding = useParadoxStore((state) => state.finding);
  const notice = useParadoxStore((state) => state.notice);
  const reduceMotion = useReducedMotion();

  if (!hydrated) {
    return <main id="main-content" className="missing-state" tabIndex={-1} aria-busy="true"><LoaderCircle className="animate-spin" aria-hidden="true" /><h1>Restoring Verification</h1><p>Loading the stored counterexample and runtime strategy.</p></main>;
  }

  if (!finding || guardMode !== "versioned") {
    return <main id="main-content" className="missing-state" tabIndex={-1}><CircleAlert aria-hidden="true" /><h1>Verification Unavailable</h1><p>Compute a counterexample and apply its version guard before replaying the repair.</p><Link className={buttonVariants()} href="/lab/expense-approval">Return to Exploration <ArrowRight aria-hidden="true" /></Link></main>;
  }

  return (
    <main id="main-content" className="verification-page" tabIndex={-1}>
      <header className="verification-heading">
        <span className="section-label">Same path. New semantics.</span>
        <h1>The dangerous future<br />{" "}meets the guard.</h1>
        <p>Paradox first replays the exact stored counterexample, then reopens the complete bounded state space.</p>
        <Button size="lg" onClick={() => void verifyRepairService().catch(() => undefined)} disabled={exploring}>
          {exploring ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCw className="size-4" aria-hidden="true" />}
          {exploring ? `Re-exploring… ${progress} states` : verification ? "Run Verification Again" : "Verify Repair"}
        </Button>
      </header>

      <section className={`replay-track${verification?.verified ? " replay-track-verified" : ""}`} aria-label="Exact counterexample replay">
        <motion.div className="replay-path-sweep" aria-hidden="true" initial={reduceMotion ? false : { scaleX: 0 }} animate={{ scaleX: verification ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.65, 0, 0.35, 1] }} />
        <div className="replay-step actor-agent"><span>A1</span><strong>Inspect v{finding?.believed.version ?? "—"}</strong><code>{finding ? money.format(finding.believed.amountCents / 100) : "Awaiting finding"}</code></div>
        <div className="replay-line" />
        <div className="replay-step actor-human"><span>H1</span><strong>Edit to v{finding?.changed.version ?? "—"}</strong><code>{finding ? money.format(finding.changed.amountCents / 100) : "Awaiting finding"}</code></div>
        <div className="replay-line" />
        <div className="replay-step actor-agent"><span>A2</span><strong>Approve expecting v{finding?.believed.version ?? "—"}</strong><code>{finding ? `review_expense_481_v${finding.believed.version}` : "Awaiting finding"}</code></div>
        <motion.div className="guard-stop" animate={verification && !reduceMotion ? { scale: [0.96, 1.025, 1] } : {}} transition={{ duration: 0.3 }}>
          <CircleStop aria-hidden="true" />
          <div><span>Semantic guard</span><strong>{verification ? verification.exactReplay.code : "Awaiting replay"}</strong></div>
        </motion.div>
      </section>

      {verification?.verified && (
        <section className="verification-result" aria-live="polite">
          <div className="verification-statement"><Check aria-hidden="true" /><div><span>Computed result</span><h2>Counterexample eliminated within the explored model.</h2><p>No claim of universal safety is made.</p></div></div>
          <div className="verification-metrics">
            <div><span>Exact counterexample</span><strong>{verification.exactReplay.blocked ? "Blocked" : "Survived"}</strong></div>
            <div><span>Schedules explored</span><strong>{verification.exploration.schedulesExplored.toLocaleString()}</strong></div>
            <div><span>Unique states</span><strong>{verification.exploration.uniqueStatesReached.toLocaleString()}</strong></div>
            <div><span>Counterexamples after guard</span><strong>{verification.exploration.counterexamples}</strong></div>
          </div>
        </section>
      )}
      {verification && !verification.verified && (
        <section className="verification-failure" role="alert">
          <CircleStop aria-hidden="true" />
          <div><span>Verification failed</span><h2>The counterexample still survives this bounded model.</h2><p>Exact replay: {verification.exactReplay.code}. Surviving counterexamples: {verification.exploration.counterexamples}.</p></div>
        </section>
      )}
      {notice && <p role="alert" aria-live="polite" className="inline-notice">{notice}</p>}
    </main>
  );
}
