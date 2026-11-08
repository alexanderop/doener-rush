/**
 * A plate, as a state machine:
 *
 *   empty ──fill (a döner)──▶ full ──served over the pass──▶ (gone; comes back dirty)
 *     ▲                        │
 *     └──── scrape (the bin) ──┘
 *
 *   dirty ──washed at the sink──▶ empty
 *
 * The sink and the rack count plates rather than hold them, so washing turns a dirty plate into a
 * fresh EMPTY one. A dirty plate never carries food.
 */
import type { Doener } from "../model.ts";

/** What state a plate is in, and the döner on it when full. */
export type Plate =
  | { readonly state: "dirty" }
  | { readonly state: "empty" }
  | { readonly state: "full"; readonly food: Doener };

/** Back from a customer: wash it before it takes food again. */
export const DIRTY: Plate = { state: "dirty" };

/** Clean, with nothing on it. */
export const EMPTY: Plate = { state: "empty" };

/** Puts a döner on a clean empty plate; any other plate is returned as it was. */
export function fill(plate: Plate, food: Doener): Plate {
  return plate.state === "empty" ? { state: "full", food } : plate;
}

/** The bin takes the food off; the plate stays in hand, clean and empty. */
export function scrape(plate: Plate): Plate {
  return plate.state === "full" ? EMPTY : plate;
}

/** The döner on the plate, or null. */
export function foodOn(plate: Plate): Doener | null {
  return plate.state === "full" ? plate.food : null;
}
