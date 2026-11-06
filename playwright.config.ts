import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { checkout } from "./scripts/lib/checkout.ts";

const { baseUrl } = checkout();

const testDir = defineBddConfig({
  features: "e2e/features/*.feature",
  steps: ["e2e/fixtures.ts", "e2e/steps/*.ts"],
  // "Given I have 4 …" sets the inventory, "Then I have 4 …" checks it
  matchKeywords: true,
});

export default defineConfig({
  testDir,
  // headless Chromium renders WebGL on the CPU; parallel browsers starve each other and the game loop slows
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  // `__game` only exists in a dev build
  webServer: { command: "pnpm dev", url: baseUrl, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
