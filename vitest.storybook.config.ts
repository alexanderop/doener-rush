import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
Runs every story as a browser test (render + a11y). Kept apart from
vitest.config.ts, which runs the node sim tests.
*/
export default defineConfig({
  plugins: [tailwindcss(), viteReact(), storybookTest({ configDir: ".storybook" })],
  resolve: { tsconfigPaths: true },
  // vite.config.ts defines this for the dev server; stories only need the shape
  define: { __BUILD_INFO__: JSON.stringify({ root: "storybook", commit: "", startedAt: "" }) },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      // full Chromium in new headless mode: reuses the browser Playwright already cached
      provider: playwright({ launchOptions: { channel: "chromium" } }),
      instances: [{ browser: "chromium" }],
    },
  },
});
