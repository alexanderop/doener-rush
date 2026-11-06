/**
 * Seeded randomness for the sim (mulberry32). The state is a plain number the
 * world stores, so a save or a replay continues the same sequence.
 */

/** Advances the state and returns the next state with a float in [0, 1). */
export function nextRandom(state: number): readonly [next: number, value: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return [next, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}
