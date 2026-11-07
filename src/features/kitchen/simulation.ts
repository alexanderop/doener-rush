import type { CrateGoods, Doener, Filling, Item, Spit, Station } from "./model.ts";
import {
  AFTER_SHAVE, BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, FAMILY, FIRE_SPREAD, HEAT, MIX_TICKS, SHAVE_TICKS, SPIT_HEAT,
  SPIT_IGNITE, SPIT_TURN, THROWABLE, TRAY_PORTIONS, WASH_TICKS, isBread, isDry, isFull,
} from "./prototypes.ts";

/** A fresh spit, part-cooked all round so the first portion comes quickly. */
export function newSpit(): Spit {
  return { angle: 0, sides: [0.9, 0.9, 0.9, 0.9], shave: 0 };
}

/** A fresh item from a crate: bread, a whole vegetable, or a bowl with the dry goods in it. */
function takeFromCrate(goods: CrateGoods): Item {
  if (isBread(goods)) return { kind: "base", base: goods, toast: 0, fillings: [] };

  if (isDry(goods)) return { kind: "bowl", contents: [goods], knead: 0 };

  return { kind: "veg", veg: goods, chop: 0 };
}

/** Empty hands take from a crate; a bowl at a dry-goods crate gets that good poured in, once. */
function crate(goods: CrateGoods, held: Item | null): Item | null {
  if (held === null) return takeFromCrate(goods);

  if (held.kind === "bowl" && isDry(goods) && !held.contents.includes(goods)) held.contents.push(goods);

  return held;
}

/** True when a vegetable has been chopped through. */
export function isChopped(item: Item): boolean {
  return item.kind === "veg" && item.chop >= CHOP_TICKS;
}

/** True when a base stayed on the heat too long. */
export function isBurntBase(item: Item): boolean {
  return item.kind === "base" && item.toast >= HEAT[item.base].burnt;
}

/** True when a dish had all the heat it needs to be sold: toasted bread; a wrap needs none. */
export function isBaked(dish: Doener): boolean {
  const heat = HEAT[dish.base];

  return !heat.required || dish.toast >= heat.done;
}

/**
 * True when `filling` may go into `dish`: not burnt, not in it yet, and of the dish's own family.
 * A pastry takes exactly one topping, and only while the dough is raw.
 */
function accepts(dish: Doener, filling: Filling): boolean {
  if (isBurntBase(dish) || dish.fillings.includes(filling) || FAMILY[dish.base] !== FAMILY[filling]) return false;

  return FAMILY[dish.base] !== "pastry" || (dish.toast === 0 && dish.fillings.length === 0);
}

/** True when a cook may throw the item: a vegetable, whole or chopped, or bread straight from the crate. */
export function isThrowable(item: Item): boolean {
  if (!THROWABLE[item.kind]) return false;

  return item.kind !== "base" || (item.toast === 0 && item.fillings.length === 0);
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

  if (item?.kind === "plate") return item.food;

  return null;
}

/**
 * Puts `extra` into `target` when it fits: a döner onto a clean empty plate; shaved meat that is
 * not burnt or a chopped vegetable into a döner (or the döner on a plate), each filling once.
 * Returns false and changes nothing when it does not fit.
 */
