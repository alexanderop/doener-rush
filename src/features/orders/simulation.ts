import { nextRandom } from "../../game/core/rng.ts";
import { TOAST_DONE, isBurntBase } from "../kitchen/public.ts";
import type { Item } from "../kitchen/public.ts";
import type { Order, OrderEvent, OrdersState, Recipe } from "./model.ts";
import {
  ARRIVAL_MAX, ARRIVAL_MIN, EVENT_TICKS, MAX_ORDERS, MAX_TIP, MISSED_PENALTY, RECIPES,
} from "./prototypes.ts";

/** An empty counter: the first customer arrives at once. */
export function newOrders(): OrdersState {
  return { queue: [], nextId: 1, untilNext: 0, score: 0, served: 0, missed: 0, events: [] };
}

/** Adds a customer for `recipe` now, as the arrival timer would. */
export function addOrder(state: OrdersState, recipe: Recipe): Order {
  const order: Order = { id: state.nextId, recipe, ticksLeft: recipe.patience };
  state.nextId += 1;
  state.queue.push(order);

  return order;
}

/**
 * Advances the orders by one tick: patience runs down, customers who run out leave,
 * and a new one arrives when the timer is up. Returns the next random state.
 */
export function stepOrders(state: OrdersState, tick: number, rng: number): number {
  let random = rng;

  for (const order of state.queue) order.ticksLeft -= 1;

  for (const order of state.queue.filter((o) => o.ticksLeft <= 0)) {
    state.queue.splice(state.queue.indexOf(order), 1);
    state.score -= MISSED_PENALTY;
    state.missed += 1;
    record(state, tick, { type: "expired", orderId: order.id, penalty: MISSED_PENALTY });
  }

  state.untilNext -= 1;

  if (state.untilNext <= 0) {
    if (state.queue.length < MAX_ORDERS) {
      const [afterPick, pick] = nextRandom(random);
      // SAFETY: pick is below 1, so the index is below RECIPES.length, which is not zero.
      addOrder(state, RECIPES[Math.floor(pick * RECIPES.length)]!);
      random = afterPick;
    }

    const [afterWait, wait] = nextRandom(random);
    state.untilNext = Math.round(ARRIVAL_MIN + wait * (ARRIVAL_MAX - ARRIVAL_MIN));
    random = afterWait;
  }

  while (state.events.length > 0 && tick - (state.events[0]?.tick ?? tick) > EVENT_TICKS) state.events.shift();

  return random;
}

/** Why `item` is not a sellable döner, or null when it is. Döner go out on a clean plate. */
export function defect(item: Item): string | null {
  if (item.kind === "base") return "Erst auf einen Teller!";

  if (item.kind !== "plate") return "Das ist kein Döner.";

  if (item.dirty) return "Schmutziger Teller!";
  const food = item.food;

  if (food === null) return "Der Teller ist leer.";

  if (isBurntBase(food)) return "Verbranntes Brot!";

  if (food.base === "bread" && food.toast < TOAST_DONE) return "Brot nicht getoastet.";

  return null;
}

/** True when `item` is exactly what `recipe` asks for, on a plate. */
function matches(item: Item, recipe: Recipe): boolean {
  if (item.kind !== "plate" || item.food === null || defect(item) !== null) return false;
  const { base, fillings } = item.food;

  return base === recipe.base && fillings.length === recipe.fillings.length && recipe.fillings.every((f) => fillings.includes(f));
}

/**
 * Hands `item` over the pass: the longest-waiting matching customer takes it and pays points
 * plus a tip for speed. Returns true when someone took it; the cook keeps it otherwise.
 */
export function serve(state: OrdersState, item: Item, tick: number): boolean {
  const order = state.queue.find((o) => matches(item, o.recipe));

  if (order === undefined) {
    record(state, tick, { type: "wrong", reason: defect(item) ?? "Das hat niemand bestellt." });

    return false;
  }

  state.queue.splice(state.queue.indexOf(order), 1);
  const tip = Math.round((MAX_TIP * order.ticksLeft) / order.recipe.patience);
  state.score += order.recipe.points + tip;
  state.served += 1;
  record(state, tick, { type: "served", orderId: order.id, points: order.recipe.points, tip });

  return true;
}

function record(state: OrdersState, tick: number, event: OrderEvent): void {
  state.events.push({ tick, event });
}
