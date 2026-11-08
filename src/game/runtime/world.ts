import type { Dir, Tile } from "../core/grid.ts";
import { newMind } from "../../features/bots/public.ts";
import type { BotMind } from "../../features/bots/public.ts";
import { newCook } from "../../features/cooks/public.ts";
import type { Cook, Landing, Thrown } from "../../features/cooks/public.ts";
import { OUT, START_PLATES, newSpit } from "../../features/kitchen/public.ts";
import type { CrateGoods, Sauce, Station, Topping } from "../../features/kitchen/public.ts";
import { PASS, RECIPES, combinePace, newOrders, paceFor } from "../../features/orders/public.ts";
import type { OrdersState, Seating } from "../../features/orders/public.ts";
import { isUp, newBridge } from "./bridge.ts";
import type { Bridges } from "./bridge.ts";
import { DEFAULT_LEVEL } from "./levels.ts";
import type { Level } from "./levels.ts";
import { TWO_PLAYERS, crewOf } from "./lineup.ts";
import type { Driver, Lineup } from "./lineup.ts";
import { NORMAL_RULES } from "./rules.ts";
import type { Rules } from "./rules.ts";

const CRATES = new Map<string, CrateGoods>([
  ["B", "bread"], ["W", "wrap"], ["L", "lettuce"], ["T", "tomato"], ["O", "onion"], ["M", "flour"], ["Y", "butter"],
]);

const BELTS = new Map<string, Dir>([[">", { dx: 1, dy: 0 }], ["<", { dx: -1, dy: 0 }], ["^", { dx: 0, dy: -1 }], ["v", { dx: 0, dy: 1 }]]);

const SAUCE_KEYS = new Map<string, Sauce | Topping>([
  ["g", "garlic"], ["h", "herb"], ["s", "spicy"], ["z", "cinnamon"], ["m", "poppy"], ["l", "lye"],
]);

/** The whole game state of one round. Plain data the tick mutates; no Effect, no DOM. */
export interface World {
  readonly seed: number;
  tick: number;
  rng: number;
  readonly width: number;
  readonly height: number;
  /** Stations by `y * width + x`; floor tiles have none. */
  readonly stations: Map<number, Station>;
  /** Open water (`~`) by `y * width + x`: nobody walks there, but a throw flies over it. */
  readonly water: ReadonlySet<number>;
  /** The bridges (`#`) over the water and where they are in their schedule; null in a kitchen without. */
  readonly bridges: Bridges | null;
  readonly cooks: Cook[];
  /** Ingredients in the air, oldest throw first. */
  readonly thrown: Thrown[];
  /** How the throws of the last second ended, newest last, for the landing puffs. */
  readonly landings: { readonly tick: number; readonly landing: Landing }[];
  /** Who drives each cook, by index into `cooks`. */
  readonly drivers: readonly Driver[];
  /** For each keyboard binding, the index of the cook it moves now; -1 when it drives none. */
  readonly control: number[];
  /** Cooks of a swap pair left holding work: they keep chopping, washing or spraying on their own. */
  readonly parked: Set<number>;
  /** The memory of each bot cook, by cook id. */
  readonly bots: Map<number, BotMind>;
  readonly orders: OrdersState;
  /** Ticks at which a served plate comes back dirty to the return station. */
  readonly platesDue: number[];
  /** Last tick of the round. Set once by the shift's rules before it starts. */
  endTick: number;
  /** The house rules: burning, fire, dishes, customers, shift length. Set once before the shift starts. */
  rules: Rules;
  /** The guided tutorial's progress, or null in a normal shift. */
  tutorial: TutorialState | null;
}

/** Progress through the tutorial: the index of the current lesson. */
interface TutorialState {
  lesson: number;
}