export function addTo(target: Item, extra: Item): boolean {
  if (target.kind === "plate") {
    if (target.dirty) return false;

    if (target.food === null) {
      if (extra.kind !== "base") return false;
      target.food = extra;

      return true;
    }

    return addTo(target.food, extra);
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
 * what the cook holds afterwards. A burning station refuses everything. The pass is handled by
 * the runtime, which knows the orders.
 */
export function interact(station: Station, held: Item | null): Item | null {
  if (station.fire > 0) return held;

  switch (station.type) {
    case "crate":
      return crate(station.goods, held);
    case "bin":
      return bin(held);
    case "pass":
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

        return { kind: "plate", dirty: false, food: null };
      }

      if (held?.kind === "plate" && !held.dirty && held.food === null) {
        station.plates += 1;

        return null;
      }

      return held;
    case "return":
      if (held !== null || station.plates === 0) return held;
      station.plates -= 1;

      return { kind: "plate", dirty: true, food: null };
    case "sink":
      if (held?.kind === "plate" && held.dirty) {
        station.dirty += 1;

        return null;
      }

      if (held === null && station.clean > 0) {
        station.clean -= 1;

        return { kind: "plate", dirty: false, food: null };
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
      return swapOrCombine(station, held);
  }
}

/** The bin eats food: a plate comes back empty, the extinguisher is never thrown away. */
function bin(held: Item | null): Item | null {
  if (held?.kind === "plate") {
    held.food = null;

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
  const portion: Item = { kind: "veg", veg: station.veg, chop: CHOP_TICKS };

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

  if (station.fire > 0) return held;

  if (station.type === "board" && station.item?.kind === "veg" && held === null) {
    station.item.chop = Math.min(station.item.chop + 1, CHOP_TICKS);

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
  if (station.fire === 0) return;
  station.douse += 1;

  if (station.douse < DOUSE_TICKS) return;
  station.fire = 0;
  station.douse = 0;

  // the charred outside is scraped off; what is left underneath is raw
  if (station.type === "spit") {
    station.spit.sides.forEach((level, i) => {
      if (level >= BURNT) station.spit.sides[i] = AFTER_SHAVE;
    });
  }
}

function shave(spit: Spit, held: Item | null): Item | null {
  if (held !== null && doenerIn(held) === null) return held;
  const side = bestSide(spit);

  if ((spit.sides[side] ?? 0) < COOKED) {
    spit.shave = 0;

    return held;
  }

  spit.shave += 1;

  if (spit.shave < SHAVE_TICKS) return held;
  spit.shave = 0;
  const meat: Item = { kind: "meat", burnt: (spit.sides[side] ?? 0) >= BURNT };
  spit.sides[side] = AFTER_SHAVE;

  if (held === null) return meat;
  addTo(held, meat);

  return held;
}

/** The most cooked side: the one a shave takes. */
function bestSide(spit: Spit): number {
  let best = 0;

  for (let i = 1; i < 4; i++) if ((spit.sides[i] ?? 0) > (spit.sides[best] ?? 0)) best = i;

  return best;
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
    spit.sides[side] = (spit.sides[side] ?? 0) + SPIT_HEAT;

    if ((spit.sides[side] ?? 0) >= SPIT_IGNITE) ignite(station);
  } else if (station.type === "toaster" && station.item?.kind === "base") {
    station.item.toast += 1;

    // only the moment it crosses the line: a doused toaster stays out, with the charred bread still in it
    if (station.item.toast === HEAT[station.item.base].ignite) ignite(station);
  } else if (station.type === "mixer" && station.fire === 0 && station.item?.kind === "bowl" && isFull(station.item)) {
    station.item.knead += 1;

    if (station.item.knead >= MIX_TICKS) station.item = { kind: "base", base: "dough", toast: 0, fillings: [] };
  }

  if (station.fire > 0) {
    station.fire += 1;
    const food = doenerIn(station.item);

    if (food !== null) food.toast = Math.max(food.toast, HEAT[food.base].burnt);
  }
}

/** Holds food on a station just short of burnt: the easy rule and the tutorial's calm kitchen. */
export function keepFromBurning(station: Station): void {
  if (station.type === "toaster" && station.item?.kind === "base") {
    station.item.toast = Math.min(station.item.toast, HEAT[station.item.base].burnt - 1);
  }

  if (station.type === "spit") station.spit.sides.forEach((level, i) => {
    station.spit.sides[i] = Math.min(level, BURNT - 0.01);
  });
}

/** Sets a station on fire, unless it is the sink or already burning. */
function ignite(station: Station): void {
  if (station.type === "sink" || station.fire > 0) return;
  station.fire = 1;
  station.douse = 0;
}

/**
 * Spreads fire: a station that has burned for a multiple of FIRE_SPREAD ticks sets its four
 * neighbours alight. Call once per tick after `stepStation`.
 */
export function spreadFire(stations: Iterable<Station>, at: (x: number, y: number) => Station | null): void {
  const spreading: Station[] = [];

  for (const s of stations) if (s.fire > 1 && (s.fire - 1) % FIRE_SPREAD === 0) spreading.push(s);

  for (const s of spreading) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = at(s.x + dx, s.y + dy);

      if (next !== null) ignite(next);
    }
  }
}
