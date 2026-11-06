import type { Tile } from "../core/grid.ts";
import { newCook } from "../../features/cooks/public.ts";
import type { Cook } from "../../features/cooks/public.ts";
import { START_PLATES, newSpit } from "../../features/kitchen/public.ts";
import type { CrateGoods, Sauce, Station } from "../../features/kitchen/public.ts";
import { newOrders } from "../../features/orders/public.ts";
import type { OrdersState } from "../../features/orders/public.ts";

/**
 * The shop's floor plan, one character per tile:
 * `.` floor · `=` counter · `S` spit · `R` toaster · `K` cutting board · `P` pass · `X` bin ·
 * crates `B` bread, `W` wrap, `L` lettuce, `T` tomato, `O` onion ·
 * sauces `g` garlic, `h` herb, `s` spicy · `t` prep tray · `D` plate rack · `U` dirty-plate return ·
 * `N` sink · `F` counter with the fire extinguisher · `1`–`2` where the cooks start (floor).
 */
const SHOP = [
  "==S=R=B=W=PP=",
  "=...........U",
  "K...........g",
  "K...=ttt=...h",
  "=...=...=...s",
  "L...=====...F",
  "T...........X",
  "O.1.......2.=",
  "===D=====N===",
] as const;

const CRATES = new Map<string, CrateGoods>([["B", "bread"], ["W", "wrap"], ["L", "lettuce"], ["T", "tomato"], ["O", "onion"]]);

const SAUCE_KEYS = new Map<string, Sauce>([["g", "garlic"], ["h", "herb"], ["s", "spicy"]]);

/** The whole game state of one round. Plain data the tick mutates; no Effect, no DOM. */
export interface World {
  readonly seed: number;
  tick: number;
  rng: number;
  readonly width: number;
  readonly height: number;
  /** Stations by `y * width + x`; floor tiles have none. */
  readonly stations: Map<number, Station>;
  readonly cooks: Cook[];
  readonly orders: OrdersState;
  /** Ticks at which a served plate comes back dirty to the return station. */
  readonly platesDue: number[];
  /** Last tick of the round. */
  readonly endTick: number;
}

/** Builds a fresh round from a floor plan. */
export function newWorld(seed: number, endTick: number, plan: readonly string[] = SHOP): World {
  const height = plan.length;
  const width = Math.max(...plan.map((row) => row.length));
  const stations = new Map<number, Station>();
  const starts: Tile[] = [];
  plan.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const station = stationFor(ch, x, y);

      if (station !== null) stations.set(y * width + x, station);

      if (ch === "1" || ch === "2") starts[Number(ch) - 1] = { x, y };
    });
  });
  const cooks = starts.map((tile, i) => newCook(i + 1, tile));

  return { seed, tick: 0, rng: seed, width, height, stations, cooks, orders: newOrders(), platesDue: [], endTick };
}

function stationFor(ch: string, x: number, y: number): Station | null {
  const at = { x, y, fire: 0, douse: 0 };
  const goods = CRATES.get(ch);

  if (goods !== undefined) return { ...at, type: "crate", goods, item: null };
  const sauce = SAUCE_KEYS.get(ch);

  if (sauce !== undefined) return { ...at, type: "sauce", sauce, item: null };

  switch (ch) {
    case "=": return { ...at, type: "counter", item: null };
    case "F": return { ...at, type: "counter", item: { kind: "extinguisher" } };
    case "K": return { ...at, type: "board", item: null };
    case "R": return { ...at, type: "toaster", item: null };
    case "S": return { ...at, type: "spit", item: null, spit: newSpit() };
    case "P": return { ...at, type: "pass", item: null };
    case "X": return { ...at, type: "bin", item: null };
    case "t": return { ...at, type: "tray", item: null, veg: null, portions: 0 };
    case "D": return { ...at, type: "rack", item: null, plates: START_PLATES };
    case "U": return { ...at, type: "return", item: null, plates: 0 };
    case "N": return { ...at, type: "sink", item: null, dirty: 0, clean: 0, scrub: 0 };
    default: return null;
  }
}

/** The station on a tile, or null on floor and outside the shop. */
export function stationAt(world: World, x: number, y: number): Station | null {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;

  return world.stations.get(y * world.width + x) ?? null;
}

/** True where a cook cannot walk: stations and everything outside the shop. */
export function isSolid(world: World, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return true;

  return world.stations.has(y * world.width + x);
}
