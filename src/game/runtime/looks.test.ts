import { describe, expect, it } from "vitest";
import { lineupOf } from "./lineup.ts";
import { DEFAULT_PICKS, LOOKS, LOOK_IDS, crewLooks, stepLook } from "./looks.ts";
import type { LookId, Picks } from "./looks.ts";

const ids = (looks: readonly { readonly id: string }[]) => looks.map((l) => l.id);

describe("given the look table", () => {
  it("has a unique id, name and body colour for every look", () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    expect(new Set(LOOKS.map((l) => l.name)).size).toBe(LOOKS.length);
    expect(new Set(LOOKS.map((l) => l.body)).size).toBe(LOOKS.length);
  });
});

describe("given a crew with players and bots", () => {
  const everyPick: Picks[] = LOOK_IDS.flatMap((a) => LOOK_IDS.map((b): Picks => [a, b]));

  const crews = [
    lineupOf(1, 3),
    lineupOf(2, 2),
    lineupOf(1, 2, true),
    lineupOf(0, 4),
  ];

  it("never dresses two cooks alike, whatever the players pick", () => {
    for (const lineup of crews) {
      for (const picks of everyPick) {
        const looks = ids(crewLooks(lineup.drivers, picks));
        expect(new Set(looks).size, `${picks.join("+")} for ${looks.join(",")}`).toBe(lineup.drivers.length);
      }
    }
  });

  it("gives each player their pick and the bots the next free looks in table order", () => {
    expect(ids(crewLooks(lineupOf(2, 2).drivers, ["jule", "mehmet"]))).toEqual(["jule", "mehmet", "mimi", "lena"]);
    expect(ids(crewLooks(lineupOf(1, 3).drivers, DEFAULT_PICKS))).toEqual(["mehmet", "mimi", "lena", "bruno"]);
  });

  it("keeps player 1's pick when both players pick the same look", () => {
    expect(ids(crewLooks(lineupOf(2, 0).drivers, ["can", "can"]))).toEqual(["can", "mehmet"]);
  });

  it("dresses the second cook of a swap pair in the next free look", () => {
    expect(ids(crewLooks(lineupOf(1, 1, true).drivers, ["lena", "mehmet"]))).toEqual(["lena", "mehmet", "mimi"]);
  });
});

describe("given the arrows of a look picker", () => {
  it("walks the whole table both ways and wraps around", () => {
    const walk = (step: 1 | -1) => {
      const seen: LookId[] = [];
      let id: LookId = "mehmet";

      for (const _ of LOOK_IDS) {
        seen.push(id);
        id = stepLook(id, step);
      }

      return seen;
    };

    expect(walk(1)).toEqual(LOOK_IDS);
    expect(new Set(walk(-1))).toEqual(new Set(LOOK_IDS));
    expect(stepLook("mehmet", -1)).toBe("erna");
  });

  it("skips the look the other player wears", () => {
    expect(stepLook("mehmet", 1, new Set(["mimi"]))).toBe("lena");
    expect(stepLook("lena", -1, new Set(["mimi"]))).toBe("mehmet");
  });
});
