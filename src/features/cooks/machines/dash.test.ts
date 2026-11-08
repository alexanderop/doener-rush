import { describe, expect, it } from "vitest";
import { DASH_COOLDOWN, DASH_TICKS } from "../prototypes.ts";
import type { Dash } from "./dash.ts";
import { READY, stepDash } from "./dash.ts";

/** Steps the dash with a press on the given ticks; returns the state name per tick. */
function run(ticks: number, presses: ReadonlySet<number>): string[] {
  let dash: Dash = READY;

  return Array.from({ length: ticks }, (_, t) => {
    dash = stepDash(dash, presses.has(t));

    return dash.state;
  });
}

describe("dash", () => {
  it("dashes for DASH_TICKS ticks from the press, then cools until DASH_COOLDOWN", () => {
    const states = run(DASH_COOLDOWN + 2, new Set([1]));

    expect(states[0]).toBe("ready");
    expect(states.filter((s) => s === "dashing")).toHaveLength(DASH_TICKS);
    expect(states[1 + DASH_TICKS]).toBe("cooling");
    expect(states[DASH_COOLDOWN]).toBe("cooling");
    expect(states[1 + DASH_COOLDOWN]).toBe("ready");
  });

  it("ignores presses while dashing and cooling, and takes one on the first free tick", () => {
    const states = run(DASH_COOLDOWN + 3, new Set([0, 3, DASH_TICKS + 2, DASH_COOLDOWN]));

    expect(states.filter((s) => s === "dashing")).toHaveLength(DASH_TICKS + 3);
    expect(states[DASH_COOLDOWN]).toBe("dashing");
  });
});
