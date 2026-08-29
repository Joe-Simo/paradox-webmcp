/**
 * A step either returns the next state directly, or wraps it to also skip the
 * operation's remaining steps. The wrapped form must always carry BOTH keys —
 * `skipRemainingSteps` is required so a bare `{ state }` can never be
 * mistaken for (or mistakenly used as) a wrapper.
 */
type ExplorerStepResult<S> = S | {
    state: S;
    skipRemainingSteps: boolean;
};
type ExplorerOperation<S> = {
    /** Unique operation id, e.g. "approve_reviewed_expense". */
    id: string;
    /** Who performs it, e.g. "agent" | "human" | "system". */
    actor: string;
    /** Number of atomic micro-steps (yield points sit between them). */
    steps: number;
    /** Optional gate: may this operation take its next step in this state? */
    enabled?: (state: S, phase: number) => boolean;
    /**
     * Pure step function. Receives a structuredClone of the state. State must
     * be JSON-plain data (plain objects, arrays, strings, finite numbers,
     * booleans, null) so canonical hashing is sound — Map/Set/Date and friends
     * are rejected loudly by canonicalStateHash.
     */
    apply: (state: S, phase: number) => ExplorerStepResult<S>;
};
type ExplorerInvariant<S> = {
    id: string;
    title: string;
    check: (state: S) => {
        ok: true;
    } | {
        ok: false;
        explanation: string;
    };
};
type ExplorerTraceStep = {
    operationId: string;
    actor: string;
    phase: number;
    stateHash: string;
};
type ExplorerViolation = {
    invariantId: string;
    title: string;
    explanation: string;
};
type ExplorerCounterexample = {
    trace: ExplorerTraceStep[];
    violation: ExplorerViolation;
    finalStateHash: string;
    minimized: {
        operations: string[];
        originalMicroSteps: number;
        retainedOperations: number;
    };
};
type ExploreOutcome = {
    complete: boolean;
    status: "complete" | "incomplete_bound";
    schedulesExplored: number;
    uniqueStatesReached: number;
    equivalentBranchesMerged: number;
    counterexamples: number;
    counterexample: ExplorerCounterexample | null;
};
type VerifyOutcome = {
    exactReplay: {
        violationReproduced: boolean;
    };
    exploration: ExploreOutcome;
    verified: boolean;
};
type ExploreConfig<S> = {
    initial: S;
    operations: ExplorerOperation<S>[];
    invariants: ExplorerInvariant<S>[];
    maxNodes?: number;
};
declare function canonicalStateHash(value: unknown): string;
declare function exploreInterleavings<S>(config: ExploreConfig<S>): ExploreOutcome;
declare function verifyRepair<S>(config: ExploreConfig<S>, counterexampleTrace: ExplorerTraceStep[]): VerifyOutcome;

type RecordedOperation = {
    /** Semantic action name, e.g. "approve_reviewed_expense". */
    action: string;
    /** Who performed it, e.g. "agent" | "human" | "system". */
    actor: string;
    /** State keys this operation read before deciding, e.g. ["expense:481:amount"]. */
    reads: string[];
    /** State keys this operation wrote when committing. */
    writes: string[];
};
type RecorderEvent = RecordedOperation & {
    id: string;
    logicalTime: number;
};
/** Minimal session recorder: ordering and identity handled for you. */
declare function createRecorder(): {
    record(action: string, details: Omit<RecordedOperation, "action">): RecorderEvent;
    events: () => RecorderEvent[];
};
type AnalyzeOptions = {
    /**
     * Operations whose commits carry a version guard on their reads — matched
     * by action name or by the suffixed operation id (`edit#2`) that
     * `minimizedOperations` and `hazard.operation` report.
     */
    guarded?: string[];
    maxNodes?: number;
};
type StaleCommitHazard = {
    operation: string;
    actor: string;
    overwrittenReads: string[];
    explanation: string;
};
type RecordingAnalysis = {
    exploration: ExploreOutcome;
    hazard: StaleCommitHazard | null;
    /** Essential operations of the shortest hazardous schedule. */
    minimizedOperations: string[];
};
/**
 * Explore every interleaving of a recorded session and report the first
 * stale-commit hazard, fully automatically — no model, no invariant to write.
 */
