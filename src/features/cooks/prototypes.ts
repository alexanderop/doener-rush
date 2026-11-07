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

/** Flight speed of a thrown ingredient in tiles per tick (10 tiles a second). */
export const THROW_SPEED = 10 / TICK_RATE;

/** Ticks a thrown ingredient stays in the air before it drops: six tiles of flight. */
export const THROW_TICKS = Math.round(6 / THROW_SPEED);

/** How close a thrown ingredient must pass a cook's centre to be caught, in tiles. */
export const CATCH_REACH = 0.5;
