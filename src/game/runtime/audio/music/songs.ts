/**
 * The soundtrack: one main theme in E Phrygian dominant, the döner-shop scale, in one version per
 * kitchen. Every version sings the same lead over its own bass, pad, arp, counter-melody and drums.
 * The two DJ takes, "lift" for a busy kitchen and "peak" for the last thirty seconds, bring their
 * own lead and borrow the backing of the kitchen they play in. Every line is written by hand.
 */
import type { LevelId } from "../../levels.ts";
import type { Row, Song, Tone } from "./score.ts";

/** A DJ take: its own lead over the backing of whichever kitchen it plays in. */
export type Take = "lift" | "peak";

/** What the game can ask the DJ for: a kitchen's version of the theme, or a take. */
export type Tune = LevelId | Take;

/** The chord of each of the sixteen bars, which names every backing pattern. */
const CHORDS = ["E", "F", "E", "E", "Am", "Dm", "F", "E", "Am", "Am", "Dm", "Dm", "F", "F", "E", "E"] as const;

/** The backing chords: patterns are named `bass` + chord, `pad` + chord, and so on. */
type Chord = (typeof CHORDS)[number];

const WAVES = {
  triangle: "0123456789abcdeffedcba9876543210",
  sine: "89acdeefffeedca98653211000112356",
  saw: "00112233445566778899aabbccddeeff",
  square: "ffffffffffffffff0000000000000000",
  pulse: "ffffffff000000000000000000000000",
};

/** The main theme, one bar per line: the hook, its answer, the bridge and the turn home. */
const THEME = [
  "B4 - - - C5 B4 A4 G#4 A4 - G#4 - F4 - E4 -",
  "F4 - A4 - C5 - - - B4 - A4 G#4 A4 - - -",
  "B4 - - - C5 B4 A4 G#4 A4 - G#4 - F4 - E4 -",
  "G#4 - F4 - E4 - - - . . . . . . E4 F4",
  "G#4 A4 - - C5 - B4 A4 E5 - - - D5 C5 B4 A4",
  "D5 - - - F5 - E5 D5 C5 - D5 - A4 - - -",
  "C5 - A4 - F4 - A4 - C5 - D5 - C5 B4 A4 G#4",
  "B4 - - - - - G#4 - E4 - - - . . . .",
  "E5 - - - - - D5 C5 B4 - C5 - A4 - - -",
  ". . A4 B4 C5 - B4 - A4 - G#4 - A4 - E4 -",
  "F5 - - - - - E5 D5 C5 - D5 - A4 - - -",
  ". . A4 C5 D5 - C5 - A4 - F4 - A4 - - -",
  "C5 - - - A4 - C5 - F5 - E5 - D5 - C5 -",
  "A4 - - - C5 - D5 - C5 - B4 - A4 - G#4 -",
  "G#4 - B4 - E5 - - - D5 - C5 - B4 - G#4 -",
  "B4 - - - A4 G#4 F4 G#4 E4 - - - . . . .",
];

/** The busy-kitchen take: the theme an octave up, ornamented in sixteenths. */
const LIFT = [
  "E5 - B4 - C5 B4 A4 G#4 A4 B4 G#4 - F4 G#4 E4 -",
  "F4 A4 C5 A4 F5 - E5 - C5 - A4 G#4 A4 - C5 -",
  "E5 - B4 - C5 B4 A4 G#4 A4 B4 G#4 - F4 G#4 E4 -",
  "G#4 B4 E5 G#5 - - F5 - E5 - . . E5 . E5 F5",
  "G#5 A5 - - E5 - C5 A4 E5 - A5 - G#5 - E5 -",
  "F5 - D5 - A4 - D5 - F5 - A5 - G#5 F5 E5 D5",
  "C5 - F5 - A5 - F5 - C5 - D5 E5 F5 E5 D5 C5",
  "B4 - E5 - G#5 - - - B5 - - - . . . .",
  "A5 - - - E5 - - C5 E5 - A5 - G#5 - E5 -",
  "A5 - G#5 A5 B5 - A5 - G#5 - E5 - C5 - E5 -",
  "D5 - - - F5 - - A5 - - F5 - D5 - A4 -",
  "D5 F5 A5 F5 D5 - A4 - D5 - E5 - F5 - - -",
  "F5 - - - C5 - F5 - A5 - - - G#5 F5 E5 F5",
  "A5 - - - F5 - C5 - A4 - C5 - F5 - G#5 -",
  "B5 - - - G#5 - E5 - B4 - E5 - G#5 - B5 -",
  "E6 - - - D6 C6 B5 A5 G#5 - F5 - E5 - - -",
];

