import type { Tile } from "../../game/core/grid.ts";
import type { Cook, Intent } from "./model.ts";
import { DASH_COOLDOWN, DASH_SPEED, DASH_TICKS, PERSONAL_SPACE, RADIUS, WALK } from "./prototypes.ts";

/** A new cook standing in the middle of a tile, facing down. */
export function newCook(id: number, tile: Tile): Cook {
  return { id, x: tile.x + 0.5, y: tile.y + 0.5, face: { dx: 0, dy: 1 }, held: null, working: false, dash: 0, dashCooldown: 0 };
}

/**
 * Walks a cook one tick along the intent. Each axis moves on its own, so a cook slides
 * along a counter instead of sticking to it, and stops short of solid tiles and other cooks.
 */
export function walk(cook: Cook, intent: Intent, solid: (x: number, y: number) => boolean, others: readonly Cook[]): void {
  if (cook.dashCooldown > 0) cook.dashCooldown -= 1;

  if (intent.dash && cook.dashCooldown === 0) {
    cook.dash = DASH_TICKS;
    cook.dashCooldown = DASH_COOLDOWN;
  }

  if (cook.dash > 0) {
    cook.dash -= 1;
    dashStep(cook, intent, solid, others);

    return;
  }

  const dx = Math.sign(intent.dx);
  const dy = Math.sign(intent.dy);

  if (dx === 0 && dy === 0) return;

  if (dx !== 0 && (dy === 0 || cook.face.dx === 0)) cook.face = { dx: dx > 0 ? 1 : -1, dy: 0 };

  if (dy !== 0 && dx === 0) cook.face = { dx: 0, dy: dy > 0 ? 1 : -1 };
  const step = dx !== 0 && dy !== 0 ? WALK / Math.SQRT2 : WALK;
  const x = cook.x + dx * step;

  if (fits(x, cook.y, solid) && clear(cook, x, cook.y, others)) cook.x = x;
  const y = cook.y + dy * step;

  if (fits(cook.x, y, solid) && clear(cook, cook.x, y, others)) cook.y = y;
}

/** One tick of a dash: fast along the walk direction, or straight ahead when standing. */
function dashStep(cook: Cook, intent: Intent, solid: (x: number, y: number) => boolean, others: readonly Cook[]): void {
  let dx = Math.sign(intent.dx);
  let dy = Math.sign(intent.dy);

  if (dx === 0 && dy === 0) {
    dx = cook.face.dx;
    dy = cook.face.dy;
  } else if (dy === 0 || dx === 0) {
    cook.face = dx !== 0 ? { dx: dx > 0 ? 1 : -1, dy: 0 } : { dx: 0, dy: dy > 0 ? 1 : -1 };
  }

  const step = dx !== 0 && dy !== 0 ? DASH_SPEED / Math.SQRT2 : DASH_SPEED;
  const x = cook.x + dx * step;

  if (fits(x, cook.y, solid) && clear(cook, x, cook.y, others)) cook.x = x;
  const y = cook.y + dy * step;

  if (fits(cook.x, y, solid) && clear(cook, cook.x, y, others)) cook.y = y;
}

function fits(x: number, y: number, solid: (x: number, y: number) => boolean): boolean {
  for (const cx of [x - RADIUS, x + RADIUS]) {
    for (const cy of [y - RADIUS, y + RADIUS]) if (solid(Math.floor(cx), Math.floor(cy))) return false;
  }

  return true;
}

function clear(cook: Cook, x: number, y: number, others: readonly Cook[]): boolean {
  return others.every((o) => o.id === cook.id || Math.hypot(o.x - x, o.y - y) >= PERSONAL_SPACE ||
    Math.hypot(o.x - x, o.y - y) > Math.hypot(o.x - cook.x, o.y - cook.y));
}

/** The tile right in front of the cook: the station interact and work reach. */
export function facingTile(cook: Cook): Tile {
  return { x: Math.floor(cook.x) + cook.face.dx, y: Math.floor(cook.y) + cook.face.dy };
}
