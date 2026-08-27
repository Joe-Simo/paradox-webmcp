"use client";

import Link from "next/link";
import { ArrowRight, Atom, GitMerge, LoaderCircle, ScanSearch } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MultiverseCanvas } from "./multiverse-canvas";
import { useParadoxStore } from "@/stores/paradox-store";
import { exploreFuturesService } from "@/stores/services";
import { hasRecordedRace } from "@/domain/ledger/model";
import { VerificationWorkspace } from "./verification-workspace";

export function ExplorationWorkspace() {
  const hydrated = useParadoxStore((state) => state.hydrated);
  const run = useParadoxStore((state) => state.run);
  const exploring = useParadoxStore((state) => state.exploring);
  const progress = useParadoxStore((state) => state.progress);
  const notice = useParadoxStore((state) => state.notice);
  const session = useParadoxStore((state) => state.session);
  const finding = useParadoxStore((state) => state.finding);
  const completeTrace = hasRecordedRace(session);

  if (finding && session.ledger.guardMode === "versioned") return <VerificationWorkspace />;

  return (
      <main id="main-content" className={`lab-grid ${run ? "lab-grid-has-run" : ""}`} tabIndex={-1}>
      <section className="lab-heading">
        <div>
          <span className="section-label">Bounded semantic exploration</span>
          <h1>Explore every future<br />{" "}before your users do.</h1>
        </div>
        <div className="lab-action">
          <p>Paradox interleaves the recorded human and agent operations, merges equivalent states, and evaluates each commit.</p>
          <Button size="lg" onClick={() => void exploreFuturesService().catch(() => undefined)} disabled={!hydrated || exploring || !completeTrace}>
            {exploring ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
            {exploring ? `Exploring… ${progress} states` : "Explore Futures"}
          </Button>
        </div>
      </section>

      {!completeTrace && !run && (
        <section className="record-required">
          <Atom aria-hidden="true" />
          <div><strong>The semantic trace is incomplete.</strong><p>Record inspect, edit, and approve in the instrumented fixture first.</p></div>
          <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/lab/expense-approval/ledger">Open Fixture <ArrowRight aria-hidden="true" /></Link>
        </section>
      )}

      {run ? (
        <>
          <section className="results-header" aria-live="polite">
            <div><span>Exploration result</span><strong>{run.finding ? "A stale belief crossed a commit boundary." : "No counterexample survived."}</strong></div>
            <code>{run.id}</code>
          </section>
          <MultiverseCanvas run={run} />
          <section className="metrics-strip" aria-label="Computed exploration metrics">
            <div><span>Schedules explored</span><strong>{run.schedulesExplored.toLocaleString()}</strong></div>
            <div><span>Unique states</span><strong>{run.uniqueStatesReached.toLocaleString()}</strong></div>
            <div><span>Equivalent branches merged</span><strong>{run.equivalentBranchesMerged.toLocaleString()}</strong></div>
            <div className={run.counterexamples > 0 ? "metric-danger" : ""}><span>Counterexamples</span><strong>{run.counterexamples.toLocaleString()}</strong></div>
          </section>
          {run.finding && (
            <section className="finding-callout">
              <div className="finding-symbol" aria-hidden="true"><GitMerge /></div>
              <div><span>Shortest computed failure · {run.finding.minimization.originalMicroSteps} → {run.finding.minimization.retainedSemanticSteps} steps</span><strong>{run.finding.semanticSequence.join(" → ")}</strong><p>{run.finding.violation.explanation}</p></div>
              <Link className={buttonVariants({ variant: "error" })} href={`/lab/expense-approval/finding/${run.finding.id}`}>Focus Counterexample <ArrowRight aria-hidden="true" /></Link>
            </section>
          )}
        </>
      ) : (
        <section className="empty-canvas">
          <div className="empty-orbit"><span /><span /><span /></div>
          <h2>Time is still folded.</h2>
          <p>Select Explore Futures to interleave the recorded human and agent operations and reveal every ordering.</p>
        </section>
      )}
      {notice && <p role="alert" aria-live="polite" className="inline-notice lab-notice">{notice}</p>}
    </main>
  );
}
