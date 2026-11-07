import { Arbitrary, Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { BURNT, CHOP_TICKS, DOUSE_TICKS, SHAVE_TICKS, TOAST_BURNT, TOAST_DONE } from "../../features/kitchen/public.ts";
import { ROUND_TICKS } from "../../features/orders/public.ts";
import { find, hold, press, walkTo, wait } from "./testing/drive.ts";
import { SCENARIOS } from "./testing/scenarios.ts";
import { isOver, run, snapshot, step } from "./step.ts";
import { IDLE } from "../../features/cooks/public.ts";
import type { World } from "./world.ts";
import { TWO_PLAYERS, crewOf, lineupOf } from "./lineup.ts";
import { NORMAL_RULES, PRESETS, setRules } from "./rules.ts";

/** Cook 1 builds a Döner Pur (toasted bread, meat, garlic) from scratch, plates it and hands it over. */
function makeDoenerPur(world: World): void {
  walkTo(world, 1, find(world, (s) => s.type === "crate" && s.goods === "bread"));
  press(world, 1);
  const toaster = find(world, (s) => s.type === "toaster");
  walkTo(world, 1, toaster);
  press(world, 1);
  wait(world, TOAST_DONE);
  press(world, 1);
  walkTo(world, 1, find(world, (s) => s.type === "spit"));
  hold(world, 1, SHAVE_TICKS * 2);
  walkTo(world, 1, find(world, (s) => s.type === "sauce" && s.sauce === "garlic"));
  press(world, 1);
  // put the döner down, fetch a plate, pick the döner up onto it
  const counter = find(world, (s) => s.type === "counter" && s.x === 9 && s.y === 0);
  walkTo(world, 1, counter);
  press(world, 1);
  walkTo(world, 1, find(world, (s) => s.type === "rack"));
  press(world, 1);
  walkTo(world, 1, counter);
  press(world, 1);
  walkTo(world, 1, find(world, (s) => s.type === "pass"));
  press(world, 1);
}

describe("given a shift with one customer who wants a Döner Pur", () => {
  it("is served by a cook who toasts, shaves, sauces and hands over", () => {
    const world = SCENARIOS.shift.build(1);
    world.orders.untilNext = Number.MAX_SAFE_INTEGER;
    world.orders.queue.length = 0;
    const pur = { id: "pur", name: "Döner Pur", base: "bread", fillings: ["meat", "garlic"], points: 20, patience: ROUND_TICKS } as const;
    world.orders.queue.push({ id: 99, recipe: pur, patience: ROUND_TICKS, ticksLeft: ROUND_TICKS });
    makeDoenerPur(world);
    expect(world.cooks[0]?.held).toBeNull();
    expect(world.orders.served).toBe(1);
    expect(world.orders.score).toBeGreaterThan(20);
  });
});

describe("given the ready-classic scenario", () => {
  it("scores when cook 1 presses interact at the pass", () => {
    const world = SCENARIOS["ready-classic"].build(1);
    press(world, 1);
    expect(snapshot(world).orders.served).toBe(1);
  });
});

describe("given a cook who forgets the bread", () => {
  it("burns it in the toaster", () => {
    const world = SCENARIOS.shift.build(1);
    walkTo(world, 1, find(world, (s) => s.type === "crate" && s.goods === "bread"));
    press(world, 1);
    const toaster = find(world, (s) => s.type === "toaster");
    walkTo(world, 1, toaster);
    press(world, 1);
    wait(world, TOAST_BURNT);
    expect(toaster.item).toMatchObject({ kind: "base" });
    expect(toaster.item?.kind === "base" && toaster.item.toast >= TOAST_BURNT).toBe(true);
  });
});

describe("given a whole shift", () => {
  it("ends after three minutes and stops changing", () => {
    const world = SCENARIOS.shift.build(3);
    run(world, ROUND_TICKS);
    expect(isOver(world)).toBe(true);
    const before = JSON.stringify(snapshot(world));
    step(world, []);
    expect(JSON.stringify(snapshot(world))).toBe(before);
  });
});

const IntentSchema = Schema.Struct({
  dx: Schema.Literals([-1, 0, 1]),
  dy: Schema.Literals([-1, 0, 1]),
  interact: Schema.Boolean,
  work: Schema.Boolean,
  dash: Schema.Boolean,
  ticks: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 40 })),
});

