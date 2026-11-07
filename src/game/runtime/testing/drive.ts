import type { Intent } from "../../../features/cooks/public.ts";
import { IDLE } from "../../../features/cooks/public.ts";
import { findPath, isNextTo } from "../../../features/bots/public.ts";
import type { Station } from "../../../features/kitchen/public.ts";
import type { Tile } from "../../core/grid.ts";
import { step } from "../step.ts";
import type { World } from "../world.ts";
import { isSolid } from "../world.ts";

/** Most ticks a scripted action may take before the test fails. */
const LIMIT = 60 * 30;

/** Intents by keyboard binding that give `intent` to the cook and idle everyone else; a bot cook cannot be scripted. */
function intentsFor(world: World, cookId: number, intent: Intent): Intent[] {
  const driver = world.drivers[world.cooks.findIndex((c) => c.id === cookId)];

  if (driver?.kind !== "keys") throw new Error(`Cook ${cookId} is not on the keyboard.`);
  const intents = [IDLE, IDLE];
  intents[driver.binding] = intent;

  return intents;
}

/** The first station of a type (and, for crates and sauces, of that goods). */
export function find(world: World, match: (s: Station) => boolean): Station {
  for (const s of world.stations.values()) if (match(s)) return s;
  throw new Error("No such station in the shop.");
}

/** Shortest floor path from one tile to any floor tile next to `target`. */
function pathTo(world: World, fromX: number, fromY: number, target: Station): Tile[] {
  const path = findPath(world.width, world.height, (x, y) => isSolid(world, x, y), { x: fromX, y: fromY }, (x, y) => isNextTo({ x, y }, target));

  if (path === null) throw new Error(`No path to the ${target.type} at ${target.x},${target.y}.`);

  return path;
}

/** Walks a cook to the station and turns them to face it, stepping the world as it goes. */
export function walkTo(world: World, cookId: number, target: Station): void {
  const cook = world.cooks.find((c) => c.id === cookId);

  if (cook === undefined) throw new Error(`No cook ${cookId}`);
  const path = pathTo(world, Math.floor(cook.x), Math.floor(cook.y), target);
  let ticks = 0;

  for (const tile of path) {
    while (Math.abs(cook.x - (tile.x + 0.5)) > 0.05 || Math.abs(cook.y - (tile.y + 0.5)) > 0.05) {
      const dx = Math.abs(cook.x - (tile.x + 0.5)) > 0.05 ? Math.sign(tile.x + 0.5 - cook.x) : 0;
      const dy = dx === 0 ? Math.sign(tile.y + 0.5 - cook.y) : 0;
      step(world, intentsFor(world, cookId, { dx, dy, interact: false, work: false, dash: false, throw: false }));
      ticks += 1;

      if (ticks > LIMIT) throw new Error(`Cook ${cookId} is stuck walking to ${target.type}.`);
    }
  }

  const last = path.at(-1) ?? { x: Math.floor(cook.x), y: Math.floor(cook.y) };
  // one short step toward the station turns the cook without leaving the tile
  step(world, intentsFor(world, cookId, { dx: target.x - last.x, dy: target.y - last.y, interact: false, work: false, dash: false, throw: false }));
}

/** Presses interact once. */
export function press(world: World, cookId: number): void {
  step(world, intentsFor(world, cookId, { dx: 0, dy: 0, interact: true, work: false, dash: false, throw: false }));
}

/** Holds work for `ticks` ticks. */
export function hold(world: World, cookId: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, intentsFor(world, cookId, { dx: 0, dy: 0, interact: false, work: true, dash: false, throw: false }));
}

/** Presses throw once, then lets the world run until nothing is in the air. */
export function toss(world: World, cookId: number): void {
  step(world, intentsFor(world, cookId, { ...IDLE, throw: true }));
  let ticks = 0;

  while (world.thrown.length > 0) {
    step(world, []);
    ticks += 1;

    if (ticks > LIMIT) throw new Error("A thrown item never came down.");
  }
}

/** Lets time pass with everyone idle. */
export function wait(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, []);
}
