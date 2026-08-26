import { openDB, type DBSchema } from "idb";
import type { LabSession } from "@/domain/ledger/types";
import type { CounterexampleFinding, ExplorationResult, VerificationReport } from "@/paradox/explorer/types";

interface ParadoxDB extends DBSchema {
  sessions: { key: string; value: LabSession };
  runs: { key: string; value: ExplorationResult };
  findings: { key: string; value: CounterexampleFinding };
  verifications: { key: string; value: VerificationReport };
}

const DB_NAME = "paradox-correctness-lab";
const ACTIVE_SESSION_ID = "expense-approval-golden";

function database() {
  return openDB<ParadoxDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("sessions");
      db.createObjectStore("runs");
      db.createObjectStore("findings");
      db.createObjectStore("verifications");
    },
  });
}

export async function loadWorkspace() {
  const db = await database();
  const session = await db.get("sessions", ACTIVE_SESSION_ID);
  const runs = await db.getAll("runs");
  const findings = await db.getAll("findings");
  const verifications = await db.getAll("verifications");
  return {
    session,
    run: runs.at(-1),
    finding: findings.at(-1),
    verification: verifications.at(-1),
  };
}

export async function saveSession(session: LabSession) {
  const db = await database();
  await db.put("sessions", session, ACTIVE_SESSION_ID);
}

export async function saveRun(run: ExplorationResult) {
  const db = await database();
  const transaction = db.transaction(["runs", "findings"], "readwrite");
  await transaction.objectStore("runs").put(run, run.id);
  if (run.finding) await transaction.objectStore("findings").put(run.finding, run.finding.id);
  await transaction.done;
}

export async function saveVerification(report: VerificationReport) {
  const db = await database();
  await db.put("verifications", report, report.id);
}

export async function clearWorkspace() {
  const db = await database();
  const transaction = db.transaction(["sessions", "runs", "findings", "verifications"], "readwrite");
  await Promise.all([
    transaction.objectStore("sessions").clear(),
    transaction.objectStore("runs").clear(),
    transaction.objectStore("findings").clear(),
    transaction.objectStore("verifications").clear(),
  ]);
  await transaction.done;
}
