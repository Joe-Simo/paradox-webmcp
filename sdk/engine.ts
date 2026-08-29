// Bounded interleaving explorer — the Paradox engine, generalized.
//
// Model: each operation is a sequence of atomic micro-steps. The explorer
// interleaves every enabled operation's next micro-step (program order is
// preserved within an operation), merges states that become canonically
// equivalent, evaluates invariants on terminal states, extracts the first
// violating schedule as a counterexample, minimizes it to the essential
// operations, and can verify a repaired operation set by exact replay plus
// full re-exploration. Deterministic and dependency-free.

export type ExplorerStepResult<S> = S | { state: S; skipRemainingSteps?: boolean };

export type ExplorerOperation<S> = {
  /** Unique operation id, e.g. "approve_reviewed_expense". */
  id: string;
  /** Who performs it, e.g. "agent" | "human" | "system". */
  actor: string;
  /** Number of atomic micro-steps (yield points sit between them). */
  steps: number;
  /** Optional gate: may this operation take its next step in this state? */
  enabled?: (state: S, phase: number) => boolean;
  /** Pure step function. Receives a structuredClone of the state. */
  apply: (state: S, phase: number) => ExplorerStepResult<S>;
};

export type ExplorerInvariant<S> = {
  id: string;
  title: string;
  check: (state: S) => { ok: true } | { ok: false; explanation: string };
};

export type ExplorerTraceStep = {
  operationId: string;
  actor: string;
  phase: number;
  stateHash: string;
};

export type ExplorerViolation = { invariantId: string; title: string; explanation: string };

export type ExplorerCounterexample = {
  trace: ExplorerTraceStep[];
  violation: ExplorerViolation;
  finalStateHash: string;
  minimized: {
    operations: string[];
    originalMicroSteps: number;
    retainedOperations: number;
  };
};

export type ExploreOutcome = {
  complete: boolean;
  status: "complete" | "incomplete_bound";
  schedulesExplored: number;
  uniqueStatesReached: number;
  equivalentBranchesMerged: number;
  counterexamples: number;
  counterexample: ExplorerCounterexample | null;
};

export type VerifyOutcome = {
  exactReplay: { violationReproduced: boolean };
  exploration: ExploreOutcome;
  verified: boolean;
};

export type ExploreConfig<S> = {
  initial: S;
  operations: ExplorerOperation<S>[];
  invariants: ExplorerInvariant<S>[];
  maxNodes?: number;
};

// ---------- canonical hashing (stable stringify + FNV-1a 64) ----------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function fnv1a64(text: string): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (let i = 0; i < text.length; i++) {
    low ^= text.charCodeAt(i);
    // 64-bit FNV prime 0x100000001b3 via 32-bit halves.
    const newLow = (low & 0xffff) * 0x1b3 + (((low >>> 16) * 0x1b3) << 16);
    const carry = Math.floor((low & 0xffff) * 0x1b3 / 0x10000) + ((low >>> 16) * 0x1b3 & 0xffff);
    high = (high * 0x1b3 + low + Math.floor(carry / 0x10000)) >>> 0;
    low = newLow >>> 0;
  }
  return (high >>> 0).toString(16).padStart(8, "0") + (low >>> 0).toString(16).padStart(8, "0");
}

export function canonicalStateHash(value: unknown): string {
  return fnv1a64(stableStringify(value));
}

// ---------- internal node model ----------

type Phases = Record<string, number>;
type Node<S> = { state: S; phases: Phases; trace: ExplorerTraceStep[]; ways: number };

function nodeHash<S>(state: S, phases: Phases): string {
  return canonicalStateHash({ state, phases });
}

function enabledOperations<S>(operations: ExplorerOperation<S>[], state: S, phases: Phases) {
  return operations.filter((operation) => {
    const phase = phases[operation.id] ?? 0;
    if (phase >= operation.steps) return false;
    return operation.enabled?.(state, phase) ?? true;
  });
}

function applyOperationStep<S>(operation: ExplorerOperation<S>, state: S, phases: Phases): { state: S; phases: Phases } {
  const phase = phases[operation.id] ?? 0;
  const produced = operation.apply(structuredClone(state), phase);
  // The wrapped form is discriminated by its `skipRemainingSteps` key.
  const wrapped = typeof produced === "object" && produced !== null && "skipRemainingSteps" in (produced as object)
    ? (produced as { state: S; skipRemainingSteps?: boolean })
    : null;
  const nextState = wrapped ? wrapped.state : (produced as S);
  const nextPhases: Phases = { ...phases, [operation.id]: wrapped?.skipRemainingSteps ? operation.steps : phase + 1 };
  return { state: nextState, phases: nextPhases };
}

function isTerminal<S>(operations: ExplorerOperation<S>[], phases: Phases) {
  return operations.every((operation) => (phases[operation.id] ?? 0) >= operation.steps);
}

function firstViolation<S>(invariants: ExplorerInvariant<S>[], state: S): ExplorerViolation | null {
  for (const invariant of invariants) {
    const verdict = invariant.check(state);
    if (!verdict.ok) return { invariantId: invariant.id, title: invariant.title, explanation: verdict.explanation };
  }
  return null;
}

// ---------- minimization (operation-level delta) ----------

function replayOperations<S>(config: ExploreConfig<S>, trace: ExplorerTraceStep[], keep: Set<string>) {
  let state = structuredClone(config.initial);
  let phases: Phases = {};
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

function minimize<S>(config: ExploreConfig<S>, trace: ExplorerTraceStep[], violation: ExplorerViolation) {
  let retained = [...new Set(trace.map((step) => step.operationId))];
  for (const candidate of [...retained]) {
    const without = retained.filter((operationId) => operationId !== candidate);
    const replayed = replayOperations(config, trace, new Set(without));
    if (firstViolation(config.invariants, replayed)?.invariantId === violation.invariantId) retained = without;
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

export function exploreInterleavings<S>(config: ExploreConfig<S>): ExploreOutcome {
  const maxNodes = config.maxNodes ?? 50_000;
  const initialPhases: Phases = {};
  const initialHash = nodeHash(config.initial, initialPhases);
  let layer = new Map<string, Node<S>>([[initialHash, { state: config.initial, phases: initialPhases, trace: [], ways: 1 }]]);
  const visited = new Set<string>([initialHash]);
  let visitedCount = 0;
  let schedulesExplored = 0;
  let equivalentBranchesMerged = 0;
  let counterexamples = 0;
  let counterexample: ExplorerCounterexample | null = null;
  let complete = true;

  while (layer.size > 0) {
    const nextLayer = new Map<string, Node<S>>();
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
    counterexample,
  };
}

// ---------- verify ----------

export function verifyRepair<S>(config: ExploreConfig<S>, counterexampleTrace: ExplorerTraceStep[]): VerifyOutcome {
  let state = structuredClone(config.initial);
  let phases: Phases = {};
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
    verified: !violationReproduced && exploration.complete && exploration.counterexamples === 0,
  };
}
