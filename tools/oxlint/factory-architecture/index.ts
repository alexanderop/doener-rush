import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import { builtinModules } from "node:module";
import { ownerOf, resolveLocal } from "./paths.ts";
import type { Owner } from "./paths.ts";
import { featureDependencies } from "./policy.ts";

type Check = (from: Owner, to: Owner | null, source: string) => string | null;

const nodeModules = new Set(builtinModules);

function visits(context: Context, check: Check) {
  const from = ownerOf(context.cwd, context.filename);

  function inspect(node: ESTree.Node, source: string): void {
    const target = resolveLocal(context.cwd, context.filename, source);
    const problem = check(from, target === null ? null : ownerOf(context.cwd, target), source);
    if (problem) context.report({ node, messageId: "violation", data: { problem } });
  }

  return {
    ImportDeclaration(node: ESTree.ImportDeclaration) { inspect(node.source, node.source.value); },
    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
      if (node.source) inspect(node.source, node.source.value);
    },
    ExportAllDeclaration(node: ESTree.ExportAllDeclaration) { inspect(node.source, node.source.value); },
    TSImportType(node: ESTree.TSImportType) { inspect(node.source, node.source.value); },
    TSExternalModuleReference(node: ESTree.TSExternalModuleReference) { inspect(node.expression, node.expression.value); },
    ImportExpression(node: ESTree.ImportExpression) {
      if (node.source.type === "Literal" && typeof node.source.value === "string") {
        inspect(node.source, node.source.value);
      } else if (check === boundaryProblem && (from.layer !== "outside" || (from.simulation && !from.test))) {
        context.report({ node, messageId: "violation", data: { problem: "Use a literal dynamic import so architecture boundaries can be checked." } });
      }
    },
    CallExpression(node: ESTree.CallExpression) {
      if (node.callee.type !== "Identifier" || node.callee.name !== "require") return;
      const argument = node.arguments[0];
      if (argument?.type === "Literal" && typeof argument.value === "string") {
        inspect(argument, argument.value);
      } else if (check === boundaryProblem && (from.layer !== "outside" || (from.simulation && !from.test))) {
        context.report({ node, messageId: "violation", data: { problem: "Use a literal require so architecture boundaries can be checked." } });
      }
    },
  };
}

function boundaryProblem(from: Owner, to: Owner | null, source: string): string | null {
  if (from.layer === "outside") return null;
  if (to === null) {
    if (source.startsWith("#") || source.startsWith("@/")) {
      return `Unrecognized local alias ${source}; use #/ or @/.`;
    }

    return null;
  }

  if (to.feature && !featureDependencies.has(to.feature)) return `Register feature ${to.feature} in the architecture policy.`;
  // Stories are Storybook test tooling: only they may import the shared preview and input helpers.
  if (from.path.endsWith(".stories.tsx") && /^\.storybook\/(?:preview|input)(?:\.tsx?)?$/u.test(to.path)) return null;
  if (to.layer === "unknown" || to.layer === "outside") return `${from.path} cannot depend on module outside the architecture layers: ${to.path}.`;
  if (from.layer === "shared" && to.layer !== "shared") return "Shared code cannot depend on game or feature code.";
  if (from.layer === "core" && to.layer !== "core") return "Game core cannot depend on features, runtime, persistence or browser utilities.";
  if (from.layer === "feature") {
    if (to.feature && to.feature !== from.feature &&
        !featureDependencies.get(from.feature ?? "")?.includes(to.feature)) {
      return `${from.feature} has no declared dependency on ${to.feature}.`;
    }

    if (to.layer === "app" || to.layer === "persistence") return "Features cannot depend on app composition or persistence orchestration.";
    if (to.layer === "runtime" && to.path.replace(/\.tsx?$/u, "") !== "src/game/runtime/client") {
      return "Feature UI may use game/runtime/client; runtime internals cannot be imported by features.";
    }
  }

  if ((from.layer === "runtime" || from.layer === "persistence") && to.layer === "app") return "Game orchestration cannot depend on app composition.";
  if (from.layer === "runtime" && to.layer === "persistence") return "Persistence is wired by app composition; runtime cannot depend on it.";
  return null;
}

