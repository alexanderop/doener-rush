import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { simulationModules } from "./policy.ts";

export type Layer = "feature" | "core" | "runtime" | "persistence" | "shared" | "app" | "unknown" | "outside";

export interface Owner {
  readonly path: string;
  readonly layer: Layer;
  readonly feature: string | null;
  readonly entry: "public" | "client" | null;
  readonly simulation: boolean;
  readonly test: boolean;
}

function canonical(path: string): string {
  return existsSync(path) ? realpathSync(path) : path;
}

/** Resolve the project's two aliases, extensionless modules, index files and symlinks. */
export function resolveLocal(root: string, importer: string, source: string): string | null {
  let target: string;
  if (source.startsWith("#/") || source.startsWith("@/")) {
    target = resolve(root, "src", source.slice(2));
  } else if (source.startsWith(".") || isAbsolute(source)) {
    target = resolve(dirname(importer), source);
  } else {
    return null;
  }

  const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`];
  for (const candidate of candidates) {
    // A directory itself is not a module. Prefer its index file.
    if (/\.[cm]?[jt]sx?$/u.test(candidate) && existsSync(candidate)) return canonical(candidate);
  }

  // TS bundler resolution permits .js specifiers for .ts source files.
  if (target.endsWith(".js") && existsSync(`${target.slice(0, -3)}.ts`)) {
    return canonical(`${target.slice(0, -3)}.ts`);
  }

  return target;
}

export function ownerOf(root: string, filename: string): Owner {
  const path = relative(canonical(root), canonical(filename)).replaceAll("\\", "/").replace(/\?.*$/u, "");
  const parts = path.split("/");
  const feature = parts[0] === "src" && parts[1] === "features" ? parts[2] ?? null : null;
  const module = parts[3]?.replace(/\.[cm]?[jt]sx?$/u, "") ?? "";
  const directModule = parts.length === 4;
  let layer: Layer = "outside";
  if (parts[0] === "src") {
    layer = "unknown";
    if (feature) layer = "feature";
    else if (parts[1] === "shared") layer = "shared";
    else if (parts[1] === "app" || parts[1] === "routes") layer = "app";
    else if (parts.length === 2 && (["router.tsx", "routeTree.gen.ts", "styles.css"].includes(parts[1] ?? ""))) layer = "app";
    else if (parts[1] === "game" && parts[2] === "core") layer = "core";
    else if (parts[1] === "game" && parts[2] === "runtime") layer = "runtime";
    else if (parts[1] === "game" && parts[2] === "persistence") layer = "persistence";
  }

  return {
    path,
    layer,
    feature,
    entry: directModule && feature && (module === "public" || module === "client") ? module : null,
    simulation: layer === "core" || (feature !== null && simulationModules.has(module)) ||
      /^src\/game\/runtime\/(?!(?:client|new-world|atoms|audio|devtools|useGameCanvas|WorldProvider|contexts)(?:\.tsx?)?$|(?:testing|canvas|gl|input)\/)/u.test(path),
    test: /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path),
  };
}
