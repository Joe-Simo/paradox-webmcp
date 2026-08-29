// sdk/engine.ts
function stableStringify(value) {
  if (typeof value === "bigint") {
    throw new TypeError("canonicalStateHash: state must be JSON-plain data (bigint found)");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value instanceof Map || value instanceof Set || value instanceof Date || value instanceof RegExp || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new TypeError(`canonicalStateHash: state must be JSON-plain data (${value.constructor.name} found) \u2014 convert to plain objects and arrays first`);
  }
  const record = value;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
function fnv1a64(text) {
  let high = 3421674724;
  let low = 2216829733;
  for (let i = 0; i < text.length; i++) {
    low ^= text.charCodeAt(i);
    const newLow = (low & 65535) * 435 + ((low >>> 16) * 435 << 16);
    const carry = Math.floor((low & 65535) * 435 / 65536) + ((low >>> 16) * 435 & 65535);
    high = high * 435 + low + Math.floor(carry / 65536) >>> 0;
    low = newLow >>> 0;
  }
  return (high >>> 0).toString(16).padStart(8, "0") + (low >>> 0).toString(16).padStart(8, "0");
}
function canonicalStateHash(value) {
  return fnv1a64(stableStringify(value));
}
function nodeHash(state, phases) {
  return canonicalStateHash({ state, phases });
}
function enabledOperations(operations, state, phases) {
  return operations.filter((operation) => {
    const phase = phases[operation.id] ?? 0;
    if (phase >= operation.steps) return false;
    return operation.enabled?.(state, phase) ?? true;
  });
}
function applyOperationStep(operation, state, phases) {
  const phase = phases[operation.id] ?? 0;
  const produced = operation.apply(structuredClone(state), phase);
  const wrapped = typeof produced === "object" && produced !== null && "state" in produced && "skipRemainingSteps" in produced ? produced : null;
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
    if (!verdict.ok) return { invariantId: invariant.id, title: invariant.title, explanation: verdict.explanation };
  }
  return null;
}
function replayOperations(config, trace, keep) {
  let state = structuredClone(config.initial);
  let phases = {};
  for (const step of trace) {
    if (!keep.has(step.operationId)) continue;
    const operation = config.operations.find((candidate) => candidate.id === step.operationId);
    if (!operation) continue;
    const phase = phases[operation.id] ?? 0;
    if (phase >= operation.steps) continue;
    if (!(operation.enabled?.(state, phase) ?? true)) continue;
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
    if (firstViolation(config.invariants, replayed)?.invariantId === violation.invariantId) retained = without;
  }
  const ordered = retained.slice().sort((a, b) => trace.findIndex((s) => s.operationId === a) - trace.findIndex((s) => s.operationId === b));
  return {
    operations: ordered,
    originalMicroSteps: trace.length,
    retainedOperations: ordered.length
  };
}
function exploreInterleavings(config) {
  const maxNodes = config.maxNodes ?? 5e4;
  const initialPhases = {};
  const initialHash = nodeHash(config.initial, initialPhases);
  let layer = /* @__PURE__ */ new Map([[initialHash, { state: config.initial, phases: initialPhases, trace: [], ways: 1 }]]);
  const visited = /* @__PURE__ */ new Set([initialHash]);
  let visitedCount = 0;
  let schedulesExplored = 0;
  let equivalentBranchesMerged = 0;
  let counterexamples = 0;
  let counterexample = null;
  let complete = true;
  while (layer.size > 0) {
    const nextLayer = /* @__PURE__ */ new Map();
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
            minimized: minimize(config, node.trace, violation)
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
          stateHash: hash
        }];
        const existing = nextLayer.get(hash);
        if (existing) {
          existing.ways += node.ways;
          equivalentBranchesMerged += 1;
        } else {
          nextLayer.set(hash, { state: next.state, phases: next.phases, trace, ways: node.ways });
        }
        visited.add(hash);
      }
    }
    if (!complete) break;
    layer = nextLayer;
  }
  return {
    complete,
    status: complete ? "complete" : "incomplete_bound",
    schedulesExplored,
    uniqueStatesReached: visited.size,
    equivalentBranchesMerged,
    counterexamples,
    counterexample
  };
}
function verifyRepair(config, counterexampleTrace) {
  let state = structuredClone(config.initial);
  let phases = {};
  for (const step of counterexampleTrace) {
    const operation = config.operations.find((candidate) => candidate.id === step.operationId);
    if (!operation) continue;
    const phase = phases[operation.id] ?? 0;
    if (phase >= operation.steps) continue;
    if (!(operation.enabled?.(state, phase) ?? true)) continue;
    const next = applyOperationStep(operation, state, phases);
    state = next.state;
    phases = next.phases;
  }
  const violationReproduced = firstViolation(config.invariants, state) !== null;
  const exploration = exploreInterleavings(config);
  return {
    exactReplay: { violationReproduced },
    exploration,
    verified: !violationReproduced && exploration.complete && exploration.counterexamples === 0
  };
}

