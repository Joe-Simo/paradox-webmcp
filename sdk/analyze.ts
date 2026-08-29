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
} from "./engine.js";

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
  /** key -> actor -> count of writes committed to that key by that actor. */
  writes: Record<string, Record<string, number>>;
  /** operation id -> key -> other-actor write count observed at read time. */
  snapshots: Record<string, Record<string, number>>;
  outcomes: Record<string, "committed" | "blocked" | "stale_commit">;
  staleDetails: Record<string, { keys: string[] }>;
};

export type AnalyzeOptions = {
  /**
   * Operations whose commits carry a version guard on their reads — matched
   * by action name or by the suffixed operation id (`edit#2`) that
   * `minimizedOperations` and `hazard.operation` report.
   */
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

/** Stable, collision-free ids: duplicate actions get per-occurrence suffixes. */
function operationIds(recorded: RecordedOperation[]): string[] {
  const totals = new Map<string, number>();
  for (const event of recorded) totals.set(event.action, (totals.get(event.action) ?? 0) + 1);
  const seen = new Map<string, number>();
  const used = new Set<string>();
  return recorded.map((event) => {
    const occurrence = (seen.get(event.action) ?? 0) + 1;
    seen.set(event.action, occurrence);
    let id = (totals.get(event.action) ?? 0) > 1 ? `${event.action}#${occurrence}` : event.action;
    while (used.has(id)) id = `${id}#`;
    used.add(id);
    return id;
  });
}

/** Writes to `key` since the snapshot by anyone other than `actor`. */
function otherActorWrites(writes: Record<string, Record<string, number>>, key: string, actor: string): number {
  let count = 0;
  for (const [writer, n] of Object.entries(writes[key] ?? {})) if (writer !== actor) count += n;
  return count;
}

function synthesizeOperations(recorded: RecordedOperation[], guarded: Set<string>): ExplorerOperation<HazardState>[] {
  const ids = operationIds(recorded);
  return recorded.map((event, index) => {
    const id = ids[index];
    return {
      id,
      actor: event.actor,
      steps: 2, // read-and-decide, then commit — the yield point sits between.
      apply(state, phase) {
        if (phase === 0) {
          const snapshot: Record<string, number> = {};
          for (const key of event.reads) snapshot[key] = otherActorWrites(state.writes, key, event.actor);
          state.snapshots[id] = snapshot;
          return state;
        }
        const snapshot = state.snapshots[id] ?? {};
        // Only writes by a DIFFERENT actor invalidate a read — an actor
        // cannot interleave with itself.
        const overwritten = event.reads.filter(
          (key) => otherActorWrites(state.writes, key, event.actor) !== (snapshot[key] ?? 0),
        );
        if (overwritten.length > 0 && (guarded.has(event.action) || guarded.has(id))) {
          state.outcomes[id] = "blocked";
          return { state, skipRemainingSteps: true };
        }
        for (const key of event.writes) {
          const byActor = state.writes[key] ?? (state.writes[key] = {});
          byActor[event.actor] = (byActor[event.actor] ?? 0) + 1;
        }
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
  return { writes: {}, snapshots: {}, outcomes: {}, staleDetails: {} };
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
    const wrapped = typeof produced === "object" && produced !== null
      && "state" in (produced as object) && "skipRemainingSteps" in (produced as object)
      ? (produced as { state: HazardState; skipRemainingSteps: boolean })
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
      const ids = operationIds(recorded);
      const source = recorded.find((event, index) => ids[index] === operation);
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
