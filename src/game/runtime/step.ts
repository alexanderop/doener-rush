import { think } from "../../features/bots/public.ts";
import type { Sight } from "../../features/bots/public.ts";
import { IDLE, facingTile, fly, throwHeld, tilesUnder, walk } from "../../features/cooks/public.ts";
import type { Cook, Intent, Thrown } from "../../features/cooks/public.ts";
import { beltsMove, interact, isBurning, moveBelts, spreadFire, stepStation, work } from "../../features/kitchen/public.ts";
import { ordersSnapshot, seatAt, serve, stepOrders } from "../../features/orders/public.ts";
import type { OrdersSnapshot, Seat } from "../../features/orders/public.ts";
import type { Item, Station } from "../../features/kitchen/public.ts";
import { TICK_RATE, seconds } from "../core/grid.ts";
import { isClosing, stepBridge } from "./bridge.ts";
import type { PlayerInput } from "./lineup.ts";
import { enforceRules } from "./rules.ts";
import type { World } from "./world.ts";
import { blocksThrow, isBridge, isSolid, stationAt } from "./world.ts";
import { stepTutorial, tutorialView } from "./tutorial/tutorial.ts";
import type { TutorialView } from "./tutorial/tutorial.ts";

/** Ticks after a serve until its plate comes back: dirty to the return hatch, or clean to the rack when the rules skip the dishes. */
const PLATE_RETURN = seconds(7);

/** Ticks a landing stays on record for the view to show its puff. */
const LANDING_TICKS = seconds(1);

/** True once the round's time is up; the tick stops changing the world. */
export function isOver(world: World): boolean {
  return world.tick >= world.endTick;
}

/**
 * Advances the world by one tick. `intents[b]` drives the cook binding `b` controls now; missing
 * intents idle. A swap press moves that control to the binding's next cook. Bots think for their cook from what they see at
 * that moment, so a bot sees the moves of the cooks before it.
 * The order is fixed (cooks by id, then thrown ingredients, bridges, belts, stations, orders), so a seed and the same
 * intents always give the same round.
 */
export function step(world: World, intents: readonly PlayerInput[]): void {
  if (isOver(world)) return;
  const solid = (x: number, y: number) => isSolid(world, x, y);
  intents.forEach((input, b) => {
    if (input.swap === true) swapCook(world, b, input);
  });
  world.cooks.forEach((cook, i) => {
    const driver = world.drivers[i];
    const mind = world.bots.get(cook.id);
    let intent = IDLE;

    if (driver?.kind === "keys") intent = world.control[driver.binding] === i ? intentOf(intents[driver.binding]) : parkedIntent(world, i);
    else if (mind !== undefined) intent = think(sightOf(world, cook), mind, cook);
    walk(cook, intent, solid, world.cooks);
    const thrown = intent.throw ? throwHeld(cook) : null;

    if (thrown !== null) {
      world.thrown.push(thrown);
      cook.working = false;

      return;
    }

    const front = facingTile(cook);
    const station = stationAt(world, front.x, front.y);
    cook.working = intent.work && station !== null;

    if (station === null) return;

    if (intent.interact) {
      const seat = seatAt(station);
      cook.held = seat === null ? interact(station, cook.held) : handOver(world, cook.held, seat);
    } else if (intent.work) {
      cook.held = work(station, cook.held);
    }
  });

  flyThrown(world);
  stepBridges(world);

  if (beltsMove(world.tick)) moveBelts(world.stations.values(), (x, y) => stationAt(world, x, y));

  for (const station of world.stations.values()) stepStation(station);
  enforceRules(world);
  spreadFire(world.stations.values(), (x, y) => fightable(world, x, y));
  returnPlates(world);
  world.rng = stepOrders(world.orders, world.tick, world.rng);
  world.tick += 1;
  stepTutorial(world);
}

/**
 * Moves every ingredient in the air one tick, oldest throw first, and records how the finished flights ended. A throw
 * flies over water; one that runs out of flight above it is lost like one that hits the floor.
 */
function flyThrown(world: World): void {
  const flying: Thrown[] = [];

  for (const thrown of world.thrown) {
    const landing = fly(thrown, world.cooks, (x, y) => stationAt(world, x, y), (x, y) => blocksThrow(world, x, y));

    if (landing === null) flying.push(thrown);
    else world.landings.push({ tick: world.tick, landing });
  }

  world.thrown.splice(0, world.thrown.length, ...flying);

  while (world.landings.length > 0 && world.tick - (world.landings[0]?.tick ?? world.tick) > LANDING_TICKS) world.landings.shift();
}

/** The bridges follow their schedule; one due to sink waits while any cook's footprint touches a bridge tile. */
function stepBridges(world: World): void {
  const { bridges } = world;

  if (bridges === null) return;
  const occupied = world.cooks.some((cook) => isOnBridge(world, cook));
  bridges.state = stepBridge(bridges.state, bridges.schedule, occupied);
}

function isOnBridge(world: World, cook: Cook): boolean {
  return tilesUnder(cook.x, cook.y).some((t) => isBridge(world, t.x, t.y));
}