const plays = Arbitrary.array(Schema.Tuple([IntentSchema, IntentSchema]).pipe(Arbitrary.schema), { maxLength: 60 });

function play(seed: number, moves: readonly (readonly [typeof IntentSchema.Type, typeof IntentSchema.Type])[]): World {
  const world = SCENARIOS.shift.build(seed);

  for (const [a, b] of moves) run(world, Math.max(a.ticks, b.ticks), [a, b]);

  return world;
}

const check = <A>(arbitrary: Arbitrary.Arbitrary<A>, property: (value: A) => boolean) =>
  Effect.runPromise(Arbitrary.checkEffect(arbitrary, property, { seed: 42, runs: 40 })).then(Arbitrary.formatCheckFailure);

describe("given random button mashing by two players", () => {
  it("never puts a cook inside a station or outside the shop", async () => {
    const failure = await check(plays, (moves) => {
      const world = play(5, moves);

      return world.cooks.every((c) => !world.stations.has(Math.floor(c.y) * world.width + Math.floor(c.x)));
    });

    expect(failure).toBeUndefined();
  });

  it("replays the same round from the same seed and inputs", async () => {
    const failure = await check(plays, (moves) => JSON.stringify(play(9, moves).cooks) === JSON.stringify(play(9, moves).cooks));
    expect(failure).toBeUndefined();
  });
});

describe("given a served döner", () => {
  it("brings its plate back dirty to the return hatch a few seconds later", () => {
    const world = SCENARIOS["ready-classic"].build(1);
    press(world, 1);
    const hatch = find(world, (s) => s.type === "return");
    wait(world, 60 * 8);
    expect(hatch).toMatchObject({ plates: 1 });
  });
});

describe("given a kitchen fire", () => {
  it("spreads from the spit to the counters next to it", () => {
    const world = SCENARIOS["kitchen-fire"].build(1);
    world.cooks[0]!.held = null;
    wait(world, 60 * 7);
    const burning = [...world.stations.values()].filter((s) => s.fire > 0);
    expect(burning.length).toBeGreaterThan(1);
  });

  it("is put out by cook 1 spraying the extinguisher", () => {
    const world = SCENARIOS["kitchen-fire"].build(1);
    hold(world, 1, DOUSE_TICKS + 1);
    expect(find(world, (s) => s.type === "spit").fire).toBe(0);
  });

  it("starts the shift with an extinguisher on a counter", () => {
    const world = SCENARIOS.shift.build(1);
    expect([...world.stations.values()].some((s) => s.item?.kind === "extinguisher")).toBe(true);
  });
});

describe("given a lineup", () => {
  it("puts one cook per driver on its own floor tile, up to four", () => {
    for (const [humans, bots] of [[1, 0], [2, 0], [1, 3], [2, 2], [0, 4]] as const) {
      const world = SCENARIOS.shift.build(1, lineupOf(humans, bots));
      const tiles = new Set(world.cooks.map((c) => `${Math.floor(c.x)},${Math.floor(c.y)}`));
      expect(world.cooks).toHaveLength(humans + bots);
      expect(tiles.size).toBe(humans + bots);
      expect(world.cooks.every((c) => !world.stations.has(Math.floor(c.y) * world.width + Math.floor(c.x)))).toBe(true);
    }
  });

  it("never asks for more than four cooks or none at all", () => {
    expect(lineupOf(2, 3).drivers).toHaveLength(4);
    expect(lineupOf(0, 0).drivers).toEqual([{ kind: "bot" }]);
  });

  it("lets a solo player's WASD binding drive cook 1", () => {
    const world = SCENARIOS.shift.build(1, lineupOf(1, 0));
    const startX = world.cooks[0]?.x ?? 0;
    run(world, 30, [{ dx: 1, dy: 0, interact: false, work: false, dash: false }]);
    expect(world.cooks[0]?.x).toBeGreaterThan(startX + 1);
  });

  it("gives the arrow keys to cook 2 when two players share the keyboard", () => {
    const world = SCENARIOS.shift.build(1, TWO_PLAYERS);
    const [one, two] = world.cooks;
    const before = [one?.x, two?.x];
    run(world, 30, [IDLE, { dx: -1, dy: 0, interact: false, work: false, dash: false }]);
    expect([one?.x, (two?.x ?? 0) < (before[1] ?? 0) - 1]).toEqual([before[0], true]);
  });
});

