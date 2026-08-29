import { describe, expect, it } from "vitest";
import {
  exploreInterleavings,
  verifyRepair,
  type ExploreConfig,
  type ExplorerOperation,
} from "@/sdk";

// The expense-approval race, expressed purely through the public SDK API.
// This must reproduce the lab engine's published numbers — two independent
// implementations agreeing on the same model.

type Snapshot = { amountCents: number; version: number };
type LedgerState = {
  expense: Snapshot & { status: "pending" | "approved" };
  inspectRead: Snapshot | null;
  token: Snapshot | null;
  approvalRead: Snapshot | null;
  approvalOutcome: "STATE_CHANGED" | null;
  guardMode: "unsafe" | "versioned";
  editTargetCents: number;
};

const initial = (guardMode: "unsafe" | "versioned"): LedgerState => ({
  expense: { amountCents: 239_900, version: 7, status: "pending" },
  inspectRead: null,
  token: null,
  approvalRead: null,
  approvalOutcome: null,
  guardMode,
  editTargetCents: 2_399_900,
});

const operations: ExplorerOperation<LedgerState>[] = [
  {
    id: "inspect_expense",
    actor: "agent",
    steps: 2,
    apply(state, phase) {
      if (phase === 0) state.inspectRead = { amountCents: state.expense.amountCents, version: state.expense.version };
      if (phase === 1 && state.inspectRead) state.token = { ...state.inspectRead };
      return state;
    },
  },
  {
    id: "edit_expense_amount",
    actor: "human",
    steps: 2,
    apply(state, phase) {
      if (phase === 1 && state.expense.status === "pending") {
        state.expense.amountCents = state.editTargetCents;
        state.expense.version += 1;
      }
      return state;
    },
  },
  {
    id: "approve_reviewed_expense",
    actor: "agent",
    steps: 5,
    enabled: (state) => state.token !== null,
    apply(state, phase) {
      if (phase === 1) state.approvalRead = { amountCents: state.expense.amountCents, version: state.expense.version };
      if (phase === 2 && state.guardMode === "versioned" && state.token && state.expense.version !== state.token.version) {
        state.approvalOutcome = "STATE_CHANGED";
        return { state, skipRemainingSteps: true };
      }
      if (phase === 4 && state.expense.status === "pending") {
        if (state.guardMode === "versioned" && state.token && state.expense.version !== state.token.version) {
          state.approvalOutcome = "STATE_CHANGED";
        } else {
          state.expense.status = "approved";
        }
      }
      return state;
    },
  },
];

const invariants = [
  {
    id: "review_version_matches_commit",
    title: "Approved state must equal inspected state",
    check(state: LedgerState) {
      if (state.expense.status !== "approved" || !state.token) return { ok: true as const };
      if (state.expense.version !== state.token.version) {
        return { ok: false as const, explanation: `The review covered version ${state.token.version}, but version ${state.expense.version} was committed.` };
      }
      return { ok: true as const };
    },
  },
  {
    id: "approved_amount_matches_review",
    title: "Approved amount must equal inspected amount",
    check(state: LedgerState) {
      if (state.expense.status !== "approved" || !state.token) return { ok: true as const };
      if (state.expense.amountCents !== state.token.amountCents) {
        return { ok: false as const, explanation: "The committed amount differs from the amount inspected by the agent." };
      }
      return { ok: true as const };
    },
  },
];

const configFor = (guardMode: "unsafe" | "versioned"): ExploreConfig<LedgerState> => ({
  initial: initial(guardMode),
  operations,
  invariants,
});

describe("SDK exploration engine", () => {
  it("reproduces the lab's published unsafe model exactly", () => {
    const outcome = exploreInterleavings(configFor("unsafe"));
    expect(outcome.complete).toBe(true);
    expect(outcome.schedulesExplored).toBe(36);
    expect(outcome.uniqueStatesReached).toBe(36);
    expect(outcome.equivalentBranchesMerged).toBe(11);
    expect(outcome.counterexamples).toBe(27);
    expect(outcome.counterexample).not.toBeNull();
    expect(outcome.counterexample?.violation.invariantId).toBe("review_version_matches_commit");
    expect(outcome.counterexample?.minimized.operations).toEqual([
      "inspect_expense",
      "edit_expense_amount",
      "approve_reviewed_expense",
    ]);
    expect(outcome.counterexample?.minimized.originalMicroSteps).toBe(9);
    expect(outcome.counterexample?.minimized.retainedOperations).toBe(3);
  });

  it("reproduces the lab's published guarded model exactly", () => {
    const outcome = exploreInterleavings(configFor("versioned"));
    expect(outcome.complete).toBe(true);
    expect(outcome.schedulesExplored).toBe(36);
    expect(outcome.uniqueStatesReached).toBe(34);
    expect(outcome.equivalentBranchesMerged).toBe(10);
    expect(outcome.counterexamples).toBe(0);
    expect(outcome.counterexample).toBeNull();
  });

  it("verifies the guarded repair against the unsafe counterexample", () => {
    const unsafe = exploreInterleavings(configFor("unsafe"));
    const trace = unsafe.counterexample?.trace;
    expect(trace).toBeDefined();
    const verdict = verifyRepair(configFor("versioned"), trace ?? []);
    expect(verdict.exactReplay.violationReproduced).toBe(false);
    expect(verdict.exploration.counterexamples).toBe(0);
    expect(verdict.verified).toBe(true);
  });

  it("reports an incomplete bound honestly", () => {
    const outcome = exploreInterleavings({ ...configFor("unsafe"), maxNodes: 5 });
    expect(outcome.complete).toBe(false);
    expect(outcome.status).toBe("incomplete_bound");
  });
});
