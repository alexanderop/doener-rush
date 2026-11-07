import type { Tile } from "../core/grid.ts";
import { newMind } from "../../features/bots/public.ts";
import type { BotMind } from "../../features/bots/public.ts";
import { newCook } from "../../features/cooks/public.ts";
import type { Cook, Landing, Thrown } from "../../features/cooks/public.ts";
import { START_PLATES, newSpit } from "../../features/kitchen/public.ts";
import type { CrateGoods, Sauce, Station, Topping } from "../../features/kitchen/public.ts";
import { RECIPES, combinePace, newOrders, paceFor } from "../../features/orders/public.ts";
import type { OrdersState } from "../../features/orders/public.ts";
import { DEFAULT_LEVEL } from "./levels.ts";
import type { Level } from "./levels.ts";
import { TWO_PLAYERS, crewOf } from "./lineup.ts";
import type { Driver, Lineup } from "./lineup.ts";
import { NORMAL_RULES } from "./rules.ts";
import type { Rules } from "./rules.ts";

const CRATES = new Map<string, CrateGoods>([
  ["B", "bread"], ["W", "wrap"], ["L", "lettuce"], ["T", "tomato"], ["O", "onion"], ["M", "flour"], ["Y", "butter"],
]);

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
  const starts: Tile[] = [];
  plan.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const station = stationFor(ch, x, y);

      if (station !== null) stations.set(y * width + x, station);

      if (ch >= "1" && ch <= "4") starts[Number(ch) - 1] = { x, y };
    });
  });

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

  return {
    seed, tick: 0, rng: seed, width, height, stations, cooks, thrown: [], landings: [], drivers: lineup.drivers, control, parked: new Set(), bots,
    orders: newOrders(combinePace(paceFor(crewOf(lineup)), level.pace), RECIPES.filter((r) => level.menu.includes(r.id))), platesDue: [], endTick, rules: NORMAL_RULES, tutorial: null,
  };
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
    case "R": return { ...at, type: "toaster", look: "grill", item: null };
    case "E": return { ...at, type: "toaster", look: "oven", item: null };
    case "Q": return { ...at, type: "mixer", item: null };
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