describe("given a solo player who drives two cooks", () => {
  const swapPress = { ...IDLE, swap: true };

  it("counts as a crew of one, and with a bot as two", () => {
    expect(crewOf(lineupOf(1, 0, true))).toBe(1);
    expect(crewOf(lineupOf(1, 1, true))).toBe(2);
    expect(lineupOf(1, 0, true).drivers).toHaveLength(2);
  });

  it("moves only the cook in control, and a swap hands control to the other", () => {
    const world = SCENARIOS.shift.build(1, lineupOf(1, 0, true));
    const [one, two] = world.cooks;
    const before = [one?.x, two?.x];
    run(world, 20, [{ ...IDLE, dx: 1 }]);
    expect(two?.x).toBe(before[1]);
    expect(one?.x).not.toBe(before[0]);
    step(world, [swapPress]);
    const oneAt = one?.x;
    run(world, 20, [{ ...IDLE, dx: -1 }]);
    expect(one?.x).toBe(oneAt);
    expect(two?.x).not.toBe(before[1]);
    expect(snapshot(world).control[0]).toBe(1);
  });

  it("lets the cook left chopping finish the veg alone", () => {
    const world = SCENARIOS.shift.build(1, lineupOf(1, 0, true));
    walkTo(world, 1, find(world, (s) => s.type === "crate" && s.goods === "lettuce"));
    press(world, 1);
    const board = find(world, (s) => s.type === "board");
    walkTo(world, 1, board);
    press(world, 1);
    hold(world, 1, 5);
    step(world, [{ ...swapPress, work: true }]);
    run(world, CHOP_TICKS);
    expect(board.item?.kind === "veg" && board.item.chop).toBe(CHOP_TICKS);
    expect(world.parked.size).toBe(0);
  });

  it("does not keep a cook working when the player let go of work before swapping", () => {
    const world = SCENARIOS.shift.build(1, lineupOf(1, 0, true));
    step(world, [swapPress]);
    expect(world.parked.size).toBe(0);
  });
});

describe("given house rules picked on the home page", () => {
  it("never lets the spit burn or catch fire with burning off", () => {
    const world = SCENARIOS["burning-spit"].build(1);
    setRules(world, { ...NORMAL_RULES, burning: false });
    run(world, 60 * 60);
    const spit = find(world, (s) => s.type === "spit");
    expect(spit.fire).toBe(0);
    expect(spit.type === "spit" && spit.spit.sides.every((side) => side < BURNT)).toBe(true);
  });

  it("puts out every fire at once with fire off", () => {
    const world = SCENARIOS["kitchen-fire"].build(1);
    setRules(world, { ...NORMAL_RULES, fire: false });
    step(world, []);
    expect([...world.stations.values()].every((s) => s.fire === 0)).toBe(true);
  });

  it("sends served plates back clean to the rack with dishes off", () => {
    const world = SCENARIOS["ready-classic"].build(1);
    setRules(world, { ...NORMAL_RULES, dishes: false });
    const rack = find(world, (s) => s.type === "rack");
    const before = rack.type === "rack" ? rack.plates : 0;
    press(world, 1);
    wait(world, 60 * 8);
    expect(rack.type === "rack" && rack.plates).toBe(before + 1);
    expect(find(world, (s) => s.type === "return")).toMatchObject({ plates: 0 });
  });

  it("makes customers wait longer and come less often on easy, and the shift as long as picked", () => {
    const easy = SCENARIOS.shift.build(1);
    setRules(easy, { ...PRESETS.easy, minutes: 5 });
    const normal = SCENARIOS.shift.build(1);
    setRules(normal, NORMAL_RULES);
    expect(easy.orders.pace.patience).toBeGreaterThan(normal.orders.pace.patience);
    expect(easy.orders.pace.arrival).toBeGreaterThan(normal.orders.pace.arrival);
    expect(easy.endTick).toBe(60 * 60 * 5);
    expect(normal.endTick).toBe(ROUND_TICKS);
    expect(snapshot(easy).orders.targets[2]).toBeGreaterThan(snapshot(normal).orders.targets[2] ?? 0);
  });
});
