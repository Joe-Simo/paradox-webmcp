// Bounded interleaving explorer — the Paradox engine, generalized.
//
// Model: each operation is a sequence of atomic micro-steps. The explorer
// interleaves every enabled operation's next micro-step (program order is
// preserved within an operation), merges states that become canonically
// equivalent, evaluates invariants on terminal states, extracts the first
// violating schedule as a counterexample, minimizes it to the essential
// operations, and can verify a repaired operation set by exact replay plus
// full re-exploration. Deterministic and dependency-free.
// ---------- canonical hashing (stable stringify + 64-bit FNV-style mix) ----------
function stableStringify(value) {
    if (typeof value === "bigint") {
        throw new TypeError("canonicalStateHash: state must be JSON-plain data (bigint found)");
    }
    if (value === null || typeof value !== "object")
        return JSON.stringify(value) ?? "undefined";
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    if (value instanceof Map || value instanceof Set || value instanceof Date || value instanceof RegExp
        || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        throw new TypeError(`canonicalStateHash: state must be JSON-plain data (${value.constructor.name} found) — convert to plain objects and arrays first`);
    }
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
// FNV-inspired 64-bit mix over UTF-16 code units, computed in two 32-bit
// halves. Deterministic and non-cryptographic; not bit-exact FNV-1a. Used
// only to key state-equivalence merging within one exploration run.
function fnv1a64(text) {
    let high = 0xcbf29ce4;
    let low = 0x84222325;
    for (let i = 0; i < text.length; i++) {
        low ^= text.charCodeAt(i);
        const newLow = (low & 0xffff) * 0x1b3 + (((low >>> 16) * 0x1b3) << 16);
        const carry = Math.floor((low & 0xffff) * 0x1b3 / 0x10000) + ((low >>> 16) * 0x1b3 & 0xffff);
        high = (high * 0x1b3 + low + Math.floor(carry / 0x10000)) >>> 0;
        low = newLow >>> 0;
    }
    return (high >>> 0).toString(16).padStart(8, "0") + (low >>> 0).toString(16).padStart(8, "0");
}
export function canonicalStateHash(value) {
    return fnv1a64(stableStringify(value));
}
function nodeHash(state, phases) {
    return canonicalStateHash({ state, phases });
}
function enabledOperations(operations, state, phases) {
    return operations.filter((operation) => {
        const phase = phases[operation.id] ?? 0;
        if (phase >= operation.steps)
            return false;
        return operation.enabled?.(state, phase) ?? true;
    });
}
function applyOperationStep(operation, state, phases) {
    const phase = phases[operation.id] ?? 0;
    const produced = operation.apply(structuredClone(state), phase);
    // The wrapped form is discriminated by carrying BOTH wrapper keys.
    const wrapped = typeof produced === "object" && produced !== null
        && "state" in produced && "skipRemainingSteps" in produced
        ? produced
        : null;
    const nextState = wrapped ? wrapped.state : produced;
    const nextPhases = { ...phases, [operation.id]: wrapped?.skipRemainingSteps ? operation.steps : phase + 1 };
    return { state: nextState, phases: nextPhases };
}
function isTerminal(operations, phases) {
    return operations.every((operation) => (phases[operation.id] ?? 0) >= operation.steps);
}
function firstViolation(invariants, state) {
    for (const invariant of invariants) {
        const verdict = invariant.check(state);
        if (!verdict.ok)
            return { invariantId: invariant.id, title: invariant.title, explanation: verdict.explanation };
    }
    return null;
}
// ---------- minimization (operation-level delta) ----------
function replayOperations(config, trace, keep) {
    let state = structuredClone(config.initial);
    let phases = {};
    for (const step of trace) {
        if (!keep.has(step.operationId))
            continue;
        const operation = config.operations.find((candidate) => candidate.id === step.operationId);
        if (!operation)
            continue;
        const phase = phases[operation.id] ?? 0;
        if (phase >= operation.steps)
            continue;
        if (!(operation.enabled?.(state, phase) ?? true))
            continue;
        const next = applyOperationStep(operation, state, phases);
        state = next.state;
        phases = next.phases;
    }
    return state;
}
function minimize(config, trace, violation) {
    let retained = [...new Set(trace.map((step) => step.operationId))];
    for (const candidate of [...retained]) {
        const without = retained.filter((operationId) => operationId !== candidate);
        const replayed = replayOperations(config, trace, new Set(without));
        if (firstViolation(config.invariants, replayed)?.invariantId === violation.invariantId)
            retained = without;
    }
    const ordered = retained
        .slice()
        .sort((a, b) => trace.findIndex((s) => s.operationId === a) - trace.findIndex((s) => s.operationId === b));
    return {
        operations: ordered,
        originalMicroSteps: trace.length,
        retainedOperations: ordered.length,
    };
}
// ---------- explore ----------
export function exploreInterleavings(config) {
    const maxNodes = config.maxNodes ?? 50_000;
    const initialPhases = {};
    const initialHash = nodeHash(config.initial, initialPhases);
    let layer = new Map([[initialHash, { state: config.initial, phases: initialPhases, trace: [], ways: 1 }]]);
    const visited = new Set([initialHash]);
    let visitedCount = 0;
    let schedulesExplored = 0;
    let equivalentBranchesMerged = 0;
    let counterexamples = 0;
    let counterexample = null;
    let complete = true;
    while (layer.size > 0) {
        const nextLayer = new Map();
        for (const node of layer.values()) {
            visitedCount += 1;
            if (visitedCount > maxNodes) {
                complete = false;
                break;
            }
            if (isTerminal(config.operations, node.phases)) {
                schedulesExplored += node.ways;
                const violation = firstViolation(config.invariants, node.state);
                if (violation) {
                    counterexamples += node.ways;
                    counterexample ??= {
                        trace: node.trace,
                        violation,
                        finalStateHash: nodeHash(node.state, node.phases),
                        minimized: minimize(config, node.trace, violation),
                    };
                }
                continue;
            }
            for (const operation of enabledOperations(config.operations, node.state, node.phases)) {
                const next = applyOperationStep(operation, node.state, node.phases);
                const hash = nodeHash(next.state, next.phases);
                const trace = [...node.trace, {
                        operationId: operation.id,
                        actor: operation.actor,
                        phase: node.phases[operation.id] ?? 0,
                        stateHash: hash,
                    }];
                const existing = nextLayer.get(hash);
                if (existing) {
                    existing.ways += node.ways;
                    equivalentBranchesMerged += 1;
                }
                else {
                    nextLayer.set(hash, { state: next.state, phases: next.phases, trace, ways: node.ways });
                }
                visited.add(hash);
            }
        }
        if (!complete)
            break;
        layer = nextLayer;
    }
    return {
        complete,
        status: complete ? "complete" : "incomplete_bound",
        schedulesExplored,
        uniqueStatesReached: visited.size,
        equivalentBranchesMerged,
        counterexamples,
        counterexample,
    };
}
// ---------- verify ----------
export function verifyRepair(config, counterexampleTrace) {
    let state = structuredClone(config.initial);
    let phases = {};
    for (const step of counterexampleTrace) {
        const operation = config.operations.find((candidate) => candidate.id === step.operationId);
        if (!operation)
            continue;
        const phase = phases[operation.id] ?? 0;
        if (phase >= operation.steps)
            continue;
        if (!(operation.enabled?.(state, phase) ?? true))
            continue;
        const next = applyOperationStep(operation, state, phases);
        state = next.state;
        phases = next.phases;
    }
    const violationReproduced = firstViolation(config.invariants, state) !== null;
    const exploration = exploreInterleavings(config);
    return {
        exactReplay: { violationReproduced },
        exploration,
        verified: !violationReproduced && exploration.complete && exploration.counterexamples === 0,
    };
}
//# sourceMappingURL=engine.js.map