/**
 * A prep tray, as a state machine:
 *
 *   empty ──stock (a chopped vegetable)──▶ stocked ──take the last portion──▶ empty
 *                                           │    ▲
 *                                           └────┘ stock the same vegetable, or take one of several
 *
 * A stocked tray holds one kind of vegetable and at least one portion of it, so a tray with a
 * vegetable but nothing in it cannot exist.
 */
import type { Veg } from "../model.ts";
import { TRAY_PORTIONS } from "../prototypes.ts";

/** What is in a prep tray. */
export type Tray =
  | { readonly state: "empty" }
  | { readonly state: "stocked"; readonly veg: Veg; readonly portions: number };

/** Nothing in it: it takes any chopped vegetable. */
export const NO_STOCK: Tray = { state: "empty" };

/** A tray holding `portions` of `veg`; empty when there are none. */
export function trayOf(veg: Veg, portions: number): Tray {
  return portions > 0 ? { state: "stocked", veg, portions } : NO_STOCK;
}

/** True when one more portion of `veg` goes in: the tray is empty, or holds that vegetable and is not full. */
export function takesPortion(tray: Tray, veg: Veg): boolean {
  return tray.state === "empty" || (tray.veg === veg && tray.portions < TRAY_PORTIONS);
}

/** One portion of `veg` goes in; a tray that does not take it is returned as it was. */
export function stock(tray: Tray, veg: Veg): Tray {
  if (!takesPortion(tray, veg)) return tray;

  return { state: "stocked", veg, portions: portionsIn(tray) + 1 };
}

/** One portion comes out; the last one leaves the tray empty. */
export function takePortion(tray: Tray): Tray {
  return tray.state === "empty" ? tray : trayOf(tray.veg, tray.portions - 1);
}

/** The vegetable in the tray, or null when it is empty. */
export function vegIn(tray: Tray): Veg | null {
  return tray.state === "stocked" ? tray.veg : null;
}

/** How many portions are in the tray. */
export function portionsIn(tray: Tray): number {
  return tray.state === "stocked" ? tray.portions : 0;
}
