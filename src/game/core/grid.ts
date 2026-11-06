/** Simulation ticks per second; every timer in the sim counts these. */
export const TICK_RATE = 60;

/** Milliseconds one tick stands for. */
export const TICK_MS = 1000 / TICK_RATE;

/** Converts seconds of game time to whole ticks. */
export function seconds(s: number): number {
  return Math.round(s * TICK_RATE);
}

/** One of the four directions a cook can face, as a unit step on the grid. */
export interface Dir {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

/** A whole-number tile coordinate. */
export interface Tile {
  readonly x: number;
  readonly y: number;
}
