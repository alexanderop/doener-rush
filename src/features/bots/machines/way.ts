/**
 * How a bot gets past other cooks on the walk to its step, as a state machine stepped once per tick it walks:
 *
 *   direct ──stuck, a tile to step onto──▶ aside ──there, or ASIDE ticks up──▶ around ──DETOUR ticks──▶ direct
 *      │                                     ▲                                  ▲  │
 *      └──stuck, nowhere to step─────────────┼──────────────────────────────────┘  │
 *                                            └──────────── stuck again ────────────┘
 *
 * `direct` plans the path as if the other cooks were not there, `around` plans it around them, and `aside` first
 * steps onto a free tile so another cook gets past. The detour only starts once the step aside is over.
 */
import type { Tile } from "../../../game/core/grid.ts";

/** Ticks a bot tries to reach the tile it steps aside to. */
export const ASIDE = 45;

/** Ticks a bot keeps routing around other cooks once it got stuck. */
export const DETOUR = 90;

/** Where a bot is in getting past the other cooks; `left` counts the ticks until it moves on. */
export type Way =
  | { readonly state: "direct" }
  | { readonly state: "aside"; readonly to: Tile; readonly left: number }
  | { readonly state: "around"; readonly left: number };

/** Nobody in the way so far. */
export const DIRECT: Way = { state: "direct" };

/** The bot got stuck: it steps onto `to` first when there is such a tile, then routes around the others. */
export function giveWay(to: Tile | null): Way {
  return to === null ? { state: "around", left: DETOUR } : { state: "aside", to, left: ASIDE };
}

/** One tick of stepping aside; `arrived` is true once the bot stands on the tile. Any other way is returned as it was. */
export function stepAside(way: Way, arrived: boolean): Way {
  if (way.state !== "aside") return way;

  return arrived || way.left <= 1 ? { state: "around", left: DETOUR } : { ...way, left: way.left - 1 };
}

/** One tick of routing around the others. Any other way is returned as it was. */
export function stepAround(way: Way): Way {
  if (way.state !== "around") return way;

  return way.left <= 1 ? DIRECT : { state: "around", left: way.left - 1 };
}
