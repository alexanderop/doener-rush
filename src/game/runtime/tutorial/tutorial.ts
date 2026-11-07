import { BURNT, TOAST_BURNT } from "../../../features/kitchen/public.ts";
import type { Station } from "../../../features/kitchen/public.ts";
import { RECIPES, addOrder } from "../../../features/orders/public.ts";
import { lineupOf } from "../lineup.ts";
import type { World } from "../world.ts";
import { newWorld } from "../world.ts";
import { LESSONS, lessonIndex } from "./lessons.ts";

/** What the HUD shows of the tutorial. */
export interface TutorialView {
  /** 1-based number of the current lesson. */
  readonly step: number;
  readonly total: number;
  readonly title: string;
  readonly text: string;
  readonly why: string;
  readonly trouble: string | null;
  readonly finished: boolean;
  /** Where the card goes so it never hides the stations the arrow points at. */
  readonly side: "left" | "right";
}

/** The serve lesson: until it is done, a customer waiting for a Döner Classic is always there. */
const SERVE_LESSON = lessonIndex("serve");

function orderClassic(world: World): void {
  const classic = RECIPES.find((r) => r.id === "classic");

  if (classic !== undefined) addOrder(world.orders, classic);
}

/** A calm shop for one player with a single patient customer who wants a Döner Classic. */
export function newTutorialWorld(): World {
  const world = newWorld(1, Number.MAX_SAFE_INTEGER, lineupOf(1, 0));
  world.orders.untilNext = Number.MAX_SAFE_INTEGER;
  orderClassic(world);
  world.tutorial = { lesson: 0 };

  return world;
}

/**
 * Runs after every tick of a tutorial world: one step of the lesson machine. Keeps the kitchen
 * calm (nothing burns, the customer never leaves, fire stays where the tutorial lit it), moves on
 * through every lesson that is done, then takes the current lesson's `back` transition if it fires.
 */
export function stepTutorial(world: World): void {
  const state = world.tutorial;

  if (state === null) return;
  calm(world);

  // a player who serves before the serve lesson gets a new customer, so that lesson (and the
  // dirty plate the dishes lessons need) still happens
  if (state.lesson < SERVE_LESSON && world.orders.queue.length === 0) orderClassic(world);

  while (state.lesson < LESSONS.length - 1 && LESSONS[state.lesson]?.done(world) === true) enter(world, state.lesson + 1);
  const back = LESSONS[state.lesson]?.back;

  if (back?.when(world) === true) enter(world, lessonIndex(back.to));
}

function enter(world: World, lesson: number): void {
  if (world.tutorial === null) return;
  world.tutorial.lesson = lesson;
  LESSONS[lesson]?.onEnter?.(world);
}

function calm(world: World): void {
  for (const order of world.orders.queue) order.ticksLeft = order.recipe.patience;

  for (const station of world.stations.values()) {
    if (station.type === "toaster" && station.item?.kind === "base") station.item.toast = Math.min(station.item.toast, TOAST_BURNT - 1);

    if (station.type === "spit") station.spit.sides.forEach((level, i) => {
      station.spit.sides[i] = Math.min(level, BURNT - 0.01);
    });

    // only the grill the tutorial lit may burn: fire does not spread here
    if (station.fire > 0 && station.type !== "toaster") station.fire = 0;
  }
}

/** The stations the tutorial arrow points at now; none outside a tutorial. */
export function tutorialTargets(world: World): readonly Station[] {
  if (world.tutorial === null) return [];

  return LESSONS[world.tutorial.lesson]?.targets(world) ?? [];
}

/** The card sits right unless every target is in the right half of the shop. */
function sideFor(targets: readonly Station[], width: number): "left" | "right" {
  return targets.length > 0 && targets.every((s) => s.x >= width / 2) ? "left" : "right";
}

/** The HUD's view of the tutorial, or null outside a tutorial. */
export function tutorialView(world: World): TutorialView | null {
  const state = world.tutorial;

  if (state === null) return null;
  const lesson = LESSONS[state.lesson];

  if (lesson === undefined) return null;

  return {
    step: state.lesson + 1,
    total: LESSONS.length,
    title: lesson.title,
    text: lesson.text,
    why: lesson.why,
    trouble: lesson.trouble(world),
    finished: state.lesson === LESSONS.length - 1,
    side: sideFor(lesson.targets(world), world.width),
  };
}
