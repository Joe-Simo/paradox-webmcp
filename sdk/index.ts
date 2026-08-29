export {
  canonicalStateHash,
  exploreInterleavings,
  verifyRepair,
} from "./engine";
export type {
  ExploreConfig,
  ExploreOutcome,
  ExplorerCounterexample,
  ExplorerInvariant,
  ExplorerOperation,
  ExplorerStepResult,
  ExplorerTraceStep,
  ExplorerViolation,
  VerifyOutcome,
} from "./engine";

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

export function createSemanticEvent<
  TAction extends string,
  TMetadata extends Record<string, string | number | boolean | null>,
>(input: SemanticEventInput<TAction, TMetadata>) {
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
    metadata: { ...input.metadata, invocationSource: input.invocationSource },
  };
}

export type InvariantResult =
  | { ok: true }
  | { ok: false; invariantId: string; title: string; explanation: string; relevantEventIds: string[] };

export type SemanticInvariant<TState, TEvent> = {
  id: string;
  title: string;
  evaluate(previous: TState, event: TEvent, current: TState): InvariantResult;
};

export function defineInvariant<TState, TEvent>(invariant: SemanticInvariant<TState, TEvent>) {
  return invariant;
}

export type RegisteredTool = { name: string; description: string };

export type StatefulWebMCPTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
};

export type ModelContextLike<TTool extends StatefulWebMCPTool = StatefulWebMCPTool> = {
  registerTool(tool: TTool, options?: { signal?: AbortSignal }): Promise<void>;
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

export function activateToolSurface<TTool extends StatefulWebMCPTool>({ context, tools, onToolsChanged, onError }: ToolSurfaceOptions<TTool>) {
  const controller = new AbortController();
  let active = true;
  const refresh = async () => {
    const registered = typeof context.getTools === "function"
      ? await context.getTools()
      : tools.map(({ name, description }) => ({ name, description }));
    if (active) onToolsChanged?.(registered);
  };
  const onToolChange = () => void refresh().catch((error: unknown) => {
    if (active) onError?.(error);
  });
  const observesToolChanges = typeof context.addEventListener === "function"
    && typeof context.removeEventListener === "function";

  if (observesToolChanges) context.addEventListener?.("toolchange", onToolChange);
  void (async () => {
    try {
      await Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal })));
      await refresh();
    } catch (error) {
      if (!active || controller.signal.aborted) return;
      controller.abort(); // roll back any partially registered tools
      onError?.(error);
    }
  })();

  return () => {
    active = false;
    controller.abort();
    if (observesToolChanges) context.removeEventListener?.("toolchange", onToolChange);
  };
}
