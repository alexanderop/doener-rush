import type { Cook } from "../../../features/cooks/public.ts";
import { CHOPPED, DIRTY, HEAT, MIX_TICKS, RAW, WHOLE, sideAt, toastAt, trayOf } from "../../../features/kitchen/public.ts";
import { ROUND_TICKS, RECIPES, addOrder } from "../../../features/orders/public.ts";
import type { Dir } from "../../core/grid.ts";
import { seconds } from "../../core/grid.ts";
import type { Recipe } from "../../../features/orders/public.ts";
import { levelOf } from "../levels.ts";
import type { Level } from "../levels.ts";
import type { Lineup } from "../lineup.ts";
import type { World } from "../world.ts";
import { newWorld } from "../world.ts";

/**
 * A named starting state for tests, e2e features and `?scenario=` in the browser. Only `shift` plays in the level it
 * is given; `backstube`, `belt`, `bridge`, `canal-throw`, `dining-room` and `slide` set up their own kitchen, the others the original shop,
 * whose tiles they name.
 */
export interface Scenario {
  readonly description: string;
  readonly build: (seed: number, lineup?: Lineup, level?: Level) => World;
}

function recipe(id: string): Recipe {
  const found = RECIPES.find((r) => r.id === id);

  if (found === undefined) throw new Error(`No recipe ${id}`);

  return found;
}

/** Puts a cook in the middle of tile `x`, `y`, facing `face`. */
function place(cook: Cook | undefined, x: number, y: number, face: Dir): void {
  if (cook === undefined) return;
  cook.x = x + 0.5;
  cook.y = y + 0.5;
  cook.face = face;
}

