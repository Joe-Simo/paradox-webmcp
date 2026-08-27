export function createSemanticEvent(input) {
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
export function defineInvariant(invariant) {
    return invariant;
}
export function activateToolSurface({ context, tools, onToolsChanged, onError }) {
    const controller = new AbortController();
    let active = true;
    const refresh = async () => {
        const registered = typeof context.getTools === "function"
            ? await context.getTools()
            : tools.map(({ name, description }) => ({ name, description }));
        if (active)
            onToolsChanged?.(registered);
    };
    const onToolChange = () => void refresh().catch(onError);
    const observesToolChanges = typeof context.addEventListener === "function"
        && typeof context.removeEventListener === "function";
    if (observesToolChanges)
        context.addEventListener?.("toolchange", onToolChange);
    void Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal })))
        .then(refresh)
        .catch((error) => {
        if (active && !controller.signal.aborted)
            onError?.(error);
    });
    return () => {
        active = false;
        controller.abort();
        if (observesToolChanges)
            context.removeEventListener?.("toolchange", onToolChange);
    };
}
//# sourceMappingURL=index.js.map