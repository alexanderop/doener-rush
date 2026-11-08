import { describe, expect, it } from "vitest";
import { IDLE, THROW_TICKS, tilesUnder } from "../../features/cooks/public.ts";
import type { Intent } from "../../features/cooks/public.ts";
import { BELT_TICKS, WHOLE } from "../../features/kitchen/public.ts";
import { ROUND_TICKS } from "../../features/orders/public.ts";
import { seconds } from "../core/grid.ts";
import { levelOf } from "./levels.ts";
import { lineupOf } from "./lineup.ts";
import { run, step } from "./step.ts";
import { SCENARIOS } from "./testing/scenarios.ts";
import { blocksThrow, isSolid, isWater, newWorld, stationAt } from "./world.ts";
import type { World } from "./world.ts";

const THROW: Intent = { ...IDLE, throw: true };

const RIGHT: Intent = { ...IDLE, dx: 1 };

function itemOn(world: World, x: number, y: number) {
  return stationAt(world, x, y)?.item ?? null;
}

describe("given the Hafenimbiss canal", () => {
  it("never lets a cook onto open water, and onto a bridge only while it is up", () => {
    const world = newWorld(1, ROUND_TICKS, undefined, levelOf("hafen"));
    expect(isSolid(world, 7, 1)).toBe(true);
    expect(isSolid(world, 7, 2)).toBe(false);
    world.bridges!.state = { state: "down", left: seconds(5) };
    expect(isSolid(world, 7, 2)).toBe(true);
    expect(isWater(world, 7, 2)).toBe(true);
  });

  it("lets a throw fly over water and bridges alike", () => {
    const world = newWorld(1, ROUND_TICKS, undefined, levelOf("hafen"));
    world.bridges!.state = { state: "down", left: seconds(5) };
    expect([blocksThrow(world, 7, 1), blocksThrow(world, 8, 2), blocksThrow(world, 9, 3)]).toEqual([false, false, true]);
  });

  it("waits for a cook standing on a bridge, then sinks once they step off", () => {
    const world = SCENARIOS.bridge.build(1);
    run(world, seconds(3));
    expect(world.bridges!.state).toEqual({ state: "held" });
    expect(isSolid(world, 7, 2)).toBe(false);

    for (let i = 0; i < seconds(1) && world.bridges!.state.state === "held"; i++) step(world, [RIGHT]);
    expect(world.bridges!.state.state).toBe("down");
    expect(isSolid(world, 7, 2)).toBe(true);
    expect(tilesUnder(world.cooks[0]!.x, world.cooks[0]!.y).every((t) => !isSolid(world, t.x, t.y))).toBe(true);
  });

  it("carries a throw across the water to a cook on the far bank", () => {
    const world = SCENARIOS["canal-throw"].build(1);
    step(world, [THROW]);
    run(world, THROW_TICKS);
    expect(world.cooks[1]!.held).toMatchObject({ kind: "veg", veg: "lettuce" });
    expect(world.landings.at(-1)?.landing.how).toBe("caught");
  });

  it("loses a throw that comes down over the water", () => {
    const world = SCENARIOS["canal-throw"].build(1);
    world.thrown.push({ item: { kind: "veg", veg: "onion", cut: WHOLE }, by: 1, x: 7.5, y: 3, dir: { dx: 0, dy: 1 }, flown: THROW_TICKS - 3 });
    run(world, 3);
    const end = world.landings.at(-1)?.landing;
    expect(end?.how).toBe("dropped");
    expect(isWater(world, Math.floor(end!.x), Math.floor(end!.y))).toBe(true);
    expect(world.thrown).toEqual([]);
  });
});

describe("given the Fließband", () => {
  it("carries the döner across the wall to the front and stops it at the belt's end", () => {
    const world = SCENARIOS.belt.build(1);
    const doener = itemOn(world, 6, 3);
    run(world, BELT_TICKS * 2 + 1);
    expect(itemOn(world, 8, 3)).toBe(doener);
    run(world, BELT_TICKS * 3);
    expect(itemOn(world, 8, 3)).toBe(doener);
    expect([itemOn(world, 6, 6), itemOn(world, 7, 6)]).toEqual([{ kind: "plate", plate: { state: "dirty" } }, { kind: "plate", plate: { state: "dirty" } }]);
  });

  it("lets the cook at the end take the döner off the belt", () => {
    const world = SCENARIOS.belt.build(1);
    run(world, BELT_TICKS * 2 + 1);
    step(world, [IDLE, { ...IDLE, interact: true }]);
    expect(world.cooks[1]!.held).toMatchObject({ kind: "base", fillings: ["meat", "lettuce"] });
    expect(itemOn(world, 8, 3)).toBeNull();
  });
});

describe("given four bots in the moving kitchens", () => {
  it.each(["hafen", "fliessband"] as const)("%s: no cook ever stands in water or a station", (id) => {
    const world = newWorld(3, ROUND_TICKS, lineupOf(0, 4), levelOf(id));
    const stuck: string[] = [];

    for (let t = 0; t < ROUND_TICKS && stuck.length === 0; t++) {
      run(world, 1);

      for (const cook of world.cooks) {
        if (tilesUnder(cook.x, cook.y).some((tile) => isSolid(world, tile.x, tile.y))) stuck.push(`cook ${cook.id} at ${cook.x},${cook.y} on tick ${world.tick}`);
      }
    }

    expect(stuck).toEqual([]);
  });
});
