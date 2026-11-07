/**
 * Every sound of the game as data: one-shots as a list of voices, loops as filtered noise, and
 * the music as a step pattern. `engine.ts` plays them; nothing here touches Web Audio.
 */
import type { Cue, Loop } from "./cues.ts";

/** One layer of a sound: an oscillator or a burst of filtered noise, swept from `from` to `to` Hz. */
export interface Voice {
  readonly source: OscillatorType | "noise";
  /** The noise filter; tones ignore it. */
  readonly filter: BiquadFilterType;
  readonly from: number;
  readonly to: number;
  /** Seconds after the sound starts. */
  readonly at: number;
  readonly length: number;
  readonly gain: number;
}

function tone(wave: OscillatorType, from: number, to: number, length: number, gain: number, at = 0): Voice {
  return { source: wave, filter: "allpass", from, to, at, length, gain };
}

function noise(filter: BiquadFilterType, from: number, to: number, length: number, gain: number, at = 0): Voice {
  return { source: "noise", filter, from, to, at, length, gain };
}

/** The one-shot sounds. */
export const SOUNDS: Readonly<Record<Cue, readonly Voice[]>> = {
  chop: [noise("highpass", 2800, 2000, 0.04, 0.35), tone("triangle", 190, 120, 0.06, 0.35)],
  pickup: [tone("sine", 420, 920, 0.09, 0.35)],
  putdown: [tone("sine", 760, 300, 0.09, 0.35)],
  dash: [noise("bandpass", 500, 2600, 0.2, 0.45)],
  served: [tone("sine", 1319, 1319, 0.6, 0.3), tone("sine", 1760, 1760, 0.7, 0.25, 0.1)],
  coin: [tone("square", 988, 988, 0.07, 0.12, 0.18), tone("square", 1319, 1319, 0.3, 0.12, 0.25)],
  lost: [tone("sawtooth", 240, 110, 0.45, 0.22)],
  wrong: [tone("square", 155, 150, 0.13, 0.22), tone("square", 155, 150, 0.13, 0.22, 0.17)],
  warn: [tone("square", 1046, 1046, 0.07, 0.12)],
  splash: [noise("bandpass", 1400, 400, 0.22, 0.35)],
  tick: [tone("square", 2100, 1900, 0.025, 0.1)],
  whistle: [tone("sine", 2150, 2150, 0.28, 0.3), tone("sine", 2350, 2250, 0.6, 0.3, 0.32)],
  count: [tone("sine", 660, 660, 0.16, 0.4)],
  go: [tone("sine", 1320, 1320, 0.5, 0.35), tone("square", 660, 660, 0.4, 0.08)],
};

/** One short pop of the fire's crackle; the engine fires these at random while something burns. */
export const CRACKLE: readonly Voice[] = [noise("highpass", 1800, 900, 0.035, 0.5)];

/** A loop: endless noise through one filter, at most this loud. */
interface LoopSound {
  readonly filter: BiquadFilterType;
  readonly freq: number;
  readonly q: number;
  readonly gain: number;
}

/** The loops. */
export const LOOPS: Readonly<Record<Loop, LoopSound>> = {
  sizzle: { filter: "highpass", freq: 3200, q: 0.7, gain: 0.07 },
  fire: { filter: "lowpass", freq: 520, q: 0.9, gain: 0.45 },
  spray: { filter: "bandpass", freq: 2600, q: 0.6, gain: 0.3 },
};

/** A part of the band. */
type Part = "kick" | "bass" | "stab" | "hat";

/**
 * The music: four bars in E Phrygian dominant, sixteen steps each. A pattern letter plays its
 * part on that step: `x` hits, and the bass plays `R` root, `O` octave, `F` fifth.
 */
export const GROOVE = {
  bpm: 124,
  /** The last thirty seconds. */
  fastBpm: 150,
  bars: [
    { root: 40, chord: [64, 68, 71] },
    { root: 41, chord: [65, 69, 72] },
    { root: 38, chord: [62, 65, 69] },
    { root: 40, chord: [64, 68, 71] },
  ],
  patterns: {
    kick: "x...x...x...x...",
    bass: "R..O..R.R..F..O.",
    stab: "..x...x...x...x.",
    hat: "x.x.x.x.x.x.x.x.",
  } satisfies Record<Part, string>,
} as const;

/** How each part sounds at a pitch in Hz. */
export const BAND: Readonly<Record<Part, (hz: number) => readonly Voice[]>> = {
  kick: () => [tone("sine", 150, 45, 0.14, 0.7)],
  bass: (hz) => [tone("square", hz, hz, 0.15, 0.13)],
  stab: (hz) => [tone("triangle", hz, hz, 0.1, 0.12), tone("square", hz, hz, 0.06, 0.03)],
  hat: () => [noise("highpass", 7500, 7000, 0.035, 0.18)],
};
