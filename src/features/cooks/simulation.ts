import type { Tile } from "../../game/core/grid.ts";
import { isThrowable, land } from "../kitchen/public.ts";
import type { Station } from "../kitchen/public.ts";
import { READY, stepDash } from "./machines/dash.ts";
import type { Cook, Intent, Landing, Thrown } from "./model.ts";
import {
  CATCH_REACH, DASH_SPEED, PERSONAL_SPACE, RADIUS, THROW_SPEED, THROW_TICKS, WALK,
} from "./prototypes.ts";

/** A new cook standing in the middle of a tile, facing down. */
export function newCook(id: number, tile: Tile): Cook {
  return { id, x: tile.x + 0.5, y: tile.y + 0.5, face: { dx: 0, dy: 1 }, held: null, working: false, dash: READY };
}

/**
 * Walks a cook one tick along the intent. Each axis moves on its own, so a cook slides
 * along a counter instead of sticking to it, and stops short of solid tiles and other cooks.
 */
export function walk(cook: Cook, intent: Intent, solid: (x: number, y: number) => boolean, others: readonly Cook[]): void {
  cook.dash = stepDash(cook.dash, intent.dash);

  if (cook.dash.state === "dashing") {
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

/** The cook throws what they hold, straight ahead from their hands. Only raw ingredients fly; anything else stays in hand and gives null. */
export function throwHeld(cook: Cook): Thrown | null {
  if (cook.held === null || !isThrowable(cook.held)) return null;
  const thrown: Thrown = { item: cook.held, by: cook.id, x: cook.x, y: cook.y, dir: cook.face, flown: 0 };
  cook.held = null;

  return thrown;
}

/**
 * Moves a thrown ingredient one tick. The first empty-handed cook it reaches catches it. The first
 * solid tile it enters keeps it when that is a station that would take it put down, and loses it
 * otherwise. Out of range it falls to the floor and is lost. Returns how it ended, or null while it flies.
 */
export function fly(thrown: Thrown, cooks: readonly Cook[], stationAt: (x: number, y: number) => Station | null,
  solid: (x: number, y: number) => boolean): Landing | null {
  thrown.x += thrown.dir.dx * THROW_SPEED;
  thrown.y += thrown.dir.dy * THROW_SPEED;
  thrown.flown += 1;
  const catcher = cooks.find((c) => c.id !== thrown.by && c.held === null && Math.hypot(c.x - thrown.x, c.y - thrown.y) <= CATCH_REACH);

  if (catcher !== undefined) {
    catcher.held = thrown.item;

    return { how: "caught", item: thrown.item, x: catcher.x, y: catcher.y };
  }

  const tx = Math.floor(thrown.x);
  const ty = Math.floor(thrown.y);

  if (solid(tx, ty)) {
    const station = stationAt(tx, ty);
    const how = station !== null && land(station, thrown.item) ? "landed" : "dropped";

    return { how, item: thrown.item, x: tx + 0.5, y: ty + 0.5 };
  }

  if (thrown.flown >= THROW_TICKS) return { how: "dropped", item: thrown.item, x: thrown.x, y: thrown.y };

  return null;
}