/** The last-thirty-seconds take: its own driving hook, stabbed in sixteenths. */
const PEAK = [
  "E5 . E5 F5 G#5 . F5 E5 . E5 F5 G#5 B5 - G#5 -",
  "A5 . A5 G#5 F5 . C5 A4 . A4 C5 F5 A5 - F5 -",
  "E5 . E5 F5 G#5 . F5 E5 . E5 F5 G#5 B5 - G#5 -",
  "B5 - G#5 - F5 - E5 - G#5 - F5 - E5 - D5 -",
  "C5 . C5 E5 A5 . E5 C5 . C5 E5 A5 B5 - A5 -",
  "D5 . D5 F5 A5 . F5 D5 . D5 F5 A5 D6 - A5 -",
  "C6 - A5 - F5 - C5 - F5 - A5 - C6 - B5 A5",
  "G#5 - - - E5 - - - B5 - - - G#5 - - -",
  "C5 . C5 E5 A5 . E5 C5 . C5 E5 A5 B5 - A5 -",
  "E5 . E5 A5 C6 . B5 A5 G#5 . A5 B5 C6 - B5 -",
  "D5 . D5 F5 A5 . F5 D5 . D5 F5 A5 D6 - A5 -",
  "F5 . F5 A5 D6 . C6 A5 F5 . D5 F5 A5 - F5 -",
  "C6 . C6 A5 F5 . A5 C6 . C6 A5 F5 C5 - F5 -",
  "C6 - A5 - F5 - C5 - F5 - A5 - C6 - B5 A5",
  "E5 . E5 F5 G#5 . F5 E5 . E5 F5 G#5 B5 - G#5 -",
  "E6 - - - B5 - - - G#5 - - - E5 - - -",
];

/** One kitchen's backing: a pattern per chord for each stem, and a beat with a fill. */
interface Backing {
  readonly tone: Tone;
  readonly bass: Readonly<Record<Chord, string>>;
  readonly pad: Readonly<Record<Chord, string>>;
  readonly arp: Readonly<Record<Chord, string>>;
  readonly counter: Readonly<Record<Chord, string>>;
  readonly beat: string;
  /** Closes each eight-bar phrase. */
  readonly fill: string;
}

