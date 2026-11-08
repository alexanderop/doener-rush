import { CHOPPED, WHOLE, chop } from "./machines/cut.ts";
import { DIRTY, EMPTY, fill, foodOn, scrape } from "./machines/plate.ts";
import { holdSideBelowBurnt, roast, scrapeIfBurnt, shaveOff, sideAt } from "./machines/side.ts";
import { burn, ignite as igniteFire, isBurning, spray, spreadsNow } from "./machines/fire.ts";
import { RAW, char, heatTicks, heatUp, holdBelowBurnt } from "./machines/toast.ts";
import type { Side } from "./machines/side.ts";
import type { CrateGoods, Doener, Filling, Item, Spit, Station } from "./model.ts";
import {
  BELT_TICKS, FAMILY, HEAT, MIX_TICKS, SHAVE_TICKS,
  SPIT_IGNITE, SPIT_TURN, THROWABLE, TRAY_PORTIONS, WASH_TICKS, isBread, isDry, isFull,
} from "./prototypes.ts";

/** A fresh spit, part-cooked all round so the first portion comes quickly. */
export function newSpit(): Spit {
  return { angle: 0, sides: [sideAt(0.9), sideAt(0.9), sideAt(0.9), sideAt(0.9)], shave: 0 };
}

/** A fresh item from a crate: bread, a whole vegetable, or a bowl with the dry goods in it. */
function takeFromCrate(goods: CrateGoods): Item {
  if (isBread(goods)) return { kind: "base", base: goods, toast: RAW, fillings: [] };

  if (isDry(goods)) return { kind: "bowl", contents: [goods], knead: 0 };

  return { kind: "veg", veg: goods, cut: WHOLE };
}

/** Empty hands take from a crate; a bowl at a dry-goods crate gets that good poured in, once. */
function crate(goods: CrateGoods, held: Item | null): Item | null {
  if (held === null) return takeFromCrate(goods);

  if (held.kind === "bowl" && isDry(goods) && !held.contents.includes(goods)) held.contents.push(goods);

  return held;
}

/** True when a vegetable has been chopped through. */
export function isChopped(item: Item): boolean {
  return item.kind === "veg" && item.cut.state === "chopped";
}

/** True when a base stayed on the heat too long. */
export function isBurntBase(item: Item): boolean {
  return item.kind === "base" && item.toast.state === "burnt";
}

/** True when a dish had all the heat it needs to be sold: toasted bread; a wrap needs none. */
export function isBaked(dish: Doener): boolean {
  return !HEAT[dish.base].required || dish.toast.state === "done" || dish.toast.state === "burnt";
}

/**
 * True when `filling` may go into `dish`: not burnt, not in it yet, and of the dish's own family.
 * A pastry takes exactly one topping, and only while the dough is raw.
 */
export function accepts(dish: Doener, filling: Filling): boolean {
  if (isBurntBase(dish) || dish.fillings.includes(filling) || FAMILY[dish.base] !== FAMILY[filling]) return false;

  return FAMILY[dish.base] !== "pastry" || (dish.toast.state === "raw" && dish.fillings.length === 0);
}

/** True when a cook may throw the item: a vegetable, whole or chopped, or bread straight from the crate. */
export function isThrowable(item: Item): boolean {
  if (!THROWABLE[item.kind]) return false;

  return item.kind !== "base" || (item.toast.state === "raw" && item.fillings.length === 0);
}

/**
 * A thrown item reaches a station. It stays there when a cook putting it down would have left
 * empty-handed: onto a free counter or board, into the toaster, a prep tray or the bin, or into a
 * döner waiting there. Returns false and changes nothing otherwise, so a station that would only
 * hand something back (a crate, the pass, a tray that adds a portion to the bread) refuses it.
 */
export function land(station: Station, item: Item): boolean {
  if (interact(structuredClone(station), structuredClone(item)) !== null) return false;
  interact(station, item);

  return true;
}

/** The döner an item is or carries: the item itself, or what lies on a plate. */
function doenerIn(item: Item | null): Doener | null {
  if (item?.kind === "base") return item;

  if (item?.kind === "plate") return foodOn(item.plate);

  return null;
}

/**
 * Puts `extra` into `target` when it fits: a döner onto a clean empty plate; shaved meat that is
 * not burnt or a chopped vegetable into a döner (or the döner on a plate), each filling once.
 * Returns false and changes nothing when it does not fit.
 */
export function addTo(target: Item, extra: Item): boolean {
  if (target.kind === "plate") {
    const { plate } = target;

    if (plate.state === "dirty") return false;

    if (plate.state === "full") return addTo(plate.food, extra);

    if (extra.kind !== "base") return false;
    target.plate = fill(plate, extra);

    return true;
  }

  if (target.kind !== "base") return false;
  let filling: Filling;

  if (extra.kind === "meat" && !extra.burnt) filling = "meat";
  else if (extra.kind === "veg" && isChopped(extra)) filling = extra.veg;
  else return false;

  if (!accepts(target, filling)) return false;
  target.fillings.push(filling);

  return true;
}

