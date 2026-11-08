import { describe, expect, it } from "vitest";
import { DOUSE_TICKS, FIRE_SPREAD } from "../prototypes.ts";
import { OUT, burn, dousing, ignite, spray, spreadsNow } from "./fire.ts";

describe("fire", () => {
  it("catches once: igniting a burning fire keeps its ticks", () => {
    const lit = burn(burn(ignite(OUT)));

    expect(lit).toEqual({ state: "burning", ticks: 3, sprayed: 0 });
    expect(ignite(lit)).toBe(lit);
  });

  it("goes out after DOUSE_TICKS of spray, not before", () => {
    let fire = ignite(OUT);

    for (let i = 1; i < DOUSE_TICKS; i++) fire = spray(fire);

    expect(fire.state).toBe("burning");
    expect(dousing(fire)).toBeCloseTo((DOUSE_TICKS - 1) / DOUSE_TICKS);
    expect(spray(fire)).toBe(OUT);
  });

  it("spreads every FIRE_SPREAD ticks after it caught", () => {
    let fire = ignite(OUT);
    const spreads: number[] = [];

    for (let t = 1; t <= FIRE_SPREAD * 2 + 1; t++) {
      if (spreadsNow(fire)) spreads.push(t);
      fire = burn(fire);
    }

    expect(spreads).toEqual([FIRE_SPREAD + 1, FIRE_SPREAD * 2 + 1]);
  });

  it("does nothing while out", () => {
    expect(burn(OUT)).toBe(OUT);
    expect(spray(OUT)).toBe(OUT);
    expect(spreadsNow(OUT)).toBe(false);
  });
});
