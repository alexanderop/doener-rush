import { nextRandom } from "../../game/core/rng.ts";
import { isBaked, isBurntBase } from "../kitchen/public.ts";
import type { Item } from "../kitchen/public.ts";
import type { Order, OrderEvent, OrdersState, Recipe } from "./model.ts";
import {
  ARRIVAL_MAX, ARRIVAL_MIN, EVENT_TICKS, MAX_COMBO, MAX_ORDERS, MAX_TIP, MISSED_PENALTY, NORMAL_PACE, RECIPES,
} from "./prototypes.ts";
import type { Pace } from "./prototypes.ts";

/** An empty counter at a pace, serving a menu: the first customer arrives at once. */
export function newOrders(pace: Pace = NORMAL_PACE, menu: readonly Recipe[] = RECIPES): OrdersState {
  if (menu.length === 0) throw new Error("A shift needs at least one recipe on the menu.");

  return { pace, menu, queue: [], nextId: 1, untilNext: 0, score: 0, combo: 1, served: 0, missed: 0, events: [] };
}

/** Adds a customer for `recipe` now, as the arrival timer would. */
export function addOrder(state: OrdersState, recipe: Recipe): Order {
  const patience = Math.round(recipe.patience * state.pace.patience);
  const order: Order = { id: state.nextId, recipe, patience, ticksLeft: patience };
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
    state.combo = 1;
    record(state, tick, { type: "expired", orderId: order.id, penalty: MISSED_PENALTY });
  }

  state.untilNext -= 1;

  if (state.untilNext <= 0) {
    if (state.queue.length < MAX_ORDERS) {
      const [afterPick, pick] = nextRandom(random);
      // SAFETY: pick is below 1, so the index is below menu.length, which newOrders keeps above zero.
      addOrder(state, state.menu[Math.floor(pick * state.menu.length)]!);
      random = afterPick;
    }

    const [afterWait, wait] = nextRandom(random);
    state.untilNext = Math.round((ARRIVAL_MIN + wait * (ARRIVAL_MAX - ARRIVAL_MIN)) * state.pace.arrival);
    random = afterWait;
  }

  while (state.events.length > 0 && tick - (state.events[0]?.tick ?? tick) > EVENT_TICKS) state.events.shift();

  return random;
}

/** Why `item` is not a sellable döner, or null when it is. Döner go out on a clean plate. */
export function defect(item: Item): string | null {
  if (item.kind === "base") return "Erst auf einen Teller!";

  if (item.kind !== "plate") return "Das ist kein Döner.";

  if (item.plate.state === "dirty") return "Schmutziger Teller!";

  if (item.plate.state === "empty") return "Der Teller ist leer.";
  const { food } = item.plate;

  if (isBurntBase(food)) return food.base === "dough" ? "Verbranntes Gebäck!" : "Verbranntes Brot!";

  if (!isBaked(food)) return food.base === "dough" ? "Teig nicht gebacken." : "Brot nicht getoastet.";

  return null;
}

/** True when `item` is exactly what `recipe` asks for, on a plate. */
function matches(item: Item, recipe: Recipe): boolean {
  if (item.kind !== "plate" || item.plate.state !== "full" || defect(item) !== null) return false;
  const { base, fillings } = item.plate.food;

  return base === recipe.base && fillings.length === recipe.fillings.length && recipe.fillings.every((f) => fillings.includes(f));
}

/**
 * Hands `item` over the pass: the longest-waiting matching customer takes it and pays points
 * plus a tip for speed times the combo. Serving the customer at the head of the queue raises
 * the combo; serving anyone else resets it. Returns true when someone took it; the cook keeps it otherwise.
 */
export function serve(state: OrdersState, item: Item, tick: number): boolean {
  const order = state.queue.find((o) => matches(item, o.recipe));

  if (order === undefined) {
    record(state, tick, { type: "wrong", reason: defect(item) ?? "Das hat niemand bestellt." });

    return false;
  }

  const inTurn = state.queue[0] === order;
  state.queue.splice(state.queue.indexOf(order), 1);
  const { combo } = state;
  const tip = Math.round((MAX_TIP * order.ticksLeft) / order.patience) * combo;
  state.score += order.recipe.points + tip;
  state.served += 1;
  state.combo = inTurn ? Math.min(MAX_COMBO, combo + 1) : 1;
  record(state, tick, { type: "served", orderId: order.id, points: order.recipe.points, tip, combo });

  return true;
}

function record(state: OrdersState, tick: number, event: OrderEvent): void {
  state.events.push({ tick, event });
}
