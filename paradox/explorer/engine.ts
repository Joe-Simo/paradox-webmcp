import { canonicalHash } from "@/domain/ledger/hash";
import type { GuardMode, LabSession } from "@/domain/ledger/types";
import type {
  CounterexampleFinding,
  ExplorationResult,
  InvariantViolation,
  RepresentativeBranch,
  TraceStep,
  VerificationReport,
} from "./types";

type PhaseState = { inspect: number; edit: number; approve: number };
type Snapshot = { amountCents: number; version: number };

type MachineState = {
  expense: Snapshot & { status: "pending" | "approved" };
  phases: PhaseState;
  inspectRead: Snapshot | null;
  token: Snapshot | null;
  approvalRead: Snapshot | null;
  approvalOutcome: "STATE_CHANGED" | null;
  guardMode: GuardMode;
  editTargetCents: number;
};

type Node = { state: MachineState; trace: TraceStep[]; ways: number };
type Operation = "inspect" | "edit" | "approve";

const PHASES = {
  inspect: ["read expense", "create review token"],
  edit: ["read current amount", "commit amount change"],
  approve: ["resolve review token", "read current expense", "validate preconditions", "prepare mutation", "commit mutation"],
} as const;

function machineHash(state: MachineState) {
  return canonicalHash(state);
}

function inputsFrom(session: LabSession) {
  const expense = session.ledger.expenses["481"];
  const inspectEvent = session.events.find((event) => event.action === "inspect_expense");
  const editEvent = session.events.filter((event) => event.action === "edit_expense_amount").at(-1);
  const inspectedAmount = Number(inspectEvent?.metadata.inspectedAmountCents ?? 239_900);
  const inspectedVersion = Number(inspectEvent?.metadata.inspectedVersion ?? 7);
  const editTarget = Number(editEvent?.metadata.amountCents ?? (expense?.amountCents === inspectedAmount ? 2_399_900 : expense?.amountCents) ?? 2_399_900);
  return { inspectedAmount, inspectedVersion, editTarget };
}

function initialMachine(session: LabSession, guardMode: GuardMode): MachineState {
  const { inspectedAmount, inspectedVersion, editTarget } = inputsFrom(session);
  return {
    expense: { amountCents: inspectedAmount, version: inspectedVersion, status: "pending" },
    phases: { inspect: 0, edit: 0, approve: 0 },
    inspectRead: null,
    token: null,
    approvalRead: null,
    approvalOutcome: null,
    guardMode,
    editTargetCents: editTarget,
  };
}

function enabled(state: MachineState): Operation[] {
  const operations: Operation[] = [];
  if (state.phases.inspect < PHASES.inspect.length) operations.push("inspect");
  if (state.phases.edit < PHASES.edit.length) operations.push("edit");
  if (state.token && state.phases.approve < PHASES.approve.length) operations.push("approve");
  return operations;
}

function applyStep(state: MachineState, operation: Operation): MachineState {
  const next: MachineState = structuredClone(state);
  const phase = next.phases[operation];

  if (operation === "inspect") {
    if (phase === 0) next.inspectRead = { amountCents: next.expense.amountCents, version: next.expense.version };
    if (phase === 1 && next.inspectRead) next.token = { ...next.inspectRead };
    next.phases.inspect += 1;
  }

  if (operation === "edit") {
    if (phase === 1 && next.expense.status === "pending") {
      next.expense.amountCents = next.editTargetCents;
      next.expense.version += 1;
    }
    next.phases.edit += 1;
  }

  if (operation === "approve") {
    if (phase === 1) next.approvalRead = { amountCents: next.expense.amountCents, version: next.expense.version };
    if (phase === 2 && next.guardMode === "versioned" && next.token && next.expense.version !== next.token.version) {
      next.approvalOutcome = "STATE_CHANGED";
      next.phases.approve = PHASES.approve.length;
      return next;
    }
    if (phase === 4 && next.expense.status === "pending") {
      if (next.guardMode === "versioned" && next.token && next.expense.version !== next.token.version) {
        next.approvalOutcome = "STATE_CHANGED";
      } else {
        next.expense.status = "approved";
      }
    }
    next.phases.approve += 1;
  }
  return next;
}

