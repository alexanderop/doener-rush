import type { Base, Filling } from "../kitchen/public.ts";
import type { Pace } from "./prototypes.ts";

/** The dishes the shop can make. */
export type RecipeId = "classic" | "durum" | "veggie" | "pur" | "franz" | "mohn" | "brezel";

/** A dish on the menu: the base and exactly these fillings. */
export interface Recipe {
  readonly id: RecipeId;
  readonly name: string;
  /** The emoji on the customer's ticket. */
  readonly icon: string;
  readonly base: Base;
  readonly fillings: readonly Filling[];
  readonly points: number;
  /** Ticks the customer waits before leaving. */
  readonly patience: number;
}

/** Where a customer waits for the food: at the pass, or seated at a numbered table in the dining room. */
export type Seat = { readonly kind: "pass" } | { readonly kind: "table"; readonly table: number };

/**
 * How a shop seats its customers, decided by its floor plan: everyone at the pass, or one guest per table. A full
 * pass turns the next customer away; a full dining room keeps them at the door until a table frees.
 */
export type Seating = { readonly kind: "pass" } | { readonly kind: "tables"; readonly tables: readonly number[] };

/** A customer waiting for one recipe. */
export interface Order {
  readonly id: number;
  readonly recipe: Recipe;
  /** Where the dish has to go. */
  readonly seat: Seat;
  /** Ticks this customer waits in all: the recipe's patience at the shift's pace. */
  readonly patience: number;
  ticksLeft: number;
}

/** Something that happened to the orders this tick, for HUD feedback. */
export type OrderEvent =
  | { readonly type: "served"; readonly orderId: number; readonly seat: Seat; readonly points: number; readonly tip: number; readonly combo: number }
  | { readonly type: "expired"; readonly orderId: number; readonly penalty: number }
  | { readonly type: "wrong"; readonly seat: Seat; readonly reason: string };

/** All order state of one round. */
export interface OrdersState {
  /** How busy the shift is, set by the size of the crew and the shift's rules before it starts. */
  pace: Pace;
  /** What customers may order this shift; never empty. */
  readonly menu: readonly Recipe[];
  readonly seating: Seating;
  readonly queue: Order[];
  nextId: number;
  /** Ticks until the next customer arrives. */
  untilNext: number;
  score: number;
  /** What the next speed tip is multiplied by: 1, rising while customers are served in the order they came. */
  combo: number;
  served: number;
  missed: number;
  /** Events of the last few seconds, newest last. */
  readonly events: { readonly tick: number; readonly event: OrderEvent }[];
}
