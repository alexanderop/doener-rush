import { describe, expect, it } from "vitest";
import { validatePlaySearch } from "./playSearch.ts";

describe("given a /play query with a lineup", () => {
  it("reads the number of players and bots from the URL text", () => {
    expect(validatePlaySearch({ humans: "0", bots: "2" })).toMatchObject({ humans: 0, bots: 2 });
  });

  it("drops a count out of range or not a whole number, and keeps the rest", () => {
    expect(validatePlaySearch({ humans: "3", bots: "1.5", seed: 4 })).toEqual({ seed: 4, scenario: undefined, humans: undefined, bots: undefined });
  });
});

describe("given a /play query with house rules", () => {
  it("reads switches, levels and the shift length, and drops values out of range", () => {
    expect(validatePlaySearch({ fire: "0", burn: 1, patience: "2", rush: "0", minutes: "5" })).toMatchObject({ fire: 0, burn: 1, patience: 2, rush: 0, minutes: 5 });
    expect(validatePlaySearch({ fire: "2", patience: "3", minutes: "9" })).toMatchObject({ fire: undefined, patience: undefined, minutes: undefined });
  });
});