declare function analyzeRecording(recorded: RecordedOperation[], options?: AnalyzeOptions): RecordingAnalysis;
/**
 * Prove a repair: with the named operations version-guarded, the exact
 * hazardous schedule is replayed and the full model re-explored.
 */
declare function verifyRecordingRepair(recorded: RecordedOperation[], counterexampleTrace: ExplorerTraceStep[], options: AnalyzeOptions & {
    guarded: string[];
}): VerifyOutcome;

type InvocationSource = "webmcp" | "local_control" | "system";
type SemanticEventInput<TAction extends string, TMetadata extends Record<string, string | number | boolean | null>> = {
    id: string;
    actor: "human" | "agent" | "system";
    action: TAction;
    invocationSource: InvocationSource;
    entityIds: string[];
    reads: string[];
    writes: string[];
    preStateHash: string;
    postStateHash: string;
    preVersion?: number;
    postVersion?: number;
    logicalTime: number;
    metadata: TMetadata;
};
declare function createSemanticEvent<TAction extends string, TMetadata extends Record<string, string | number | boolean | null>>(input: SemanticEventInput<TAction, TMetadata>): {
    id: string;
    actor: "system" | "human" | "agent";
    action: TAction;
    entityIds: string[];
    reads: string[];
    writes: string[];
    preStateHash: string;
    postStateHash: string;
    preVersion: number | undefined;
    postVersion: number | undefined;
    logicalTime: number;
    metadata: TMetadata & {
        invocationSource: InvocationSource;
    };
};
type InvariantResult = {
    ok: true;
} | {
    ok: false;
    invariantId: string;
    title: string;
    explanation: string;
    relevantEventIds: string[];
};
type SemanticInvariant<TState, TEvent> = {
    id: string;
    title: string;
    evaluate(previous: TState, event: TEvent, current: TState): InvariantResult;
};
declare function defineInvariant<TState, TEvent>(invariant: SemanticInvariant<TState, TEvent>): SemanticInvariant<TState, TEvent>;
type RegisteredTool = {
    name: string;
    description: string;
};
type StatefulWebMCPTool = {
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: {
        readOnlyHint?: boolean;
        untrustedContentHint?: boolean;
    };
    execute(input: unknown, options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
};
type ModelContextLike<TTool extends StatefulWebMCPTool = StatefulWebMCPTool> = {
    registerTool(tool: TTool, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    getTools?(): Promise<RegisteredTool[]>;
    addEventListener?(type: "toolchange", listener: EventListenerOrEventListenerObject): void;
    removeEventListener?(type: "toolchange", listener: EventListenerOrEventListenerObject): void;
};
type ToolSurfaceOptions<TTool extends StatefulWebMCPTool> = {
    context: ModelContextLike<TTool>;
    tools: TTool[];
    onToolsChanged?(tools: RegisteredTool[]): void;
    onError?(error: unknown): void;
};
declare function activateToolSurface<TTool extends StatefulWebMCPTool>({ context, tools, onToolsChanged, onError }: ToolSurfaceOptions<TTool>): () => void;

export { type AnalyzeOptions, type ExploreConfig, type ExploreOutcome, type ExplorerCounterexample, type ExplorerInvariant, type ExplorerOperation, type ExplorerStepResult, type ExplorerTraceStep, type ExplorerViolation, type InvariantResult, type InvocationSource, type ModelContextLike, type RecordedOperation, type RecorderEvent, type RecordingAnalysis, type RegisteredTool, type SemanticEventInput, type SemanticInvariant, type StaleCommitHazard, type StatefulWebMCPTool, type ToolSurfaceOptions, type VerifyOutcome, activateToolSurface, analyzeRecording, canonicalStateHash, createRecorder, createSemanticEvent, defineInvariant, exploreInterleavings, verifyRecordingRepair, verifyRepair };
