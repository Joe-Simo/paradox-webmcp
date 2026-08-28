"use client";

import { z } from "zod";
import { sessionHash } from "@/domain/ledger/model";
import type { DomainResult } from "@/domain/ledger/types";
import { paradoxStore } from "@/stores/paradox-store";
import {
  applyVersionGuardService,
  approveExpenseService,
  exploreFuturesService,
  inspectExpenseService,
  resetLabService,
  verifyRepairService,
} from "@/stores/services";
import { approveExpenseInput, exploreInput, findingInput, inspectExpenseInput, resetInput } from "./schemas";
import type { WebMCPTool } from "./types";

type Surface = "ledger" | "lab" | "finding" | "verified";
type ToolExecute = (input: unknown, options: { signal: AbortSignal }) => Promise<unknown>;

const emptySchema = { type: "object", properties: {}, additionalProperties: false };

function resultPayload<T>(result: DomainResult<T>) {
  if (result.ok) return { ok: true, ...result.data, eventId: result.event.id };
  return {
    ok: false,
    code: result.error.code,
    message: result.error.message,
    eventId: result.event?.id ?? null,
  };
}

function executable(tool: Omit<WebMCPTool, "execute">, execute: ToolExecute): WebMCPTool {
  return {
    ...tool,
    execute: async (input, options) => {
      try {
        const signal = options?.signal ?? new AbortController().signal;
        if (signal.aborted) throw new DOMException("The operation was cancelled.", "AbortError");
        return await execute(input, { signal });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { ok: false, code: "INVALID_INPUT", message: error.issues[0]?.message ?? "Invalid tool input." };
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return { ok: false, code: "CANCELLED", message: "The operation was cancelled." };
        }
        return { ok: false, code: "TOOL_ERROR", message: error instanceof Error ? error.message : "Tool execution failed." };
      }
    },
  };
}

