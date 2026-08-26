"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Braces, CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useParadoxStore } from "@/stores/paradox-store";
import { applyVersionGuardService } from "@/stores/services";
import { VerificationWorkspace } from "./verification-workspace";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function FindingFocus({ findingId }: { findingId: string }) {
  const router = useRouter();
  const hydrated = useParadoxStore((state) => state.hydrated);
  const finding = useParadoxStore((state) => state.finding);
  const guardMode = useParadoxStore((state) => state.session.ledger.guardMode);
  if (!hydrated) {
    return <main id="main-content" className="missing-state" tabIndex={-1} aria-busy="true"><LoaderCircle className="animate-spin" aria-hidden="true" /><h1>Restoring the Finding</h1><p>Loading its exact semantic trace.</p></main>;
  }
  if (!finding || finding.id !== findingId) {
    return <main id="main-content" className="missing-state" tabIndex={-1}><CircleAlert aria-hidden="true" /><h1>Finding Unavailable</h1><p>This URL does not match the active computed counterexample.</p><Link className={buttonVariants()} href="/lab/expense-approval">Return to Exploration <ArrowRight aria-hidden="true" /></Link></main>;
  }
  if (guardMode === "versioned") return <VerificationWorkspace />;

  const apply = async () => {
    await applyVersionGuardService();
    router.push("/lab/expense-approval/verified");
  };

  return (
    <main id="main-content" className="finding-page" tabIndex={-1}>
      <header className="finding-header">
        <span className="section-label">Shortest counterexample / {finding.scheduleId}</span>
        <h1>The agent approved a state<br />{" "}it never reviewed.</h1>
        <p>{finding.violation.explanation}</p>
      </header>
      <section className="temporal-planes" aria-label="Observed, changed, and committed states">
        <article className="plane plane-agent"><span>Observed</span><div className="plane-marker">A</div><strong>{money.format(finding.believed.amountCents / 100)}</strong><code>version {finding.believed.version}</code><p>Agent belief became fixed in the review token.</p></article>
        <article className="plane plane-human"><span>Changed</span><div className="plane-marker">H</div><strong>{money.format(finding.changed.amountCents / 100)}</strong><code>version {finding.changed.version}</code><p>The human changed canonical state.</p></article>
        <article className="plane plane-system"><span>Committed</span><div className="plane-marker">S</div><strong>{money.format(finding.committed.amountCents / 100)}</strong><code>approved · version {finding.committed.version}</code><p>The unsafe tool committed without semantic equality.</p></article>
      </section>
      <section className="invariant-failure">
        <CircleAlert aria-hidden="true" />
        <div><span>Invariant violated</span><strong>currentExpense.version === reviewedExpense.version</strong><p>{finding.violation.title}</p></div>
      </section>
      <section className="minimized-sequence" aria-labelledby="minimized-title">
        <div>
          <span className="section-label">Automatic minimization</span>
          <h2 id="minimized-title">{finding.minimization.originalMicroSteps} machine steps reduced to {finding.minimization.retainedSemanticSteps} essential operations.</h2>
        </div>
        <ol>
          {finding.minimizedTrace.map((step, index) => (
            <li key={step.stepId}><span>{index + 1}</span><strong>{step.action}</strong><code>{step.stateHash}</code></li>
          ))}
        </ol>
      </section>
      <section className="repair-panel">
        <div className="repair-copy"><span className="section-label">Constrained repair</span><h2>Require the version the agent actually inspected.</h2><p>Paradox changes this instrumented lab’s runtime strategy. It does not claim arbitrary source rewriting.</p></div>
        <div className="repair-code">
          <div className="code-block-header"><span><Braces aria-hidden="true" />guarded-approval.ts</span><span>TypeScript</span></div>
          <pre aria-label="Version guard implementation" tabIndex={0}><code>{`if (expense.version !== expectedVersion) {
  return {
    ok: false,
    code: "STATE_CHANGED",
    message: "The expense changed after inspection."
  };
}`}</code></pre>
        </div>
        <Button size="lg" onClick={() => void apply().catch(() => undefined)}>Apply Version Guard <ArrowRight className="size-4" aria-hidden="true" /></Button>
      </section>
    </main>
  );
}
