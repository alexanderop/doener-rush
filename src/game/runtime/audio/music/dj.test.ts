import { describe, expect, it } from "vitest";
import { HOLD_BARS, PHRASE_BARS, SWAP_BAR, decks, deckGain, mixKind, nextDj } from "./dj.ts";
import type { Dj, How, Track, Want } from "./dj.ts";

const level: Track = { id: "level", theme: "doener", grid: "4/4" };

const lift: Track = { id: "lift", theme: "doener", grid: "4/4" };

const peak: Track = { id: "peak", theme: "endspurt", grid: "4/4" };

const waltz: Track = { id: "waltz", theme: "walzer", grid: "12/8" };

const want = (track: Track, how: How = "dj"): Want => ({ track, how });

/** Runs the DJ bar by bar from `from` through `to`, asking for `wanted(bar)`, and returns its state at each bar. */
function play(dj: Dj, from: number, to: number, wanted: (bar: number) => Want): Dj[] {
  const states: Dj[] = [];
  let state = dj;

  for (let bar = from; bar <= to; bar++) {
    state = nextDj(state, bar, wanted(bar));
    states.push(state);
  }

  return states;
}

const holding = (track: Track, start: number): Dj => nextDj({ kind: "silent" }, start, want(track));

describe("the DJ's mix kinds", () => {
  it("blends versions of one theme, duets songs on one grid, and lets the melody carry otherwise", () => {
    expect(mixKind(level, lift)).toBe("blend");
    expect(mixKind(level, peak)).toBe("duet");
    expect(mixKind(peak, waltz)).toBe("melody");
    expect(mixKind(level, { ...waltz, theme: "doener" })).toBe("blend");
  });
});

describe("the DJ in a round", () => {
  it("starts the first song at once on deck A", () => {
    const dj = holding(level, 0);
    expect(decks(dj)).toEqual(["level", ""]);
    expect(deckGain(dj, 0.5, "lead", 0)).toBe(1);
  });

  it("holds a song sixteen bars before mixing, then waits for the next eight-bar phrase", () => {
    const states = play(holding(level, 0), 1, HOLD_BARS + 2 * PHRASE_BARS, () => want(lift));
    const firstMix = states.findIndex((dj) => dj.kind === "mixing") + 1;
    expect(firstMix).toBe(HOLD_BARS);

    // asked for lift only at bar 17: past the hold, but bar 24 is the next phrase
    const late = play(holding(level, 0), 1, 40, (bar) => want(bar >= 17 ? lift : level));
    expect(late.findIndex((dj) => dj.kind === "mixing") + 1).toBe(24);
  });

  it("overlaps the decks for four bars, then holds the new song on deck B", () => {
    const states = play(holding(level, 0), 1, 20, () => want(lift));
    expect(states.slice(15, 19).every((dj) => dj.kind === "mixing")).toBe(true);
    const after = states[19];
    expect(after?.kind).toBe("hold");
    expect(after === undefined ? [] : decks(after)).toEqual(["", "lift"]);
  });

  it("does not mix the new song out again before it has held sixteen bars", () => {
    const states = play(holding(level, 0), 1, 60, (bar) => want(bar < 20 ? lift : level));
    const mixes = states.flatMap((dj, i) => (dj.kind === "mixing" && states[i - 1]?.kind === "hold" ? [i + 1] : []));
    expect(mixes).toEqual([16, 40]);
  });

  it("in a blend layers both leads and swaps the bass on the swap bar", () => {
    const mixing = nextDj(holding(level, 0), 16, want(lift));
    expect([deckGain(mixing, 16.5, "lead", 0), deckGain(mixing, 16.5, "lead", 1)]).toEqual([1, 1]);
    expect([deckGain(mixing, 16.5, "bass", 0), deckGain(mixing, 16.5, "bass", 1)]).toEqual([1, 0]);
    expect([deckGain(mixing, 16 + SWAP_BAR, "bass", 0), deckGain(mixing, 16 + SWAP_BAR, "bass", 1)]).toEqual([0, 1]);
    expect(deckGain(mixing, 16 + SWAP_BAR, "counter", 1)).toBe(1);
  });

  it("in a duet sings both leads while the arp and the pad change decks", () => {
    const mixing = nextDj(holding(level, 0), 16, want(peak));
    expect([deckGain(mixing, 17, "lead", 0), deckGain(mixing, 17, "lead", 1)]).toEqual([1, 1]);
    expect([deckGain(mixing, 17, "pad", 0), deckGain(mixing, 19, "pad", 1)]).toEqual([1, 1]);
    expect(deckGain(mixing, 19, "pad", 0)).toBe(0);
  });

  it("in a melody mix keeps the outgoing lead over the incoming backing", () => {
    const mixing = nextDj(holding(peak, 0), 16, want(waltz));
    expect([deckGain(mixing, 19.5, "lead", 0), deckGain(mixing, 19.5, "lead", 1)]).toEqual([1, 0]);
    expect([deckGain(mixing, 19.5, "arp", 0), deckGain(mixing, 19.5, "arp", 1)]).toEqual([0, 1]);
  });
});

describe("a plain song change", () => {
  it("crossfades over two bars from the next bar line, whatever the hold", () => {
    const states = play(holding(level, 0), 1, 4, (bar) => want(bar >= 3 ? peak : level, "plain"));
    expect(states.map((dj) => dj.kind)).toEqual(["hold", "hold", "mixing", "mixing"]);
    const mixing = states[2];

    if (mixing === undefined) throw new Error("the DJ mixes at bar 3");
    expect(deckGain(mixing, 4, "bass", 0)).toBeCloseTo(Math.SQRT1_2);
    expect(deckGain(mixing, 4, "bass", 1)).toBeCloseTo(Math.SQRT1_2);
    expect(deckGain(mixing, 5, "lead", 1)).toBeCloseTo(1);
    expect(play(mixing, 4, 5, () => want(peak, "plain")).map((dj) => dj.kind)).toEqual(["mixing", "hold"]);
  });
});
