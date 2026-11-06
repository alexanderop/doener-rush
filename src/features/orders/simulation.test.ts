import { describe, expect, it } from "vitest";
import { TOAST_BURNT, TOAST_DONE } from "../kitchen/public.ts";
import type { Item } from "../kitchen/public.ts";
import { MISSED_PENALTY, RECIPES } from "./prototypes.ts";
import { addOrder, defect, newOrders, serve, stepOrders } from "./simulation.ts";

const classic = RECIPES.find((r) => r.id === "classic")!;

const classicDoener = (toast = TOAST_DONE): Item => ({ kind: "plate", dirty: false, food: { kind: "base", base: "bread", toast, fillings: ["garlic", "onion", "meat", "lettuce"] } });

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
    expect(defect({ kind: "base", base: "bread", toast: TOAST_DONE, fillings: [] })).toBe("Erst auf einen Teller!");
    expect(defect({ kind: "plate", dirty: true, food: null })).toBe("Schmutziger Teller!");
  });

  it("refuses burnt bread", () => {
    expect(defect(classicDoener(TOAST_BURNT))).toBe("Verbranntes Brot!");
  });

  it("refuses a döner with a filling missing", () => {
    const state = newOrders();
    addOrder(state, classic);
    expect(serve(state, { kind: "plate", dirty: false, food: { kind: "base", base: "bread", toast: TOAST_DONE, fillings: ["meat", "garlic"] } }, 0)).toBe(false);
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
