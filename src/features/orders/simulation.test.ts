import { describe, expect, it } from "vitest";
import { DIRTY, HEAT, toastAt } from "../kitchen/public.ts";
import type { Item } from "../kitchen/public.ts";
import { MAX_COMBO, MAX_TIP, MISSED_PENALTY, RECIPES, paceFor } from "./prototypes.ts";
import { ordersSnapshot } from "./snapshot.ts";
import { addOrder, defect, newOrders, serve, stepOrders } from "./simulation.ts";

const classic = RECIPES.find((r) => r.id === "classic")!;

const classicDoener = (toast = HEAT.bread.done): Item => ({ kind: "plate", plate: { state: "full", food: { kind: "base", base: "bread", toast: toastAt("bread", toast), fillings: ["garlic", "onion", "meat", "lettuce"] } } });

describe("given a customer who wants a Döner Classic", () => {
  it("pays the points plus a full tip for one served at once", () => {
    const state = newOrders();
    addOrder(state, classic);
    expect(serve(state, classicDoener(), 0)).toBe(true);
    expect(state.score).toBe(classic.points + 10);
    expect(state.queue).toHaveLength(0);
  });

  it("refuses untoasted bread and says why", () => {
    const state = newOrders();
    addOrder(state, classic);
    expect(serve(state, classicDoener(0), 0)).toBe(false);
    expect(defect(classicDoener(0))).toBe("Brot nicht getoastet.");
    expect(state.events.at(-1)?.event).toEqual({ type: "wrong", reason: "Brot nicht getoastet." });
  });

  it("refuses a döner handed over without a plate, and a dirty plate", () => {
    expect(defect({ kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: [] })).toBe("Erst auf einen Teller!");
    expect(defect({ kind: "plate", plate: DIRTY })).toBe("Schmutziger Teller!");
  });

  it("refuses burnt bread", () => {
    expect(defect(classicDoener(HEAT.bread.burnt))).toBe("Verbranntes Brot!");
  });

  it("refuses a döner with a filling missing", () => {
    const state = newOrders();
    addOrder(state, classic);
    expect(serve(state, { kind: "plate", plate: { state: "full", food: { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: ["meat", "garlic"] } } }, 0)).toBe(false);
  });

  it("leaves when patience runs out and costs points", () => {
    const state = newOrders();
    state.untilNext = Number.MAX_SAFE_INTEGER;
    addOrder(state, classic);

    for (let tick = 0; tick < classic.patience; tick++) stepOrders(state, tick, 1);
    expect(state.queue).toHaveLength(0);
    expect(state.score).toBe(-MISSED_PENALTY);
    expect(state.missed).toBe(1);
  });
});

describe("given a customer who wants a Franzbrötchen", () => {
  const franz = RECIPES.find((r) => r.id === "franz")!;
  const pastry = (toast: number, topping: "cinnamon" | "poppy"): Item => ({ kind: "plate", plate: { state: "full", food: { kind: "base", base: "dough", toast: toastAt("dough", toast), fillings: [topping] } } });

  it("takes a baked cinnamon pastry on a plate and pays for it", () => {
    const state = newOrders();
    addOrder(state, franz);
    expect(serve(state, pastry(HEAT.dough.done, "cinnamon"), 0)).toBe(true);
    expect(state.score).toBe(franz.points + 10);
  });

  it("refuses raw dough and says why", () => {
    expect(defect(pastry(HEAT.dough.done - 1, "cinnamon"))).toBe("Teig nicht gebacken.");
  });

  it("refuses a burnt pastry and calls it pastry, not bread", () => {
    expect(defect(pastry(HEAT.dough.burnt, "cinnamon"))).toBe("Verbranntes Gebäck!");
  });

  it("does not take a Mohnbrötchen instead", () => {
    const state = newOrders();
    addOrder(state, franz);
    expect(serve(state, pastry(HEAT.dough.done, "poppy"), 0)).toBe(false);
    expect(state.queue).toHaveLength(1);
  });
});