/** The cook part of a player's input. */
function intentOf(input: PlayerInput | undefined): Intent {
  if (input === undefined) return IDLE;

  return { dx: input.dx, dy: input.dy, interact: input.interact, work: input.work, dash: input.dash, throw: input.throw };
}

/**
 * Moves binding `b` to its next cook. The cook it leaves keeps working if the player was holding
 * work at a station that still has some: the board, the sink, or a fire with the extinguisher.
 */
function swapCook(world: World, b: number, input: PlayerInput): void {
  const mine = world.drivers.flatMap((d, i) => (d.kind === "keys" && d.binding === b ? [i] : []));

  if (mine.length < 2) return;
  const current = world.control[b] ?? -1;

  if (input.work && current >= 0) world.parked.add(current);
  const next = mine[(mine.indexOf(current) + 1) % mine.length] ?? current;
  world.control[b] = next;
  world.parked.delete(next);
}

/** A parked cook holds work while its station still has work left, then stands still. */
function parkedIntent(world: World, i: number): Intent {
  const cook = world.cooks[i];

  if (cook === undefined || !world.parked.has(i)) return IDLE;
  const front = facingTile(cook);
  const station = stationAt(world, front.x, front.y);

  if (station !== null && hasWorkLeft(station, cook.held)) return { ...IDLE, work: true };
  world.parked.delete(i);

  return IDLE;
}

/** True while holding work at this station still does something a parked cook may finish alone. The spit is left out: it would pile on meat. */
function hasWorkLeft(station: Station, held: Item | null): boolean {
  if (held?.kind === "extinguisher") return isBurning(station.fire);

  if (station.type === "board") return held === null && station.item?.kind === "veg" && station.item.cut.state !== "chopped";

  if (station.type === "sink") return held === null && station.dirty > 0;

  return false;
}

/** The station on a tile if a cook can stand next to it; fire skips the rest, since nobody could ever put it out. */
function fightable(world: World, x: number, y: number): Station | null {
  const station = stationAt(world, x, y);

  if (station === null) return null;

  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx = 0, dy = 0]) => !isSolid(world, x + dx, y + dy)) ? station : null;
}

/**
 * What a bot sees: the world read-only, plus every bot's claims so two never chase the same job. A bridge about to
 * sink counts as water to a bot not on one yet, so it never starts across; one already on it walks on, and the bridge waits.
 */
function sightOf(world: World, me: Cook): Sight {
  const bridges = world.bridges;
  const avoid = bridges !== null && isClosing(bridges.state) && !isOnBridge(world, me);

  const claims = new Map<string, number>();

  for (const [id, mind] of world.bots) {
    if (mind.order !== null) claims.set(`order:${mind.order}`, id);

    if (mind.task !== null) claims.set(mind.task, id);
  }

  return {
    width: world.width,
    height: world.height,
    solid: (x, y) => isSolid(world, x, y) || (avoid && isBridge(world, x, y)),
    crossing: (x, y) => isBridge(world, x, y),
    stationAt: (x, y) => stationAt(world, x, y),
    stations: [...world.stations.values()],
    cooks: world.cooks,
    orders: world.orders.queue,
    bots: new Set(world.bots.keys()),
    claims,
  };
}

/** A cook hands what it holds to whoever waits at `seat`; the plate comes back dirty a while later. */
function handOver(world: World, held: Item | null, seat: Seat): Item | null {
  if (held === null) return null;

  if (!serve(world.orders, held, world.tick, seat)) return held;
  world.platesDue.push(world.tick + PLATE_RETURN);

  return null;
}

function returnPlates(world: World): void {
  const to = world.rules.dishes ? "return" : "rack";

  while (world.platesDue.length > 0 && (world.platesDue[0] ?? Infinity) <= world.tick) {
    world.platesDue.shift();

    for (const station of world.stations.values()) {
      if (station.type === to) {
        station.plates += 1;
        break;
      }
    }
  }
}

/** Runs `ticks` ticks with the same intents. */
export function run(world: World, ticks: number, intents: readonly PlayerInput[] = []): void {
  for (let i = 0; i < ticks; i++) step(world, intents);
}

/** What the HUD shows of a world. */
export interface Snapshot {
  readonly tick: number;
  readonly secondsLeft: number;
  readonly over: boolean;
  readonly orders: OrdersSnapshot;
  readonly held: readonly (Item | null)[];
  /** For each keyboard binding, the index of the cook it moves now; -1 for none. */
  readonly control: readonly number[];
  /** The current tutorial lesson, or null in a normal shift. */
  readonly tutorial: TutorialView | null;
}

/** Takes the HUD's view of a world. Copies, so React never sees later mutations. */
export function snapshot(world: World): Snapshot {
  return {
    tick: world.tick,
    secondsLeft: Math.max(0, Math.ceil((world.endTick - world.tick) / TICK_RATE)),
    over: isOver(world),
    orders: ordersSnapshot(world.orders),
    held: world.cooks.map((c) => (c.held === null ? null : structuredClone(c.held))),
    control: [...world.control],
    tutorial: tutorialView(world),
  };
}