/**
 * The cook presses interact at a station while holding `held`. Changes the station and returns
 * what the cook holds afterwards. A burning station refuses everything. The pass and the tables
 * are handled by the runtime, which knows the orders.
 */
export function interact(station: Station, held: Item | null): Item | null {
  if (isBurning(station.fire)) return held;

  switch (station.type) {
    case "crate":
      return crate(station.goods, held);
    case "bin":
      return bin(held);
    case "pass":
    case "table":
    case "spit":
      return held;
    case "sauce": {
      const doener = doenerIn(held);

      if (doener === null || !accepts(doener, station.sauce)) return held;
      doener.fillings.push(station.sauce);

      return held;
    }

    case "tray":
      return tray(station, held);
    case "rack":
      if (held === null && station.plates > 0) {
        station.plates -= 1;

        return { kind: "plate", plate: EMPTY };
      }

      if (held?.kind === "plate" && held.plate.state === "empty") {
        station.plates += 1;

        return null;
      }

      return held;
    case "return":
      if (held !== null || station.plates === 0) return held;
      station.plates -= 1;

      return { kind: "plate", plate: DIRTY };
    case "sink":
      if (held?.kind === "plate" && held.plate.state === "dirty") {
        station.dirty += 1;

        return null;
      }

      if (held === null && station.clean > 0) {
        station.clean -= 1;

        return { kind: "plate", plate: EMPTY };
      }

      return held;
    case "toaster":
      if (held !== null && held.kind !== "base" && station.item === null) return held;

      return swapOrCombine(station, held);
    case "mixer":
      if (held !== null && !(held.kind === "bowl" && isFull(held)) && station.item === null) return held;

      return swapOrCombine(station, held);
    case "board":
    case "counter":
    case "belt":
      return swapOrCombine(station, held);
  }
}

/** The bin eats food: a plate comes back empty, the extinguisher is never thrown away. */
function bin(held: Item | null): Item | null {
  if (held?.kind === "plate") {
    held.plate = scrape(held.plate);

    return held;
  }

  return held?.kind === "extinguisher" ? held : null;
}

/** A prep tray: chopped vegetables go in one portion at a time, and come out into a döner. */
function tray(station: Extract<Station, { type: "tray" }>, held: Item | null): Item | null {
  if (held?.kind === "veg" && isChopped(held)) {
    if (station.portions >= TRAY_PORTIONS || (station.veg !== null && station.veg !== held.veg)) return held;
    station.veg = held.veg;
    station.portions += 1;

    return null;
  }

  if (station.veg === null || station.portions === 0) return held;
  const portion: Item = { kind: "veg", veg: station.veg, cut: CHOPPED };

  if (held === null) {
    takePortion(station);

    return portion;
  }

  if (addTo(held, portion)) takePortion(station);

  return held;
}

function takePortion(station: Extract<Station, { type: "tray" }>): void {
  station.portions -= 1;

  if (station.portions === 0) station.veg = null;
}

function swapOrCombine(station: { item: Item | null }, held: Item | null): Item | null {
  if (held === null) {
    const taken = station.item;
    station.item = null;

    return taken;
  }

  if (station.item === null) {
    station.item = held;

    return null;
  }

  if (addTo(held, station.item)) {
    station.item = null;

    return held;
  }

  if (addTo(station.item, held)) return null;

  return held;
}

/**
 * The cook holds work at a station for one tick: chops on a board, shaves at the spit, washes at
 * the sink, sprays a fire with the extinguisher. Returns what the cook holds afterwards.
 */
export function work(station: Station, held: Item | null): Item | null {
  if (held?.kind === "extinguisher") {
    douse(station);

    return held;
  }

  if (isBurning(station.fire)) return held;

  if (station.type === "board" && station.item?.kind === "veg" && held === null) {
    station.item.cut = chop(station.item.cut);

    return held;
  }

  if (station.type === "sink" && held === null && station.dirty > 0) {
    station.scrub += 1;

    if (station.scrub >= WASH_TICKS) {
      station.scrub = 0;
      station.dirty -= 1;
      station.clean += 1;
    }

    return held;
  }

  if (station.type === "spit") return shave(station.spit, held);

  return held;
}

function douse(station: Station): void {
  if (!isBurning(station.fire)) return;
  station.fire = spray(station.fire);

  if (isBurning(station.fire)) return;

  // the charred outside is scraped off; what is left underneath is raw
  if (station.type === "spit") {
    station.spit.sides.forEach((side, i) => {
      station.spit.sides[i] = scrapeIfBurnt(side);
    });
  }
}