describe("given a queue of customers and the tip combo", () => {
  const pur = RECIPES.find((r) => r.id === "pur")!;
  const purDoener: Item = { kind: "plate", plate: { state: "full", food: { kind: "base", base: "bread", toast: toastAt("bread", HEAT.bread.done), fillings: ["meat", "garlic"] } } };
  const lastServe = (state: ReturnType<typeof newOrders>) => state.events.filter((e) => e.event.type === "served").at(-1)?.event;

  it("starts a shift at x1", () => {
    expect(ordersSnapshot(newOrders()).combo).toBe(1);
  });

  it("rises by one for each customer served in the order they came, and doubles the next tip", () => {
    const state = newOrders();
    addOrder(state, classic);
    addOrder(state, classic);
    serve(state, classicDoener(), 0);
    expect(lastServe(state)).toMatchObject({ tip: MAX_TIP, combo: 1 });
    expect(ordersSnapshot(state).combo).toBe(2);

    serve(state, classicDoener(), 0);
    expect(lastServe(state)).toMatchObject({ tip: MAX_TIP * 2, combo: 2 });
    expect(state.score).toBe(2 * classic.points + MAX_TIP + MAX_TIP * 2);
    expect(ordersSnapshot(state).combo).toBe(3);
  });

  it("stops rising at the cap", () => {
    const state = newOrders();

    for (let i = 0; i < MAX_COMBO + 2; i++) {
      addOrder(state, classic);
      serve(state, classicDoener(), 0);
    }

    expect(ordersSnapshot(state).combo).toBe(MAX_COMBO);
    expect(lastServe(state)).toMatchObject({ tip: MAX_TIP * MAX_COMBO, combo: MAX_COMBO });
  });

  it("falls back to x1 when a later customer is served before the one waiting longest", () => {
    const state = newOrders();
    addOrder(state, pur);
    serve(state, purDoener, 0);
    addOrder(state, classic);
    addOrder(state, pur);
    serve(state, purDoener, 0);
    expect(lastServe(state)).toMatchObject({ tip: MAX_TIP * 2, combo: 2 });
    expect(ordersSnapshot(state).combo).toBe(1);

    serve(state, classicDoener(), 0);
    expect(lastServe(state)).toMatchObject({ tip: MAX_TIP, combo: 1 });
  });

  it("falls back to x1 when a customer leaves unserved", () => {
    const state = newOrders();
    state.untilNext = Number.MAX_SAFE_INTEGER;
    addOrder(state, pur);
    serve(state, purDoener, 0);
    addOrder(state, classic);
    expect(ordersSnapshot(state).combo).toBe(2);

    for (let tick = 0; tick < classic.patience; tick++) stepOrders(state, tick, 1);
    expect(state.missed).toBe(1);
    expect(ordersSnapshot(state).combo).toBe(1);
  });

  it("leaves the combo alone when a wrong dish is refused", () => {
    const state = newOrders();
    addOrder(state, pur);
    serve(state, purDoener, 0);
    addOrder(state, classic);
    expect(serve(state, purDoener, 0)).toBe(false);
    expect(ordersSnapshot(state).combo).toBe(2);
  });
});

describe("given an empty counter", () => {
  it("brings the same customers for the same seed", () => {
    const run = (seed: number) => {
      const state = newOrders();
      let rng = seed;

      for (let tick = 0; tick < 60 * 60; tick++) rng = stepOrders(state, tick, rng);

      return state.queue.map((o) => o.recipe.id);
    };

    expect(run(7)).toEqual(run(7));
    expect(run(7).length).toBeGreaterThan(1);
  });
});

describe("given a solo shift", () => {
  const solo = paceFor(1);

  it("gives each customer more patience than a two-cook shift does", () => {
    const state = newOrders(solo);
    const order = addOrder(state, classic);
    expect(order.ticksLeft).toBeGreaterThan(classic.patience);
    expect(ordersSnapshot(state).tickets[0]?.patience).toBe(1);
  });

  it("sends fewer customers in the same time", () => {
    const arrivals = (pace = paceFor(2)) => {
      const state = newOrders(pace);
      let rng = 3;

      for (let tick = 0; tick < 60 * 120; tick++) {
        rng = stepOrders(state, tick, rng);
        state.queue.length = 0;
      }

      return state.nextId;
    };

    expect(arrivals(solo)).toBeLessThan(arrivals());
  });

  it("brings only customers for the shift's menu", () => {
    const pur = RECIPES.find((r) => r.id === "pur")!;
    const state = newOrders(solo, [pur]);
    const ordered: string[] = [];
    let rng = 5;

    for (let tick = 0; tick < 60 * 180; tick++) {
      rng = stepOrders(state, tick, rng);
      ordered.push(...state.queue.map((o) => o.recipe.id));
      state.queue.length = 0;
    }

    expect(ordered.length).toBeGreaterThan(5);
    expect(new Set(ordered)).toEqual(new Set(["pur"]));
  });

  it("asks for lower scores for each star", () => {
    const [one = 0, , three = 0] = ordersSnapshot(newOrders(solo)).targets;
    const [normalOne = 0, , normalThree = 0] = ordersSnapshot(newOrders()).targets;
    expect(one).toBeLessThan(normalOne);
    expect(three).toBeLessThan(normalThree);
  });
});
