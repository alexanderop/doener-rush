import { TICK_RATE } from "../../game/core/grid.ts";

/** Walking speed in tiles per tick (4 tiles a second). */
export const WALK = 4 / TICK_RATE;

/** Ticks a dash lasts. */
export const DASH_TICKS = 10;

/** Dash speed in tiles per tick: about two tiles per dash. */
export const DASH_SPEED = 0.2;

/** Ticks after a dash starts before the next one. */
export const DASH_COOLDOWN = 40;

/** Half the width of a cook's square footprint, in tiles. */
export const RADIUS = 0.32;

/** Closest two cooks' centres may come, in tiles. */
export const PERSONAL_SPACE = 0.7;