/** The version of the theme each kitchen plays. */
const BACKINGS: Readonly<Record<LevelId, Backing>> = {
  // a first day: round pulses, roots on the beat, kick and snare with room to breathe
  "erster-tag": {
    tone: { leadDuty: 0.5, arpDuty: 0.25, wave: WAVES.triangle, bassCutoff: 500, padCutoff: 1200 },
    bass: {
      E: "E2 - - - . . E2 . B1 - - - . . B1 .",
      F: "F2 - - - . . F2 . C2 - - - . . C2 .",
      Am: "A1 - - - . . A1 . E2 - - - . . E2 .",
      Dm: "D2 - - - . . D2 . A1 - - - . . A1 .",
    },
    pad: {
      E: "E3:47 - - - - - - - - - - - - - - -",
      F: "F3:47 - - - - - - - - - - - - - - -",
      Am: "A3:37 - - - - - - - - - - - - - - -",
      Dm: "D3:37 - - - - - - - - - - - - - - -",
    },
    arp: {
      E: "E4:47 - - - . . . . E4:47 - - - . . . .",
      F: "F4:47 - - - . . . . F4:47 - - - . . . .",
      Am: "A4:37 - - - . . . . A4:37 - - - . . . .",
      Dm: "D4:37 - - - . . . . D4:37 - - - . . . .",
    },
    counter: {
      E: ". . . . G#3 - B3 - . . . . E4 - D4 -",
      F: ". . . . A3 - C4 - . . . . F4 - E4 -",
      Am: ". . . . C4 - E4 - . . . . A4 - G#4 -",
      Dm: ". . . . F3 - A3 - . . . . D4 - C4 -",
    },
    beat: "k . . . s . . . k . h . s . . .",
    fill: "k . . . s . . . k . s . s . s s",
  },
  // the original shop: octave bass, seventh-chord pads, a skipping arp, four on the floor
  imbiss: {
    tone: { leadDuty: 0.25, arpDuty: 0.125, wave: WAVES.sine, bassCutoff: 700, padCutoff: 1800 },
    bass: {
      E: "E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .",
      F: "F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .",
      Am: "A1 . A2 . A1 . A2 . A1 . A2 . A1 . A2 .",
      Dm: "D2 . D3 . D2 . D3 . D2 . D3 . D2 . D3 .",
    },
    pad: {
      E: "E3:47a - - - - - - - - - - - - - - -",
      F: "F3:47b - - - - - - - - - - - - - - -",
      Am: "A2:7cf - - - - - - - - - - - - - - -",
      Dm: "D3:37c - - - - - - - - - - - - - - -",
    },
    arp: {
      E: "E4:47 - . E4:47 - . E4:47 - E4:47 - . E4:47 - . E4:47 -",
      F: "F4:47 - . F4:47 - . F4:47 - F4:47 - . F4:47 - . F4:47 -",
      Am: "A4:37 - . A4:37 - . A4:37 - A4:37 - . A4:37 - . A4:37 -",
      Dm: "D4:37 - . D4:37 - . D4:37 - D4:37 - . D4:37 - . D4:37 -",
    },
    counter: {
      E: ". . . . . . . . B3 - G#3 - E3 - F3 G#3",
      F: ". . . . . . . . C4 - A3 - F3 - G#3 A3",
      Am: ". . . . . . . . E4 - C4 - A3 - B3 C4",
      Dm: ". . . . . . . . F4 - D4 - A3 - C4 D4",
    },
    beat: "k . h . ks . h . k . h . ks . h o",
    fill: "k . h . ks . h . k . s . s s s s",
  },
  // across the counter wall: a syncopated bass, offbeat stabs, a counter-melody that answers
  durchreiche: {
    tone: { leadDuty: 0.25, arpDuty: 0.5, wave: WAVES.square, bassCutoff: 800, padCutoff: 1500 },
    bass: {
      E: "E2 - . E2 . . E3 . . E2 - . D2 . E2 .",
      F: "F2 - . F2 . . F3 . . F2 - . E2 . F2 .",
      Am: "A1 - . A1 . . A2 . . A1 - . G#1 . A1 .",
      Dm: "D2 - . D2 . . D3 . . D2 - . C2 . D2 .",
    },
    pad: {
      E: ". . . . E3:47 - . . . . . . E3:47 - . .",
      F: ". . . . F3:47 - . . . . . . F3:47 - . .",
      Am: ". . . . A3:37 - . . . . . . A3:37 - . .",
      Dm: ". . . . D3:37 - . . . . . . D3:37 - . .",
    },
    arp: {
      E: "E5:47 . E5:47 . E5:47 . E5:47 . E5:47 . E5:47 . E5:47 . E5:47 .",
      F: "F5:47 . F5:47 . F5:47 . F5:47 . F5:47 . F5:47 . F5:47 . F5:47 .",
      Am: "A4:37 . A4:37 . A4:37 . A4:37 . A4:37 . A4:37 . A4:37 . A4:37 .",
      Dm: "D5:37 . D5:37 . D5:37 . D5:37 . D5:37 . D5:37 . D5:37 . D5:37 .",
    },
    counter: {
      E: ". . . . . . . . . . . . E4 F4 G#4 B4",
      F: ". . . . . . . . . . . . F4 A4 C5 A4",
      Am: ". . . . . . . . . . . . A4 C5 E5 C5",
      Dm: ". . . . . . . . . . . . D4 F4 A4 F4",
    },
    beat: "k . h . s . h k . k h . s . h .",
    fill: "k . h . s . h k . k s . s s s s",
  },
  // the long narrow kitchen: a thin lead over a sixteenth-note bass that never stops running
  schlauch: {
    tone: { leadDuty: 0.125, arpDuty: 0.25, wave: WAVES.saw, bassCutoff: 900, padCutoff: 1000 },
    bass: {
      E: "E2 E2 E3 E2 E2 E3 E2 E2 E2 E2 E3 E2 E2 E3 E2 E3",
      F: "F2 F2 F3 F2 F2 F3 F2 F2 F2 F2 F3 F2 F2 F3 F2 F3",
      Am: "A1 A1 A2 A1 A1 A2 A1 A1 A1 A1 A2 A1 A1 A2 A1 A2",
      Dm: "D2 D2 D3 D2 D2 D3 D2 D2 D2 D2 D3 D2 D2 D3 D2 D3",
    },
    pad: {
      E: "E3:7c - - - - - - - - - - - - - - -",
      F: "F3:7c - - - - - - - - - - - - - - -",
      Am: "A2:7c - - - - - - - - - - - - - - -",
      Dm: "D3:7c - - - - - - - - - - - - - - -",
    },
    arp: {
      E: "E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47 E4:47",
      F: "F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47 F4:47",
      Am: "A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37 A4:37",
      Dm: "D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37 D4:37",
    },
    counter: {
      E: "E3 - . E3 G#3 - . B3 - . D4 - B3 - G#3 -",
      F: "F3 - . F3 A3 - . C4 - . E4 - C4 - A3 -",
      Am: "A3 - . A3 C4 - . E4 - . G#4 - E4 - C4 -",
      Dm: "D3 - . D3 F3 - . A3 - . C4 - A3 - F3 -",
    },
    beat: "k h h h ks h h h k h h h ks h h o",
    fill: "k h h h ks h h h k . s s s s s s",
  },
  // the big kitchen: wide four-note pads, a rolling bass, open hats on every offbeat
  grosskueche: {
    tone: { leadDuty: 0.25, arpDuty: 0.125, wave: WAVES.sine, bassCutoff: 700, padCutoff: 2600 },
    bass: {
      E: "E2 . E3 E2 . E3 E2 . E2 . E3 E2 . E3 B1 D2",
      F: "F2 . F3 F2 . F3 F2 . F2 . F3 F2 . F3 C2 E2",
      Am: "A1 . A2 A1 . A2 A1 . A1 . A2 A1 . A2 E2 G#1",
      Dm: "D2 . D3 D2 . D3 D2 . D2 . D3 D2 . D3 A1 C2",
    },
    pad: {
      E: "E3:47ac - - - - - - - - - - - - - - -",
      F: "F3:47bc - - - - - - - - - - - - - - -",
      Am: "A2:7cf - - - - - - - - - - - - - - -",
      Dm: "D3:37ac - - - - - - - - - - - - - - -",
    },
    arp: {
      E: "E5:47 - E5:47 - E5:47 - E5:47 - E5:47 - E5:47 - E5:47 - E5:47 -",
      F: "F5:47 - F5:47 - F5:47 - F5:47 - F5:47 - F5:47 - F5:47 - F5:47 -",
      Am: "A4:37 - A4:37 - A4:37 - A4:37 - A4:37 - A4:37 - A4:37 - A4:37 -",
      Dm: "D5:37 - D5:37 - D5:37 - D5:37 - D5:37 - D5:37 - D5:37 - D5:37 -",
    },
    counter: {
      E: "E4 - - - D4 - - - B3 - - - G#3 - - -",
      F: "F4 - - - E4 - - - C4 - - - A3 - - -",
      Am: "A4 - - - G#4 - - - E4 - - - C4 - - -",
      Dm: "D4 - - - F4 - - - A4 - - - F4 - - -",
    },
    beat: "k . o . ks . o . k . o . ks . o h",
    fill: "ks . o . ks . o . ks . s . s s s s",
  },
  // the bakery: a bouncing three-three-two bass, staccato offbeat chords, a hopping counter-line
  backstube: {
    tone: { leadDuty: 0.5, arpDuty: 0.25, wave: WAVES.pulse, bassCutoff: 1100, padCutoff: 1400 },
    bass: {
      E: "E2 . . E2 . . E3 . E2 . . E3 . E2 B1 .",
      F: "F2 . . F2 . . F3 . F2 . . F3 . F2 C2 .",
      Am: "A1 . . A1 . . A2 . A1 . . A2 . A1 E2 .",
      Dm: "D2 . . D2 . . D3 . D2 . . D3 . D2 A1 .",
    },
    pad: {
      E: ". . E4:47 . . . E4:47 . . . E4:47 . . . E4:47 .",
      F: ". . F4:47 . . . F4:47 . . . F4:47 . . . F4:47 .",
      Am: ". . A3:37 . . . A3:37 . . . A3:37 . . . A3:37 .",
      Dm: ". . D4:37 . . . D4:37 . . . D4:37 . . . D4:37 .",
    },
    arp: {
      E: "E4:47 . . E4:47 . . E4:47 . E4:47 . . E4:47 . . E4:47 .",
      F: "F4:47 . . F4:47 . . F4:47 . F4:47 . . F4:47 . . F4:47 .",
      Am: "A4:37 . . A4:37 . . A4:37 . A4:37 . . A4:37 . . A4:37 .",
      Dm: "D4:37 . . D4:37 . . D4:37 . D4:37 . . D4:37 . . D4:37 .",
    },
    counter: {
      E: "B3 . G#3 . E3 . G#3 . B3 . D4 . B3 . G#3 .",
      F: "C4 . A3 . F3 . A3 . C4 . E4 . C4 . A3 .",
      Am: "C4 . A3 . E3 . A3 . C4 . E4 . C4 . A3 .",
      Dm: "A3 . F3 . D3 . F3 . A3 . C4 . A3 . F3 .",
    },
    beat: "k . h k s . h . k h . k s . h h",
    fill: "k . h k s . h . k . s s s s s s",
  },
  // the conveyor kitchen: a pumping eighth-note bass like a motor, clockwork arps, a counter-line that ticks along
  fliessband: {
    tone: { leadDuty: 0.125, arpDuty: 0.5, wave: WAVES.square, bassCutoff: 950, padCutoff: 1300 },
    bass: {
      E: "E2 . E2 . E3 . E2 . E2 . E2 . E3 . D3 .",
      F: "F2 . F2 . F3 . F2 . F2 . F2 . F3 . E3 .",
      Am: "A1 . A1 . A2 . A1 . A1 . A1 . A2 . G#2 .",
      Dm: "D2 . D2 . D3 . D2 . D2 . D2 . D3 . C3 .",
    },
    pad: {
      E: "E3:47 - . . E3:47 - . . E3:47 - . . E3:47 - . .",
      F: "F3:47 - . . F3:47 - . . F3:47 - . . F3:47 - . .",
      Am: "A3:37 - . . A3:37 - . . A3:37 - . . A3:37 - . .",
      Dm: "D3:37 - . . D3:37 - . . D3:37 - . . D3:37 - . .",
    },
    arp: {
      E: "E5:47 E5:47 . E5:47 E5:47 . E5:47 . E5:47 E5:47 . E5:47 E5:47 . E5:47 .",
      F: "F5:47 F5:47 . F5:47 F5:47 . F5:47 . F5:47 F5:47 . F5:47 F5:47 . F5:47 .",
      Am: "A4:37 A4:37 . A4:37 A4:37 . A4:37 . A4:37 A4:37 . A4:37 A4:37 . A4:37 .",
      Dm: "D5:37 D5:37 . D5:37 D5:37 . D5:37 . D5:37 D5:37 . D5:37 D5:37 . D5:37 .",
    },
    counter: {
      E: "E4 . G#4 . B4 . G#4 . E4 . G#4 . B4 . D5 .",
      F: "F4 . A4 . C5 . A4 . F4 . A4 . C5 . E5 .",
      Am: "A4 . C5 . E5 . C5 . A4 . C5 . E5 . G#4 .",
      Dm: "D4 . F4 . A4 . F4 . D4 . F4 . A4 . C5 .",
    },
    beat: "k . h h s . h h k . h h s . h k",
    fill: "k . h h s . h h k k s . s s s s",
  },
  // the harbour: a swaying bass that rolls like a boat, long pads, a counter-melody like a shanty answering
  hafen: {
    tone: { leadDuty: 0.5, arpDuty: 0.125, wave: WAVES.triangle, bassCutoff: 600, padCutoff: 2000 },
    bass: {
      E: "E2 - - B1 - - E2 - G#2 - - E2 - - B1 -",
      F: "F2 - - C2 - - F2 - A2 - - F2 - - C2 -",
      Am: "A1 - - E2 - - A1 - C2 - - A1 - - E2 -",
      Dm: "D2 - - A1 - - D2 - F2 - - D2 - - A1 -",
    },
    pad: {
      E: "E3:47 - - - - - - - E3:47 - - - - - - -",
      F: "F3:47 - - - - - - - F3:47 - - - - - - -",
      Am: "A2:37 - - - - - - - A2:37 - - - - - - -",
      Dm: "D3:37 - - - - - - - D3:37 - - - - - - -",
    },
    arp: {
      E: "E5:47 . . E5:47 . . E5:47 . . E5:47 . . E5:47 . . .",
      F: "F5:47 . . F5:47 . . F5:47 . . F5:47 . . F5:47 . . .",
      Am: "A4:37 . . A4:37 . . A4:37 . . A4:37 . . A4:37 . . .",
      Dm: "D5:37 . . D5:37 . . D5:37 . . D5:37 . . D5:37 . . .",
    },
    counter: {
      E: "B3 - - G#3 - - E3 - B3 - - D4 - - B3 -",
      F: "C4 - - A3 - - F3 - C4 - - E4 - - C4 -",
      Am: "E4 - - C4 - - A3 - E4 - - G#4 - - E4 -",
      Dm: "A3 - - F3 - - D3 - A3 - - C4 - - A3 -",
    },
    beat: "k . . h s . k . . h s . k . h .",
    fill: "k . . h s . k . . k s s s s s s",
  },
};

