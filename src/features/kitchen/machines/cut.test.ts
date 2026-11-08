import { describe, expect, it } from "vitest";
import { CHOP_TICKS } from "../prototypes.ts";
import type { Cut } from "./cut.ts";
import { CHOPPED, WHOLE, chop, cutTicks } from "./cut.ts";

describe("cut", () => {
  it("is cutting after one tick of work and chopped after CHOP_TICKS", () => {
    let cut: Cut = WHOLE;

    for (let i = 1; i < CHOP_TICKS; i++) cut = chop(cut);

    expect(cut).toEqual({ state: "cutting", ticks: CHOP_TICKS - 1 });
    expect(chop(cut)).toBe(CHOPPED);
  });

  it("stays chopped under more work", () => {
    expect(chop(CHOPPED)).toBe(CHOPPED);
    expect(cutTicks(CHOPPED)).toBe(CHOP_TICKS);
  });
});
