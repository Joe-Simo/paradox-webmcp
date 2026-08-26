"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Braces, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParadoxStore } from "@/stores/paradox-store";
import { applyVersionGuardService } from "@/stores/services";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function FindingFocus() {
  const router = useRouter();
  const hydrated = useParadoxStore((state) => state.hydrated);
  const finding = useParadoxStore((state) => state.finding);
  if (!hydrated) {
    return <main className="missing-state" aria-busy="true"><LoaderCircle className="animate-spin" /><h1>Restoring the finding</h1><p>Loading its exact semantic trace.</p></main>;
  }
  if (!finding) {
    return <main className="missing-state"><CircleAlert /><h1>No computed finding</h1><p>Explore the recorded session before opening this route.</p></main>;
  }

  const apply = async () => {
    await applyVersionGuardService();
    router.push("/lab/expense-approval/verified");
  };

  return (
    <main className="finding-page">
      <header className="finding-header">
        <span className="section-label">Shortest counterexample / {finding.scheduleId}</span>
        <h1>The agent approved a state<br />it never reviewed.</h1>
        <p>{finding.violation.explanation}</p>
      </header>
      <section className="temporal-planes" aria-label="Observed, changed, and committed states">
        <article className="plane plane-agent"><span>Observed</span><div className="plane-marker">A</div><strong>{money.format(finding.believed.amountCents / 100)}</strong><code>version {finding.believed.version}</code><p>Agent belief became fixed in the review token.</p></article>
        <article className="plane plane-human"><span>Changed</span><div className="plane-marker">H</div><strong>{money.format(finding.changed.amountCents / 100)}</strong><code>version {finding.changed.version}</code><p>The human changed canonical state.</p></article>
        <article className="plane plane-system"><span>Committed</span><div className="plane-marker">S</div><strong>{money.format(finding.committed.amountCents / 100)}</strong><code>approved · version {finding.committed.version}</code><p>The unsafe tool committed without semantic equality.</p></article>
      </section>
      <section className="invariant-failure">
        <CircleAlert />
        <div><span>Invariant violated</span><strong>currentExpense.version === reviewedExpense.version</strong><p>{finding.violation.title}</p></div>
      </section>
      <section className="repair-panel">
        <div className="repair-copy"><span className="section-label">Constrained repair</span><h2>Require the version the agent actually inspected.</h2><p>Paradox changes this instrumented lab’s runtime strategy. It does not claim arbitrary source rewriting.</p></div>
        <pre><Braces aria-hidden="true" /><code>{`if (expense.version !== expectedVersion) {
  return {
    ok: false,
    code: "STATE_CHANGED",
    message: "The expense changed after inspection."
  };
}`}</code></pre>
        <Button size="lg" onClick={() => void apply()}>Apply version guard <ArrowRight className="size-4" /></Button>
      </section>
    </main>
  );
}
