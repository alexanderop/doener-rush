import { describe, expect, it } from "vitest";
import { seconds } from "../core/grid.ts";
import { DOUSE_TICKS, TOAST_DONE } from "../../features/kitchen/public.ts";
import { RECIPES, ROUND_TICKS, addOrder } from "../../features/orders/public.ts";
import type { Recipe } from "../../features/orders/public.ts";
import { find, hold, press, walkTo, wait } from "./testing/drive.ts";
import { SCENARIOS } from "./testing/scenarios.ts";
import { run, snapshot } from "./step.ts";
import type { World } from "./world.ts";
import { lineupOf } from "./world.ts";

function recipe(id: string): Recipe {
  const found = RECIPES.find((r) => r.id === id);

  if (found === undefined) throw new Error(`No recipe ${id}`);

  return found;
}

/** A shift where only the given customers come, each willing to wait the whole round. */
function onlyCustomers(world: World, ...ids: string[]): World {
  world.orders.untilNext = Number.MAX_SAFE_INTEGER;
  world.orders.queue.length = 0;

  for (const id of ids) addOrder(world.orders, { ...recipe(id), patience: ROUND_TICKS });

  return world;
}

function burning(world: World): number {
  return [...world.stations.values()].filter((s) => s.fire > 0).length;
}

/** Every clean plate in the shop: on the rack, washed in the sink, or in a cook's hands. */
function cleanPlates(world: World): number {
  let n = 0;

  for (const s of world.stations.values()) {
    if (s.type === "rack") n += s.plates;

    if (s.type === "sink") n += s.clean;

    if (s.item?.kind === "plate" && !s.item.dirty) n += 1;
  }

  return n + world.cooks.filter((c) => c.held?.kind === "plate" && !c.held.dirty).length;
}

describe("given a shift run by two bots and nobody on the keyboard", () => {
  it.each([1, 2, 3])("serves at least four customers on seed %i", (seed) => {
    const world = SCENARIOS.shift.build(seed, lineupOf(0, 2));
    run(world, ROUND_TICKS);
    expect(snapshot(world).orders.served).toBeGreaterThanOrEqual(4);
  });

  it("never has two bots building for the same customer", () => {
    for (const seed of [1, 2, 3]) {
      const world = SCENARIOS.shift.build(seed, lineupOf(0, 3));

      for (let t = 0; t < ROUND_TICKS; t++) {
        run(world, 1);
        const claimed = [...world.bots.values()].flatMap((m) => (m.order === null ? [] : [m.order]));
        expect(new Set(claimed).size, `seed ${seed} tick ${t}`).toBe(claimed.length);
      }
    }
  });

  it("plays the same round from the same seed and lineup", () => {
    const play = () => {
      const world = SCENARIOS.shift.build(7, lineupOf(1, 2));
      run(world, seconds(90), [{ dx: 1, dy: -1, interact: false, work: false, dash: false }]);

      return JSON.stringify({ cooks: world.cooks, orders: world.orders, stations: [...world.stations.values()], bots: [...world.bots] });
    };

    expect(play()).toBe(play());
  });
});

describe("given a bot alone in the shop", () => {
  it.each([1, 2, 3])("serves at least two customers on seed %i", (seed) => {
    const world = SCENARIOS.shift.build(seed, lineupOf(0, 1));
    run(world, ROUND_TICKS);
    expect(snapshot(world).orders.served).toBeGreaterThanOrEqual(2);
  });

  it("stocks a tray with the vegetable a customer needs and none holds", () => {
    const world = onlyCustomers(SCENARIOS.shift.build(1, lineupOf(0, 1)), "classic");
    const trays = [...world.stations.values()].filter((s) => s.type === "tray");
    expect(trays.some((t) => t.veg === "lettuce")).toBe(false);
    run(world, seconds(15));
    expect(trays.some((t) => t.veg === "lettuce" && t.portions > 0)).toBe(true);
  });

  it("makes a Döner Pur from scratch and hands it over", () => {
    const world = onlyCustomers(SCENARIOS.shift.build(1, lineupOf(0, 1)), "pur");
    run(world, seconds(40));
    expect(snapshot(world).orders.served).toBe(1);
  });
});

describe("given the kitchen-fire scenario with a bot in cook 1's place", () => {
  it("sprays the spit until the fire is out", () => {
    const world = SCENARIOS["kitchen-fire"].build(1, lineupOf(0, 1));
    run(world, DOUSE_TICKS + 10);
    expect(burning(world)).toBe(0);
  });

  it("fetches the extinguisher from its counter when nobody holds it", () => {
    const world = SCENARIOS["kitchen-fire"].build(1, lineupOf(0, 2));
    const [first] = world.cooks;

    if (first !== undefined) first.held = null;
    const home = find(world, (s) => s.type === "counter" && s.x === 12 && s.y === 5);
    home.item = { kind: "extinguisher" };
    run(world, seconds(20));
    expect(burning(world)).toBe(0);
  });
});

describe("given the dirty-dishes scenario with bots", () => {
  it("washes plates back into use", () => {
    const world = SCENARIOS["dirty-dishes"].build(1, lineupOf(0, 2));
    expect(cleanPlates(world)).toBe(0);
    run(world, seconds(20));
    expect(cleanPlates(world)).toBeGreaterThanOrEqual(2);
  });
});

describe("given a player who steals the bot's bread from the toaster", () => {
  it("does not stop the bot: it starts over and still serves", () => {
    const world = onlyCustomers(SCENARIOS.shift.build(1, lineupOf(1, 1)), "pur");
    const toaster = find(world, (s) => s.type === "toaster");

    for (let t = 0; t < seconds(30) && toaster.item === null; t++) run(world, 1);
    expect(toaster.item).toMatchObject({ kind: "base", base: "bread" });
    walkTo(world, 1, toaster);
    press(world, 1);
    expect(world.cooks[0]?.held).toMatchObject({ kind: "base" });
    walkTo(world, 1, find(world, (s) => s.type === "bin"));
    press(world, 1);
    expect(world.cooks[0]?.held).toBeNull();
    wait(world, seconds(45));
    expect(snapshot(world).orders.served).toBe(1);
  });
});

describe("given a fire nobody can reach", () => {
  it("never spreads into the corner counter behind the spit", () => {
    const world = SCENARIOS["kitchen-fire"].build(1);
    const [first] = world.cooks;

    if (first !== undefined) first.held = null;
    wait(world, seconds(30));
    expect(find(world, (s) => s.x === 1 && s.y === 0).fire).toBeGreaterThan(0);
    expect(find(world, (s) => s.x === 0 && s.y === 0).fire).toBe(0);
  });
});

describe("given bread forgotten in the toaster until it catches fire", () => {
  it("stays out once sprayed, with the charred bread still inside", () => {
    const world = SCENARIOS.shift.build(1);
    const toaster = find(world, (s) => s.type === "toaster");
    toaster.item = { kind: "base", base: "bread", toast: TOAST_DONE, fillings: [] };
    wait(world, seconds(17));
    expect(toaster.fire).toBeGreaterThan(0);
    const [cook] = world.cooks;

    if (cook !== undefined) {
      cook.x = 4.5;
      cook.y = 1.5;
      cook.face = { dx: 0, dy: -1 };
      cook.held = { kind: "extinguisher" };
    }

    hold(world, 1, DOUSE_TICKS + 1);
    wait(world, seconds(3));
    expect(toaster.fire).toBe(0);
    expect(toaster.item).toMatchObject({ kind: "base" });
  });
});
