"use client";

import { CircleCheck, GitMerge, Shield, TriangleAlert } from "lucide-react";
import { useParadoxStore } from "@/stores/paradox-store";

export function PolicyRail() {
  const session = useParadoxStore((state) => state.session);
  const guardMode = useParadoxStore((state) => state.session.ledger.guardMode);
  const finding = useParadoxStore((state) => state.finding);
  const expense = session.ledger.expenses["481"];
  const observedViolation = expense.status === "approved" && expense.approvedFromReviewVersion !== expense.version;
  const invariantFailed = guardMode === "unsafe" && Boolean(finding || observedViolation);
  return (
    <aside className="policy-rail" aria-label="Policy and invariant context">
      <section>
        <h2>Policy</h2>
        <div className="policy-statement">
          <Shield aria-hidden="true" />
          <div><strong>$3,000 limit</strong><p>Equipment requests below the limit may be approved.</p></div>
        </div>
        <div className="policy-statement">
          <GitMerge aria-hidden="true" />
          <div><strong>Human authority</strong><p>Edits become the canonical application state.</p></div>
        </div>
      </section>
      <section className="invariant-section">
        <h2>Invariant</h2>
        <div className={invariantFailed ? "invariant-active" : "invariant-idle"}>
          {invariantFailed ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          <div>
            <strong>Reviewed state = committed state</strong>
            <code>current.version === reviewed.version</code>
          </div>
        </div>
      </section>
      <section className="guard-section">
        <h2>Runtime strategy</h2>
        <span className={`guard-indicator ${guardMode}`}>{guardMode === "unsafe" ? "Unversioned approval" : "Version guard active"}</span>
      </section>
    </aside>
  );
}
