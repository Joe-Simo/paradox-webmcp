"use client";

import { Check, CircleStop, LoaderCircle, RotateCw } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useParadoxStore } from "@/stores/paradox-store";
import { verifyRepairService } from "@/stores/services";

export function VerificationWorkspace() {
  const hydrated = useParadoxStore((state) => state.hydrated);
  const verification = useParadoxStore((state) => state.verification);
  const exploring = useParadoxStore((state) => state.exploring);
  const progress = useParadoxStore((state) => state.progress);
  const guardMode = useParadoxStore((state) => state.session.ledger.guardMode);

  return (
    <main className="verification-page">
      <header className="verification-heading">
        <span className="section-label">Same path. New semantics.</span>
        <h1>The dangerous future<br />meets the guard.</h1>
        <p>Paradox first replays the exact stored counterexample, then reopens the complete bounded state space.</p>
        <Button size="lg" onClick={() => void verifyRepairService()} disabled={!hydrated || exploring || guardMode !== "versioned"}>
          {exploring ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
          {exploring ? `Re-exploring · ${progress}` : "Verify repair"}
        </Button>
      </header>

      <section className="replay-track" aria-label="Exact counterexample replay">
        <div className="replay-step actor-agent"><span>A1</span><strong>Inspect v7</strong><code>$2,399</code></div>
        <div className="replay-line" />
        <div className="replay-step actor-human"><span>H1</span><strong>Edit to v8</strong><code>$23,999</code></div>
        <div className="replay-line" />
        <div className="replay-step actor-agent"><span>A2</span><strong>Approve expecting v7</strong><code>review_expense_481_v7</code></div>
        <motion.div className="guard-stop" animate={verification ? { scale: [0.92, 1.06, 1] } : {}}>
          <CircleStop />
          <div><span>Semantic guard</span><strong>{verification ? verification.exactReplay.code : "Awaiting replay"}</strong></div>
        </motion.div>
      </section>

      {verification && (
        <section className="verification-result">
          <div className="verification-statement"><Check /><div><span>Computed result</span><h2>Counterexample eliminated within the explored model.</h2><p>No claim of universal safety is made.</p></div></div>
          <div className="verification-metrics">
            <div><span>Exact counterexample</span><strong>{verification.exactReplay.blocked ? "Blocked" : "Survived"}</strong></div>
            <div><span>Schedules explored</span><strong>{verification.exploration.schedulesExplored.toLocaleString()}</strong></div>
            <div><span>Unique states</span><strong>{verification.exploration.uniqueStatesReached.toLocaleString()}</strong></div>
            <div><span>Counterexamples after guard</span><strong>{verification.exploration.counterexamples}</strong></div>
          </div>
        </section>
      )}
    </main>
  );
}
