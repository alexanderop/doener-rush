import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { featureDependencies, policyProblems } from "./policy.ts";

const project = fileURLToPath(new URL("../../../", import.meta.url));
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixtureFile(root: string, path: string, code: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, code);
}

/** Exercise the installed Oxlint binary and real orders config, rather than mocking AST nodes. */
function lint(path: string, code: string, setup?: (root: string) => void): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "factory-architecture-")));
  roots.push(root);
  const config = JSON.parse(readFileSync(resolve(project, ".oxlintrc.json"), "utf8"));
  config.jsPlugins = config.jsPlugins.map((plugin: { name: string; specifier: string }) => ({
    ...plugin, specifier: resolve(project, plugin.specifier),
  }));
  fixtureFile(root, ".oxlintrc.json", JSON.stringify(config));
  fixtureFile(root, path, code);
  setup?.(root);
  const result = spawnSync(resolve(project, "node_modules/.bin/oxlint"), [
    "--config", join(root, ".oxlintrc.json"), path,
  ], { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  expect(output).not.toMatch(/Failed to load|Failed to parse|panicked|Cannot find/u);
  expect([0, 1]).toContain(result.status);
  return output;
}

describe("factory architecture enforced by Oxlint", () => {
  it.each([
    ["same feature internals", "src/features/kitchen/simulation.ts", 'import "./selectors";'],
    ["declared feature dependency", "src/features/orders/simulation.ts", 'import "../kitchen/public";'],
    ["alias feature dependency", "src/features/orders/simulation.ts", 'import "@/features/kitchen/public.ts";'],
    ["core primitives", "src/features/kitchen/simulation.ts", 'import "#/game/core/inventory";'],
    ["UI primitives", "src/features/kitchen/ui/Dialog.tsx", 'import "#/shared/ui/button";'],
    ["UI runtime bridge", "src/features/kitchen/ui/Dialog.tsx", 'import "#/game/runtime/client";'],
    ["runtime composes features", "src/game/runtime/step.ts", 'import "#/features/kitchen/public";'],
    ["app composes UI", "src/app/GameScreen.tsx", 'import "#/features/kitchen/client";'],
    ["persistence composes features", "src/game/persistence/save.ts", 'import "#/features/kitchen/public";'],
    ["app integration", "src/app/hud/ResearchDialog.tsx", 'import "#/features/kitchen/client";'],
    ["route importing a feature client entry", "src/routes/play.tsx", 'import "#/features/kitchen/client";'],
    ["route importing app composition", "src/routes/play.tsx", 'import "#/app/GameScreen";'],
    ["router importing the generated route tree", "src/router.tsx", 'import "./routeTree.gen.ts";'],
    ["test tooling", "src/features/kitchen/simulation.test.ts", 'import "node:fs";'],
    ["story tooling", "src/app/hud/Quickbar.stories.tsx", 'import "../../../.storybook/preview";'],
    ["a context module with type-only imports", "src/game/runtime/contexts.ts", 'import { createContext } from "react";\nimport type { World } from "./world.ts";\nimport { type Command } from "./world.ts";\n\n/** The world. */\nexport const WorldContext = createContext<[World, Command] | null>(null);'],
    ["a module without a context importing at runtime", "src/game/runtime/WorldProvider.tsx", 'import { useMemo } from "react";\nimport { mapSceneOf } from "./canvas/map-scene.ts";\n\nexport { useMemo, mapSceneOf };'],
  ])("allows %s", (_name, path, code) => {
    expect(lint(path, code)).not.toContain("error ");
  });

  it.each([
    ["alias internals", "src/features/orders/simulation.ts", 'import "#/features/kitchen/selectors.ts";', "public-api"],
    ["relative internals", "src/features/orders/simulation.ts", 'import "../kitchen/selectors";', "public-api"],
    ["undeclared dependency", "src/features/kitchen/simulation.ts", 'import "../orders/public";', "boundaries"],
    ["type-only dependency", "src/features/kitchen/model.ts", 'import type { Power } from "../cooks/public"; export type View = Power;', "boundaries"],
    ["re-export", "src/features/orders/public.ts", 'export { value } from "../kitchen/selectors";', "public-api"],
    ["export star", "src/features/orders/public.ts", 'export * from "../kitchen/selectors";', "public-api"],
    ["literal dynamic import", "src/features/orders/simulation.ts", 'void import("../kitchen/selectors");', "public-api"],
    ["nonliteral dynamic import", "src/features/orders/simulation.ts", 'const path = "../kitchen/public"; void import(path);', "boundaries"],
    ["template dynamic import", "src/features/orders/simulation.ts", 'void import(`../kitchen/public`);', "boundaries"],
    ["TypeScript import type", "src/features/orders/model.ts", 'export type View = import("../kitchen/selectors").View;', "public-api"],
    ["require", "src/features/orders/simulation.ts", 'require("../kitchen/selectors");', "public-api"],
    ["import equals", "src/features/orders/simulation.ts", 'import Research = require("../kitchen/selectors"); export { Research };', "public-api"],
    ["unknown feature", "src/features/mystery/model.ts", 'export const value = 1;', "boundaries"],
    ["unknown target", "src/app/GameScreen.tsx", 'import "#/features/mystery/public";', "boundaries"],
    ["shared importing feature", "src/shared/ui/button.tsx", 'import "#/features/kitchen/client";', "boundaries"],
    ["core importing feature", "src/game/core/inventory.ts", 'import "#/features/kitchen/public";', "boundaries"],
    ["feature importing an unknown layer", "src/features/kitchen/ui/Dialog.tsx", 'import "#/game/atoms";', "boundaries"],
    ["stray file in src/game", "src/game/foo.ts", 'export const value = 1;', "not in a known layer"],
    ["stray top-level folder", "src/utils/x.ts", 'export const value = 1;', "not in a known layer"],
    ["stray file importing nothing", "src/helpers.ts", 'export const value = 1;', "not in a known layer"],
    ["importing a stray module", "src/app/GameScreen.tsx", 'import "#/utils/x";', "boundaries"],
    ["route importing feature internals", "src/routes/play.tsx", 'import "#/features/kitchen/ui/Dialog";', "public-api"],
    ["route importing runtime internals", "src/routes/play.tsx", 'import { place } from "#/game/runtime/world.ts";\n\nplace();', "no-restricted-imports"],
    ["runtime depending on a route", "src/game/runtime/step.ts", 'import "#/routes/play";', "boundaries"],
    ["story importing an arbitrary storybook module", "src/app/hud/Quickbar.stories.tsx", 'import "../../../.storybook/main";', "boundaries"],
    ["non-story importing storybook", "src/app/hud/Quickbar.tsx", 'import "../../../.storybook/preview";', "boundaries"],
    ["feature importing runtime world", "src/features/kitchen/model.ts", 'import "#/game/runtime/world";', "boundaries"],
    ["feature importing persistence", "src/features/kitchen/save.ts", 'import "#/game/persistence/save";', "boundaries"],
    ["React in simulation", "src/features/kitchen/simulation.ts", 'import "react";', "simulation-purity"],
    ["Effect in simulation", "src/features/kitchen/model.ts", 'import "effect/Schema";', "simulation-purity"],
    ["feature UI in simulation", "src/features/kitchen/public.ts", 'export * from "./client";', "simulation-purity"],
    ["runtime bridge in simulation", "src/features/kitchen/simulation.ts", 'import "#/game/runtime/client";', "simulation-purity"],
    ["shared browser utility in simulation", "src/features/kitchen/simulation.ts", 'import "#/shared/graphics/canvas";', "simulation-purity"],
    ["node I/O in simulation", "src/features/kitchen/simulation.ts", 'import "node:fs";', "simulation-purity"],
    ["bare Node built-in", "src/features/kitchen/simulation.ts", 'import "fs";', "simulation-purity"],
    ["a context module importing sim code", "src/game/runtime/contexts.ts", 'import { createContext } from "react";\nimport { mapSceneOf } from "./canvas/map-scene.ts";\n\nexport const SceneContext = createContext(mapSceneOf);', "context-leaf"],
    ["a context module re-exporting", "src/game/runtime/contexts.ts", 'import { createContext } from "react";\n\nexport const SceneContext = createContext(null);\n\nexport { useScene } from "./scene.ts";', "context-leaf"],
    ["unknown local alias", "src/features/kitchen/simulation.ts", 'import "#internal";', "boundaries"],
    ["runtime depending on persistence", "src/game/runtime/step.ts", 'import "#/game/persistence/save";', "boundaries"],
    ["app depending on feature internals", "src/app/GameScreen.tsx", 'import "#/features/kitchen/ui/Dialog";', "public-api"],
    ["test boundaries still enforced", "src/features/kitchen/simulation.test.ts", 'import "../orders/public";', "boundaries"],
    ["legacy alias loophole", "src/game/runtime/kitchen.ts", 'import "#/game/atoms";', "simulation-purity"],
    ["browser global in feature simulation", "src/features/kitchen/simulation.ts", 'window.alert("hello");', "no-restricted-globals"],
    ["random in feature simulation", "src/features/kitchen/simulation.ts", 'Math.random();', "no-restricted-properties"],
  ])("rejects %s", (_name, path, code, rule) => {
    expect(lint(path, code)).toContain(rule);
  });

  it("resolves index files rather than treating a public directory as the entry point", () => {
    expect(lint("src/features/orders/simulation.ts", 'import "../kitchen/public";', (root) => {
      fixtureFile(root, "src/features/kitchen/public/index.ts", "export {};");
    })).toContain("public-api");
  });

  it("rejects a public entry point symlink to feature internals", () => {
    expect(lint("src/features/orders/simulation.ts", 'import "../kitchen/public";', (root) => {
      fixtureFile(root, "src/features/kitchen/selectors.ts", "export {};");
      symlinkSync("selectors.ts", join(root, "src/features/kitchen/public.ts"));
    })).toContain("public-api");
  });

  it("allows .js specifiers that resolve to the public .ts entry point", () => {
    expect(lint("src/features/orders/simulation.ts", 'import "../kitchen/public.js";', (root) => {
      fixtureFile(root, "src/features/kitchen/public.ts", "export {};");
    })).not.toContain("error ");
  });
});

describe("feature dependency policy", () => {
  it("has registered dependencies and no cycles", () => {
    expect(policyProblems(featureDependencies)).toEqual([]);
  });

  it("rejects undeclared targets", () => {
    expect(policyProblems(new Map([["kitchen", ["missing"]]]))).toEqual([
      "kitchen depends on unregistered feature missing",
    ]);
  });

  it("rejects indirect cycles", () => {
    expect(policyProblems(new Map([
      ["kitchen", ["orders"]], ["orders", ["cooks"]], ["cooks", ["kitchen"]],
    ]))).toEqual(["Feature dependency cycle: kitchen -> orders -> cooks -> kitchen"]);
  });

  it("rejects self dependencies", () => {
    expect(policyProblems(new Map([["kitchen", ["kitchen"]]]))).toEqual([
      "Feature dependency cycle: kitchen -> kitchen",
    ]);
  });
});