/** The leads, each with its theme: the takes are not versions of the main theme's melody. */
const LEADS: Readonly<Record<"theme" | Take, { readonly theme: string; readonly bars: readonly string[] }>> = {
  theme: { theme: "doener", bars: THEME },
  lift: { theme: "doener", bars: LIFT },
  peak: { theme: "endspurt", bars: PEAK },
};

function isTake(tune: Tune): tune is Take {
  return tune === "lift" || tune === "peak";
}

/** The song for `tune`, played in kitchen `level`: a take borrows that kitchen's backing. */
export function songFor(tune: Tune, level: LevelId): Song {
  const take = isTake(tune) ? tune : "theme";
  const kitchen = isTake(tune) ? level : tune;
  const backing = BACKINGS[kitchen];
  const lead = LEADS[take];

  const patterns = Object.fromEntries([
    ["beat", backing.beat],
    ["fill", backing.fill],
    ...lead.bars.map((bar, i) => [`lead${i}`, bar]),
    ...(["E", "F", "Am", "Dm"] as const).flatMap((chord) => [
      [`bass${chord}`, backing.bass[chord]],
      [`pad${chord}`, backing.pad[chord]],
      [`arp${chord}`, backing.arp[chord]],
      [`counter${chord}`, backing.counter[chord]],
    ]),
  ]);

  const order = CHORDS.map((chord, bar): Row => ({
    lead: `lead${bar}`,
    arp: `arp${chord}`,
    counter: `counter${chord}`,
    bass: `bass${chord}`,
    pad: `pad${chord}`,
    drums: bar % 8 === 7 ? "fill" : "beat",
  }));

  return { id: take === "theme" ? kitchen : `${take}@${kitchen}`, theme: lead.theme, grid: "4/4", tone: backing.tone, patterns, order };
}
