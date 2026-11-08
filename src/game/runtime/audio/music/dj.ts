/**
 * The DJ: two decks on one bar clock. A plain song change crossfades over two bars from the next
 * bar line. During a round the DJ mixes like a live set: it holds each song at least sixteen bars,
 * starts a mix only on an eight-bar phrase of the playing song, and overlaps the decks for four
 * bars while the stems trade decks. `nextDj` runs once per bar; `deckGain` says how loud a part of
 * each deck plays at any moment. Pure, so it runs the same in Vitest and in the worklet.
 */
import type { Part, Song } from "./score.ts";

/** What the DJ needs to know about a song to mix it. */
export type Track = Pick<Song, "id" | "theme" | "grid">;

/** How the DJ takes a song change: mixed into the set, or a plain two-bar crossfade. */
export type How = "dj" | "plain";

/** The song the game asks for and how to get there. */
export interface Want {
  readonly track: Track;
  readonly how: How;
}

/** How two songs blend, by how closely they match. */
export type MixKind = "blend" | "duet" | "melody";

/** Every way the decks can overlap. */
type Fade = MixKind | "crossfade";

/** One of the two decks. */
export type Deck = 0 | 1;

/** A song on a deck; its first bar plays at bar `start` of the clock. */
interface Spin {
  readonly track: Track;
  readonly deck: Deck;
  readonly start: number;
}

/** Silent before the first song; holding one song; or mixing from one deck into the other. */
export type Dj =
  | { readonly kind: "silent" }
  | { readonly kind: "hold"; readonly spin: Spin; readonly free: number }
  | { readonly kind: "mixing"; readonly from: Spin; readonly to: Spin; readonly fade: Fade };

/**
 * Who plays a part during an overlap: both decks, the outgoing one only, a swap from outgoing to
 * incoming on the swap bar, or an equal-power fade across the overlap.
 */
type Hand = "both" | "from" | "swap" | "fade";

/** A song plays at least this many bars after its mix in before the DJ mixes it out. */
export const HOLD_BARS = 16;

/** A mix starts only on the first bar of a phrase of the playing song. */
export const PHRASE_BARS = 8;

/** Bar of the overlap on which `swap` parts trade decks. */
export const SWAP_BAR = 2;

const BACKING_SWAPS: Readonly<Record<Exclude<Part, "lead">, Hand>> = { arp: "swap", counter: "swap", bass: "swap", pad: "swap", drums: "swap" };

/** Each overlap: how many bars it takes and who plays each part meanwhile. */
const FADES: Readonly<Record<Fade, { readonly bars: number; readonly hands: Readonly<Record<Part, Hand>> }>> = {
  // same theme: both versions of the melody layer, the low end and the counter-melody swap
  blend: { bars: 4, hands: { lead: "both", arp: "both", pad: "both", counter: "swap", bass: "swap", drums: "swap" } },
  // same bar grid: the two leads sing together over the backing as it changes
  duet: { bars: 4, hands: { lead: "both", ...BACKING_SWAPS } },
  // nothing in common: the outgoing lead keeps singing over the incoming backing
  melody: { bars: 4, hands: { lead: "from", ...BACKING_SWAPS } },
  crossfade: { bars: 2, hands: { lead: "fade", arp: "fade", counter: "fade", bass: "fade", pad: "fade", drums: "fade" } },
};

/** Mix kind by whether the themes match and whether the grids match. */
const KINDS: Readonly<Record<`${boolean}:${boolean}`, MixKind>> = {
  "true:true": "blend",
  "true:false": "blend",
  "false:true": "duet",
  "false:false": "melody",
};

/** How the DJ blends `from` into `to`. */
export function mixKind(from: Track, to: Track): MixKind {
  return KINDS[`${from.theme === to.theme}:${from.grid === to.grid}`];
}

/** The DJ at the first beat of `bar`, given what the game wants now. */
export function nextDj(dj: Dj, bar: number, want: Want): Dj {
  switch (dj.kind) {
    case "silent":
      return { kind: "hold", spin: { track: want.track, deck: 0, start: bar }, free: bar + HOLD_BARS };
    case "hold": {
      const { spin } = dj;

      if (want.track.id === spin.track.id) return dj;

      if (want.how === "plain") return mix(spin, want.track, "crossfade", bar);

      if (bar < dj.free || (bar - spin.start) % PHRASE_BARS !== 0) return dj;

      return mix(spin, want.track, mixKind(spin.track, want.track), bar);
    }

    case "mixing":
      if (bar < dj.to.start + FADES[dj.fade].bars) return dj;

      // the mix is over: hold the new song, though a plain change may start at once
      return nextDj({ kind: "hold", spin: dj.to, free: bar + HOLD_BARS }, bar, want);
  }
}

function mix(from: Spin, track: Track, fade: Fade, bar: number): Dj {
  return { kind: "mixing", from, to: { track, deck: from.deck === 0 ? 1 : 0, start: bar }, fade };
}

/** How loud `part` of `deck` plays at clock time `at` (in bars, fractional), 0 to 1. */
export function deckGain(dj: Dj, at: number, part: Part, deck: Deck): number {
  switch (dj.kind) {
    case "silent":
      return 0;
    case "hold":
      return dj.spin.deck === deck ? 1 : 0;
    case "mixing": {
      const { bars, hands } = FADES[dj.fade];
      const into = Math.min(Math.max((at - dj.to.start) / bars, 0), 1);
      const [from, to] = handGains(hands[part], into, (at - dj.to.start) >= SWAP_BAR);

      return dj.from.deck === deck ? from : to;
    }
  }
}

function handGains(hand: Hand, into: number, swapped: boolean): readonly [number, number] {
  switch (hand) {
    case "both": return [1, 1];
    case "from": return [1, 0];
    case "swap": return swapped ? [0, 1] : [1, 0];
    case "fade": return [Math.cos(into * Math.PI / 2), Math.sin(into * Math.PI / 2)];
  }
}

/** The song each deck plays now, or "" for an empty deck. */
export function decks(dj: Dj): readonly [string, string] {
  switch (dj.kind) {
    case "silent": return ["", ""];
    case "hold": return dj.spin.deck === 0 ? [dj.spin.track.id, ""] : ["", dj.spin.track.id];
    case "mixing": return dj.from.deck === 0 ? [dj.from.track.id, dj.to.track.id] : [dj.to.track.id, dj.from.track.id];
  }
}
