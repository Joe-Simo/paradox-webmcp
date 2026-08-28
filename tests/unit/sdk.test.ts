import { describe, expect, it, vi } from "vitest";
import { activateToolSurface, createSemanticEvent, defineInvariant, type StatefulWebMCPTool } from "@/sdk";

describe("installable Paradox instrumentation", () => {
  it("records invocation provenance without retaining mutable input arrays", () => {
    const entityIds = ["expense:481"];
    const event = createSemanticEvent({ id: "evt_003", actor: "agent", action: "approve_reviewed_expense", invocationSource: "webmcp", entityIds, reads: ["expense:481:version"], writes: ["expense:481:status"], preStateHash: "before", postStateHash: "after", logicalTime: 3, metadata: { reviewedVersion: 7 } });
    entityIds.push("expense:999");
    expect(event.entityIds).toEqual(["expense:481"]);
    expect(event.metadata.invocationSource).toBe("webmcp");
  });

  it("preserves typed deterministic invariants", () => {
    const invariant = defineInvariant<number, { id: string }>({ id: "never-decrease", title: "State never decreases", evaluate(previous, event, current) { return current >= previous ? { ok: true } : { ok: false, invariantId: "never-decrease", title: "State never decreases", explanation: "State decreased.", relevantEventIds: [event.id] }; } });
    expect(invariant.evaluate(2, { id: "evt_1" }, 1)).toMatchObject({ ok: false, invariantId: "never-decrease" });
  });

  it("registers a state-scoped WebMCP surface and aborts stale tools", async () => {
    const registered = new Map<string, StatefulWebMCPTool>();
    const context = new class extends EventTarget {
      async registerTool(tool: StatefulWebMCPTool, options?: { signal?: AbortSignal }) { registered.set(tool.name, tool); options?.signal?.addEventListener("abort", () => { registered.delete(tool.name); this.dispatchEvent(new Event("toolchange")); }, { once: true }); this.dispatchEvent(new Event("toolchange")); }
      async getTools() { return [...registered.values()].map(({ name, description }) => ({ name, description })); }
    }();
    const onToolsChanged = vi.fn();
    const tool: StatefulWebMCPTool = { name: "inspect_expense", description: "Inspect one pending expense.", inputSchema: { type: "object" }, async execute() { return { ok: true }; } };
    const stop = activateToolSurface({ context, tools: [tool], onToolsChanged });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onToolsChanged).toHaveBeenCalledWith([{ name: tool.name, description: tool.description }]);
    stop();
    expect(registered.size).toBe(0);
  });

  it("supports early WebMCP clients without EventTarget or getTools", async () => {
    const registered = new Map<string, StatefulWebMCPTool>();
    const context = {
      async registerTool(tool: StatefulWebMCPTool, options?: { signal?: AbortSignal }) {
        registered.set(tool.name, tool);
        options?.signal?.addEventListener("abort", () => registered.delete(tool.name), { once: true });
      },
    };
    const onToolsChanged = vi.fn();
    const tool: StatefulWebMCPTool = { name: "inspect_expense", description: "Inspect one pending expense.", inputSchema: { type: "object" }, async execute() { return { ok: true }; } };

    const stop = activateToolSurface({ context, tools: [tool], onToolsChanged });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onToolsChanged).toHaveBeenCalledWith([{ name: tool.name, description: tool.description }]);
    stop();
    expect(registered.size).toBe(0);
  });
});
