export type InvocationSource = "webmcp" | "local_control" | "system";
export type SemanticEventInput<TAction extends string, TMetadata extends Record<string, string | number | boolean | null>> = {
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
export declare function createSemanticEvent<TAction extends string, TMetadata extends Record<string, string | number | boolean | null>>(input: SemanticEventInput<TAction, TMetadata>): {
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
export type InvariantResult = {
    ok: true;
} | {
    ok: false;
    invariantId: string;
    title: string;
    explanation: string;
    relevantEventIds: string[];
};
export type SemanticInvariant<TState, TEvent> = {
    id: string;
    title: string;
    evaluate(previous: TState, event: TEvent, current: TState): InvariantResult;
};
export declare function defineInvariant<TState, TEvent>(invariant: SemanticInvariant<TState, TEvent>): SemanticInvariant<TState, TEvent>;
export type RegisteredTool = {
    name: string;
    description: string;
};
export type StatefulWebMCPTool = {
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
    }): Promise<string>;
};
export type ModelContextLike<TTool extends StatefulWebMCPTool = StatefulWebMCPTool> = {
    registerTool(tool: TTool, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    getTools?(): Promise<RegisteredTool[]>;
    addEventListener?(type: "toolchange", listener: EventListenerOrEventListenerObject): void;
    removeEventListener?(type: "toolchange", listener: EventListenerOrEventListenerObject): void;
};
export type ToolSurfaceOptions<TTool extends StatefulWebMCPTool> = {
    context: ModelContextLike<TTool>;
    tools: TTool[];
    onToolsChanged?(tools: RegisteredTool[]): void;
    onError?(error: unknown): void;
};
export declare function activateToolSurface<TTool extends StatefulWebMCPTool>({ context, tools, onToolsChanged, onError }: ToolSurfaceOptions<TTool>): () => void;