function traceStep(previous: MachineState, state: MachineState, operation: Operation, index: number): TraceStep {
  const actor = operation === "edit" ? "human" : "agent";
  const phaseIndex = previous.phases[operation];
  return {
    id: `step_${index}_${operation}_${phaseIndex}`,
    actor,
    operation,
    phase: PHASES[operation][phaseIndex] ?? "blocked",
    stateHash: machineHash(state),
    amountCents: state.expense.amountCents,
    version: state.expense.version,
    status: state.expense.status,
    outcome: state.approvalOutcome ?? undefined,
  };
}

function terminal(state: MachineState) {
  return state.phases.inspect === PHASES.inspect.length
    && state.phases.edit === PHASES.edit.length
    && state.phases.approve === PHASES.approve.length;
}

function violation(state: MachineState): InvariantViolation | null {
  if (state.expense.status !== "approved" || !state.token) return null;
  if (state.expense.version !== state.token.version) {
    return {
      invariantId: "review_version_matches_commit",
      title: "Approved state must equal inspected state",
      explanation: `The review covered version ${state.token.version}, but version ${state.expense.version} was committed.`,
    };
  }
  if (state.expense.amountCents !== state.token.amountCents) {
    return {
      invariantId: "approved_amount_matches_review",
      title: "Approved amount must equal inspected amount",
      explanation: "The committed amount differs from the amount inspected by the agent.",
    };
  }
  return null;
}

const actionFor = {
  inspect: "inspect_expense",
  edit: "edit_expense_amount",
  approve: "approve_reviewed_expense",
} as const;

function replayTrace(initial: MachineState, trace: TraceStep[]) {
  let state = initial;
  for (const step of trace) {
    if (!enabled(state).includes(step.operation)) continue;
    state = applyStep(state, step.operation);
  }
  return state;
}

function milestone(step: TraceStep) {
  return step.phase === "create review token"
    || step.phase === "commit amount change"
    || step.phase === "commit mutation"
    || step.outcome === "STATE_CHANGED";
}

function minimizeTrace(initial: MachineState, trace: TraceStep[], invariantId: InvariantViolation["invariantId"]) {
  let retained = [...new Set(trace.filter(milestone).map((step) => step.operation))];
  for (const candidate of [...retained]) {
    const withoutCandidate = retained.filter((operation) => operation !== candidate);
    const replayed = replayTrace(initial, trace.filter((step) => withoutCandidate.includes(step.operation)));
    if (violation(replayed)?.invariantId === invariantId) retained = withoutCandidate;
  }

  const minimizedTrace = trace
    .filter((step) => milestone(step) && retained.includes(step.operation))
    .map((step) => ({
      stepId: step.id,
      actor: step.actor,
      action: actionFor[step.operation],
      stateHash: step.stateHash,
      amountCents: step.amountCents,
      version: step.version,
    }));
  return {
    minimizedTrace,
    semanticSequence: minimizedTrace.map((step) => step.action),
    minimization: {
      originalMicroSteps: trace.length,
      retainedSemanticSteps: minimizedTrace.length,
      removedMicroSteps: trace.length - minimizedTrace.length,
    },
  };
}

function createFinding(initial: MachineState, state: MachineState, trace: TraceStep[], found: InvariantViolation): CounterexampleFinding {
  const scheduleId = `schedule_${canonicalHash(trace.map(({ operation, phase }) => ({ operation, phase })))}`;
  const token = state.token ?? { amountCents: 239_900, version: 7 };
  const editStep = [...trace].reverse().find((step) => step.operation === "edit" && step.version !== token.version);
  const minimized = minimizeTrace(initial, trace, found.invariantId);
  return {
    id: `finding_${canonicalHash({ scheduleId, invariantId: found.invariantId })}`,
    scheduleId,
    trace,
    ...minimized,
    violation: found,
    believed: token,
    changed: { amountCents: editStep?.amountCents ?? state.expense.amountCents, version: editStep?.version ?? state.expense.version },
    committed: { amountCents: state.expense.amountCents, version: state.expense.version },
  };
}

const operationAccess: Record<Operation, { reads: Set<string>; writes: Set<string> }> = {
  inspect: { reads: new Set(["expense:amount", "expense:version"]), writes: new Set(["review-token"]) },
  edit: { reads: new Set(["expense:amount", "expense:version"]), writes: new Set(["expense:amount", "expense:version"]) },
  approve: { reads: new Set(["review-token", "expense:amount", "expense:version"]), writes: new Set(["expense:status"]) },
};

function intersects(first: Set<string>, second: Set<string>) {
  for (const value of first) if (second.has(value)) return true;
  return false;
}

