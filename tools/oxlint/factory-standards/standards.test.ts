import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const project = fileURLToPath(new URL("../../../", import.meta.url));
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Lint one fixture file with the installed Oxlint binary and the real production config. */
function lint(path: string, code: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "factory-standards-")));
  roots.push(root);
  const config = JSON.parse(readFileSync(resolve(project, ".oxlintrc.json"), "utf8"));
  config.jsPlugins = config.jsPlugins.map((plugin: { name: string; specifier: string }) => ({
    ...plugin, specifier: resolve(project, plugin.specifier),
  }));
  for (const [file, text] of [[".oxlintrc.json", JSON.stringify(config)], [path, code]] as const) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }

  const result = spawnSync(resolve(project, "node_modules/.bin/oxlint"), ["--config", join(root, ".oxlintrc.json"), path], { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  expect(output).not.toMatch(/Failed to load|Failed to parse|panicked|Cannot find/u);
  return output;
}

const doc = "/** Documented. */\n";

describe("factory standards enforced by Oxlint", () => {
  it.each([
    ["a non-null assertion", "src/app/hud/x.ts", `${doc}export function f(m: Map<string, number>) { return m.get("a")!; }`, "no-unjustified-non-null-assertion"],
    ["a SAFETY comment on an unrelated earlier statement", "src/app/hud/x.ts", `${doc}export function f(m: Map<string, number>) {\n  // SAFETY: unrelated.\n  const a = 1;\n  return m.get("a")! + a;\n}`, "no-unjustified-non-null-assertion"],
    ["an undocumented export", "src/features/research/model.ts", "export const value = 1;", "require-export-jsdoc"],
    ["a line comment instead of JSDoc", "src/features/research/model.ts", "// Not JSDoc.\nexport type Value = number;", "require-export-jsdoc"],
    ["`| undefined` outside the simulation", "src/app/hud/x.ts", `${doc}export type Pick = string | undefined;`, "no-optional-values"],
    ["`| null` outside the simulation", "src/game/persistence/x.ts", `${doc}export function f(): string | null { return null; }`, "no-optional-values"],
    ["an optional property", "src/game/runtime/atoms.ts", `${doc}export interface Pick { readonly id?: string }`, "no-optional-values"],
    ["an optional parameter", "src/shared/x.ts", `${doc}export function f(id?: string) { return id; }`, "no-optional-values"],
    ["an Effect leaf import", "src/game/persistence/x.test.ts", 'import * as Arbitrary from "effect/Arbitrary";\n\nvoid Arbitrary;', "no-effect-leaf-imports"],
    ["instanceof on a tagged error", "scripts/x.ts", "class UsageError extends Error {}\nexport const f = (e: Error) => e instanceof UsageError;", "no-tagged-error-instanceof"],
    ["explicit any", "src/app/hud/x.ts", `${doc}export const f = (x: any) => x;`, "no-explicit-any"],
  ])("rejects %s", (_name, path, code, rule) => {
    expect(lint(path, code)).toContain(rule);
  });

  it.each([
    ["a non-null assertion under a SAFETY comment", "src/app/hud/x.ts", `${doc}export function f(xs: number[]) {\n  if (xs.length === 0) return 0;\n  // SAFETY: xs is non-empty, checked above.\n  return xs.at(0)!;\n}`],
    ["a non-null assertion in a test", "src/app/hud/x.test.ts", 'import { expect, it } from "vitest";\n\nit("a", () => { expect(new Map([["a", 1]]).get("a")!).toBe(1); });'],
    ["optional values in the simulation", "src/features/research/model.ts", `${doc}export interface Lab { readonly target?: string; readonly done: number | undefined }`],
    ["optional props in a React component", "src/app/hud/X.tsx", `${doc}export function X({ label }: { label?: string }) { return label; }`],
    ["optional values in the per-frame renderer", "src/game/runtime/canvas/x.ts", `${doc}export function f(id?: string): string | undefined { return id; }`],
    ["a documented export", "src/features/research/model.ts", `${doc}export const value = 1;`],
    ["Effect from the root", "src/game/persistence/x.ts", `import { Arbitrary } from "effect";\n\n${doc}export const a = Arbitrary;`],
    ["instanceof on a built-in error", "scripts/x.ts", "export const f = (e: unknown) => e instanceof TypeError;"],
  ])("allows %s", (_name, path, code) => {
    expect(lint(path, code)).not.toMatch(/factory-standards|no-explicit-any/u);
  });
});
