import { seconds } from "../../game/core/grid.ts";
import type { Recipe } from "./model.ts";

/** The menu. */
export const RECIPES: readonly Recipe[] = [
  { id: "classic", name: "Döner Classic", icon: "🥙", base: "bread", fillings: ["meat", "lettuce", "onion", "garlic"], points: 30, patience: seconds(70) },
  { id: "durum", name: "Dürüm Scharf", icon: "🌯", base: "wrap", fillings: ["meat", "lettuce", "tomato", "spicy"], points: 40, patience: seconds(80) },
  { id: "veggie", name: "Veggie Döner", icon: "🥙", base: "bread", fillings: ["lettuce", "tomato", "onion", "herb"], points: 35, patience: seconds(75) },
  { id: "pur", name: "Döner Pur", icon: "🥙", base: "bread", fillings: ["meat", "garlic"], points: 20, patience: seconds(55) },
  { id: "franz", name: "Franzbrötchen", icon: "🥐", base: "dough", fillings: ["cinnamon"], points: 30, patience: seconds(75) },
  { id: "mohn", name: "Mohnbrötchen", icon: "🥯", base: "dough", fillings: ["poppy"], points: 30, patience: seconds(75) },
  { id: "brezel", name: "Brezel", icon: "🥨", base: "dough", fillings: ["lye"], points: 35, patience: seconds(80) },
];

/** Customers waiting at most at once. */
export const MAX_ORDERS = 4;

/** Shortest wait between two customers. */
export const ARRIVAL_MIN = seconds(14);

/** Longest wait between two customers. */
export const ARRIVAL_MAX = seconds(24);

/** Points lost when a customer leaves unserved. */
export const MISSED_PENALTY = 10;

/** Most tip points for a döner served the moment it was ordered. */
export const MAX_TIP = 10;

/** Ticks a HUD event stays in the list. */
export const EVENT_TICKS = seconds(3);

/** Length of a round. */
export const ROUND_TICKS = seconds(180);

/** Scores for one, two and three stars, for the normal pace of two cooks. */
export const STARS: readonly [number, number, number] = [60, 160, 260];

/**
 * How busy a shift is for a crew of a given size. A smaller crew gets customers further apart
 * (`arrival` stretches the wait between two), who wait longer (`patience`), and lower star
 * scores (`stars`), so a solo shift is as fair as a full one.
 */
export interface Pace {
  readonly arrival: number;
  readonly patience: number;
  readonly stars: number;
}

/** The pace for two cooks: what the timings above are tuned for. */
export const NORMAL_PACE: Pace = { arrival: 1, patience: 1, stars: 1 };

/** Two paces applied one on top of the other, such as a crew's pace and a level's. */
export function combinePace(a: Pace, b: Pace): Pace {
  return { arrival: a.arrival * b.arrival, patience: a.patience * b.patience, stars: a.stars * b.stars };
}

/** Pace by crew size: one, two, three and four cooks acting at once. */
const PACES: readonly Pace[] = [
  { arrival: 1.6, patience: 1.35, stars: 0.6 },
  NORMAL_PACE,
  { arrival: 0.85, patience: 1, stars: 1.2 },
  { arrival: 0.75, patience: 1, stars: 1.35 },
];

/** The pace for `crew` cooks acting at once; clamps to the table. */
export function paceFor(crew: number): Pace {
  return PACES[Math.max(0, Math.min(PACES.length - 1, Math.round(crew) - 1))] ?? NORMAL_PACE;
}
