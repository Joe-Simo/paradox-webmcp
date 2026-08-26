import { z } from "zod";

export const inspectExpenseInput = z.object({ expenseId: z.string().default("481") });
export const approveExpenseInput = z.object({ reviewToken: z.string().min(1), expectedVersion: z.number().int().optional() });
export const exploreInput = z.object({ sessionId: z.string().optional(), maxNodes: z.number().int().positive().max(50_000).default(50_000) });
export const findingInput = z.object({ findingId: z.string().min(1) });
export const resetInput = z.object({ scenarioId: z.literal("expense-approval").default("expense-approval") });
