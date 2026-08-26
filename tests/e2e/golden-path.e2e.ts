import { expect, test } from "@playwright/test";

test("records, explores, repairs, and verifies the golden race", async ({ page }) => {
  await page.goto("/lab/expense-approval/ledger");
  await page.getByRole("button", { name: "Inspect expense" }).click();
  await expect(page.getByText("review_expense_481_v7")).toBeVisible();
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
