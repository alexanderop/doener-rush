/**
 * Which checkout this is and the dev port and browser session that belong to
 * it. The main workspace keeps port 3000; every git worktree gets its own port
 * and agent-browser session, so parallel agents never share a server or a save.
 */
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

export interface Checkout {
  root: string;
  /**
  True in a git worktree (`.git` is a file), false in the main workspace.
  */
  worktree: boolean;
  port: number;
  baseUrl: string;
  /**
  agent-browser session name for this checkout.
  */
  session: string;
}

function fnv1a(s: string) {
  let h = 0x811c9dc5;

  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);

  return h >>> 0;
}

function gitRoot(cwd = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return cwd;
  }
}

export function gitCommit(cwd = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function checkout(cwd = process.cwd()): Checkout {
  const root = gitRoot(cwd);
  let worktree = false;

  try {
    worktree = statSync(join(root, ".git")).isFile();
  } catch {
    // no .git at all: treat as the main workspace
  }

  const hash = fnv1a(root);
  const port = Number(process.env.PORT) || (worktree ? 3100 + (hash % 6000) : 3000);

  return {
    root,
    worktree,
    port,
    baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
    session: `doener-rush-${worktree ? hash.toString(36) : "main"}`,
  };
}
