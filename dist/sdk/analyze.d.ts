import { type ExploreOutcome, type ExplorerTraceStep, type VerifyOutcome } from "./engine";
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
export type RecorderEvent = RecordedOperation & {
    id: string;
    logicalTime: number;
};
/** Minimal session recorder: ordering and identity handled for you. */
export declare function createRecorder(): {
    record(action: string, details: Omit<RecordedOperation, "action">): RecorderEvent;
    events: () => RecorderEvent[];
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
/**
 * Explore every interleaving of a recorded session and report the first
 * stale-commit hazard, fully automatically — no model, no invariant to write.
 */
export declare function analyzeRecording(recorded: RecordedOperation[], options?: AnalyzeOptions): RecordingAnalysis;
/**
 * Prove a repair: with the named operations version-guarded, the exact
 * hazardous schedule is replayed and the full model re-explored.
 */
export declare function verifyRecordingRepair(recorded: RecordedOperation[], counterexampleTrace: ExplorerTraceStep[], options: AnalyzeOptions & {
    guarded: string[];
}): VerifyOutcome;
