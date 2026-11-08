/**
 * The music as data, tracker style: a song is hand-written pattern lines, one token per step, played
 * row by row from its order list. `compile` turns the token strings into numeric step events once,
 * so the worklet only reads numbers while it renders. Nothing here generates or transposes a note.
 */

/** A layer of a song that can trade decks on its own during a mix. */
type Stem = "lead" | "arp" | "counter" | "bass" | "pad";

/** What a row plays: the stems, and the bed's drums, which never enter or leave by intensity. */
export type Part = Stem | "drums";

/** How a bar is divided: sixteen straight steps, or twelve triplet steps. Every song plays 128 BPM. */
type Grid = "4/4" | "12/8";

/** Steps in one bar of each grid. */
const STEPS_PER_BAR: Readonly<Record<Grid, number>> = { "4/4": 16, "12/8": 12 };

/** A row entry that keeps the part silent for the bar. */
export const REST = "rest";

/** One bar of the order list: the pattern each part plays, or `REST`. */
export type Row = Readonly<Record<Part, string>>;

/** How the chip and the bed sound in one version of the theme. */
export interface Tone {
  /** Pulse duty of the lead and the arp: 0.125, 0.25 or 0.5. */
  readonly leadDuty: number;
  readonly arpDuty: number;
  /** The wave voice's table: 32 samples of 4 bits, one hex digit each. */
  readonly wave: string;
  /** Lowpass cutoff of the bass and the pad in Hz. */
  readonly bassCutoff: number;
  readonly padCutoff: number;
}

/** A hand-written song: its theme and grid decide how the DJ mixes it with another. */
export interface Song {
  readonly id: string;
  /** Songs of one theme are versions of the same melody. */
  readonly theme: string;
  readonly grid: Grid;
  readonly tone: Tone;
  /** Pattern lines by name: space-separated tokens, `|` between bars is ignored. */
  readonly patterns: Readonly<Record<string, string>>;
  readonly order: readonly Row[];
}

/**
 * One step of a melodic line. A note starts (and plays `arp` as semitones above it, cycled at
 * 60 Hz on the arp voice, `[0]` when it has none); a hold keeps the previous note; a rest stops it.
 */
export type Step =
  | { readonly kind: "note"; readonly note: number; readonly arp: readonly number[] }
  | { readonly kind: "hold" }
  | { readonly kind: "rest" };

/** A drum the bed plays on a step. */
export type Hit = "kick" | "snare" | "hat" | "open";

/** One bar ready to play: each stem's steps and the drums' hits per step, each looped to fill the bar. */
type Bar = Readonly<Record<Stem, readonly Step[]>> & { readonly drums: readonly (readonly Hit[])[] };

/** A compiled song. */
export interface Score {
  readonly id: string;
  readonly theme: string;
  readonly grid: Grid;
  readonly tone: Tone;
  readonly steps: number;
  readonly bars: readonly Bar[];
}

const PITCH_CLASSES = new Map([["C", 0], ["D", 2], ["E", 4], ["F", 5], ["G", 7], ["A", 9], ["B", 11]]);

const ACCIDENTALS = new Map([["", 0], ["#", 1], ["b", -1]]);

const HITS = new Map<string, Hit>([["k", "kick"], ["s", "snare"], ["h", "hat"], ["o", "open"]]);

const HOLD: Step = { kind: "hold" };

const SILENCE: Step = { kind: "rest" };

/** `C4` is MIDI 60; `:47` after a note lists arp offsets in hex digits (`C4:47` is C, E, G). */
const NOTE = /^([A-G])(#|b)?(-?\d)(?::([0-9a-f]+))?$/u;

function tokens(line: string): string[] {
  return line.split(/[\s|]+/u).filter((token) => token !== "");
}

/** Parses a melodic line: notes like `C4`, `F#3` or `C4:47`, `-` to hold, `.` to rest. */
export function parseNotes(line: string): Step[] {
  return tokens(line).map((token) => {
    if (token === "-") return HOLD;

    if (token === ".") return SILENCE;
    const match = NOTE.exec(token);

    if (match === null) throw new Error(`Not a note: "${token}"`);
    const [, letter = "", accidental = "", octave = "", offsets = "0"] = match;
    const note = 12 * (Number(octave) + 1) + (PITCH_CLASSES.get(letter) ?? 0) + (ACCIDENTALS.get(accidental) ?? 0);
    const arp = [...offsets].map((digit) => parseInt(digit, 16));

    return { kind: "note", note, arp: arp[0] === 0 ? arp : [0, ...arp] };
  });
}

/** Parses a drum line: each token is the hits on that step, like `k`, `kh` or `s`; `.` is none. */
export function parseHits(line: string): Hit[][] {
  return tokens(line).map((token) => {
    if (token === ".") return [];

    return [...token].map((letter) => {
      const hit = HITS.get(letter);

      if (hit === undefined) throw new Error(`Not a drum: "${letter}" in "${token}"`);

      return hit;
    });
  });
}

/** Compiles a song once: every row's patterns parsed, each checked to fill a bar evenly. */
export function compile(song: Song): Score {
  const steps = STEPS_PER_BAR[song.grid];
  const notes = new Map<string, readonly Step[]>();
  const hits = new Map<string, readonly (readonly Hit[])[]>();

  const line = <A>(cache: Map<string, readonly A[]>, name: string, parse: (text: string) => A[], rest: A): readonly A[] => {
    if (name === REST) return [rest];
    const known = cache.get(name);

    if (known !== undefined) return known;
    const text = song.patterns[name];

    if (text === undefined) throw new Error(`${song.id}: no pattern "${name}"`);
    const parsed = parse(text);

    if (parsed.length === 0 || steps % parsed.length !== 0) {
      throw new Error(`${song.id}: pattern "${name}" has ${parsed.length} steps, which does not fill a bar of ${steps}`);
    }

    cache.set(name, parsed);

    return parsed;
  };

  const bars = song.order.map((row): Bar => ({
    lead: line(notes, row.lead, parseNotes, SILENCE),
    arp: line(notes, row.arp, parseNotes, SILENCE),
    counter: line(notes, row.counter, parseNotes, SILENCE),
    bass: line(notes, row.bass, parseNotes, SILENCE),
    pad: line(notes, row.pad, parseNotes, SILENCE),
    drums: line(hits, row.drums, parseHits, []),
  }));

  return { id: song.id, theme: song.theme, grid: song.grid, tone: song.tone, steps, bars };
}
