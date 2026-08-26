import { describe, it } from "vitest";
import fc from "fast-check";
import { applyVersionGuard, approveReviewedExpense, createInitialSession, editExpenseAmount, inspectExpense } from "@/domain/ledger/model";

describe("guard properties", () => {
  it("never commits an expense changed after inspection", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 10_000_000 }), (amountCents) => {
      fc.pre(amountCents !== 239_900);
      const inspected = inspectExpense(createInitialSession(), "481");
      if (!inspected.ok) return false;
      const edited = editExpenseAmount(inspected.session, "481", amountCents);
      if (!edited.ok) return false;
      const guarded = applyVersionGuard(edited.session);
      const result = approveReviewedExpense(guarded, inspected.data.reviewToken, inspected.data.version);
      return !result.ok && result.error.code === "STATE_CHANGED" && result.session.ledger.expenses["481"].status === "pending";
    }));
  });
});
