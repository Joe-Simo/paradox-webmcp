"use client";

import type { WebMCPTool } from "./types";
import { approveExpenseInput, exploreInput, findingInput, inspectExpenseInput, resetInput } from "./schemas";
import { paradoxStore } from "@/stores/paradox-store";
import {
  applyVersionGuardService,
  approveExpenseService,
  exploreFuturesService,
  inspectExpenseService,
  resetLabService,
  verifyRepairService,
} from "@/stores/services";

function output(value: unknown) {
  return JSON.stringify(value);
}

const emptySchema = { type: "object", properties: {}, additionalProperties: false };

export function toolsForSurface(surface: "ledger" | "lab" | "finding" | "verified"): WebMCPTool[] {
  const state = paradoxStore.getState();
  if (surface === "ledger") {
    const tools: WebMCPTool[] = [
      {
        name: "inspect_expense",
        title: "Inspect expense",
        description: "Inspect one pending expense and create a version-bound review token.",
        inputSchema: {
          type: "object",
          properties: { expenseId: { type: "string", description: "Expense identifier." } },
          required: ["expenseId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async (input) => output(await inspectExpenseService(inspectExpenseInput.parse(input).expenseId)),
      },
      {
        name: "approve_reviewed_expense",
        title: "Approve reviewed expense",
        description: state.session.ledger.guardMode === "versioned"
          ? "Approve only if the expense still matches the inspected version."
          : "Complete a previously started expense review.",
        inputSchema: {
          type: "object",
          properties: {
            reviewToken: { type: "string", description: "Token returned by inspect_expense." },
            ...(state.session.ledger.guardMode === "versioned" ? { expectedVersion: { type: "integer", description: "Version inspected by the agent." } } : {}),
          },
          required: state.session.ledger.guardMode === "versioned" ? ["reviewToken", "expectedVersion"] : ["reviewToken"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          const parsed = approveExpenseInput.parse(input);
          return output(await approveExpenseService(parsed.reviewToken, parsed.expectedVersion));
        },
      },
    ];
    return tools;
  }

  const common: WebMCPTool[] = [
    {
      name: "inspect_lab",
      title: "Inspect lab",
      description: "Inspect the active Paradox session, invariant, guard mode, and exploration status.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: async () => {
        const current = paradoxStore.getState();
        return output({
          ok: true,
          sessionId: current.session.id,
          eventCount: current.session.events.length,
          guardMode: current.session.ledger.guardMode,
          findingId: current.finding?.id ?? null,
          runStatus: current.run?.status ?? "not_started",
        });
      },
    },
    {
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
      execute: async (input) => {
        resetInput.parse(input);
        return output(await resetLabService());
      },
    },
  ];

  if (surface === "lab") {
    common.splice(1, 0, {
      name: "explore_futures",
      title: "Explore futures",
      description: "Explore human-agent interleavings and find invariant violations in the active session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Optional active session identifier." },
          maxNodes: { type: "integer", minimum: 1, maximum: 50_000, description: "Maximum states to dequeue." },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const parsed = exploreInput.parse(input);
        const run = await exploreFuturesService(parsed.maxNodes);
        return output({ ok: true, runId: run.id, schedules: run.schedulesExplored, states: run.uniqueStatesReached, counterexamples: run.counterexamples, findingId: run.finding?.id ?? null });
      },
    });
  }

  if (surface === "finding") {
    common.splice(1, 0,
      {
        name: "inspect_counterexample",
        title: "Inspect counterexample",
        description: "Explain the shortest computed invariant violation and its semantic sequence.",
        inputSchema: { type: "object", properties: { findingId: { type: "string" } }, required: ["findingId"], additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async (input) => {
          const { findingId } = findingInput.parse(input);
          const finding = paradoxStore.getState().finding;
          if (!finding || finding.id !== findingId) return output({ ok: false, code: "FINDING_NOT_FOUND" });
          return output({ ok: true, findingId, invariant: finding.violation, sequence: finding.semanticSequence, believed: finding.believed, changed: finding.changed, committed: finding.committed });
        },
      },
      {
        name: "apply_version_guard",
        title: "Apply version guard",
        description: "Apply the constrained semantic version guard to this instrumented lab.",
        inputSchema: { type: "object", properties: { findingId: { type: "string" } }, required: ["findingId"], additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          const { findingId } = findingInput.parse(input);
          if (paradoxStore.getState().finding?.id !== findingId) return output({ ok: false, code: "FINDING_NOT_FOUND" });
          return output(await applyVersionGuardService());
        },
      },
    );
  }

  if (surface === "verified") {
    common.splice(1, 0, {
      name: "verify_repair",
      title: "Verify repair",
      description: "Replay the exact counterexample and rerun the complete bounded exploration.",
      inputSchema: { type: "object", properties: { findingId: { type: "string" } }, required: ["findingId"], additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const { findingId } = findingInput.parse(input);
        if (paradoxStore.getState().finding?.id !== findingId) return output({ ok: false, code: "FINDING_NOT_FOUND" });
        const report = await verifyRepairService();
        return output({ ok: true, exactReplay: report.exactReplay, verified: report.verified, schedules: report.exploration.schedulesExplored, states: report.exploration.uniqueStatesReached, counterexamples: report.exploration.counterexamples });
      },
    });
  }
  return common;
}
