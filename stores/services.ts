"use client";

import {
  applyVersionGuard,
  approveReviewedExpense,
  createInitialSession,
  editExpenseAmount,
  inspectExpense,
} from "@/domain/ledger/model";
import { canonicalHash } from "@/domain/ledger/hash";
import type { DomainResult } from "@/domain/ledger/types";
import type { ExplorationResult, VerificationReport, WorkerRequest, WorkerResponse } from "@/paradox/explorer/types";
import { paradoxStore } from "./paradox-store";
import { clearWorkspace, loadWorkspace, saveRun, saveSession, saveVerification } from "./persistence";

let hydrationPromise: Promise<void> | null = null;

export function hydrateWorkspace() {
  if (paradoxStore.getState().hydrated) return Promise.resolve();
  hydrationPromise ??= (async () => {
    const persisted = await loadWorkspace();
    const session = persisted.session ?? createInitialSession();
    if (!persisted.session) await saveSession(session);
    paradoxStore.setState({
      hydrated: true,
      session,
      run: persisted.run ?? null,
      finding: persisted.finding ?? persisted.run?.finding ?? null,
      verification: persisted.verification ?? null,
    });
  })().finally(() => {
    hydrationPromise = null;
  });
  return hydrationPromise;
}

async function commitResult<T>(result: DomainResult<T>) {
  paradoxStore.setState({ session: result.session, notice: result.ok ? null : result.error.message });
  await saveSession(result.session);
  return result;
}

export async function inspectExpenseService(expenseId = "481") {
  await hydrateWorkspace();
  return commitResult(inspectExpense(paradoxStore.getState().session, expenseId));
}

export async function editExpenseService(expenseId: string, amountCents: number) {
  await hydrateWorkspace();
  return commitResult(editExpenseAmount(paradoxStore.getState().session, expenseId, amountCents));
}

export async function approveExpenseService(reviewToken: string, expectedVersion?: number) {
  await hydrateWorkspace();
  return commitResult(approveReviewedExpense(paradoxStore.getState().session, reviewToken, expectedVersion));
}

function runWorker(request: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../paradox/worker/explorer.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === "PROGRESS") {
        paradoxStore.setState({ progress: data.visited });
        return;
      }
      worker.terminate();
      resolve(data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage(request);
  });
}

export async function exploreFuturesService(maxNodes = 50_000): Promise<ExplorationResult> {
  await hydrateWorkspace();
  const state = paradoxStore.getState();
  const runId = `request_${canonicalHash({ session: state.session.id, at: state.session.logicalTime, guard: state.session.ledger.guardMode })}`;
  paradoxStore.setState({ exploring: true, progress: 0, notice: null });
  try {
    const response = await runWorker({
      type: "EXPLORE",
      runId,
      session: state.session,
      guardMode: state.session.ledger.guardMode,
      maxNodes,
    });
    if (response.type !== "COMPLETE") throw new Error(response.type === "ERROR" ? response.message : "Unexpected exploration response.");
    await saveRun(response.result);
    paradoxStore.setState({ run: response.result, finding: response.result.finding, exploring: false });
    return response.result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exploration failed.";
    paradoxStore.setState({ exploring: false, notice: message });
    throw error;
  }
}

export async function applyVersionGuardService() {
  await hydrateWorkspace();
  const session = applyVersionGuard(paradoxStore.getState().session);
  paradoxStore.setState({ session, verification: null, notice: null });
  await saveSession(session);
  return { ok: true as const, guardMode: session.ledger.guardMode };
}

export async function verifyRepairService(maxNodes = 50_000): Promise<VerificationReport> {
  await hydrateWorkspace();
  const state = paradoxStore.getState();
  if (!state.finding) throw new Error("Explore the session before verifying a repair.");
  const guarded = state.session.ledger.guardMode === "versioned" ? state.session : applyVersionGuard(state.session);
  if (guarded !== state.session) await saveSession(guarded);
  paradoxStore.setState({ session: guarded, exploring: true, progress: 0, notice: null });
  const runId = `verify_${state.finding.id}`;
  try {
    const response = await runWorker({ type: "VERIFY", runId, session: guarded, finding: state.finding, maxNodes });
    if (response.type !== "VERIFIED") throw new Error(response.type === "ERROR" ? response.message : "Unexpected verification response.");
    await saveRun(response.report.exploration);
    await saveVerification(response.report);
    paradoxStore.setState({ run: response.report.exploration, verification: response.report, exploring: false });
    return response.report;
  } catch (error) {
    paradoxStore.setState({ exploring: false, notice: error instanceof Error ? error.message : "Verification failed." });
    throw error;
  }
}

export async function resetLabService() {
  await hydrateWorkspace();
  await clearWorkspace();
  const session = createInitialSession();
  await saveSession(session);
  paradoxStore.setState({
    hydrated: true,
    session,
    run: null,
    finding: null,
    verification: null,
    exploring: false,
    progress: 0,
    notice: null,
  });
  return { ok: true as const, initialStateHash: canonicalHash(session.ledger) };
}
