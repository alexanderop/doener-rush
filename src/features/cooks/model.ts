import type { Dir } from "../../game/core/grid.ts";
import type { Item } from "../kitchen/public.ts";

/** One player's cook in the kitchen. Position is the centre, in tiles. */
export interface Cook {
  readonly id: number;
  x: number;
  y: number;
  face: Dir;
  held: Item | null;
  /** The cook held work this tick (for the knife and shave animation). */
  working: boolean;
  /** Ticks of dash left; the cook shoots forward while it runs. */
  dash: number;
  /** Ticks until the cook may dash again. */
  dashCooldown: number;
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
}

/** A cook who does nothing this tick. */
export const IDLE: Intent = { dx: 0, dy: 0, interact: false, work: false, dash: false };
