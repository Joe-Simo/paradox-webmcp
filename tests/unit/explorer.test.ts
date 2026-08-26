import { describe, expect, it } from "vitest";
import { createInitialSession, approveReviewedExpense, editExpenseAmount, inspectExpense } from "@/domain/ledger/model";
import { exploreSession, verifyFinding } from "@/paradox/explorer/engine";

function recordedSession() {
  const inspected = inspectExpense(createInitialSession(), "481");
  if (!inspected.ok) throw new Error("inspection failed");
  const edited = editExpenseAmount(inspected.session, "481", 2_399_900);
  if (!edited.ok) throw new Error("edit failed");
  const approved = approveReviewedExpense(edited.session, inspected.data.reviewToken);
  if (!approved.ok) throw new Error("approval failed");
  return approved.session;
}

describe("bounded interleaving explorer", () => {
  it("discovers and explains a real stale-review counterexample", () => {
    const result = exploreSession(recordedSession(), "unsafe");
    expect(result.complete).toBe(true);
    expect(result.schedulesExplored).toBeGreaterThan(0);
    expect(result.uniqueStatesReached).toBeGreaterThan(1);
    expect(result.counterexamples).toBeGreaterThan(0);
    expect(result.finding?.semanticSequence).toEqual([
      "inspect_expense",
      "edit_expense_amount",
      "approve_reviewed_expense",
    ]);
    expect(result.finding?.believed).toEqual({ amountCents: 239_900, version: 7 });
    expect(result.finding?.committed).toEqual({ amountCents: 2_399_900, version: 8 });
  });

  it("is deterministic", () => {
    const session = recordedSession();
    expect(exploreSession(session, "unsafe")).toEqual(exploreSession(session, "unsafe"));
  });

  it("eliminates the violation under guarded commit semantics", () => {
    const unsafe = exploreSession(recordedSession(), "unsafe");
    if (!unsafe.finding) throw new Error("expected finding");
    const report = verifyFinding(recordedSession(), unsafe.finding);
    expect(report.exactReplay).toEqual({ blocked: true, code: "STATE_CHANGED" });
    expect(report.exploration.complete).toBe(true);
    expect(report.exploration.counterexamples).toBe(0);
    expect(report.verified).toBe(true);
  });
});