/** Every scenario by name. */
export const SCENARIOS = {
  shift: {
    description: "A normal three-minute shift in a level (the original shop by default): customers arrive on the seed's schedule.",
    build: (seed, lineup?, level?) => newWorld(seed, ROUND_TICKS, lineup, level),
  },
  "ready-classic": {
    description: "Cook 1 stands at the pass holding a finished Döner Classic on a plate, and a customer wants one.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;
      addOrder(world.orders, recipe("classic"));
      const cook = world.cooks[0];

      if (cook !== undefined) {
        cook.x = 10.5;
        cook.y = 1.5;
        cook.face = { dx: 0, dy: -1 };
        cook.held = { kind: "plate", plate: { state: "full", food: { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: ["meat", "lettuce", "onion", "garlic"] } } };
      }

      return world;
    },
  },
  "burning-spit": {
    description: "The spit has been left alone: two sides are about to burn.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);

      for (const station of world.stations.values()) {
        if (station.type === "spit") station.spit.sides.splice(0, 4, ...[1.55, 1.5, 1.1, 0.4].map(sideAt));
      }

      return world;
    },
  },
  "kitchen-fire": {
    description: "The spit is on fire and about to spread; cook 1 stands in front of it with the extinguisher.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);

      for (const station of world.stations.values()) {
        if (station.type === "spit") {
          station.fire = { state: "burning", ticks: 200, sprayed: 0 };
          station.spit.sides.splice(0, 4, ...[2.4, 1.9, 1.2, 0.5].map(sideAt));
        }

        if (station.type === "counter" && station.item?.kind === "extinguisher") station.item = null;
      }

      const cook = world.cooks[0];

      if (cook !== undefined) {
        cook.x = 2.5;
        cook.y = 1.5;
        cook.face = { dx: 0, dy: -1 };
        cook.held = { kind: "extinguisher" };
      }

      return world;
    },
  },
  "dirty-dishes": {
    description: "Every plate is dirty: three wait at the return, the rack is empty, cook 2 stands at the sink.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);

      for (const station of world.stations.values()) {
        if (station.type === "rack") station.plates = 0;

        if (station.type === "sink") station.dirty = 3;
      }

      const cook = world.cooks[1];

      if (cook !== undefined) {
        cook.x = 9.5;
        cook.y = 7.5;
        cook.face = { dx: 0, dy: 1 };
      }

      return world;
    },
  },
  "prep-line": {
    description: "Mid-shift prep: the trays are stocked, chopped onions wait on the counters, bread is on the grill.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);
      const vegs = ["lettuce", "tomato", "onion"] as const;
      let tray = 0;

      for (const station of world.stations.values()) {
        if (station.type === "tray") {
          station.tray = trayOf(vegs[tray % 3] ?? "lettuce", 3 - (tray % 2));
          tray += 1;
        }

        if (station.type === "counter" && station.y === 5 && station.x >= 5 && station.x <= 7) {
          station.item = { kind: "veg", veg: "onion", cut: CHOPPED };
        }

        if (station.type === "toaster") station.item = { kind: "base", base: "bread", toast: toastAt("bread", 120), fillings: [] };
      }

      return world;
    },
  },
  catch: {
    description: "Cook 1 holds a whole lettuce and faces right; four tiles along the same row, cook 2 waits empty-handed for the throw.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);
      const [thrower, catcher] = world.cooks;

      if (thrower !== undefined) {
        thrower.x = 2.5;
        thrower.y = 7.5;
        thrower.face = { dx: 1, dy: 0 };
        thrower.held = { kind: "veg", veg: "lettuce", cut: WHOLE };
      }

      if (catcher !== undefined) {
        catcher.x = 6.5;
        catcher.y = 7.5;
        catcher.face = { dx: -1, dy: 0 };
      }

      return world;
    },
  },
  backstube: {
    description: "The Backstube mid-shift: a bowl half kneaded in the mixer, a Brezel and a Mohnbrötchen in the ovens, a baked Franzbrötchen on a plate, raw dough with a bowl on the counters, a customer for each pastry.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup, levelOf("backstube"));
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;

      for (const id of ["franz", "mohn", "brezel"]) addOrder(world.orders, recipe(id));
      const ovens = [...world.stations.values()].filter((s) => s.type === "toaster");
      const pastries = [{ toast: HEAT.dough.done / 2, topping: "lye" }, { toast: HEAT.dough.done + 60, topping: "poppy" }] as const;
      ovens.forEach((oven, i) => {
        const { toast, topping } = pastries[i % 2] ?? pastries[0];
        oven.item = { kind: "base", base: "dough", toast: toastAt("dough", toast), fillings: [topping] };
      });

      for (const station of world.stations.values()) {
        if (station.type === "mixer") station.item = { kind: "bowl", contents: ["flour", "butter"], knead: MIX_TICKS / 2 };

        if (station.type !== "counter" || station.y !== 3) continue;

        if (station.x === 5) station.item = { kind: "plate", plate: { state: "full", food: { kind: "base", base: "dough", toast: toastAt("dough", HEAT.dough.done), fillings: ["cinnamon"] } } };

        if (station.x === 6) station.item = { kind: "base", base: "dough", toast: RAW, fillings: [] };

        if (station.x === 7) station.item = { kind: "bowl", contents: ["flour"], knead: 0 };
      }

      return world;
    },
  },
  belt: {
    description: "The Fließband: a döner rides the upper belt to the front, two dirty plates ride the lower belt back, cook 1 waits at the upper belt's start with toasted bread, cook 2 at its end.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup, levelOf("fliessband"));
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;
      addOrder(world.orders, recipe("classic"));

      for (const station of world.stations.values()) {
        if (station.type !== "belt") continue;

        if (station.x === 6 && station.y === 3) station.item = { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: ["meat", "lettuce"] };

        if (station.y === 6 && station.x >= 7) station.item = { kind: "plate", plate: DIRTY };
      }

      const [loader, unloader] = world.cooks;
      place(loader, 5, 3, { dx: 1, dy: 0 });
      place(unloader, 9, 3, { dx: -1, dy: 0 });

      if (loader !== undefined) loader.held = { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: [] };

      return world;
    },
  },
  "dining-room": {
    description: "Mit Bedienung: a guest at table 1 wants a Döner Pur, one at table 2 a Döner Classic; cook 1 stands at table 2 holding a finished Classic.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup, levelOf("bedienung"));
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;
      addOrder(world.orders, recipe("pur"));
      addOrder(world.orders, recipe("classic"));
      const waiter = world.cooks[0];
      place(waiter, 16, 3, { dx: 0, dy: -1 });

      if (waiter !== undefined) {
        waiter.held = { kind: "plate", plate: { state: "full", food: { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: ["meat", "lettuce", "onion", "garlic"] } } };
      }

      return world;
    },
  },
  bridge: {
    description: "The Hafenimbiss a second before its bridges sink: cook 1 stands on the upper bridge, cook 2 on the far bank.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup, levelOf("hafen"));
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;

      if (world.bridges !== null) world.bridges.state = { state: "up", left: seconds(1) };
      const [onBridge, ashore] = world.cooks;
      place(onBridge, 7, 2, { dx: 1, dy: 0 });
      place(ashore, 11, 2, { dx: -1, dy: 0 });

      return world;
    },
  },
  "canal-throw": {
    description: "The Hafenimbiss with its bridges down: cook 1 on the near bank holds a whole lettuce and faces the canal; cook 2 waits empty-handed across the water in the same row.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup, levelOf("hafen"));
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;

      if (world.bridges !== null) world.bridges.state = { state: "down", left: seconds(30) };
      const [thrower, catcher] = world.cooks;
      place(thrower, 6, 1, { dx: 1, dy: 0 });
      place(catcher, 10, 1, { dx: -1, dy: 0 });

      if (thrower !== undefined) thrower.held = { kind: "veg", veg: "lettuce", cut: WHOLE };

      return world;
    },
  },
  slide: {
    description: "The Schiebetheke a second before its counters slide up: a finished döner stands on the top sliding counter, cook 1 stands in the gap they would close, cook 2 waits at the bottom where the wall opens next.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup, levelOf("schiebetheke"));
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;

      if (world.slides !== null) world.slides.state = { at: "home", left: seconds(1) };
      const top = world.stations.get(2 * world.width + 7);

      if (top?.type === "counter") top.item = { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: ["meat", "lettuce"] };
      const [inGap, below] = world.cooks;
      place(inGap, 7, 1, { dx: 1, dy: 0 });
      place(below, 8, 7, { dx: -1, dy: 0 });

      return world;
    },
  },
  rush: {
    description: "Four customers wait at once in the original shop and no more come: the kitchen at its busiest.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);
      world.orders.untilNext = Number.MAX_SAFE_INTEGER;

      for (const id of ["classic", "durum", "veggie", "classic"]) addOrder(world.orders, recipe(id));

      return world;
    },
  },
  "last-seconds": {
    description: "Ten seconds left in the shift, to see the end-of-round screen.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);
      world.tick = ROUND_TICKS - 600;
      world.orders.score = 175;
      world.orders.served = 6;

      return world;
    },
  },
} as const satisfies Record<string, Scenario>;

/** The name of a scenario. */
export type ScenarioName = keyof typeof SCENARIOS;

/** True when `name` is a known scenario. */
export function isScenario(name: string): name is ScenarioName {
  return Object.hasOwn(SCENARIOS, name);
}
