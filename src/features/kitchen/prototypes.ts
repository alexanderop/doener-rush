import { seconds } from "../../game/core/grid.ts";
import type { Base, Bowl, Bread, CrateGoods, Dry, Filling, Item } from "./model.ts";

/** How a base takes the heat, in ticks on it. */
export interface Heat {
  /** Toasted or baked from here on. */
  readonly done: number;
  /** Burnt from here on. */
  readonly burnt: number;
  /** The station catches fire the moment the base reaches this. */
  readonly ignite: number;
  /** The dish cannot be sold before `done`. */
  readonly required: boolean;
}

/** The heat timings of each base: the one source for toaster, oven, serving, bots and the view. */
export const HEAT: Readonly<Record<Base, Heat>> = {
  bread: { done: seconds(4), burnt: seconds(14), ignite: seconds(20), required: true },
  wrap: { done: seconds(4), burnt: seconds(14), ignite: seconds(20), required: false },
  dough: { done: seconds(8), burnt: seconds(20), ignite: seconds(26), required: true },
};

/** A kind of dish: a filling only goes into a base of its own family. */
export type Family = "doener" | "pastry";

/** The family of every base and filling. */
export const FAMILY: Readonly<Record<Base | Filling, Family>> = {
  bread: "doener",
  wrap: "doener",
  meat: "doener",
  lettuce: "doener",
  tomato: "doener",
  onion: "doener",
  garlic: "doener",
  herb: "doener",
  spicy: "doener",
  dough: "pastry",
  cinnamon: "pastry",
  poppy: "pastry",
  lye: "pastry",
};

/** Ticks the mixer kneads a full bowl until it is dough. */
export const MIX_TICKS = seconds(5);

/** What a bowl needs before the mixer kneads it. */
export const DRY: readonly Dry[] = ["flour", "butter"];

/** Ticks of work on a board to chop a vegetable. */
export const CHOP_TICKS = seconds(2);

/** Ticks of work at the spit to shave one portion. */
export const SHAVE_TICKS = seconds(1);

/** Turns of the spit per tick: one side passes the heat every 1.5 s. */
export const SPIT_TURN = 1 / seconds(1.5);

/** Cook level a side gains per tick while it faces the heat. */
export const SPIT_HEAT = 1 / seconds(4.5);

/** Cook level from which a side can be shaved. */
export const COOKED = 1;

/** Cook level from which a side is burnt. */
export const BURNT = 1.6;

/** Cook level a side keeps after a shave: the raw layer underneath. */
export const AFTER_SHAVE = 0.2;

/** Cook level at which a burnt side catches fire (about 12 s after it burns). */
export const SPIT_IGNITE = 2.3;

/** Ticks a fire burns before it jumps to each neighbouring station, and again every as many ticks. */
export const FIRE_SPREAD = seconds(6);

/** Ticks of spraying that put a fire out. */
export const DOUSE_TICKS = seconds(1.2);

/** Portions of one chopped vegetable a prep tray holds. */
export const TRAY_PORTIONS = 3;

/** Ticks of work at the sink to wash one plate. */
export const WASH_TICKS = seconds(2.5);

/** Clean plates on the rack when a shift starts. */
export const START_PLATES = 3;

/**
 * Which kinds of item fly when a cook throws them: raw ingredients only. A bread base counts as
 * raw until it is toasted or filled (see `isThrowable`); shaved meat, plates and the extinguisher stay in hand.
 */
export const THROWABLE: Readonly<Record<Item["kind"], boolean>> = {
  veg: true,
  base: true,
  meat: false,
  bowl: false,
  plate: false,
  extinguisher: false,
};

/** True when a crate's goods are bread rather than a vegetable or dry goods. */
export function isBread(goods: CrateGoods): goods is Bread {
  return goods === "bread" || goods === "wrap";
}

/** True when a crate's goods go into a bowl. */
export function isDry(goods: CrateGoods): goods is Dry {
  return DRY.some((d) => d === goods);
}

/** True when a bowl holds everything dough needs, so the mixer will knead it. */
export function isFull(bowl: Bowl): boolean {
  return DRY.every((d) => bowl.contents.includes(d));
}

/** Display names for HUD and tickets. */
export const LABEL: Readonly<Record<Filling | Base | Dry, string>> = {
  meat: "Fleisch",
  lettuce: "Salat",
  tomato: "Tomate",
  onion: "Zwiebel",
  garlic: "Knoblauch",
  herb: "Kräuter",
  spicy: "Scharf",
  bread: "Brot",
  wrap: "Dürüm",
  dough: "Teig",
  cinnamon: "Zimtzucker",
  poppy: "Mohn",
  lye: "Lauge & Salz",
  flour: "Mehl",
  butter: "Butter",
};

/** The emoji that stands for each ingredient, bread and the finished döner, on the canvas and the tickets. */
export const ICONS: Readonly<Record<Filling | Base | Dry | "doener", string>> = {
  meat: "🥩",
  lettuce: "🥬",
  tomato: "🍅",
  onion: "🧅",
  garlic: "🧄",
  herb: "🌿",
  spicy: "🌶️",
  bread: "🫓",
  wrap: "🌯",
  dough: "🥟",
  cinnamon: "🟤",
  poppy: "⚫",
  lye: "🧂",
  flour: "🌾",
  butter: "🧈",
  doener: "🥙",
};
