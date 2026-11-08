/** The messages between the page and the chip worklet: small cues in, a status per bar out. */
import type { LevelId } from "../../levels.ts";
import type { How } from "./dj.ts";
import type { Stem } from "./score.ts";
import type { Tune } from "./songs.ts";

/** What the page tells the chip. */
export type ToChip =
  | { readonly type: "want"; readonly tune: Tune; readonly level: LevelId; readonly how: How }
  | { readonly type: "intensity"; readonly value: number }
  | { readonly type: "play"; readonly on: boolean }
  | { readonly type: "mute"; readonly on: boolean };

/** What the chip plays, sent back at every bar line and on play or stop. */
export interface ChipStatus {
  readonly playing: boolean;
  readonly bar: number;
  /** "silent", "hold", or "mixing:<kind>". */
  readonly dj: string;
  /** The song on each deck, "" for an empty one. */
  readonly decks: readonly [string, string];
  readonly intensity: number;
  /** The stems the intensity lets in. */
  readonly layers: readonly Stem[];
}

/** The name the worklet registers its processor under. */
export const CHIP = "doener-chip";