function ledgerTools(): WebMCPTool[] {
  const versioned = paradoxStore.getState().session.ledger.guardMode === "versioned";
  return [
    executable({
      name: "inspect_expense",
      title: "Inspect expense",
      description: "Inspect one pending expense and create a version-bound review token.",
      inputSchema: {
        type: "object",
        properties: { expenseId: { type: "string", description: "Expense identifier. Defaults to 481." } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
    }, async (input) => {
      const payload = resultPayload(await inspectExpenseService(inspectExpenseInput.parse(input).expenseId, "webmcp"));
      if (!payload.ok) return payload;
      return {
        ...payload,
        guide: "You now hold a version-bound review. If a human edits this expense before you approve (Edit Amount at https://www.paradoxwebmcp.com/lab/expense-approval/ledger), completing the review reproduces the stale-approval race Paradox exists to catch.",
      };
    }),
    executable({
      name: "approve_reviewed_expense",
      title: "Approve reviewed expense",
      description: versioned
        ? "Approve only if the expense still matches the inspected version."
        : "Complete a previously started expense review.",
      inputSchema: {
        type: "object",
        properties: {
          reviewToken: { type: "string", description: "Token returned by inspect_expense." },
          ...(versioned ? { expectedVersion: { type: "integer", description: "Version inspected by the agent." } } : {}),
        },
        required: versioned ? ["reviewToken", "expectedVersion"] : ["reviewToken"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
    }, async (input) => {
      const parsed = approveExpenseInput.parse(input);
      const result = await approveExpenseService(parsed.reviewToken, parsed.expectedVersion, "webmcp");
      const payload = resultPayload(result);
      const reviewed = result.event?.metadata.reviewedVersion;
      const committed = result.event?.metadata.committedVersion;
      if (payload.ok && reviewed !== undefined && reviewed !== committed) {
        return {
          ...payload,
          guide: "You just approved a state you never reviewed — the race. Open https://www.paradoxwebmcp.com/lab/expense-approval and call explore_futures to unfold every ordering, then repair and verify.",
        };
      }
      if (payload.ok) {
        return {
          ...payload,
          guide: "Nothing changed between review and approval, so no race occurred this time. To reproduce the race: inspect again, have the human edit the amount, then complete the review.",
        };
      }
      if (payload.code === "STATE_CHANGED") {
        return {
          ...payload,
          guide: "The version guard refused a stale write. Call verify_repair from the Verify surface to prove the counterexample is eliminated across the bounded model.",
        };
      }
      return payload;
    }),
  ];
}

function inspectLabTool(): WebMCPTool {
  return executable({
    name: "inspect_lab",
    title: "Inspect lab",
    description: "Inspect the active Paradox session, invariant, guard mode, and exploration status.",
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true },
  }, async () => {
    const current = paradoxStore.getState();
    return {
      ok: true,
      sessionId: current.session.id,
      stateHash: sessionHash(current.session),
      eventCount: current.session.events.length,
      guardMode: current.session.ledger.guardMode,
      findingId: current.finding?.id ?? null,
      runStatus: current.run?.status ?? "not_started",
    };
  });
}

function resetTool(): WebMCPTool {
  return executable({
    name: "reset_lab",
    title: "Reset lab",
    description: "Reset the expense-approval lab to its deterministic initial state.",
    inputSchema: {
      type: "object",
      properties: { scenarioId: { type: "string", enum: ["expense-approval"] } },
      required: ["scenarioId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  }, async (input) => {
    resetInput.parse(input);
    return resetLabService();
  });
}

function exploreTool(): WebMCPTool {
  return executable({
    name: "explore_futures",
    title: "Explore futures",
    description: "Explore recorded human-agent interleavings and find invariant violations.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Optional active session identifier." },
        maxNodes: { type: "integer", minimum: 1, maximum: 50_000, description: "Maximum states to dequeue." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  }, async (input, { signal }) => {
    const parsed = exploreInput.parse(input);
    const currentSessionId = paradoxStore.getState().session.id;
    if (parsed.sessionId && parsed.sessionId !== currentSessionId) {
      return { ok: false, code: "SESSION_NOT_FOUND", message: "The requested session is not active." };
    }
    const run = await exploreFuturesService(parsed.maxNodes, signal);
    return {
      ok: true,
      runId: run.id,
      schedules: run.schedulesExplored,
      states: run.uniqueStatesReached,
      merged: run.equivalentBranchesMerged,
      reduced: run.partialOrderReductions,
      counterexamples: run.counterexamples,
      findingId: run.finding?.id ?? null,
    };
  });
}

function findingTools(): WebMCPTool[] {
  return [
    executable({
      name: "inspect_counterexample",
      title: "Inspect counterexample",
      description: "Explain the shortest computed invariant violation and its semantic sequence.",
      inputSchema: { type: "object", properties: { findingId: { type: "string" } }, required: ["findingId"], additionalProperties: false },
      annotations: { readOnlyHint: true },
    }, async (input) => {
      const { findingId } = findingInput.parse(input);
      const finding = paradoxStore.getState().finding;
      if (!finding || finding.id !== findingId) return { ok: false, code: "FINDING_NOT_FOUND" };
      return {
        ok: true,
        findingId,
        invariant: finding.violation,
        sequence: finding.semanticSequence,
        minimization: finding.minimization,
        believed: finding.believed,
        changed: finding.changed,
        committed: finding.committed,
      };
    }),
    executable({
      name: "apply_version_guard",
      title: "Apply version guard",
      description: "Apply the constrained semantic version guard to this instrumented lab.",
      inputSchema: { type: "object", properties: { findingId: { type: "string" } }, required: ["findingId"], additionalProperties: false },
      annotations: { readOnlyHint: false },
    }, async (input) => {
      const { findingId } = findingInput.parse(input);
      if (paradoxStore.getState().finding?.id !== findingId) return { ok: false, code: "FINDING_NOT_FOUND" };
      return applyVersionGuardService("webmcp");
    }),
  ];
}

function verifyTool(): WebMCPTool {
  return executable({
    name: "verify_repair",
    title: "Verify repair",
    description: "Replay the exact counterexample and rerun the complete bounded exploration.",
    inputSchema: { type: "object", properties: { findingId: { type: "string" } }, required: ["findingId"], additionalProperties: false },
    annotations: { readOnlyHint: false },
  }, async (input, { signal }) => {
    const { findingId } = findingInput.parse(input);
    if (paradoxStore.getState().finding?.id !== findingId) return { ok: false, code: "FINDING_NOT_FOUND" };
    const report = await verifyRepairService(50_000, signal);
    return {
      ok: true,
      exactReplay: report.exactReplay,
      verified: report.verified,
      schedules: report.exploration.schedulesExplored,
      states: report.exploration.uniqueStatesReached,
      counterexamples: report.exploration.counterexamples,
    };
  });
}

function activeLabStage(): Exclude<Surface, "ledger"> {
  const state = paradoxStore.getState();
  if (state.finding && state.session.ledger.guardMode === "versioned") return "verified";
  if (state.finding) return "finding";
  return "lab";
}

export function toolsForSurface(surface: Surface): WebMCPTool[] {
  if (surface === "ledger") return ledgerTools();
  const stage = activeLabStage();
  return [
    inspectLabTool(),
    ...(stage === "lab" ? [exploreTool()] : stage === "finding" ? findingTools() : [verifyTool()]),
    resetTool(),
  ];
}
