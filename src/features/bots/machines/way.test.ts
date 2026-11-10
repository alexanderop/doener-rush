import { describe, expect, it } from "vitest";
import type { Way } from "./way.ts";
import { ASIDE, DETOUR, DIRECT, giveWay, stepAround, stepAside } from "./way.ts";

/** Steps `way` until it leaves `state`; returns the ticks that took and the way it became. */
function leave(way: Way, state: Way["state"], step: (way: Way) => Way) {
  let ticks = 0;
  let now = way;

  while (now.state === state && ticks < 1000) {
    now = step(now);
    ticks += 1;
  }

  return { ticks, way: now };
}

describe("way", () => {
  it("steps aside when there is a tile for it, and routes around the others when there is none", () => {
    expect(giveWay({ x: 2, y: 3 })).toEqual({ state: "aside", to: { x: 2, y: 3 }, left: ASIDE });
    expect(giveWay(null)).toEqual({ state: "around", left: DETOUR });
  });

  it("gives up on the tile after ASIDE ticks and starts a full detour", () => {
    const { ticks, way } = leave(giveWay({ x: 2, y: 3 }), "aside", (w) => stepAside(w, false));

    expect(ticks).toBe(ASIDE);
    expect(way).toEqual({ state: "around", left: DETOUR });
  });

  it("starts the detour as soon as it stands on the tile", () => {
    expect(stepAside(giveWay({ x: 2, y: 3 }), true)).toEqual({ state: "around", left: DETOUR });
  });

  it("goes direct again after DETOUR ticks around the others", () => {
    const { ticks, way } = leave(giveWay(null), "around", stepAround);

    expect(ticks).toBe(DETOUR);
    expect(way).toBe(DIRECT);
  });

  it("leaves a way alone that the step is not for", () => {
    const aside = giveWay({ x: 2, y: 3 });

    expect(stepAside(DIRECT, true)).toBe(DIRECT);
    expect(stepAround(aside)).toBe(aside);
  });
});
