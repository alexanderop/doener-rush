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
