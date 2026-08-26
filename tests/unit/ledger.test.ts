import { describe, expect, it } from "vitest";
import {
  applyVersionGuard,
  approveReviewedExpense,
  createInitialSession,
  editExpenseAmount,
  inspectExpense,
  sessionHash,
} from "@/domain/ledger/model";

describe("instrumented Ledger domain", () => {
  it("reproduces the stale review commit in unsafe mode", () => {
    const initial = createInitialSession();
    const inspected = inspectExpense(initial, "481");
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    const edited = editExpenseAmount(inspected.session, "481", 2_399_900);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const approved = approveReviewedExpense(edited.session, inspected.data.reviewToken);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.session.ledger.expenses["481"]).toMatchObject({
      amountCents: 2_399_900,
      version: 8,
      status: "approved",
      approvedFromReviewVersion: 7,
    });
  });

  it("rejects the same stale review with the version guard", () => {
    const inspected = inspectExpense(createInitialSession(), "481");
    if (!inspected.ok) throw new Error("inspection failed");
    const edited = editExpenseAmount(inspected.session, "481", 2_399_900);
    if (!edited.ok) throw new Error("edit failed");
    const guarded = applyVersionGuard(edited.session);
    const result = approveReviewedExpense(guarded, inspected.data.reviewToken, inspected.data.version);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("STATE_CHANGED");
    expect(result.session.ledger.expenses["481"].status).toBe("pending");
  });

  it("resets to an identical initial hash", () => {
    expect(sessionHash(createInitialSession())).toBe(sessionHash(createInitialSession()));
  });
});
