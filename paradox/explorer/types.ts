import type { Actor, GuardMode, LabSession } from "@/domain/ledger/types";

export type TraceStep = {
  id: string;
  actor: Actor;
  operation: "inspect" | "edit" | "approve";
  phase: string;
  stateHash: string;
  amountCents: number;
  version: number;
  status: "pending" | "approved";
  outcome?: "STATE_CHANGED";
};

export type InvariantViolation = {
  invariantId: "review_version_matches_commit" | "approved_amount_matches_review";
  title: string;
  explanation: string;
};

export type RepresentativeBranch = {
  scheduleId: string;
  safe: boolean;
  trace: TraceStep[];
  finalStateHash: string;
};

export type CounterexampleFinding = {
  id: string;
  scheduleId: string;
  trace: TraceStep[];
  semanticSequence: Array<"inspect_expense" | "edit_expense_amount" | "approve_reviewed_expense">;
  violation: InvariantViolation;
  believed: { amountCents: number; version: number };
  changed: { amountCents: number; version: number };
  committed: { amountCents: number; version: number };
};

export type ExplorationResult = {
  id: string;
  sessionId: string;
  guardMode: GuardMode;
  complete: boolean;
  status: "complete" | "incomplete_bound";
  schedulesExplored: number;
  uniqueStatesReached: number;
  equivalentBranchesMerged: number;
  partialOrderReductions: number;
  counterexamples: number;
  representativeBranches: RepresentativeBranch[];
  finding: CounterexampleFinding | null;
};

export type VerificationReport = {
  id: string;
  findingId: string;
  exactReplay: { blocked: boolean; code: "STATE_CHANGED" | "UNSAFE_COMMIT" };
  exploration: ExplorationResult;
  verified: boolean;
};

export type ExploreRequest = {
  type: "EXPLORE";
  runId: string;
  session: LabSession;
  guardMode: GuardMode;
  maxNodes: number;
};

export type VerifyRequest = {
  type: "VERIFY";
  runId: string;
  session: LabSession;
  finding: CounterexampleFinding;
  maxNodes: number;
};

export type WorkerRequest = ExploreRequest | VerifyRequest;

export type WorkerResponse =
  | { type: "PROGRESS"; runId: string; visited: number }
  | { type: "COMPLETE"; runId: string; result: ExplorationResult }
  | { type: "VERIFIED"; runId: string; report: VerificationReport }
  | { type: "ERROR"; runId: string; message: string };
