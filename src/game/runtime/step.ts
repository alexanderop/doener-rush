import { IDLE, facingTile, walk } from "../../features/cooks/public.ts";
import type { Intent } from "../../features/cooks/public.ts";
import { interact, spreadFire, stepStation, work } from "../../features/kitchen/public.ts";
import { ordersSnapshot, serve, stepOrders } from "../../features/orders/public.ts";
import type { OrdersSnapshot } from "../../features/orders/public.ts";
import type { Item } from "../../features/kitchen/public.ts";
import { TICK_RATE, seconds } from "../core/grid.ts";
import type { World } from "./world.ts";
import { isSolid, stationAt } from "./world.ts";

/** Ticks after a serve until its plate comes back dirty. */
const PLATE_RETURN = seconds(7);

/** True once the round's time is up; the tick stops changing the world. */
export function isOver(world: World): boolean {
  return world.tick >= world.endTick;
}

/**
 * Advances the world by one tick. `intents[b]` drives the cook on keyboard binding `b`; missing
 * intents idle, and so do bots until they can think.
 * The order is fixed (cooks by id, then stations, then orders), so a seed and the same
 * intents always give the same round.
 */
export function step(world: World, intents: readonly Intent[]): void {
  if (isOver(world)) return;
  const solid = (x: number, y: number) => isSolid(world, x, y);
  world.cooks.forEach((cook, i) => {
    const driver = world.drivers[i];
    const intent = driver?.kind === "keys" ? (intents[driver.binding] ?? IDLE) : IDLE;
    walk(cook, intent, solid, world.cooks);
    const front = facingTile(cook);
    const station = stationAt(world, front.x, front.y);
    cook.working = intent.work && station !== null;

    if (station === null) return;

    if (intent.interact) {
      cook.held = station.type === "pass" ? handOver(world, cook.held) : interact(station, cook.held);
    } else if (intent.work) {
      cook.held = work(station, cook.held);
    }
  });

  for (const station of world.stations.values()) stepStation(station);
  spreadFire(world.stations.values(), (x, y) => stationAt(world, x, y));
  returnPlates(world);
  world.rng = stepOrders(world.orders, world.tick, world.rng);
  world.tick += 1;
}

function handOver(world: World, held: Item | null): Item | null {
  if (held === null) return null;

  if (!serve(world.orders, held, world.tick)) return held;
  world.platesDue.push(world.tick + PLATE_RETURN);

  return null;
}

function returnPlates(world: World): void {
  while (world.platesDue.length > 0 && (world.platesDue[0] ?? Infinity) <= world.tick) {
    world.platesDue.shift();

    for (const station of world.stations.values()) {
      if (station.type === "return") {
        station.plates += 1;
        break;
      }
    }
  }
}

/** Runs `ticks` ticks with the same intents. */
export function run(world: World, ticks: number, intents: readonly Intent[] = []): void {
  for (let i = 0; i < ticks; i++) step(world, intents);
}

/** What the HUD shows of a world. */
export interface Snapshot {
  readonly tick: number;
  readonly secondsLeft: number;
  readonly over: boolean;
  readonly orders: OrdersSnapshot;
  readonly held: readonly (Item | null)[];
}

/** Takes the HUD's view of a world. Copies, so React never sees later mutations. */
export function snapshot(world: World): Snapshot {
  return {
    tick: world.tick,
    secondsLeft: Math.max(0, Math.ceil((world.endTick - world.tick) / TICK_RATE)),
    over: isOver(world),
    orders: ordersSnapshot(world.orders),
    held: world.cooks.map((c) => (c.held === null ? null : structuredClone(c.held))),
  };
}
