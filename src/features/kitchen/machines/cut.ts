/**
 * A vegetable on the board, as a state machine:
 *
 *   whole ──chop──▶ cutting ──chop × CHOP_TICKS──▶ chopped
 *                   │  ▲
 *                   └──┘ chop (one tick of work)
 *
 * Only a chopped vegetable goes into a döner or a prep tray; a tray hands portions back out chopped.
 */
import { CHOP_TICKS } from "../prototypes.ts";

/** How far the knife has got through a vegetable. */
export type Cut =
  | { readonly state: "whole" }
  | { readonly state: "cutting"; readonly ticks: number }
  | { readonly state: "chopped" };

/** Straight from the crate. */
export const WHOLE: Cut = { state: "whole" };

/** Chopped through. */
export const CHOPPED: Cut = { state: "chopped" };

/** One tick of work on the board. */
export function chop(cut: Cut): Cut {
  const ticks = cutTicks(cut) + 1;

  return ticks >= CHOP_TICKS ? CHOPPED : { state: "cutting", ticks };
}

/** Ticks of chopping so far: 0 whole, CHOP_TICKS chopped. */
export function cutTicks(cut: Cut): number {
  switch (cut.state) {
    case "whole": return 0;
    case "cutting": return cut.ticks;
    case "chopped": return CHOP_TICKS;
  }
}
