/**
 * What the kitchen sounds like, read from the world without touching Web Audio: `hear` takes a
 * small digest of the audible state, `cuesBetween` turns two digests into one-shot sounds,
 * `loopLevels` gives the volume of the running loops, `intensity` how much the music gives and
 * `nextTake` which DJ take it plays. Pure, so Vitest can run it.
 */
import { BURNT, CHOP_TICKS, HEAT } from "../../../features/kitchen/public.ts";
import type { Cook, Landing } from "../../../features/cooks/public.ts";
import { MAX_ORDERS } from "../../../features/orders/public.ts";
import type { OrderEvent } from "../../../features/orders/public.ts";
import { TICK_RATE, seconds } from "../../core/grid.ts";
import type { World } from "../world.ts";
import type { Take } from "./music/songs.ts";

/** A one-shot sound. */
export type Cue =
  | "chop" | "pickup" | "putdown" | "dash" | "served" | "coin" | "lost" | "wrong" | "warn" | "splash" | "tick" | "whistle"
  | "count" | "go" | "throw" | "thud";

/** A sound that runs as long as something in the kitchen keeps it going. */
export type Loop = "sizzle" | "fire" | "spray";

/** Volume of each loop, 0 to 1. */
export type LoopLevels = Readonly<Record<Loop, number>>;

/** All loops quiet. */
export const SILENT: LoopLevels = { sizzle: 0, fire: 0, spray: 0 };

/** Ticks of chopping or shaving per knife sound. */
const STROKE_TICKS = Math.round(CHOP_TICKS / 8);

/** Ticks of scrubbing per splash. */
const SCRUB_TICKS = 20;

/** A spit side this hot is about to burn. */
const SPIT_WARN = BURNT - 0.2;

/** Ticks between two warning beeps. */
const WARN_TICKS = 30;

/** The clock ticks every second from here on. */
const LAST_SECONDS = 30;

/** What each order event sounds like. */
const ORDER_CUES: Readonly<Record<OrderEvent["type"], readonly Cue[]>> = {
  served: ["served", "coin"],
  expired: ["lost"],
  wrong: ["wrong"],
};

/** What a thrown item sounds like when it comes down: a catch or a landing pops like a put-down, a lost one thuds. */
const LANDING_CUES: Readonly<Record<Landing["how"], Cue>> = { caught: "pickup", landed: "putdown", dropped: "thud" };

/** The audible state of a world at one tick. */
export interface Heard {
  readonly tick: number;
  readonly secondsLeft: number;
  readonly over: boolean;
  /** What each cook holds, as a key that changes when the hands do; "" for empty hands. */
  readonly held: readonly string[];
  readonly dashing: readonly boolean[];
  /** Items in the air. */
  readonly flying: number;
  readonly landings: readonly { readonly tick: number; readonly how: Landing["how"] }[];
  /** Knife strokes so far on the boards and the spit. */
  readonly strokes: number;
  /** Scrub strokes so far at the sinks. */
  readonly scrubs: number;
  /** Counts up every warning beep while something is about to burn; -1 while nothing is. */
  readonly warnBeat: number;
  readonly events: readonly { readonly tick: number; readonly type: OrderEvent["type"] }[];
  /** Stations cooking: the spit, toasters with bread in them. */
  readonly cooking: number;
  readonly burning: number;
  /** A cook holds work with the extinguisher. */
  readonly spraying: boolean;
  /** Customers waiting. */
  readonly waiting: number;
  /** How much of its patience the most impatient waiting customer has used up, 0 to 1. */
  readonly urgency: number;
}

/** Takes the audible digest of a world. */
export function hear(world: World): Heard {
  let strokes = 0;
  let scrubs = 0;
  let cooking = 0;
  let burning = 0;
  let warning = false;
  const watched = world.rules.burning && world.tutorial === null;

  for (const station of world.stations.values()) {
    if (station.fire > 0) burning += 1;

    if (station.type === "board" && station.item?.kind === "veg") strokes += Math.floor(station.item.chop / STROKE_TICKS);

    if (station.type === "sink") scrubs += Math.floor(station.scrub / SCRUB_TICKS);

    if (station.type === "toaster" && station.item?.kind === "base" && station.fire === 0) {
      const { toast } = station.item;
      const { done, burnt } = HEAT[station.item.base];

      if (toast < burnt) cooking += 1;

      // past halfway from done to burnt it is about to burn: the warning beeps
      if (toast >= (done + burnt) / 2 && toast < burnt) warning ||= watched;
    }

    if (station.type === "spit" && station.fire === 0) {
      cooking += 1;
      strokes += Math.floor(station.spit.shave / STROKE_TICKS);

      if (Math.max(...station.spit.sides) >= SPIT_WARN) warning ||= watched;
    }
  }

  return {
    tick: world.tick,
    secondsLeft: Math.max(0, Math.ceil((world.endTick - world.tick) / TICK_RATE)),
    over: world.tick >= world.endTick,
    held: world.cooks.map((cook) => heldKey(cook.held)),
    dashing: world.cooks.map((cook) => cook.dash > 0),
    flying: world.thrown.length,
    landings: world.landings.map(({ tick, landing }) => ({ tick, how: landing.how })),
    strokes,
    scrubs,
    warnBeat: warning ? Math.floor(world.tick / WARN_TICKS) : -1,
    events: world.orders.events.map(({ tick, event }) => ({ tick, type: event.type })),
    cooking,
    burning,
    spraying: world.cooks.some((cook) => cook.working && cook.held?.kind === "extinguisher"),
    waiting: world.orders.queue.length,
    urgency: Math.max(0, ...world.orders.queue.map((order) => 1 - order.ticksLeft / order.patience)),
  };
}

