import type { Tile } from "../../../game/core/grid.ts";
import { IDLE, facingTile } from "../../cooks/public.ts";
import type { Cook, Intent } from "../../cooks/public.ts";
import type { BotMind, Sight, Step } from "../model.ts";
import { decide } from "./decide.ts";
import { findPath, isNextTo } from "./path.ts";

/** Ticks without getting closer before a bot routes around the other cooks. */
const STUCK = 30;

/** Ticks a bot keeps routing around other cooks once it got stuck. */
const DETOUR = 90;

/** Ticks a bot tries to reach the tile it steps aside to. */
const ASIDE = 45;

/** Tiles of straight path ahead from which a bot dashes. */
const DASH_RUN = 4;

/** How far off a tile's centre line a cook may be and still count as on it. */
const ALIGNED = 0.05;

/** A bot that has not decided anything yet. */
export function newMind(): BotMind {
  return { order: null, task: null, stepKey: "", best: Infinity, stuck: 0, detour: 0, aside: null, asideTicks: 0 };
}

/**
 * One tick of a bot cook: ask the policy what to do, then walk to the step's station, face it,
 * and press interact, hold work or wait there. Returns the intent a player would have given.
 */
export function think(sight: Sight, mind: BotMind, me: Cook): Intent {
  const plan = decide(sight, me, mind);
  mind.order = plan.order;
  mind.task = plan.task;

  return plan.step === null ? IDLE : act(sight, mind, me, plan.step);
}

function act(sight: Sight, mind: BotMind, me: Cook, step: Step): Intent {
  const key = `${step.kind}@${step.at.x},${step.at.y}`;

  if (key !== mind.stepKey) {
    mind.stepKey = key;
    mind.best = Infinity;
    mind.stuck = 0;
  }

  const tile = { x: Math.floor(me.x), y: Math.floor(me.y) };

  if (mind.aside !== null) {
    const aside = mind.aside;
    mind.asideTicks -= 1;

    if (mind.asideTicks > 0 && Math.hypot(aside.x + 0.5 - me.x, aside.y + 0.5 - me.y) > 0.15) return walkToward(me, tile, [tile, aside]);
    mind.aside = null;
  }

  if (isNextTo(tile, step.at)) {
    mind.stuck = 0;
    const front = facingTile(me);

    if (front.x !== step.at.x || front.y !== step.at.y) return { ...IDLE, dx: step.at.x - tile.x, dy: step.at.y - tile.y };

    if (step.kind === "interact") return { ...IDLE, interact: true };

    return step.kind === "work" ? { ...IDLE, work: true } : IDLE;
  }

  const path = route(sight, mind, me, tile, step.at);
  const next = path?.[1];

  if (path === null || next === undefined) return IDLE;
  const left = path.length - 2 + Math.hypot(next.x + 0.5 - me.x, next.y + 0.5 - me.y);

  if (left < mind.best - 0.01) {
    mind.best = left;
    mind.stuck = 0;
  } else if (++mind.stuck >= STUCK) {
    mind.aside = sidestep(sight, me, tile, mind.detour > 0);
    mind.asideTicks = ASIDE;
    mind.detour = DETOUR;
    mind.stuck = 0;
    mind.best = Infinity;
  }

  return walkToward(me, tile, path);
}

/**
 * Cooks pushing against each other never get past. The bot gives way to a human, to a bot with
 * a lower id, or to anyone once routing around them failed too: it steps onto the free
 * neighbouring tile farthest from every cook near it.
 */
function sidestep(sight: Sight, me: Cook, tile: Tile, detoured: boolean): Tile | null {
  const near = sight.cooks.filter((c) => c.id !== me.id && Math.hypot(c.x - me.x, c.y - me.y) < 1.6);
  const yields = detoured || near.some((c) => !sight.bots.has(c.id) || c.id < me.id);

  if (near.length === 0 || !yields) return null;
  let best: Tile | null = null;
  let bestRoom = 0;

  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = tile.x + dx;
    const y = tile.y + dy;
    const room = Math.min(...near.map((c) => Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y)));

    if (!sight.solid(x, y) && room > 0.7 && room > bestRoom) {
      best = { x, y };
      bestRoom = room;
    }
  }

  return best;
}

/** The path to stand next to `target`; around the other cooks for a while after getting stuck. */
function route(sight: Sight, mind: BotMind, me: Cook, tile: Tile, target: Tile): Tile[] | null {
  const goal = (x: number, y: number) => isNextTo({ x, y }, target);

  if (mind.detour > 0) {
    mind.detour -= 1;

    const taken = (x: number, y: number) =>
      sight.cooks.some((c) => c.id !== me.id && Math.floor(c.x) === x && Math.floor(c.y) === y);

    const around = findPath(sight.width, sight.height, (x, y) => sight.solid(x, y) || taken(x, y), tile, goal);

    if (around !== null) return around;
  }

  return findPath(sight.width, sight.height, sight.solid, tile, goal);
}

/** Steps toward the next tile's centre, lining up across the way first, and dashes down a long straight. */
function walkToward(me: Cook, tile: Tile, path: readonly Tile[]): Intent {
  const next = path[1] ?? tile;
  const offX = next.x + 0.5 - me.x;
  const offY = next.y + 0.5 - me.y;
  const dx = Math.abs(offX) > ALIGNED ? Math.sign(offX) : 0;
  const dy = Math.abs(offY) > ALIGNED ? Math.sign(offY) : 0;
  const along = { x: next.x - tile.x, y: next.y - tile.y };
  let run = 0;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] ?? tile;
    const b = path[i] ?? tile;

    if (b.x - a.x !== along.x || b.y - a.y !== along.y) break;
    run += 1;
  }

  const lined = along.x === 0 ? dx === 0 : dy === 0;
  const dash = run >= DASH_RUN && lined && me.dashCooldown === 0;

  return { dx, dy, interact: false, work: false, dash };
}
