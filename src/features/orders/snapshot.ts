import type { Filling } from "../kitchen/public.ts";
import type { OrderEvent, OrdersState } from "./model.ts";
import { STARS } from "./prototypes.ts";

/** One ticket on the rail, as the HUD shows it. */
export interface TicketView {
  readonly id: number;
  readonly name: string;
  readonly base: "bread" | "wrap";
  readonly fillings: readonly Filling[];
  /** Patience left, 1 when the customer just arrived. */
  readonly patience: number;
}

/** What the orders HUD shows. */
export interface OrdersSnapshot {
  readonly tickets: readonly TicketView[];
  readonly score: number;
  readonly served: number;
  readonly missed: number;
  readonly stars: number;
  readonly events: readonly OrderEvent[];
}

/** Stars a score earns. */
function starsFor(score: number): number {
  return STARS.filter((needed) => score >= needed).length;
}

/** Copies the orders into a plain, immutable view for the HUD. */
export function ordersSnapshot(state: OrdersState): OrdersSnapshot {
  return {
    tickets: state.queue.map((o) => ({
      id: o.id,
      name: o.recipe.name,
      base: o.recipe.base,
      fillings: o.recipe.fillings,
      patience: o.ticksLeft / o.recipe.patience,
    })),
    score: state.score,
    served: state.served,
    missed: state.missed,
    stars: starsFor(state.score),
    events: state.events.map((e) => e.event),
  };
}