function publicApiProblem(from: Owner, to: Owner | null): string | null {
  if (from.layer === "outside" || !to?.feature || from.feature === to.feature) return null;
  if (to.entry === null) return `Import ${to.feature}/public or ${to.feature}/client instead of internal module ${to.path}.`;
  return null;
}

function purityProblem(from: Owner, to: Owner | null, source: string): string | null {
  if (!from.simulation || from.test) return null;
  if (source.startsWith("node:") || nodeModules.has(source)) {
    return "Simulation cannot import Node built-ins; keep platform I/O outside the deterministic game core.";
  }

  if (/^(?:effect(?:\/|$)|react(?:\/|$)|react-dom(?:\/|$)|@effect\/)/u.test(source)) {
    return "Simulation stays plain TypeScript: no React or Effect imports, including type imports.";
  }

  if (to && !to.simulation) {
    return `Simulation cannot import browser or orchestration module ${to.path}.`;
  }

  return null;
}

function rule(description: string, check: Check) {
  return defineRule({
    meta: { type: "problem", docs: { description }, messages: { violation: "{{problem}}" } },
    create(context) { return visits(context, check); },
  });
}

const boundaries = defineRule({
  meta: { type: "problem", docs: { description: "Enforce layer direction and declared feature dependencies." }, messages: { violation: "{{problem}}" } },
  create(context) {
    const from = ownerOf(context.cwd, context.filename);
    return {
      ...visits(context, boundaryProblem),
      Program(node) {
        if (from.layer === "unknown") {
          context.report({ node, messageId: "violation", data: { problem: `${from.path} is not in a known layer: use src/app, src/features, src/game/{core,runtime,persistence}, src/shared or src/routes.` } });
        }

        if (from.feature && !featureDependencies.has(from.feature)) {
          context.report({ node, messageId: "violation", data: { problem: `Register feature ${from.feature} in the architecture policy.` } });
        }
      },
    };
  },
});

/** True for `import type { A }` and `import { type A, type B }`: erased at build time, so it never pulls a module into a hot update. */
function typeOnly(node: ESTree.ImportDeclaration): boolean {
  if (node.importKind === "type") return true;
  return node.specifiers.length > 0 && node.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type");
}

const contextLeaf = defineRule({
  meta: {
    type: "problem",
    docs: { description: "A module that creates a React context imports only react at runtime, so a hot update never re-creates the context." },
    messages: { violation: "{{problem}}" },
  },
  create(context) {
    const runtimeImports: { node: ESTree.Node; source: string }[] = [];
    let createsContext = false;
    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value === "react") {
          createsContext ||= node.specifiers.some((s) => s.type === "ImportSpecifier" && s.imported.type === "Identifier" && s.imported.name === "createContext");
          return;
        }

        if (!typeOnly(node)) runtimeImports.push({ node: node.source, source: node.source.value });
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        if (node.source && node.exportKind !== "type") runtimeImports.push({ node: node.source, source: node.source.value });
      },
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        if (node.exportKind !== "type") runtimeImports.push({ node: node.source, source: node.source.value });
      },
      "Program:exit"() {
        if (!createsContext) return;
        for (const { node, source } of runtimeImports) {
          context.report({ node, messageId: "violation", data: { problem: `This module creates a React context, so its only runtime import is react: a hot update that reaches ${source} would re-run it, create a new context and split providers from consumers. Use import type, or move the code that needs ${source} into another module.` } });
        }
      },
    };
  },
});

export default eslintCompatPlugin({
  meta: { name: "factory-architecture" },
  rules: {
    boundaries,
    "context-leaf": contextLeaf,
    "public-api": rule("Use public entry points across feature boundaries.", publicApiProblem),
    "simulation-purity": rule("Keep simulation imports deterministic and browser-free.", purityProblem),
  },
});
