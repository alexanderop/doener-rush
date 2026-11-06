import { CHOP_TICKS, TOAST_DONE } from "../../../features/kitchen/public.ts";
import { ROUND_TICKS, RECIPES, addOrder } from "../../../features/orders/public.ts";
import type { Recipe } from "../../../features/orders/public.ts";
import type { Lineup, World } from "../world.ts";
import { newWorld } from "../world.ts";

/** A named starting state for tests, e2e features and `?scenario=` in the browser. */
export interface Scenario {
  readonly description: string;
  readonly build: (seed: number, lineup?: Lineup) => World;
}

function recipe(id: string): Recipe {
  const found = RECIPES.find((r) => r.id === id);

  if (found === undefined) throw new Error(`No recipe ${id}`);

  return found;
}

/** Every scenario by name. */
export const SCENARIOS = {
  shift: {
    description: "A normal three-minute shift: customers arrive on the seed's schedule.",
    build: (seed, lineup?) => newWorld(seed, ROUND_TICKS, lineup),
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
        cook.held = { kind: "plate", dirty: false, food: { kind: "base", base: "bread", toast: TOAST_DONE, fillings: ["meat", "lettuce", "onion", "garlic"] } };
      }

      return world;
    },
  },
  "burning-spit": {
    description: "The spit has been left alone: two sides are about to burn.",
    build: (seed, lineup?) => {
      const world = newWorld(seed, ROUND_TICKS, lineup);

      for (const station of world.stations.values()) {
        if (station.type === "spit") station.spit.sides.splice(0, 4, 1.55, 1.5, 1.1, 0.4);
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
          station.fire = 200;
          station.spit.sides.splice(0, 4, 2.4, 1.9, 1.2, 0.5);
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
          station.veg = vegs[tray % 3] ?? "lettuce";
          station.portions = 3 - (tray % 2);
          tray += 1;
        }

        if (station.type === "counter" && station.y === 5 && station.x >= 5 && station.x <= 7) {
          station.item = { kind: "veg", veg: "onion", chop: CHOP_TICKS };
        }

        if (station.type === "toaster") station.item = { kind: "base", base: "bread", toast: 120, fillings: [] };
      }

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
