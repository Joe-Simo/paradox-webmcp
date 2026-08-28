import { canonicalHash } from "./hash";
import { createSemanticEvent } from "@/sdk";
import type {
  DomainResult,
  Expense,
  InvocationSource,
  LabSession,
  SemanticAction,
  SemanticEvent,
} from "./types";

const INITIAL_TIMESTAMP = "2026-08-26T12:00:00.000Z";

export function createInitialSession(id = "expense-approval-golden"): LabSession {
  const expense: Expense = {
    id: "481",
    employeeName: "Maya Chen",
    description: "Team offsite travel",
    category: "equipment",
    amountCents: 239_900,
    status: "pending",
    version: 7,
  };

  return {
    id,
    scenarioId: "expense-approval",
    ledger: {
      expenses: { [expense.id]: expense },
      selectedExpenseId: expense.id,
      policyLimitCents: 300_000,
      revision: 18,
      guardMode: "unsafe",
    },
    reviewTokens: {},
    activeReviewTokenId: null,
    events: [],
    approvalHistory: [],
    logicalTime: 0,
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
  };
}

export function modelSnapshot(session: LabSession) {
  return {
    ledger: session.ledger,
    reviewTokens: session.reviewTokens,
    activeReviewTokenId: session.activeReviewTokenId,
  };
}

export function sessionHash(session: LabSession): string {
  return canonicalHash(modelSnapshot(session));
}

export function hasRecordedRace(session: LabSession): boolean {
  const inspectIndex = session.events.findIndex((event) => event.action === "inspect_expense");
  const editIndex = session.events.findIndex((event, index) => index > inspectIndex && event.action === "edit_expense_amount");
  const approveIndex = session.events.findIndex((event, index) => index > editIndex && event.action === "approve_reviewed_expense");
  return inspectIndex >= 0 && editIndex > inspectIndex && approveIndex > editIndex;
}

function nextEvent(
  before: LabSession,
  after: LabSession,
  actor: SemanticEvent["actor"],
  action: SemanticAction,
  expense: Expense,
  reads: string[],
  writes: string[],
  metadata: SemanticEvent["metadata"],
  invocationSource: InvocationSource,
): SemanticEvent {
  return createSemanticEvent({
    id: `evt_${String(after.logicalTime).padStart(3, "0")}`,
    actor,
    action,
    entityIds: [expense.id],
    reads,
    writes,
    preStateHash: sessionHash(before),
    postStateHash: sessionHash(after),
    preVersion: before.ledger.expenses[expense.id]?.version,
    postVersion: after.ledger.expenses[expense.id]?.version,
    logicalTime: after.logicalTime,
    metadata,
    invocationSource,
  });
}

function advanced(session: LabSession): LabSession {
  return {
    ...session,
    ledger: { ...session.ledger, revision: session.ledger.revision + 1 },
    logicalTime: session.logicalTime + 1,
    updatedAt: new Date(Date.parse(INITIAL_TIMESTAMP) + (session.logicalTime + 1) * 1_000).toISOString(),
  };
}

export function inspectExpense(session: LabSession, expenseId: string, invocationSource: InvocationSource = "system"): DomainResult<{
  reviewToken: string;
  expenseId: string;
  amountCents: number;
  version: number;
  limitCents: number;
  eligibleAtInspection: boolean;
}> {
  const expense = session.ledger.expenses[expenseId];
  if (!expense) {
    return { ok: false, error: { code: "EXPENSE_NOT_FOUND", message: "Expense not found." }, session };
  }
  if (expense.status !== "pending") {
    return { ok: false, error: { code: "EXPENSE_NOT_PENDING", message: "Only pending expenses can be inspected." }, session };
  }

  const tokenId = `review_expense_${expense.id}_v${expense.version}`;
  let after = advanced(session);
  after = {
    ...after,
    reviewTokens: {
      ...after.reviewTokens,
      [tokenId]: {
        id: tokenId,
        expenseId: expense.id,
        inspectedVersion: expense.version,
        inspectedAmountCents: expense.amountCents,
        createdAtRevision: session.ledger.revision,
      },
    },
    activeReviewTokenId: tokenId,
  };
  const event = nextEvent(session, after, "agent", "inspect_expense", expense, [
    `expense:${expense.id}:amountCents`,
    `expense:${expense.id}:version`,
    "ledger:policyLimitCents",
  ], [`reviewToken:${tokenId}`], {
    reviewToken: tokenId,
    inspectedAmountCents: expense.amountCents,
    inspectedVersion: expense.version,
  }, invocationSource);
  after = { ...after, events: [...after.events, event] };
  return {
    ok: true,
    data: {
      reviewToken: tokenId,
      expenseId,
      amountCents: expense.amountCents,
      version: expense.version,
      limitCents: session.ledger.policyLimitCents,
      eligibleAtInspection: expense.amountCents < session.ledger.policyLimitCents,
    },
    session: after,
    event,
  };
}

