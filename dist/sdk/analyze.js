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
import { exploreInterleavings, verifyRepair, } from "./engine.js";
/** Minimal session recorder: ordering and identity handled for you. */
export function createRecorder() {
    const events = [];
    return {
        record(action, details) {
            const event = {
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
/** Stable, collision-free ids: duplicate actions get per-occurrence suffixes. */
function operationIds(recorded) {
    const totals = new Map();
    for (const event of recorded)
        totals.set(event.action, (totals.get(event.action) ?? 0) + 1);
    const seen = new Map();
    const used = new Set();
    return recorded.map((event) => {
        const occurrence = (seen.get(event.action) ?? 0) + 1;
        seen.set(event.action, occurrence);
        let id = (totals.get(event.action) ?? 0) > 1 ? `${event.action}#${occurrence}` : event.action;
        while (used.has(id))
            id = `${id}#`;
        used.add(id);
        return id;
    });
}
/** Writes to `key` since the snapshot by anyone other than `actor`. */
function otherActorWrites(writes, key, actor) {
    let count = 0;
    for (const [writer, n] of Object.entries(writes[key] ?? {}))
        if (writer !== actor)
            count += n;
    return count;
}
function synthesizeOperations(recorded, guarded) {
    const ids = operationIds(recorded);
    return recorded.map((event, index) => {
        const id = ids[index];
        return {
            id,
            actor: event.actor,
            steps: 2, // read-and-decide, then commit — the yield point sits between.
            apply(state, phase) {
                if (phase === 0) {
                    const snapshot = {};
                    for (const key of event.reads)
                        snapshot[key] = otherActorWrites(state.writes, key, event.actor);
                    state.snapshots[id] = snapshot;
                    return state;
                }
                const snapshot = state.snapshots[id] ?? {};
                // Only writes by a DIFFERENT actor invalidate a read — an actor
                // cannot interleave with itself.
                const overwritten = event.reads.filter((key) => otherActorWrites(state.writes, key, event.actor) !== (snapshot[key] ?? 0));
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
                }
                else {
                    state.outcomes[id] = "committed";
                }
                return state;
            },
        };
    });
}
function initialState() {
    return { writes: {}, snapshots: {}, outcomes: {}, staleDetails: {} };
}
const staleCommitInvariant = {
    id: "no_stale_commit",
    title: "No operation may commit on an overwritten belief",
    check(state) {
        const offender = Object.entries(state.outcomes).find(([, outcome]) => outcome === "stale_commit");
        if (!offender)
            return { ok: true };
        const keys = state.staleDetails[offender[0]]?.keys ?? [];
        return {
            ok: false,
            explanation: `${offender[0]} committed after its read of ${keys.join(", ")} was overwritten by another operation.`,
        };
    },
};
function configFor(recorded, options) {
    const guarded = new Set(options?.guarded ?? []);
    return {
        initial: initialState(),
        operations: synthesizeOperations(recorded, guarded),
        invariants: [staleCommitInvariant],
        maxNodes: options?.maxNodes,
    };
}
function replayHazardTrace(recorded, options, trace) {
    const config = configFor(recorded, options);
    let state = config.initial;
    const phases = {};
    for (const step of trace) {
        const operation = config.operations.find((candidate) => candidate.id === step.operationId);
        if (!operation)
            continue;
        const phase = phases[operation.id] ?? 0;
        if (phase >= operation.steps)
            continue;
        const produced = operation.apply(structuredClone(state), phase);
        const wrapped = typeof produced === "object" && produced !== null
            && "state" in produced && "skipRemainingSteps" in produced
            ? produced
            : null;
        state = wrapped ? wrapped.state : produced;
        phases[operation.id] = wrapped?.skipRemainingSteps ? operation.steps : phase + 1;
    }
    return state;
}
/**
 * Explore every interleaving of a recorded session and report the first
 * stale-commit hazard, fully automatically — no model, no invariant to write.
 */
export function analyzeRecording(recorded, options) {
    const exploration = exploreInterleavings(configFor(recorded, options));
    let hazard = null;
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
export function verifyRecordingRepair(recorded, counterexampleTrace, options) {
    return verifyRepair(configFor(recorded, options), counterexampleTrace);
}
//# sourceMappingURL=analyze.js.map