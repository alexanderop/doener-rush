import { seconds } from "../../game/core/grid.ts";
import type { Recipe } from "./model.ts";

/** The menu. */
export const RECIPES: readonly Recipe[] = [
  { id: "classic", name: "Döner Classic", base: "bread", fillings: ["meat", "lettuce", "onion", "garlic"], points: 30, patience: seconds(70) },
  { id: "durum", name: "Dürüm Scharf", base: "wrap", fillings: ["meat", "lettuce", "tomato", "spicy"], points: 40, patience: seconds(80) },
  { id: "veggie", name: "Veggie Döner", base: "bread", fillings: ["lettuce", "tomato", "onion", "herb"], points: 35, patience: seconds(75) },
  { id: "pur", name: "Döner Pur", base: "bread", fillings: ["meat", "garlic"], points: 20, patience: seconds(55) },
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

/** Scores for one, two and three stars. */
export const STARS: readonly [number, number, number] = [60, 160, 260];
