import { describe, expect, it } from "vitest";
import { IDLE } from "../../../features/cooks/public.ts";
import type { PlayerInput } from "../lineup.ts";
import { run } from "../step.ts";
import { SCENARIOS } from "../testing/scenarios.ts";
import type { World } from "../world.ts";
import { stationAt } from "../world.ts";
import { cuesBetween, hear, loopLevels } from "./cues.ts";
import type { Cue } from "./cues.ts";

/** The sounds the kitchen makes over `ticks` ticks of these intents. */
function listen(world: World, ticks: number, intents: readonly PlayerInput[] = []): Cue[] {
  const before = hear(world);
  run(world, ticks, intents);

  return cuesBetween(before, hear(world));
}

const press = (intent: Partial<PlayerInput>): PlayerInput => ({ ...IDLE, ...intent });

describe("the sounds of the kitchen", () => {
  it("rings the bell and the till when a döner goes over the pass", () => {
    const world = SCENARIOS["ready-classic"].build(1);
    expect(listen(world, 1, [press({ interact: true })])).toEqual(expect.arrayContaining(["putdown", "served", "coin"]));
  });

  it("whooshes when a cook dashes", () => {
    const world = SCENARIOS.shift.build(1);
    expect(listen(world, 2, [press({ dx: 1, dash: true })])).toContain("dash");
  });

  it("knocks the knife while a cook chops on the board", () => {
    const world = SCENARIOS.shift.build(1);
    const board = stationAt(world, 0, 2);
    const cook = world.cooks[0];

    if (board?.type !== "board" || cook === undefined) throw new Error("the shop has a board at (0, 2)");
    board.item = { kind: "veg", veg: "onion", chop: 0 };
    Object.assign(cook, { x: 1.5, y: 2.5, face: { dx: -1, dy: 0 } });
    expect(listen(world, 30, [press({ work: true })])).toContain("chop");
  });

  it("splashes while a cook scrubs plates at the sink", () => {
    const world = SCENARIOS["dirty-dishes"].build(1);
    expect(listen(world, 30, [IDLE, press({ work: true })])).toContain("splash");
  });

  it("beeps while the spit is about to burn, but not a fresh one", () => {
    const world = SCENARIOS["burning-spit"].build(1);
    expect(listen(world, 31)).toContain("warn");
    expect(listen(SCENARIOS.shift.build(1), 31)).not.toContain("warn");
  });

  it("crackles while the spit burns and sprays while the extinguisher works", () => {
    const world = SCENARIOS["kitchen-fire"].build(1);
    expect(loopLevels(hear(world)).fire).toBeGreaterThan(0);
    run(world, 1, [press({ work: true })]);
    expect(loopLevels(hear(world)).spray).toBe(1);
    run(world, 120, [press({ work: true })]);
    expect(loopLevels(hear(world)).fire).toBe(0);
  });

  it("sizzles more the more the kitchen cooks", () => {
    expect(loopLevels(hear(SCENARIOS["prep-line"].build(1))).sizzle).toBeGreaterThan(loopLevels(hear(SCENARIOS.shift.build(1))).sizzle);
  });

  it("ticks the clock in the last seconds and blows the whistle at the end", () => {
    const world = SCENARIOS["last-seconds"].build(1);
    expect(listen(world, 60)).toContain("tick");
    expect(listen(world, 600)).toContain("whistle");
  });

  it("stays quiet when nothing changes", () => {
    const world = SCENARIOS.shift.build(1);
    expect(cuesBetween(hear(world), hear(world))).toEqual([]);
  });
});
