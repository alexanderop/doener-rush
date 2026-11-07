import { describe, expect, it } from "vitest";
import { IDLE } from "../../../features/cooks/public.ts";
import { CHOP_TICKS, DOUSE_TICKS, SHAVE_TICKS, TOAST_DONE, WASH_TICKS } from "../../../features/kitchen/public.ts";
import type { Station } from "../../../features/kitchen/public.ts";
import { find, hold, press, walkTo, wait } from "../testing/drive.ts";
import { snapshot, step } from "../step.ts";
import type { World } from "../world.ts";
import { LESSONS, lessonIndex } from "./lessons.ts";
import { newTutorialWorld, tutorialTargets } from "./tutorial.ts";

function lesson(world: World): string {
  return LESSONS[world.tutorial?.lesson ?? -1]?.id ?? "none";
}

const crate = (goods: string) => (s: Station) => s.type === "crate" && s.goods === goods;

/** Builds a Döner Classic on a plate and keeps it in hand, the way the lessons teach it. */
function buildClassic(world: World): void {
  prep(world, "lettuce");
  prep(world, "onion");
  walkTo(world, 1, find(world, crate("bread")));
  press(world, 1);
  const toaster = find(world, (s) => s.type === "toaster");
  walkTo(world, 1, toaster);
  press(world, 1);
  walkTo(world, 1, find(world, (s) => s.type === "rack"));
  press(world, 1);
  walkTo(world, 1, toaster);
  wait(world, TOAST_DONE);
  press(world, 1);
  walkTo(world, 1, find(world, (s) => s.type === "spit"));
  hold(world, 1, SHAVE_TICKS * 2);

  for (const veg of ["lettuce", "onion"]) {
    walkTo(world, 1, find(world, (s) => s.type === "tray" && s.veg === veg));
    press(world, 1);
  }

  walkTo(world, 1, find(world, (s) => s.type === "sauce" && s.sauce === "garlic"));
  press(world, 1);
}

/** Serves the whole order while the card still says "Sprinten": the player never pressed Space. */
function serveBeforeSprinting(world: World): void {
  buildClassic(world);
  walkTo(world, 1, find(world, (s) => s.type === "pass"));
  press(world, 1);
  expect(world.orders.served).toBe(1);
  expect(lesson(world)).toBe("dash");
}

const sprint = (world: World) => step(world, [{ ...IDLE, dx: 1, dash: true }]);

/** Takes a vegetable from its crate, chops it on a free board and puts it in a free tray. */
function prep(world: World, veg: "lettuce" | "onion"): void {
  walkTo(world, 1, find(world, crate(veg)));
  press(world, 1);
  const board = find(world, (s) => s.type === "board" && s.item === null);
  walkTo(world, 1, board);
  press(world, 1);
  hold(world, 1, CHOP_TICKS);
  press(world, 1);
  walkTo(world, 1, find(world, (s) => s.type === "tray" && (s.veg === null || s.veg === veg)));
  press(world, 1);
}

