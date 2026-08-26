import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3400", trace: "on-first-retry" },
  webServer: {
    command: "bun run build && bun run start -- -p 3400",
    url: "http://127.0.0.1:3400",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
