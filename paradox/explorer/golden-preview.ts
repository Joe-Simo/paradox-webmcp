import { approveReviewedExpense, createInitialSession, editExpenseAmount, inspectExpense } from "@/domain/ledger/model";
import { exploreSession } from "./engine";

export type GoldenPreview = ReturnType<typeof computeGoldenPreview>;

export function computeGoldenPreview() {
  const inspected = inspectExpense(createInitialSession(), "481", "webmcp");
  if (!inspected.ok) throw new Error("Golden preview inspection failed.");
  const edited = editExpenseAmount(inspected.session, "481", 2_399_900, "local_control");
  if (!edited.ok) throw new Error("Golden preview edit failed.");
  const approved = approveReviewedExpense(edited.session, inspected.data.reviewToken, undefined, "webmcp");
  if (!approved.ok) throw new Error("Golden preview approval failed.");
  const run = exploreSession(approved.session);
  const failing = run.representativeBranches.find((branch) => !branch.safe);
  if (!run.finding || !failing) throw new Error("Golden preview counterexample was not found.");
  return {
    runId: run.id,
    scheduleId: failing.scheduleId,
    schedulesExplored: run.schedulesExplored,
    uniqueStatesReached: run.uniqueStatesReached,
    equivalentBranchesMerged: run.equivalentBranchesMerged,
    counterexamples: run.counterexamples,
    believed: run.finding.believed,
    changed: run.finding.changed,
    committed: run.finding.committed,
    invariantId: run.finding.violation.invariantId,
  };
}