function heldKey(item: Cook["held"]): string {
  if (item === null) return "";

  switch (item.kind) {
    case "base": return `base:${item.fillings.length}`;
    case "bowl": return `bowl:${item.contents.length}`;
    case "plate": return `plate:${item.dirty}:${item.food?.fillings.length ?? -1}`;
    default: return item.kind;
  }
}

/** The one-shot sounds for what changed from `before` to `after`, each at most once. */
export function cuesBetween(before: Heard, after: Heard): Cue[] {
  const cues = new Set<Cue>();
  const threw = after.flying > before.flying;
  after.held.forEach((key, i) => {
    // a cook whose hands empty on a throw whooshes instead of putting down
    if (key !== (before.held[i] ?? "") && !(key === "" && threw)) cues.add(key === "" ? "putdown" : "pickup");
  });

  if (threw) cues.add("throw");

  for (const { tick, how } of after.landings) {
    if (tick >= before.tick) cues.add(LANDING_CUES[how]);
  }

  after.dashing.forEach((dashing, i) => {
    if (dashing && before.dashing[i] !== true) cues.add("dash");
  });

  if (after.strokes > before.strokes) cues.add("chop");

  if (after.scrubs > before.scrubs) cues.add("splash");

  if (after.warnBeat >= 0 && after.warnBeat !== before.warnBeat) cues.add("warn");

  // an event is logged during the step that leaves its tick, so the new ones are from `before.tick` on
  for (const { tick, type } of after.events) {
    if (tick >= before.tick) for (const cue of ORDER_CUES[type]) cues.add(cue);
  }

  if (!after.over && after.secondsLeft <= LAST_SECONDS && after.secondsLeft < before.secondsLeft) cues.add("tick");

  if (after.over && !before.over) cues.add("whistle");

  return [...cues];
}

/** How loud each loop runs: sizzle by how much cooks, fire by how much burns, spray while someone sprays. */
export function loopLevels(heard: Heard): LoopLevels {
  return {
    sizzle: Math.min(1, heard.cooking / 3),
    fire: Math.min(1, heard.burning / 2),
    spray: heard.spraying ? 1 : 0,
  };
}

/** The last seconds play at least this hard, enough to bring in every layer. */
const FINALE = 0.9;

/** How much the music gives, 0 to 1: each waiting customer, one running out of patience, fire, and the last seconds. */
export function intensity(heard: Heard): number {
  const load = heard.waiting / MAX_ORDERS;
  // a customer is only worrying past half their patience
  const impatience = Math.max(0, heard.urgency * 2 - 1);
  const fire = Math.min(1, heard.burning / 2);
  const level = 0.2 + 0.6 * load + 0.15 * impatience + 0.4 * fire;

  return Math.min(1, heard.secondsLeft <= LAST_SECONDS ? Math.max(level, FINALE) : level);
}

/** The kitchen counts as busy from this intensity, and as calm below `CALM`. */
const BUSY = 0.65;

const CALM = 0.45;

/** The kitchen leans this long one way before the DJ follows it. */
const LEAN_TICKS = seconds(10);

/** The DJ take the kitchen asks for: its own song, the busy "lift" or the last-seconds "peak". */
export interface TakeChoice {
  readonly take: "level" | Take;
  /** The tick since which the kitchen has leaned away from the take; -1 while it does not. */
  readonly leaning: number;
}

/** Every shift starts on its kitchen's own song. */
export const FIRST_TAKE: TakeChoice = { take: "level", leaning: -1 };

/** The take after `heard`: "lift" once the kitchen has been busy a while, back when it has been calm a while, "peak" at the end. */
export function nextTake(choice: TakeChoice, heard: Heard): TakeChoice {
  if (heard.secondsLeft <= LAST_SECONDS) return { take: "peak", leaning: -1 };
  const level = intensity(heard);
  const away = choice.take === "level" ? level >= BUSY : level < CALM;

  if (!away) return { take: choice.take, leaning: -1 };
  const leaning = choice.leaning < 0 ? heard.tick : choice.leaning;

  if (heard.tick - leaning < LEAN_TICKS) return { take: choice.take, leaning };

  return { take: choice.take === "level" ? "lift" : "level", leaning: -1 };
}
