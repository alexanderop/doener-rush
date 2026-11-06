import type { Intent } from "../../../features/cooks/public.ts";
import { IDLE } from "../../../features/cooks/public.ts";
import type { Station } from "../../../features/kitchen/public.ts";
import { step } from "../step.ts";
import type { World } from "../world.ts";
import { isSolid } from "../world.ts";

/** Most ticks a scripted action may take before the test fails. */
const LIMIT = 60 * 30;

function intentsFor(world: World, cookId: number, intent: Intent): Intent[] {
  return world.cooks.map((c) => (c.id === cookId ? intent : IDLE));
}

/** The first station of a type (and, for crates and sauces, of that goods). */
export function find(world: World, match: (s: Station) => boolean): Station {
  for (const s of world.stations.values()) if (match(s)) return s;
  throw new Error("No such station in the shop.");
}

/** Shortest floor path from one tile to any floor tile next to `target` (breadth-first). */
function pathTo(world: World, fromX: number, fromY: number, target: Station): { x: number; y: number }[] {
  const key = (x: number, y: number) => y * world.width + x;
  const prev = new Map<number, number>([[key(fromX, fromY), -1]]);
  const queue = [key(fromX, fromY)];

  while (queue.length > 0) {
    const k = queue.shift() ?? 0;
    const x = k % world.width;
    const y = Math.floor(k / world.width);

    if (Math.abs(x - target.x) + Math.abs(y - target.y) === 1) {
      const path: { x: number; y: number }[] = [];

      for (let c = k; c !== -1; c = prev.get(c) ?? -1) path.unshift({ x: c % world.width, y: Math.floor(c / world.width) });

      return path;
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = key(x + dx, y + dy);

      if (!isSolid(world, x + dx, y + dy) && !prev.has(n)) {
        prev.set(n, k);
        queue.push(n);
      }
    }
  }

  throw new Error(`No path to the ${target.type} at ${target.x},${target.y}.`);
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
      step(world, intentsFor(world, cookId, { dx, dy, interact: false, work: false, dash: false }));
      ticks += 1;

      if (ticks > LIMIT) throw new Error(`Cook ${cookId} is stuck walking to ${target.type}.`);
    }
  }

  const last = path.at(-1) ?? { x: Math.floor(cook.x), y: Math.floor(cook.y) };
  // one short step toward the station turns the cook without leaving the tile
  step(world, intentsFor(world, cookId, { dx: target.x - last.x, dy: target.y - last.y, interact: false, work: false, dash: false }));
}

/** Presses interact once. */
export function press(world: World, cookId: number): void {
  step(world, intentsFor(world, cookId, { dx: 0, dy: 0, interact: true, work: false, dash: false }));
}

/** Holds work for `ticks` ticks. */
export function hold(world: World, cookId: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, intentsFor(world, cookId, { dx: 0, dy: 0, interact: false, work: true, dash: false }));
}

/** Lets time pass with everyone idle. */
export function wait(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, []);
}