/** Builds a fresh round in a level's kitchen with one cook per driver of the lineup, on start tiles `1`, `2`, … */
export function newWorld(seed: number, endTick: number, lineup: Lineup = TWO_PLAYERS, level: Level = DEFAULT_LEVEL): World {
  const { plan } = level;
  const height = plan.length;
  const width = Math.max(...plan.map((row) => row.length));
  const stations = new Map<number, Station>();
  const water = new Set<number>();
  const bridgeTiles = new Set<number>();
  const starts: Tile[] = [];
  const tables: number[] = [];
  plan.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const station = stationFor(ch, x, y, tables.length + 1);

      if (station?.type === "table") tables.push(station.table);

      if (station !== null) stations.set(y * width + x, station);

      if (ch === "~") water.add(y * width + x);

      if (ch === "#") bridgeTiles.add(y * width + x);

      if (ch >= "1" && ch <= "4") starts[Number(ch) - 1] = { x, y };
    });
  });

  if (bridgeTiles.size > 0 && level.bridge === undefined) throw new Error(`${level.id} has bridges but no bridge schedule.`);
  const bridges = level.bridge === undefined ? null : { tiles: bridgeTiles, schedule: level.bridge, state: newBridge(level.bridge) };

  const cooks = lineup.drivers.map((_, i) => {
    const start = starts[i];

    if (start === undefined) throw new Error(`The floor plan has no start tile for cook ${i + 1}.`);

    return newCook(i + 1, start);
  });

  const bots = new Map<number, BotMind>();
  lineup.drivers.forEach((driver, i) => {
    if (driver.kind === "bot") bots.set(i + 1, newMind());
  });

  const control = [0, 1].map((b) => lineup.drivers.findIndex((d) => d.kind === "keys" && d.binding === b));
  // a kitchen with tables serves its guests there; one without serves everyone over the pass
  const seating: Seating = tables.length > 0 ? { kind: "tables", tables } : PASS;
  const pace = combinePace(paceFor(crewOf(lineup)), level.pace);

  return {
    seed, tick: 0, rng: seed, width, height, stations, water, bridges, cooks, thrown: [], landings: [], drivers: lineup.drivers, control, parked: new Set(), bots,
    orders: newOrders(pace, RECIPES.filter((r) => level.menu.includes(r.id)), seating), platesDue: [], endTick, rules: NORMAL_RULES, tutorial: null,
  };
}

/** The station a plan character stands for; `table` is the number the next table gets. */
function stationFor(ch: string, x: number, y: number, table: number): Station | null {
  const at = { x, y, fire: OUT };
  const goods = CRATES.get(ch);
  const dir = BELTS.get(ch);

  if (dir !== undefined) return { ...at, type: "belt", dir, item: null };

  if (goods !== undefined) return { ...at, type: "crate", goods, item: null };
  const sauce = SAUCE_KEYS.get(ch);

  if (sauce !== undefined) return { ...at, type: "sauce", sauce, item: null };

  switch (ch) {
    case "=": return { ...at, type: "counter", item: null };
    case "F": return { ...at, type: "counter", item: { kind: "extinguisher" } };
    case "K": return { ...at, type: "board", item: null };
    case "R": return { ...at, type: "toaster", look: "grill", item: null };
    case "E": return { ...at, type: "toaster", look: "oven", item: null };
    case "Q": return { ...at, type: "mixer", item: null };
    case "S": return { ...at, type: "spit", item: null, spit: newSpit() };
    case "P": return { ...at, type: "pass", item: null };
    case "A": return { ...at, type: "table", table, item: null };
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

/** True where a cook cannot walk: stations, everything outside the shop, and water (a bridge while it is down). */
export function isSolid(world: World, x: number, y: number): boolean {
  return blocksThrow(world, x, y) || isWater(world, x, y);
}

/** True where a thrown item stops: stations and everything outside the shop. It flies on over floor and water. */
export function blocksThrow(world: World, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return true;

  return world.stations.has(y * world.width + x);
}

/** True on a tile a bridge spans, up or down. */
export function isBridge(world: World, x: number, y: number): boolean {
  return x >= 0 && x < world.width && world.bridges?.tiles.has(y * world.width + x) === true;
}

/** True on water: open water, or a bridge while it is down. */
export function isWater(world: World, x: number, y: number): boolean {
  if (x < 0 || x >= world.width) return false;

  return world.water.has(y * world.width + x) || (world.bridges !== null && isBridge(world, x, y) && !isUp(world.bridges.state));
}
