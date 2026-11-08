import type { Dir } from "../../game/core/grid.ts";
import type { Item } from "../kitchen/public.ts";
import type { Dash } from "./machines/dash.ts";

/** One player's cook in the kitchen. Position is the centre, in tiles. */
export interface Cook {
  readonly id: number;
  x: number;
  y: number;
  face: Dir;
  held: Item | null;
  /** The cook held work this tick (for the knife and shave animation). */
  working: boolean;
  /** Where the cook is in the dash cycle; the cook shoots forward while dashing. */
  dash: Dash;
}

/** What a player asks of their cook for one tick. */
export interface Intent {
  /** Walk direction, each axis -1, 0 or 1. */
  readonly dx: number;
  readonly dy: number;
  /** Interact was pressed this tick (pick up, put down, combine, serve). */
  readonly interact: boolean;
  /** Work is held this tick (chop, shave, wash, spray). */
  readonly work: boolean;
  /** Dash was pressed this tick. */
  readonly dash: boolean;
  /** Throw was pressed this tick: a raw ingredient in hand flies off straight ahead. */
  readonly throw: boolean;
}

/** A cook who does nothing this tick. */
export const IDLE: Intent = { dx: 0, dy: 0, interact: false, work: false, dash: false, throw: false };

/** An ingredient in the air after a throw. It flies straight along `dir` from where it left the hand; position in tiles. */
export interface Thrown {
  readonly item: Item;
  /** The cook who threw it; they cannot catch their own throw. */
  readonly by: number;
  x: number;
  y: number;
  readonly dir: Dir;
  /** Ticks in the air so far. */
  flown: number;
}

/**
 * How a flight ended, at tile position `x`, `y`: an empty-handed cook caught the item, a station took
 * it as if it was put down, or it hit the floor or a station that refused it and is lost.
 */
export interface Landing {
  readonly how: "caught" | "landed" | "dropped";
  readonly item: Item;
  readonly x: number;
  readonly y: number;
}
