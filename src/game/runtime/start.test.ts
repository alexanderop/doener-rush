import { describe, expect, it } from "vitest";
import { advanceStart, newStart, startView } from "./start.ts";
import type { Start } from "./start.ts";

/** Runs the start in 100 ms frames and records the view after each. */
function play(start: Start, frames: number, skipAt = -1): string[] {
  const seen: string[] = [];
  let s = start;

  for (let i = 0; i < frames; i++) {
    s = advanceStart(s, 100, i === skipAt);
    const view = startView(s);
    seen.push(`${view.phase}:${view.beat}`);
  }

  return seen;
}

/** The distinct views in order. */
function steps(seen: readonly string[]): string[] {
  return seen.filter((v, i) => v !== seen[i - 1]);
}

describe("the start of a shift", () => {
  it("shows the card, counts 3, 2, 1, says LOS! and then runs", () => {
    expect(steps(play(newStart(true), 80))).toEqual([
      "intro:-1", "countdown:3", "countdown:2", "countdown:1", "running:0", "running:-1",
    ]);
  });

  it("starts counting as soon as a key is pressed on the card", () => {
    const seen = play(newStart(true), 3, 0);
    expect(seen[0]).toBe("countdown:3");
  });

  it("waits on the card without a key", () => {
    expect(play(newStart(true), 30).every((v) => v === "intro:-1")).toBe(true);
  });

  it("runs at once without a countdown", () => {
    expect(steps(play(newStart(false), 5))).toEqual(["running:-1"]);
  });
});
