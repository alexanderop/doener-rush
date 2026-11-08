import { describe, expect, it } from "vitest";
import { LEVELS } from "../../levels.ts";
import { mixKind } from "./dj.ts";
import { compile } from "./score.ts";
import { songFor } from "./songs.ts";
import type { Tune } from "./songs.ts";

const kitchens = LEVELS.map((level) => level.id);

const tunes: readonly Tune[] = [...kitchens, "lift", "peak"];

describe("the soundtrack", () => {
  it("compiles every tune in every kitchen into sixteen bars of 4/4 at sixteen steps", () => {
    for (const level of kitchens) {
      for (const tune of tunes) {
        const score = compile(songFor(tune, level));
        expect(score.bars, `${tune} in ${level}`).toHaveLength(16);
        expect(score.steps).toBe(16);
      }
    }
  });

  it("sings one melody in every kitchen, each over its own backing", () => {
    const scores = kitchens.map((level) => compile(songFor(level, level)));
    const leads = new Set(scores.map((score) => JSON.stringify(score.bars.map((bar) => bar.lead))));
    const backings = new Set(scores.map((score) => JSON.stringify(score.bars.map(({ arp, counter, bass, pad, drums }) => ({ arp, counter, bass, pad, drums })))));
    expect(leads.size).toBe(1);
    expect(backings.size).toBe(kitchens.length);
  });

  it("plays a take's own lead over the backing of the kitchen it plays in", () => {
    const kitchen = compile(songFor("schlauch", "schlauch"));
    const lift = compile(songFor("lift", "schlauch"));
    expect(lift.bars.map((bar) => bar.bass)).toEqual(kitchen.bars.map((bar) => bar.bass));
    expect(lift.bars.map((bar) => bar.drums)).toEqual(kitchen.bars.map((bar) => bar.drums));
    expect(lift.bars.map((bar) => bar.lead)).not.toEqual(kitchen.bars.map((bar) => bar.lead));
  });

  it("blends the kitchen into the busy take and duets into the last-seconds take", () => {
    expect(mixKind(songFor("imbiss", "imbiss"), songFor("lift", "imbiss"))).toBe("blend");
    expect(mixKind(songFor("lift", "imbiss"), songFor("peak", "imbiss"))).toBe("duet");
  });
});