export function editExpenseAmount(session: LabSession, expenseId: string, amountCents: number, invocationSource: InvocationSource = "system"): DomainResult<{
  expenseId: string;
  previousAmountCents: number;
  amountCents: number;
  version: number;
}> {
  const expense = session.ledger.expenses[expenseId];
  if (!expense) return { ok: false, error: { code: "EXPENSE_NOT_FOUND", message: "Expense not found." }, session };
  if (expense.status !== "pending") {
    return { ok: false, error: { code: "EXPENSE_NOT_PENDING", message: "Only pending expenses can be edited." }, session };
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: { code: "INVALID_AMOUNT", message: "Enter a positive amount." }, session };
  }

  const updated: Expense = { ...expense, amountCents, version: expense.version + 1 };
  let after = advanced(session);
  after = { ...after, ledger: { ...after.ledger, expenses: { ...after.ledger.expenses, [expenseId]: updated } } };
  const event = nextEvent(session, after, "human", "edit_expense_amount", updated, [
    `expense:${expenseId}:amountCents`,
    `expense:${expenseId}:version`,
  ], [`expense:${expenseId}:amountCents`, `expense:${expenseId}:version`], {
    previousAmountCents: expense.amountCents,
    amountCents,
  }, invocationSource);
  after = { ...after, events: [...after.events, event] };
  return { ok: true, data: { expenseId, previousAmountCents: expense.amountCents, amountCents, version: updated.version }, session: after, event };
}

export function approveReviewedExpense(
  session: LabSession,
  reviewToken: string,
  expectedVersion?: number,
  invocationSource: InvocationSource = "system",
): DomainResult<{ expenseId: string; amountCents: number; version: number; status: "approved" }> {
  const token = session.reviewTokens[reviewToken];
  if (!token) return { ok: false, error: { code: "REVIEW_NOT_FOUND", message: "Review token not found." }, session };
  const expense = session.ledger.expenses[token.expenseId];
  if (!expense) return { ok: false, error: { code: "EXPENSE_NOT_FOUND", message: "Expense not found." }, session };
  if (expense.status !== "pending") {
    return { ok: false, error: { code: "EXPENSE_NOT_PENDING", message: "Expense is no longer pending." }, session };
  }
  if (session.ledger.guardMode === "versioned" && expectedVersion === undefined) {
    return { ok: false, error: { code: "EXPECTED_VERSION_REQUIRED", message: "The inspected version is required." }, session };
  }

  if (session.ledger.guardMode === "versioned" && (expense.version !== expectedVersion || expense.version !== token.inspectedVersion)) {
    let after = advanced(session);
    const event = nextEvent(session, after, "agent", "approve_reviewed_expense", expense, [
      `reviewToken:${reviewToken}`,
      `expense:${expense.id}:version`,
    ], [], { outcome: "STATE_CHANGED", expectedVersion: expectedVersion ?? null, currentVersion: expense.version }, invocationSource);
    after = {
      ...after,
      events: [...after.events, event],
      approvalHistory: [...after.approvalHistory, {
        id: `approval_${after.logicalTime}`,
        expenseId: expense.id,
        amountCents: expense.amountCents,
        expenseVersion: expense.version,
        reviewedVersion: token.inspectedVersion,
        outcome: "state_changed",
        logicalTime: after.logicalTime,
      }],
    };
    return { ok: false, error: { code: "STATE_CHANGED", message: "The expense changed after inspection." }, session: after, event };
  }

  const approved: Expense = {
    ...expense,
    status: "approved",
    approvedFromReviewVersion: token.inspectedVersion,
    approvedAmountCents: expense.amountCents,
  };
  let after = advanced(session);
  after = { ...after, ledger: { ...after.ledger, expenses: { ...after.ledger.expenses, [expense.id]: approved } } };
  const event = nextEvent(session, after, "agent", "approve_reviewed_expense", approved, [
    `reviewToken:${reviewToken}`,
    `expense:${expense.id}:version`,
    `expense:${expense.id}:amountCents`,
  ], [`expense:${expense.id}:status`, `expense:${expense.id}:approvedAmountCents`], {
    outcome: "approved",
    reviewedVersion: token.inspectedVersion,
    reviewedAmountCents: token.inspectedAmountCents,
    committedVersion: approved.version,
    committedAmountCents: approved.amountCents,
  }, invocationSource);
  after = {
    ...after,
    events: [...after.events, event],
    approvalHistory: [...after.approvalHistory, {
      id: `approval_${after.logicalTime}`,
      expenseId: expense.id,
      amountCents: expense.amountCents,
      expenseVersion: expense.version,
      reviewedVersion: token.inspectedVersion,
      outcome: "approved",
      logicalTime: after.logicalTime,
    }],
  };
  return { ok: true, data: { expenseId: expense.id, amountCents: approved.amountCents, version: approved.version, status: "approved" }, session: after, event };
}

export function applyVersionGuard(session: LabSession, invocationSource: InvocationSource = "system"): LabSession {
  if (session.ledger.guardMode === "versioned") return session;
  let after = advanced(session);
  after = { ...after, ledger: { ...after.ledger, guardMode: "versioned" } };
  const expense = after.ledger.expenses["481"];
  const event = nextEvent(session, after, "system", "apply_version_guard", expense, ["ledger:guardMode"], ["ledger:guardMode"], { guardMode: "versioned" }, invocationSource);
  return { ...after, events: [...after.events, event] };
}
