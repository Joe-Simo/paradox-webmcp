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
    const onToolChange = () => void refresh().catch((error) => {
        if (active)
            onError?.(error);
    });
    const observesToolChanges = typeof context.addEventListener === "function"
        && typeof context.removeEventListener === "function";
    if (observesToolChanges)
        context.addEventListener?.("toolchange", onToolChange);
    void (async () => {
        try {
            await Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal })));
            await refresh();
        }
        catch (error) {
            if (!active || controller.signal.aborted)
                return;
            controller.abort(); // roll back any partially registered tools
            onError?.(error);
        }
    })();
    return () => {
        active = false;
        controller.abort();
        if (observesToolChanges)
            context.removeEventListener?.("toolchange", onToolChange);
    };
}
//# sourceMappingURL=index.js.map