function operationsConflict(first: Operation, second: Operation) {
  const a = operationAccess[first];
  const b = operationAccess[second];
  return intersects(a.writes, b.reads) || intersects(a.writes, b.writes) || intersects(a.reads, b.writes);
}

function reducedEnabled(state: MachineState) {
  const operations = enabled(state);
  const selected: Operation[] = [];
  let reductions = 0;
  for (const operation of operations) {
    if (selected.some((earlier) => !operationsConflict(earlier, operation))) {
      reductions += 1;
    } else {
      selected.push(operation);
    }
  }
  return { operations: selected, reductions };
}

export function exploreSession(
  session: LabSession,
  guardMode: GuardMode = session.ledger.guardMode,
  maxNodes = 50_000,
  onProgress?: (visited: number) => void,
): ExplorationResult {
  const initial = initialMachine(session, guardMode);
  let layer = new Map<string, Node>([[machineHash(initial), { state: initial, trace: [], ways: 1 }]]);
  const visited = new Set<string>([machineHash(initial)]);
  let visitedCount = 0;
  let schedulesExplored = 0;
  let equivalentBranchesMerged = 0;
  let partialOrderReductions = 0;
  let counterexamples = 0;
  let finding: CounterexampleFinding | null = null;
  const representatives: RepresentativeBranch[] = [];
  let complete = true;

  while (layer.size > 0) {
    const nextLayer = new Map<string, Node>();
    for (const node of layer.values()) {
      visitedCount += 1;
      if (visitedCount % 64 === 0) onProgress?.(visitedCount);
      if (visitedCount > maxNodes) {
        complete = false;
        break;
      }
      if (terminal(node.state)) {
        schedulesExplored += node.ways;
        const found = violation(node.state);
        if (found) {
          counterexamples += node.ways;
          finding ??= createFinding(initial, node.state, node.trace, found);
        }
        const representative = {
          scheduleId: `schedule_${canonicalHash(node.trace.map(({ operation, phase }) => ({ operation, phase })))}`,
          safe: !found,
          trace: node.trace,
          finalStateHash: machineHash(node.state),
        };
        if (found && !representatives.some((branch) => !branch.safe)) {
          if (representatives.length >= 5) representatives.pop();
          representatives.unshift(representative);
        } else if (!found && representatives.length < 5) {
          representatives.push(representative);
        }
        continue;
      }

      const reduced = reducedEnabled(node.state);
      partialOrderReductions += reduced.reductions;
      for (const operation of reduced.operations) {
        const state = applyStep(node.state, operation);
        const hash = machineHash(state);
        const trace = [...node.trace, traceStep(node.state, state, operation, node.trace.length + 1)];
        const existing = nextLayer.get(hash);
        if (existing) {
          existing.ways += node.ways;
          equivalentBranchesMerged += 1;
        } else {
          nextLayer.set(hash, { state, trace, ways: node.ways });
        }
        visited.add(hash);
      }
    }
    if (!complete) break;
    layer = nextLayer;
  }
  onProgress?.(visitedCount);

  return {
    id: `run_${canonicalHash({ sessionId: session.id, guardMode, schedulesExplored, counterexamples })}`,
    sessionId: session.id,
    guardMode,
    complete,
    status: complete ? "complete" : "incomplete_bound",
    schedulesExplored,
    uniqueStatesReached: visited.size,
    equivalentBranchesMerged,
    partialOrderReductions,
    counterexamples,
    representativeBranches: representatives,
    finding,
  };
}

export function verifyFinding(session: LabSession, finding: CounterexampleFinding, maxNodes = 50_000): VerificationReport {
  let replayState = initialMachine(session, "versioned");
  for (const step of finding.trace) {
    if (replayState.approvalOutcome === "STATE_CHANGED") break;
    const operations = enabled(replayState);
    if (!operations.includes(step.operation)) continue;
    replayState = applyStep(replayState, step.operation);
  }
  const exactReplayBlocked = replayState.approvalOutcome === "STATE_CHANGED" && replayState.expense.status === "pending";
  const exploration = exploreSession(session, "versioned", maxNodes);
  return {
    id: `verification_${canonicalHash({ findingId: finding.id, runId: exploration.id })}`,
    findingId: finding.id,
    exactReplay: { blocked: exactReplayBlocked, code: exactReplayBlocked ? "STATE_CHANGED" : "UNSAFE_COMMIT" },
    exploration,
    verified: exactReplayBlocked && exploration.complete && exploration.counterexamples === 0,
  };
}
