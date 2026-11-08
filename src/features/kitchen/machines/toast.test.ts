import { describe, expect, it } from "vitest";
import { HEAT } from "../prototypes.ts";
import type { Toast } from "./toast.ts";
import { RAW, char, heatUp, holdBelowBurnt } from "./toast.ts";

/** Heats bread tick by tick and records each tick where the state changed. */
function changes(ticks: number): string[] {
  let toast: Toast = RAW;
  const seen = ["0:raw"];

  for (let t = 1; t <= ticks; t++) {
    const next = heatUp("bread", toast);

    if (next.state !== toast.state) seen.push(`${t}:${next.state}`);
    toast = next;
  }

  return seen;
}

describe("toast", () => {
  it("goes raw → toasting → done → burnt at the HEAT thresholds", () => {
    expect(changes(HEAT.bread.burnt + 5)).toEqual(["0:raw", "1:toasting", `${HEAT.bread.done}:done`, `${HEAT.bread.burnt}:burnt`]);
  });

  it("chars straight to burnt, even from raw", () => {
    expect(char("bread", RAW)).toEqual({ state: "burnt", ticks: HEAT.bread.burnt });
  });

  it("is held one tick short of burnt, and raw stays raw", () => {
    expect(holdBelowBurnt("dough", char("dough", RAW))).toEqual({ state: "done", ticks: HEAT.dough.burnt - 1 });
    expect(holdBelowBurnt("dough", RAW)).toBe(RAW);
  });
});
