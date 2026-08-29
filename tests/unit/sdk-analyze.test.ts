import { describe, expect, it } from "vitest";
import { analyzeRecording, createRecorder, verifyRecordingRepair } from "@/sdk";

// The expense race, discovered fully automatically from a recording —
// no model written, no invariant written. Read/write declarations only.

function recordExpenseSession() {
  const recorder = createRecorder();
  recorder.record("inspect_expense", {
    actor: "agent",
    reads: ["expense:481:amount", "expense:481:version"],
    writes: ["review:481"],
  });
  recorder.record("edit_expense_amount", {
    actor: "human",
    reads: ["expense:481:amount"],
    writes: ["expense:481:amount", "expense:481:version"],
  });
  recorder.record("approve_reviewed_expense", {
    actor: "agent",
    reads: ["review:481", "expense:481:version"],
    writes: ["expense:481:status"],
  });
  return recorder.events();
}

describe("automatic recording analysis", () => {
  it("finds the stale-commit race with no hand-written model", () => {
    const analysis = analyzeRecording(recordExpenseSession());
    expect(analysis.exploration.complete).toBe(true);
    expect(analysis.exploration.counterexamples).toBeGreaterThan(0);
    expect(analysis.hazard).not.toBeNull();
    expect(analysis.hazard?.operation).toBe("approve_reviewed_expense");
    expect(analysis.hazard?.actor).toBe("agent");
    expect(analysis.hazard?.overwrittenReads).toContain("expense:481:version");
    expect(analysis.minimizedOperations).toContain("approve_reviewed_expense");
    expect(analysis.minimizedOperations).toContain("edit_expense_amount");
  });

  it("proves the version-guarded repair automatically", () => {
    const events = recordExpenseSession();
    const unsafe = analyzeRecording(events);
    const trace = unsafe.exploration.counterexample?.trace;
    expect(trace).toBeDefined();
    // Guarding approve alone is insufficient: the analyzer also catches the
    // subtler race where inspect commits its review token on an overwritten
    // read. Every read-then-write operation carries the guard.
    const verdict = verifyRecordingRepair(events, trace ?? [], { guarded: ["inspect_expense", "approve_reviewed_expense"] });
    expect(verdict.exactReplay.violationReproduced).toBe(false);
    expect(verdict.exploration.counterexamples).toBe(0);
    expect(verdict.verified).toBe(true);
  });

  it("stays quiet when operations do not interfere", () => {
    const recorder = createRecorder();
    recorder.record("read_report", { actor: "agent", reads: ["report:1"], writes: [] });
    recorder.record("update_profile", { actor: "human", reads: ["profile:2"], writes: ["profile:2"] });
    const analysis = analyzeRecording(recorder.events());
    expect(analysis.exploration.counterexamples).toBe(0);
    expect(analysis.hazard).toBeNull();
  });

  it("distinguishes duplicate actions in one recording", () => {
    const recorder = createRecorder();
    recorder.record("edit", { actor: "human", reads: ["x"], writes: ["x"] });
    recorder.record("edit", { actor: "human", reads: ["x"], writes: ["x"] });
    const analysis = analyzeRecording(recorder.events());
    expect(analysis.exploration.complete).toBe(true);
  });
});