function shave(spit: Spit, held: Item | null): Item | null {
  if (held !== null && doenerIn(held) === null) return held;
  const side = bestSide(spit);

  if (sideOf(spit, side).state === "raw") {
    spit.shave = 0;

    return held;
  }

  spit.shave += 1;

  if (spit.shave < SHAVE_TICKS) return held;
  spit.shave = 0;
  const meat: Item = { kind: "meat", burnt: sideOf(spit, side).state === "burnt" };
  spit.sides[side] = shaveOff();

  if (held === null) return meat;
  addTo(held, meat);

  return held;
}

/** The most cooked side: the one a shave takes. */
function bestSide(spit: Spit): number {
  let best = 0;

  for (let i = 1; i < 4; i++) if (sideOf(spit, i).level > sideOf(spit, best).level) best = i;

  return best;
}

function sideOf(spit: Spit, i: number): Side {
  return spit.sides[i % 4] ?? spit.sides[0];
}

/** The side of the spit that faces the heat now. */
function heatedSide(spit: Spit): number {
  return Math.floor(spit.angle) % 4;
}

/**
 * Advances a station by one tick: the spit turns and cooks, the toaster toasts or the oven bakes,
 * and either catches fire when left far too long; the mixer kneads a full bowl into dough. A fire
 * burns whatever lies on the station.
 */
export function stepStation(station: Station): void {
  if (station.type === "spit") {
    const { spit } = station;
    spit.angle = (spit.angle + SPIT_TURN) % 4;
    const side = heatedSide(spit);
    spit.sides[side] = roast(sideOf(spit, side));

    if (sideOf(spit, side).level >= SPIT_IGNITE) ignite(station);
  } else if (station.type === "toaster" && station.item?.kind === "base") {
    station.item.toast = heatUp(station.item.base, station.item.toast);

    // only the moment it crosses the line: a doused toaster stays out, with the charred bread still in it
    if (heatTicks(station.item.toast) === HEAT[station.item.base].ignite) ignite(station);
  } else if (station.type === "mixer" && !isBurning(station.fire) && station.item?.kind === "bowl" && isFull(station.item)) {
    station.item.knead += 1;

    if (station.item.knead >= MIX_TICKS) station.item = { kind: "base", base: "dough", toast: RAW, fillings: [] };
  }

  if (isBurning(station.fire)) {
    station.fire = burn(station.fire);
    const food = doenerIn(station.item);

    if (food !== null) food.toast = char(food.base, food.toast);
  }
}

/** Holds food on a station just short of burnt: the easy rule and the tutorial's calm kitchen. */
export function keepFromBurning(station: Station): void {
  if (station.type === "toaster" && station.item?.kind === "base") {
    station.item.toast = holdBelowBurnt(station.item.base, station.item.toast);
  }

  if (station.type === "spit") station.spit.sides.forEach((side, i) => {
    station.spit.sides[i] = holdSideBelowBurnt(side);
  });
}

/** Sets a station on fire, unless it is the sink or already burning. */
function ignite(station: Station): void {
  if (station.type !== "sink") station.fire = igniteFire(station.fire);
}

/**
 * Spreads fire: a station that has burned for a multiple of FIRE_SPREAD ticks sets its four
 * neighbours alight. Call once per tick after `stepStation`.
 */
export function spreadFire(stations: Iterable<Station>, at: (x: number, y: number) => Station | null): void {
  const spreading: Station[] = [];

  for (const s of stations) if (spreadsNow(s.fire)) spreading.push(s);

  for (const s of spreading) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = at(s.x + dx, s.y + dy);

      if (next !== null) ignite(next);
    }
  }
}

type Belt = Extract<Station, { type: "belt" }>;

/** True on the ticks the belts carry their items on: every BELT_TICKS. */
export function beltsMove(tick: number): boolean {
  return tick % BELT_TICKS === 0;
}

/**
 * Carries every item on a belt one tile along it, onto the next belt tile if that one is free or frees up in this
 * same move: the head of a line goes first, so a full line moves as one. An item stays at the end of its belt, on a
 * burning belt, and when a belt merging in from earlier in plan order took the tile first.
 */
export function moveBelts(stations: Iterable<Station>, at: (x: number, y: number) => Station | null): void {
  const belts = [...stations].filter((s): s is Belt => s.type === "belt");
  const arrived = new Set<Belt>();
  let moving = true;

  while (moving) {
    moving = false;

    for (const belt of belts) {
      if (belt.item === null || arrived.has(belt) || isBurning(belt.fire)) continue;
      const next = at(belt.x + belt.dir.dx, belt.y + belt.dir.dy);

      if (next?.type !== "belt" || next.item !== null || isBurning(next.fire)) continue;
      next.item = belt.item;
      belt.item = null;
      arrived.add(next);
      moving = true;
    }
  }
}
