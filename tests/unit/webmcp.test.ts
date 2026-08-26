import { afterEach, describe, expect, it } from "vitest";
import { applyVersionGuard, approveReviewedExpense, createInitialSession, editExpenseAmount, inspectExpense } from "@/domain/ledger/model";
import { exploreSession } from "@/paradox/explorer/engine";
import { paradoxStore } from "@/stores/paradox-store";
import { toolsForSurface } from "@/webmcp/registry";

function recordedSession() {
  const inspected = inspectExpense(createInitialSession(), "481");
  if (!inspected.ok) throw new Error("inspection failed");
  const edited = editExpenseAmount(inspected.session, "481", 2_399_900);
  if (!edited.ok) throw new Error("edit failed");
  const approved = approveReviewedExpense(edited.session, inspected.data.reviewToken);
  if (!approved.ok) throw new Error("approval failed");
  return approved.session;
}

afterEach(() => {
  paradoxStore.setState({ session: createInitialSession(), run: null, finding: null, verification: null });
});

describe("WebMCP registry", () => {
  it("advances the active tool surface from exploration to repair to verification without navigation", () => {
    expect(toolsForSurface("lab").map((tool) => tool.name)).toEqual(["inspect_lab", "explore_futures", "reset_lab"]);

    const session = recordedSession();
    const run = exploreSession(session);
    if (!run.finding) throw new Error("finding missing");
    paradoxStore.setState({ session, run, finding: run.finding });
    expect(toolsForSurface("lab").map((tool) => tool.name)).toEqual([
      "inspect_lab",
      "inspect_counterexample",
      "apply_version_guard",
      "reset_lab",
    ]);

    paradoxStore.setState({ session: applyVersionGuard(session) });
    expect(toolsForSurface("lab").map((tool) => tool.name)).toEqual(["inspect_lab", "verify_repair", "reset_lab"]);
  });

  it("returns structured cancellation and validation errors", async () => {
    const controller = new AbortController();
    controller.abort();
    const cancelled = await toolsForSurface("lab")[1].execute({}, { signal: controller.signal });
    expect(JSON.parse(cancelled)).toMatchObject({ ok: false, code: "CANCELLED" });

    const session = recordedSession();
    const run = exploreSession(session);
    if (!run.finding) throw new Error("finding missing");
    paradoxStore.setState({ session, run, finding: run.finding });
    const inspectFinding = toolsForSurface("lab").find((tool) => tool.name === "inspect_counterexample");
    if (!inspectFinding) throw new Error("inspect_counterexample missing");
    const invalid = await inspectFinding.execute({}, { signal: new AbortController().signal });
    expect(JSON.parse(invalid)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});
