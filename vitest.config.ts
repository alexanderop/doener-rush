import { defineConfig } from "vitest/config";

/**
Separate from vite.config.ts on purpose: that one loads the TanStack Start plugin.
`.ts` import extensions and the `#/` alias (package.json "imports") resolve natively in Vite.
*/
export default defineConfig({
  test: {
    // Oxlint subprocess fixtures must not compete with randomized simulation properties.
    projects: [
      {
        test: {
          name: "game",
          maxWorkers: 4,
          include: ["src/**/*.test.ts"],
          environment: "node",
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "architecture",
          include: ["tools/oxlint/factory-{architecture,standards}/**/*.test.ts"],
          environment: "node",
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
