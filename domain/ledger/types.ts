export type GuardMode = "unsafe" | "versioned";
export type ExpenseStatus = "pending" | "approved" | "rejected";
export type Actor = "human" | "agent" | "system";
export type InvocationSource = "webmcp" | "local_control" | "system";

export type Expense = {
  id: string;
  employeeName: string;
  description: string;
  category: "equipment" | "travel" | "other";
  amountCents: number;
  status: ExpenseStatus;
  version: number;
  approvedFromReviewVersion?: number;
  approvedAmountCents?: number;
};

export type ReviewToken = {
  id: string;
  expenseId: string;
  inspectedVersion: number;
  inspectedAmountCents: number;
  createdAtRevision: number;
};

export type SemanticAction =
  | "inspect_expense"
  | "edit_expense_amount"
  | "approve_reviewed_expense"
  | "apply_version_guard"
  | "reset_lab";

export type SemanticEvent = {
  id: string;
  actor: Actor;
  action: SemanticAction;
  entityIds: string[];
  reads: string[];
  writes: string[];
  preStateHash: string;
  postStateHash: string;
  preVersion?: number;
  postVersion?: number;
  logicalTime: number;
  metadata: Record<string, string | number | boolean | null>;
};

export type ApprovalHistoryEntry = {
  id: string;
  expenseId: string;
  amountCents: number;
  expenseVersion: number;
  reviewedVersion: number;
  outcome: "approved" | "state_changed";
  logicalTime: number;
};

export type LedgerState = {
  expenses: Record<string, Expense>;
  selectedExpenseId: string | null;
  policyLimitCents: number;
  revision: number;
  guardMode: GuardMode;
};

export type LabSession = {
  id: string;
  scenarioId: "expense-approval";
  ledger: LedgerState;
  reviewTokens: Record<string, ReviewToken>;
  activeReviewTokenId: string | null;
  events: SemanticEvent[];
  approvalHistory: ApprovalHistoryEntry[];
  logicalTime: number;
  createdAt: string;
  updatedAt: string;
};

export type DomainErrorCode =
  | "EXPENSE_NOT_FOUND"
  | "EXPENSE_NOT_PENDING"
  | "INVALID_AMOUNT"
  | "REVIEW_NOT_FOUND"
  | "EXPECTED_VERSION_REQUIRED"
  | "STATE_CHANGED";

export type DomainResult<T> =
  | { ok: true; data: T; session: LabSession; event: SemanticEvent }
  | { ok: false; error: { code: DomainErrorCode; message: string }; session: LabSession; event?: SemanticEvent };
