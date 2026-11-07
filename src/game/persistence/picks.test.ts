import { Option } from "effect";
import { describe, expect, it } from "vitest";
import { DEFAULT_PICKS } from "../runtime/looks.ts";
import { loadPicks, parsePicks } from "./picks.ts";

describe("given saved look picks", () => {
  it("reads back two known looks", () => {
    expect(parsePicks(JSON.stringify(["jule", "can"]))).toEqual(["jule", "can"]);
  });

  it("falls back to the default looks for an unknown look, a wrong shape or broken text", () => {
    for (const text of [JSON.stringify(["jule", "zorro"]), JSON.stringify(["jule"]), "{", "\"lena\""]) {
      expect(parsePicks(text), text).toEqual(DEFAULT_PICKS);
    }
  });

  it("gives the default looks when nothing is saved", () => {
    expect(loadPicks(() => Option.none())).toEqual(DEFAULT_PICKS);
  });
});
