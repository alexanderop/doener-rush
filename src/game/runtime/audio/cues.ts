/**
 * What the kitchen sounds like, read from the world without touching Web Audio: `hear` takes a
 * small digest of the audible state, `cuesBetween` turns two digests into one-shot sounds and
 * `loopLevels` gives the volume of the running loops. Pure, so Vitest can run it.
 */
import { BURNT, CHOP_TICKS, TOAST_BURNT, TOAST_DONE } from "../../../features/kitchen/public.ts";
import type { Cook } from "../../../features/cooks/public.ts";
import type { OrderEvent } from "../../../features/orders/public.ts";
import { TICK_RATE } from "../../core/grid.ts";
import type { World } from "../world.ts";

/** A one-shot sound. */
export type Cue =
  | "chop" | "pickup" | "putdown" | "dash" | "served" | "coin" | "lost" | "wrong" | "warn" | "splash" | "tick" | "whistle"
  | "count" | "go";

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

/** Toast past this is about to burn: the warning beeps. */
const TOAST_WARN = TOAST_DONE + (TOAST_BURNT - TOAST_DONE) / 2;

/** A spit side this hot is about to burn. */
const SPIT_WARN = BURNT - 0.2;

/** Ticks between two warning beeps. */
const WARN_TICKS = 30;

/** The clock ticks every second from here on. */
export const LAST_SECONDS = 30;

/** What each order event sounds like. */
const ORDER_CUES: Readonly<Record<OrderEvent["type"], readonly Cue[]>> = {
  served: ["served", "coin"],
  expired: ["lost"],
  wrong: ["wrong"],
};

/** The audible state of a world at one tick. */
export interface Heard {
  readonly tick: number;
  readonly secondsLeft: number;
  readonly over: boolean;
  /** What each cook holds, as a key that changes when the hands do; "" for empty hands. */
  readonly held: readonly string[];
  readonly dashing: readonly boolean[];
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

      if (toast < TOAST_BURNT) cooking += 1;

      if (toast >= TOAST_WARN && toast < TOAST_BURNT) warning ||= watched;
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
    strokes,
    scrubs,
    warnBeat: warning ? Math.floor(world.tick / WARN_TICKS) : -1,
    events: world.orders.events.map(({ tick, event }) => ({ tick, type: event.type })),
    cooking,
    burning,
    spraying: world.cooks.some((cook) => cook.working && cook.held?.kind === "extinguisher"),
  };
}

function heldKey(item: Cook["held"]): string {
  if (item === null) return "";

  switch (item.kind) {
    case "base": return `base:${item.fillings.length}`;
    case "plate": return `plate:${item.dirty}:${item.food?.fillings.length ?? -1}`;
    default: return item.kind;
  }
}

/** The one-shot sounds for what changed from `before` to `after`, each at most once. */
export function cuesBetween(before: Heard, after: Heard): Cue[] {
  const cues = new Set<Cue>();
  after.held.forEach((key, i) => {
    if (key !== (before.held[i] ?? "")) cues.add(key === "" ? "putdown" : "pickup");
  });
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
