import { openDB, type DBSchema } from "idb";
import type { LabSession } from "@/domain/ledger/types";
import type { CounterexampleFinding, ExplorationResult, VerificationReport } from "@/paradox/explorer/types";

interface ParadoxDB extends DBSchema {
  sessions: { key: string; value: LabSession };
  runs: { key: string; value: ExplorationResult };
  findings: { key: string; value: CounterexampleFinding };
  verifications: { key: string; value: VerificationReport };
  workspace: {
    key: "active";
    value: { runId?: string; findingId?: string; verificationId?: string };
  };
}

const DB_NAME = "paradox-correctness-lab";
const ACTIVE_SESSION_ID = "expense-approval-golden";

function database() {
  return openDB<ParadoxDB>(DB_NAME, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions");
      if (!db.objectStoreNames.contains("runs")) db.createObjectStore("runs");
      if (!db.objectStoreNames.contains("findings")) db.createObjectStore("findings");
      if (!db.objectStoreNames.contains("verifications")) db.createObjectStore("verifications");
      if (!db.objectStoreNames.contains("workspace")) db.createObjectStore("workspace");
    },
  });
}

export async function loadWorkspace() {
  const db = await database();
  const session = await db.get("sessions", ACTIVE_SESSION_ID);
  const active = await db.get("workspace", "active");
  const run = active?.runId ? await db.get("runs", active.runId) : undefined;
  const finding = active?.findingId ? await db.get("findings", active.findingId) : undefined;
  const verification = active?.verificationId ? await db.get("verifications", active.verificationId) : undefined;
  return {
    session,
    run,
    finding,
    verification,
  };
}

export async function saveSession(session: LabSession) {
  const db = await database();
  await db.put("sessions", session, ACTIVE_SESSION_ID);
}

export async function saveRun(run: ExplorationResult) {
  const db = await database();
  const transaction = db.transaction(["runs", "findings", "workspace"], "readwrite");
  const active = await transaction.objectStore("workspace").get("active");
  await transaction.objectStore("runs").put(run, run.id);
  if (run.finding) await transaction.objectStore("findings").put(run.finding, run.finding.id);
  await transaction.objectStore("workspace").put({
    runId: run.id,
    findingId: run.finding?.id ?? active?.findingId,
    verificationId: active?.verificationId,
  }, "active");
  await transaction.done;
}

export async function saveVerification(report: VerificationReport) {
  const db = await database();
  const transaction = db.transaction(["verifications", "workspace"], "readwrite");
  await transaction.objectStore("verifications").put(report, report.id);
  const active = await transaction.objectStore("workspace").get("active");
  await transaction.objectStore("workspace").put({ ...active, verificationId: report.id }, "active");
  await transaction.done;
}

export async function clearDerivedWorkspace() {
  const db = await database();
  const transaction = db.transaction(["runs", "findings", "verifications", "workspace"], "readwrite");
  await Promise.all([
    transaction.objectStore("runs").clear(),
    transaction.objectStore("findings").clear(),
    transaction.objectStore("verifications").clear(),
    transaction.objectStore("workspace").clear(),
  ]);
  await transaction.done;
}

export async function clearWorkspace() {
  const db = await database();
  const transaction = db.transaction(["sessions", "runs", "findings", "verifications", "workspace"], "readwrite");
  await Promise.all([
    transaction.objectStore("sessions").clear(),
    transaction.objectStore("runs").clear(),
    transaction.objectStore("findings").clear(),
    transaction.objectStore("verifications").clear(),
    transaction.objectStore("workspace").clear(),
  ]);
  await transaction.done;
}
