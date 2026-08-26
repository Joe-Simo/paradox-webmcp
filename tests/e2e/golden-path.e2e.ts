import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type ToolResult = Record<string, unknown> & { ok: boolean };

async function toolNames(page: import("@playwright/test").Page) {
  return page.evaluate(async () => (await document.modelContext?.getTools())?.map((tool) => tool.name) ?? []);
}

async function executeTool(page: import("@playwright/test").Page, name: string, input: object): Promise<ToolResult> {
  const serialized = await page.evaluate(async ({ toolName, toolInput }) => {
    const context = document.modelContext;
    if (!context) throw new Error("modelContext missing");
    const registered = (await context.getTools()).find((tool) => tool.name === toolName);
    if (!registered) throw new Error(`Tool ${toolName} is not registered.`);
    return context.executeTool(registered, toolInput);
  }, { toolName: name, toolInput: input });
  return JSON.parse(serialized) as ToolResult;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type Tool = {
      name: string;
      description: string;
      execute: (input: unknown, options: { signal: AbortSignal }) => Promise<string>;
    };
    const tools = new Map<string, Tool>();
    const context = new class extends EventTarget {
      async registerTool(tool: Tool, options?: { signal?: AbortSignal }) {
        if (tools.has(tool.name)) throw new DOMException("Tool already registered.", "InvalidStateError");
        tools.set(tool.name, tool);
        const remove = () => {
          if (tools.get(tool.name) !== tool) return;
          tools.delete(tool.name);
          this.dispatchEvent(new Event("toolchange"));
        };
        options?.signal?.addEventListener("abort", remove, { once: true });
        this.dispatchEvent(new Event("toolchange"));
      }
      async getTools() {
        return [...tools.values()].map(({ name, description }) => ({ name, description }));
      }
      async executeTool(registered: { name: string }, input: object = {}, options?: { signal?: AbortSignal }) {
        const tool = tools.get(registered.name);
        if (!tool) throw new DOMException("Tool is no longer registered.", "InvalidStateError");
        return tool.execute(input, { signal: options?.signal ?? new AbortController().signal });
      }
    }();
    Object.defineProperty(document, "modelContext", { configurable: true, value: context });
  });
});

test("records, explores, repairs, and verifies the golden race", async ({ page }) => {
  await page.goto("/lab/expense-approval/ledger");
  await page.getByRole("button", { name: "Inspect expense" }).click();
  await expect(page.getByText("review_expense_481_v7", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit amount" }).click();
  await page.getByLabel("Amount (USD)").fill("23999");
  await page.getByRole("button", { name: "Commit change" }).click();
  await expect(page.getByText("$23,999").first()).toBeVisible();
  await page.getByRole("button", { name: "Complete review" }).click();
  await expect(page.getByText("approved", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Explore futures/ }).click();
  await page.getByRole("button", { name: "Explore futures" }).click();
  await expect(page.getByText("A stale belief crossed a commit boundary.")).toBeVisible();
  await page.getByRole("link", { name: /Focus counterexample/ }).click();
  await expect(page.getByRole("heading", { name: /The agent approved a state/ })).toBeVisible();
  await page.getByRole("button", { name: /Apply version guard/ }).click();
  await page.getByRole("button", { name: "Verify repair" }).click();
  await expect(page.getByText("Counterexample eliminated within the explored model.")).toBeVisible();
  await expect(page.getByText("STATE_CHANGED")).toBeVisible();
});

test("runs the complete dynamic WebMCP lifecycle without route-assisted tool changes", async ({ page }) => {
  await page.goto("/lab/expense-approval/ledger");
  await expect.poll(() => toolNames(page)).toEqual(["inspect_expense", "approve_reviewed_expense"]);

  const inspection = await executeTool(page, "inspect_expense", { expenseId: "481" });
  expect(inspection).toMatchObject({ ok: true, reviewToken: "review_expense_481_v7", version: 7 });
  expect(inspection).not.toHaveProperty("session");

  await page.getByRole("button", { name: "Edit amount" }).click();
  await page.getByLabel("Amount (USD)").fill("23999");
  await page.getByRole("button", { name: "Commit change" }).click();
  const approval = await executeTool(page, "approve_reviewed_expense", { reviewToken: "review_expense_481_v7" });
  expect(approval).toMatchObject({ ok: true, amountCents: 2_399_900, version: 8, status: "approved" });
  expect(approval).not.toHaveProperty("session");

  await page.goto("/lab/expense-approval");
  await expect.poll(() => toolNames(page)).toEqual(["inspect_lab", "explore_futures", "reset_lab"]);
  const exploration = await executeTool(page, "explore_futures", { maxNodes: 50_000 });
  expect(exploration.ok).toBe(true);
  expect(Number(exploration.counterexamples)).toBeGreaterThan(0);
  const findingId = String(exploration.findingId);

  await expect.poll(() => toolNames(page)).toEqual(["inspect_lab", "inspect_counterexample", "apply_version_guard", "reset_lab"]);
  const counterexample = await executeTool(page, "inspect_counterexample", { findingId });
  expect(counterexample).toMatchObject({
    ok: true,
    sequence: ["inspect_expense", "edit_expense_amount", "approve_reviewed_expense"],
  });
  const guard = await executeTool(page, "apply_version_guard", { findingId });
  expect(guard).toEqual({ ok: true, guardMode: "versioned" });
  await expect(page.getByRole("heading", { name: /The dangerous future/ })).toBeVisible();

  await expect.poll(() => toolNames(page)).toEqual(["inspect_lab", "verify_repair", "reset_lab"]);
  const verification = await executeTool(page, "verify_repair", { findingId });
  expect(verification).toMatchObject({
    ok: true,
    exactReplay: { blocked: true, code: "STATE_CHANGED" },
    verified: true,
    counterexamples: 0,
  });
  await expect(page.getByText("Counterexample eliminated within the explored model.")).toBeVisible();
});

test("has no serious accessibility violations on the primary Ledger surface", async ({ page }) => {
  await page.goto("/lab/expense-approval/ledger");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious).toEqual([]);
});
