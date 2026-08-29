// Automatic race analysis from recorded sessions.
//
// The stale-read race has a structural signature that needs no hand-written
// model: an operation reads some keys, a different actor overwrites one of
// those keys, and the first operation then commits its writes anyway. Given
// only recorded operations with declared read and write sets, this module
// synthesizes an exploration model, walks every interleaving with the bounded
// engine, and reports every schedule in which an operation committed on an
// overwritten belief — minimized to the essential operations. Marking an
// operation as version-guarded models the belief-carrying write pattern:
// its commit is blocked instead when any of its reads changed.

import {
  exploreInterleavings,
  verifyRepair,
  type ExploreOutcome,
  type ExplorerOperation,
  type ExplorerTraceStep,
  type VerifyOutcome,
} from "./engine";

export type RecordedOperation = {
  /** Semantic action name, e.g. "approve_reviewed_expense". */
  action: string;
  /** Who performed it, e.g. "agent" | "human" | "system". */
  actor: string;
  /** State keys this operation read before deciding, e.g. ["expense:481:amount"]. */
  reads: string[];
  /** State keys this operation wrote when committing. */
  writes: string[];
};

export type RecorderEvent = RecordedOperation & { id: string; logicalTime: number };

/** Minimal session recorder: ordering and identity handled for you. */
export function createRecorder() {
  const events: RecorderEvent[] = [];
  return {
    record(action: string, details: Omit<RecordedOperation, "action">) {
      const event: RecorderEvent = {
        id: `evt_${String(events.length + 1).padStart(3, "0")}`,
        logicalTime: events.length + 1,
        action,
        actor: details.actor,
        reads: [...details.reads],
        writes: [...details.writes],
      };
      events.push(event);
      return event;
    },
    events: () => [...events],
  };
}

type HazardState = {
  versions: Record<string, number>;
  snapshots: Record<string, Record<string, number>>;
  outcomes: Record<string, "committed" | "blocked" | "stale_commit">;
  staleDetails: Record<string, { keys: string[] }>;
};

export type AnalyzeOptions = {
  /** Operations (by action name) whose commits carry a version guard on their reads. */
  guarded?: string[];
  maxNodes?: number;
};

export type StaleCommitHazard = {
  operation: string;
  actor: string;
  overwrittenReads: string[];
  explanation: string;
};

export type RecordingAnalysis = {
  exploration: ExploreOutcome;
  hazard: StaleCommitHazard | null;
  /** Essential operations of the shortest hazardous schedule. */
  minimizedOperations: string[];
};

function operationId(event: RecordedOperation, index: number, all: RecordedOperation[]) {
  const duplicates = all.filter((candidate) => candidate.action === event.action);
  return duplicates.length > 1 ? `${event.action}#${index + 1}` : event.action;
}

function synthesizeOperations(recorded: RecordedOperation[], guarded: Set<string>): ExplorerOperation<HazardState>[] {
  return recorded.map((event, index) => {
    const id = operationId(event, index, recorded);
    return {
      id,
      actor: event.actor,
      steps: 2, // read-and-decide, then commit — the yield point sits between.
      apply(state, phase) {
        if (phase === 0) {
          const snapshot: Record<string, number> = {};
          for (const key of event.reads) snapshot[key] = state.versions[key] ?? 0;
          state.snapshots[id] = snapshot;
          return state;
        }
        const snapshot = state.snapshots[id] ?? {};
        const overwritten = event.reads.filter((key) => (state.versions[key] ?? 0) !== (snapshot[key] ?? 0));
        if (overwritten.length > 0 && guarded.has(event.action)) {
          state.outcomes[id] = "blocked";
          return { state, skipRemainingSteps: true };
        }
        for (const key of event.writes) state.versions[key] = (state.versions[key] ?? 0) + 1;
        if (overwritten.length > 0 && event.writes.length > 0) {
          state.outcomes[id] = "stale_commit";
          state.staleDetails[id] = { keys: overwritten };
        } else {
          state.outcomes[id] = "committed";
        }
        return state;
      },
    };
  });
}

function initialState(): HazardState {
  return { versions: {}, snapshots: {}, outcomes: {}, staleDetails: {} };
}

const staleCommitInvariant = {
  id: "no_stale_commit",
  title: "No operation may commit on an overwritten belief",
  check(state: HazardState) {
    const offender = Object.entries(state.outcomes).find(([, outcome]) => outcome === "stale_commit");
    if (!offender) return { ok: true as const };
    const keys = state.staleDetails[offender[0]]?.keys ?? [];
    return {
      ok: false as const,
      explanation: `${offender[0]} committed after its read of ${keys.join(", ")} was overwritten by another operation.`,
    };
  },
};

function configFor(recorded: RecordedOperation[], options?: AnalyzeOptions) {
  const guarded = new Set(options?.guarded ?? []);
  return {
    initial: initialState(),
    operations: synthesizeOperations(recorded, guarded),
    invariants: [staleCommitInvariant],
    maxNodes: options?.maxNodes,
  };
}

function replayHazardTrace(
  recorded: RecordedOperation[],
  options: AnalyzeOptions | undefined,
  trace: ExplorerTraceStep[],
): HazardState {
  const config = configFor(recorded, options);
  let state = config.initial;
  const phases: Record<string, number> = {};
  for (const step of trace) {
    const operation = config.operations.find((candidate) => candidate.id === step.operationId);
    if (!operation) continue;
    const phase = phases[operation.id] ?? 0;
    if (phase >= operation.steps) continue;
    const produced = operation.apply(structuredClone(state), phase);
    const wrapped = typeof produced === "object" && produced !== null && "skipRemainingSteps" in (produced as object)
      ? (produced as { state: HazardState; skipRemainingSteps?: boolean })
      : null;
    state = wrapped ? wrapped.state : (produced as HazardState);
    phases[operation.id] = wrapped?.skipRemainingSteps ? operation.steps : phase + 1;
  }
  return state;
}

/**
 * Explore every interleaving of a recorded session and report the first
 * stale-commit hazard, fully automatically — no model, no invariant to write.
 */
export function analyzeRecording(recorded: RecordedOperation[], options?: AnalyzeOptions): RecordingAnalysis {
  const exploration = exploreInterleavings(configFor(recorded, options));
  let hazard: StaleCommitHazard | null = null;
  if (exploration.counterexample) {
    const finalState = replayHazardTrace(recorded, options, exploration.counterexample.trace);
    const offender = Object.entries(finalState.outcomes).find(([, outcome]) => outcome === "stale_commit");
    if (offender) {
      const operation = offender[0];
      const source = recorded.find((event, index) => operationId(event, index, recorded) === operation);
      hazard = {
        operation,
        actor: source?.actor ?? "unknown",
        overwrittenReads: finalState.staleDetails[operation]?.keys ?? [],
        explanation: exploration.counterexample.violation.explanation,
      };
    }
  }
  return {
    exploration,
    hazard,
    minimizedOperations: exploration.counterexample?.minimized.operations ?? [],
  };
}

/**
 * Prove a repair: with the named operations version-guarded, the exact
 * hazardous schedule is replayed and the full model re-explored.
 */
export function verifyRecordingRepair(
  recorded: RecordedOperation[],
  counterexampleTrace: ExplorerTraceStep[],
  options: AnalyzeOptions & { guarded: string[] },
): VerifyOutcome {
  return verifyRepair(configFor(recorded, options), counterexampleTrace);
}
