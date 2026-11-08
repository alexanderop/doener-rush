import { describe, expect, it } from "vitest";
import { AFTER_SHAVE, BURNT, COOKED, SPIT_HEAT } from "../prototypes.ts";
import { holdSideBelowBurnt, roast, scrapeIfBurnt, shaveOff, sideAt } from "./side.ts";

describe("spit side", () => {
  it("is raw under COOKED, cooked from it, burnt from BURNT", () => {
    expect(sideAt(COOKED - 0.01).state).toBe("raw");
    expect(sideAt(COOKED).state).toBe("cooked");
    expect(sideAt(BURNT).state).toBe("burnt");
  });

  it("roasts across the line into the next state", () => {
    expect(roast(sideAt(COOKED - SPIT_HEAT / 2)).state).toBe("cooked");
  });

  it("goes back to raw when shaved, and when scraped only if burnt", () => {
    expect(shaveOff()).toEqual({ state: "raw", level: AFTER_SHAVE });
    expect(scrapeIfBurnt(sideAt(BURNT + 0.3))).toEqual(shaveOff());
    expect(scrapeIfBurnt(sideAt(COOKED))).toEqual(sideAt(COOKED));
  });

  it("is held just short of burnt", () => {
    expect(holdSideBelowBurnt(sideAt(BURNT + 0.5)).state).toBe("cooked");
  });
});