// sdk/analyze.ts
function createRecorder() {
  const events = [];
  return {
    record(action, details) {
      const event = {
        id: `evt_${String(events.length + 1).padStart(3, "0")}`,
        logicalTime: events.length + 1,
        action,
        actor: details.actor,
        reads: [...details.reads],
        writes: [...details.writes]
      };
      events.push(event);
      return event;
    },
    events: () => [...events]
  };
}
function operationIds(recorded) {
  const totals = /* @__PURE__ */ new Map();
  for (const event of recorded) totals.set(event.action, (totals.get(event.action) ?? 0) + 1);
  const seen = /* @__PURE__ */ new Map();
  const used = /* @__PURE__ */ new Set();
  return recorded.map((event) => {
    const occurrence = (seen.get(event.action) ?? 0) + 1;
    seen.set(event.action, occurrence);
    let id = (totals.get(event.action) ?? 0) > 1 ? `${event.action}#${occurrence}` : event.action;
    while (used.has(id)) id = `${id}#`;
    used.add(id);
    return id;
  });
}
function otherActorWrites(writes, key, actor) {
  let count = 0;
  for (const [writer, n] of Object.entries(writes[key] ?? {})) if (writer !== actor) count += n;
  return count;
}
function synthesizeOperations(recorded, guarded) {
  const ids = operationIds(recorded);
  return recorded.map((event, index) => {
    const id = ids[index];
    return {
      id,
      actor: event.actor,
      steps: 2,
      // read-and-decide, then commit — the yield point sits between.
      apply(state, phase) {
        if (phase === 0) {
          const snapshot2 = {};
          for (const key of event.reads) snapshot2[key] = otherActorWrites(state.writes, key, event.actor);
          state.snapshots[id] = snapshot2;
          return state;
        }
        const snapshot = state.snapshots[id] ?? {};
        const overwritten = event.reads.filter(
          (key) => otherActorWrites(state.writes, key, event.actor) !== (snapshot[key] ?? 0)
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
      }
    };
  });
}
function initialState() {
  return { writes: {}, snapshots: {}, outcomes: {}, staleDetails: {} };
}
var staleCommitInvariant = {
  id: "no_stale_commit",
  title: "No operation may commit on an overwritten belief",
  check(state) {
    const offender = Object.entries(state.outcomes).find(([, outcome]) => outcome === "stale_commit");
    if (!offender) return { ok: true };
    const keys = state.staleDetails[offender[0]]?.keys ?? [];
    return {
      ok: false,
      explanation: `${offender[0]} committed after its read of ${keys.join(", ")} was overwritten by another operation.`
    };
  }
};
function configFor(recorded, options) {
  const guarded = new Set(options?.guarded ?? []);
  return {
    initial: initialState(),
    operations: synthesizeOperations(recorded, guarded),
    invariants: [staleCommitInvariant],
    maxNodes: options?.maxNodes
  };
}
function replayHazardTrace(recorded, options, trace) {
  const config = configFor(recorded, options);
  let state = config.initial;
  const phases = {};
  for (const step of trace) {
    const operation = config.operations.find((candidate) => candidate.id === step.operationId);
    if (!operation) continue;
    const phase = phases[operation.id] ?? 0;
    if (phase >= operation.steps) continue;
    const produced = operation.apply(structuredClone(state), phase);
    const wrapped = typeof produced === "object" && produced !== null && "state" in produced && "skipRemainingSteps" in produced ? produced : null;
    state = wrapped ? wrapped.state : produced;
    phases[operation.id] = wrapped?.skipRemainingSteps ? operation.steps : phase + 1;
  }
  return state;
}
function analyzeRecording(recorded, options) {
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
        explanation: exploration.counterexample.violation.explanation
      };
    }
  }
  return {
    exploration,
    hazard,
    minimizedOperations: exploration.counterexample?.minimized.operations ?? []
  };
}
function verifyRecordingRepair(recorded, counterexampleTrace, options) {
  return verifyRepair(configFor(recorded, options), counterexampleTrace);
}

// sdk/index.ts
function createSemanticEvent(input) {
  return {
    id: input.id,
    actor: input.actor,
    action: input.action,
    entityIds: [...input.entityIds],
    reads: [...input.reads],
    writes: [...input.writes],
    preStateHash: input.preStateHash,
    postStateHash: input.postStateHash,
    preVersion: input.preVersion,
    postVersion: input.postVersion,
    logicalTime: input.logicalTime,
    metadata: { ...input.metadata, invocationSource: input.invocationSource }
  };
}
function defineInvariant(invariant) {
  return invariant;
}
function activateToolSurface({ context, tools, onToolsChanged, onError }) {
  const controller = new AbortController();
  let active = true;
  const refresh = async () => {
    const registered = typeof context.getTools === "function" ? await context.getTools() : tools.map(({ name, description }) => ({ name, description }));
    if (active) onToolsChanged?.(registered);
  };
  const onToolChange = () => void refresh().catch((error) => {
    if (active) onError?.(error);
  });
  const observesToolChanges = typeof context.addEventListener === "function" && typeof context.removeEventListener === "function";
  if (observesToolChanges) context.addEventListener?.("toolchange", onToolChange);
  void (async () => {
    try {
      await Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal })));
      await refresh();
    } catch (error) {
      if (!active || controller.signal.aborted) return;
      controller.abort();
      onError?.(error);
    }
  })();
  return () => {
    active = false;
    controller.abort();
    if (observesToolChanges) context.removeEventListener?.("toolchange", onToolChange);
  };
}
export {
  activateToolSurface,
  analyzeRecording,
  canonicalStateHash,
  createRecorder,
  createSemanticEvent,
  defineInvariant,
  exploreInterleavings,
  verifyRecordingRepair,
  verifyRepair
};