describe("given the tutorial", () => {
  it("walks a new player through every lesson to the end", () => {
    const world = newTutorialWorld();
    expect(lesson(world)).toBe("walk");
    step(world, [{ ...IDLE, dx: 1, dash: true }]);
    walkTo(world, 1, find(world, crate("lettuce")));
    expect(lesson(world)).toBe("lettuce");
    expect(tutorialTargets(world)).toEqual([find(world, crate("lettuce"))]);
    prep(world, "lettuce");
    expect(lesson(world)).toBe("onion");
    prep(world, "onion");
    expect(lesson(world)).toBe("bread");

    walkTo(world, 1, find(world, crate("bread")));
    press(world, 1);
    const toaster = find(world, (s) => s.type === "toaster");
    walkTo(world, 1, toaster);
    press(world, 1);
    expect(lesson(world)).toBe("plate");
    walkTo(world, 1, find(world, (s) => s.type === "rack"));
    press(world, 1);
    expect(lesson(world)).toBe("plate-up");
    walkTo(world, 1, toaster);
    wait(world, TOAST_DONE);
    press(world, 1);
    expect(lesson(world)).toBe("meat");
    walkTo(world, 1, find(world, (s) => s.type === "spit"));
    hold(world, 1, SHAVE_TICKS * 2);
    expect(lesson(world)).toBe("veg");

    for (const veg of ["lettuce", "onion"]) {
      walkTo(world, 1, find(world, (s) => s.type === "tray" && s.veg === veg));
      press(world, 1);
    }

    expect(lesson(world)).toBe("sauce");
    walkTo(world, 1, find(world, (s) => s.type === "sauce" && s.sauce === "garlic"));
    press(world, 1);
    walkTo(world, 1, find(world, (s) => s.type === "pass"));
    press(world, 1);
    expect(world.orders.served).toBe(1);
    expect(lesson(world)).toBe("return");

    const back = find(world, (s) => s.type === "return");
    walkTo(world, 1, back);
    wait(world, 60 * 8);
    press(world, 1);
    const sink = find(world, (s) => s.type === "sink");
    walkTo(world, 1, sink);
    press(world, 1);
    expect(lesson(world)).toBe("wash");
    hold(world, 1, WASH_TICKS);
    expect(lesson(world)).toBe("rack");
    press(world, 1);
    walkTo(world, 1, find(world, (s) => s.type === "rack"));
    press(world, 1);

    expect(lesson(world)).toBe("extinguisher");
    expect(toaster.fire).toBeGreaterThan(0);
    walkTo(world, 1, find(world, (s) => s.item?.kind === "extinguisher"));
    press(world, 1);
    expect(lesson(world)).toBe("douse");
    walkTo(world, 1, toaster);
    hold(world, 1, DOUSE_TICKS);
    expect(lesson(world)).toBe("finish");
    expect(snapshot(world).tutorial?.finished).toBe(true);
  });

  it("never burns the bread or lets the customer leave, however long the player waits", () => {
    const world = newTutorialWorld();
    walkTo(world, 1, find(world, crate("bread")));
    press(world, 1);
    walkTo(world, 1, find(world, (s) => s.type === "toaster"));
    press(world, 1);
    wait(world, 60 * 120);
    expect([...world.stations.values()].some((s) => s.fire > 0)).toBe(false);
    expect(world.orders.queue).toHaveLength(1);
    expect(world.orders.missed).toBe(0);
  });

  it("goes back to the bread when the player bins the döner", () => {
    const world = newTutorialWorld();
    world.tutorial = { lesson: lessonIndex("bread") };
    walkTo(world, 1, find(world, crate("bread")));
    press(world, 1);
    expect(lesson(world)).toBe("toaster");
    walkTo(world, 1, find(world, (s) => s.type === "bin"));
    press(world, 1);
    expect(lesson(world)).toBe("bread");
  });

  it("sends a new customer when the player serves before the serve lesson", () => {
    const world = newTutorialWorld();
    serveBeforeSprinting(world);
    expect(world.orders.queue).toHaveLength(1);
  });

  it("goes back to the bread when the döner is binned after an early serve", () => {
    const world = newTutorialWorld();
    serveBeforeSprinting(world);
    sprint(world);
    prep(world, "lettuce");
    prep(world, "onion");
    walkTo(world, 1, find(world, crate("bread")));
    press(world, 1);
    expect(lesson(world)).toBe("toaster");
    walkTo(world, 1, find(world, (s) => s.type === "bin"));
    press(world, 1);
    expect(lesson(world)).toBe("bread");
  });

  it("still teaches serving and the dishes when the first plate was washed early", () => {
    const world = newTutorialWorld();
    serveBeforeSprinting(world);
    const back = find(world, (s) => s.type === "return");
    walkTo(world, 1, back);
    wait(world, 60 * 8);
    press(world, 1);
    const sink = find(world, (s) => s.type === "sink");
    walkTo(world, 1, sink);
    press(world, 1);
    hold(world, 1, WASH_TICKS);
    press(world, 1);
    walkTo(world, 1, find(world, (s) => s.type === "rack"));
    press(world, 1);
    sprint(world);
    buildClassic(world);
    expect(lesson(world)).toBe("serve");
    walkTo(world, 1, find(world, (s) => s.type === "pass"));
    press(world, 1);
    expect(lesson(world)).toBe("return");
    walkTo(world, 1, back);
    wait(world, 60 * 8);
    press(world, 1);
    expect(lesson(world)).toBe("sink");
  });

  it("says why a plate with raw bread is not done", () => {
    const world = newTutorialWorld();
    world.tutorial = { lesson: lessonIndex("bread") };
    walkTo(world, 1, find(world, crate("bread")));
    press(world, 1);
    const toaster = find(world, (s) => s.type === "toaster");
    walkTo(world, 1, toaster);
    press(world, 1);
    walkTo(world, 1, find(world, (s) => s.type === "rack"));
    press(world, 1);
    walkTo(world, 1, toaster);
    press(world, 1);
    expect(lesson(world)).toBe("plate-up");
    expect(snapshot(world).tutorial?.trouble).toContain("Zu früh");
  });
});
