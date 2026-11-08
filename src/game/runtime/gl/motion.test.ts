import { describe, expect, it } from "vitest";
import { handoffOf } from "./motion.ts";
import type { HandsChange } from "./motion.ts";

const AT_STATION: HandsChange = { heldBefore: false, heldAfter: false, threw: false, caught: false, facesStation: true };

describe("given a cook facing a station", () => {
  it("takes what fills empty hands", () => {
    expect(handoffOf({ ...AT_STATION, heldAfter: true })).toBe("take");
  });

  it("puts down what leaves full hands", () => {
    expect(handoffOf({ ...AT_STATION, heldBefore: true })).toBe("drop");
  });

  it("keeps a combine in hand", () => {
    expect(handoffOf({ ...AT_STATION, heldBefore: true, heldAfter: true })).toBe("none");
  });

  it("lets a throw and a catch fly on their own", () => {
    expect(handoffOf({ ...AT_STATION, heldBefore: true, threw: true })).toBe("none");
    expect(handoffOf({ ...AT_STATION, heldAfter: true, caught: true })).toBe("none");
  });
});

describe("given a cook facing the floor", () => {
  it("moves nothing", () => {
    expect(handoffOf({ ...AT_STATION, heldAfter: true, facesStation: false })).toBe("none");
  });
});
