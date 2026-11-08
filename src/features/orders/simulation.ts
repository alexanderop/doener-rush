import { nextRandom } from "../../game/core/rng.ts";
import { isBaked, isBurntBase } from "../kitchen/public.ts";
import type { Item, Station } from "../kitchen/public.ts";
import type { Order, OrderEvent, OrdersState, Recipe, Seat, Seating } from "./model.ts";
import {
  ARRIVAL_MAX, ARRIVAL_MIN, EVENT_TICKS, MAX_COMBO, MAX_ORDERS, MAX_TIP, MISSED_PENALTY, NORMAL_PACE, RECIPES,
} from "./prototypes.ts";
import type { Pace } from "./prototypes.ts";

/** The pass: every customer of a shop without tables waits there. Both a seat and a way of seating. */
export const PASS = { kind: "pass" } as const satisfies Seat & Seating;

/** An empty shop at a pace, serving a menu, seating as its floor plan says: the first customer arrives at once. */
export function newOrders(pace: Pace = NORMAL_PACE, menu: readonly Recipe[] = RECIPES, seating: Seating = PASS): OrdersState {
  if (menu.length === 0) throw new Error("A shift needs at least one recipe on the menu.");

  return { pace, menu, seating, queue: [], nextId: 1, untilNext: 0, score: 0, combo: 1, served: 0, missed: 0, events: [] };
}

/** The lowest-numbered table nobody sits at, or null when every table is taken. */
function freeTable(tables: readonly number[], queue: readonly Order[]): Seat | null {
  const taken = new Set(queue.flatMap((o) => (o.seat.kind === "table" ? [o.seat.table] : [])));
  const table = tables.find((t) => !taken.has(t));

  return table === undefined ? null : { kind: "table", table };
}

/**
 * Where the customer arriving now goes. The pass takes anyone while fewer than MAX_ORDERS wait and turns the rest away;
 * a dining room seats them at the lowest free table, or keeps them waiting at the door until one frees.
 */
function arrival(state: OrdersState): Seat | "turned away" | "waits" {
  if (state.seating.kind === "pass") return state.queue.length < MAX_ORDERS ? PASS : "turned away";

  return freeTable(state.seating.tables, state.queue) ?? "waits";
}

/** Where a customer added by hand sits: the pass, or the lowest free table. */
function seatFor(state: OrdersState): Seat {
  if (state.seating.kind === "pass") return PASS;
  const seat = freeTable(state.seating.tables, state.queue);

  if (seat === null) throw new Error("Every table is taken.");

  return seat;
}

/** Adds a customer for `recipe` now, as the arrival timer would: at the pass, or at the lowest free table. */
export function addOrder(state: OrdersState, recipe: Recipe, seat: Seat = seatFor(state)): Order {
  const patience = Math.round(recipe.patience * state.pace.patience);
  const order: Order = { id: state.nextId, recipe, seat, patience, ticksLeft: patience };
  state.nextId += 1;
  state.queue.push(order);

  return order;
}

/**
 * Advances the orders by one tick: patience runs down, customers who run out leave and free their seat,
 * and a new one arrives when the timer is up and there is room. Returns the next random state.
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
  const next = state.untilNext <= 0 ? arrival(state) : "waits";

  if (next !== "waits") {
    if (next !== "turned away") {
      const [afterPick, pick] = nextRandom(random);
      // SAFETY: pick is below 1, so the index is below menu.length, which newOrders keeps above zero.
      addOrder(state, state.menu[Math.floor(pick * state.menu.length)]!, next);
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

/** Where a station serves customers: the pass, a table, or nowhere. The one answer to where a dish can go out. */
export function seatAt(station: Station): Seat | null {
  if (station.type === "pass") return PASS;

  return station.type === "table" ? { kind: "table", table: station.table } : null;
}

function sameSeat(a: Seat, b: Seat): boolean {
  return a.kind === "pass" ? b.kind === "pass" : b.kind === "table" && a.table === b.table;
}

/** True when `order`'s dish is handed over at `station`. */
export function servedAt(order: Order, station: Station): boolean {
  const seat = seatAt(station);

  return seat !== null && sameSeat(seat, order.seat);
}

/** Why nobody at `seat` takes a dish that is fine in itself: nobody sits there, or someone else ordered it. */
function refusal(state: OrdersState, item: Item, seat: Seat): string {
  if (seat.kind === "pass") return "Das hat niemand bestellt.";

  if (!state.queue.some((o) => sameSeat(o.seat, seat))) return "An dem Tisch sitzt niemand.";
  const elsewhere = state.queue.find((o) => matches(item, o.recipe))?.seat;

  return elsewhere?.kind === "table" ? `Das gehört an Tisch ${elsewhere.table}.` : "Das hat hier niemand bestellt.";
}

/**
 * Hands `item` over at `seat` (the pass unless given): the longest-waiting customer there whose order it matches takes
 * it and pays points plus a tip for speed times the combo. Serving the customer who has waited longest of all raises
 * the combo; serving anyone else resets it. Returns true when someone took it; the cook keeps it otherwise.
 */
export function serve(state: OrdersState, item: Item, tick: number, seat: Seat = PASS): boolean {
  const order = state.queue.find((o) => sameSeat(o.seat, seat) && matches(item, o.recipe));

  if (order === undefined) {
    record(state, tick, { type: "wrong", seat, reason: defect(item) ?? refusal(state, item, seat) });

    return false;
  }

  const inTurn = state.queue[0] === order;
  state.queue.splice(state.queue.indexOf(order), 1);
  const { combo } = state;
  const tip = Math.round((MAX_TIP * order.ticksLeft) / order.patience) * combo;
  state.score += order.recipe.points + tip;
  state.served += 1;
  state.combo = inTurn ? Math.min(MAX_COMBO, combo + 1) : 1;
  record(state, tick, { type: "served", orderId: order.id, seat, points: order.recipe.points, tip, combo });

  return true;
}

function record(state: OrdersState, tick: number, event: OrderEvent): void {
  state.events.push({ tick, event });
}
