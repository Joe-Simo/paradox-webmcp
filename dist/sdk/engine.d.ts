export type ExplorerStepResult<S> = S | {
    state: S;
    skipRemainingSteps?: boolean;
};
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
    check: (state: S) => {
        ok: true;
    } | {
        ok: false;
        explanation: string;
    };
};
export type ExplorerTraceStep = {
    operationId: string;
    actor: string;
    phase: number;
    stateHash: string;
};
export type ExplorerViolation = {
    invariantId: string;
    title: string;
    explanation: string;
};
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
    exactReplay: {
        violationReproduced: boolean;
    };
    exploration: ExploreOutcome;
    verified: boolean;
};
export type ExploreConfig<S> = {
    initial: S;
    operations: ExplorerOperation<S>[];
    invariants: ExplorerInvariant<S>[];
    maxNodes?: number;
};
export declare function canonicalStateHash(value: unknown): string;
export declare function exploreInterleavings<S>(config: ExploreConfig<S>): ExploreOutcome;
export declare function verifyRepair<S>(config: ExploreConfig<S>, counterexampleTrace: ExplorerTraceStep[]): VerifyOutcome;
