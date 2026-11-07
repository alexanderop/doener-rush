import type { Filling } from "../kitchen/public.ts";
import type { OrderEvent, OrdersState } from "./model.ts";
import { STARS } from "./prototypes.ts";
import type { Pace } from "./prototypes.ts";

/** One ticket on the rail, as the HUD shows it. */
export interface TicketView {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
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
  /** Scores for one, two and three stars at this shift's pace. */
  readonly targets: readonly number[];
  readonly events: readonly OrderEvent[];
}

/** Scores for one, two and three stars at a pace, rounded to fives. */
function targetsFor(pace: Pace): readonly number[] {
  return STARS.map((needed) => Math.round((needed * pace.stars) / 5) * 5);
}

/** Copies the orders into a plain, immutable view for the HUD. */
export function ordersSnapshot(state: OrdersState): OrdersSnapshot {
  const targets = targetsFor(state.pace);

  return {
    tickets: state.queue.map((o) => ({
      id: o.id,
      name: o.recipe.name,
      icon: o.recipe.icon,
      fillings: o.recipe.fillings,
      patience: o.ticksLeft / o.patience,
    })),
    score: state.score,
    served: state.served,
    missed: state.missed,
    stars: targets.filter((needed) => state.score >= needed).length,
    targets,
    events: state.events.map((e) => e.event),
  };
}
