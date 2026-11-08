import type { Cut } from "./machines/cut.ts";
import type { Fire } from "./machines/fire.ts";
import type { Plate } from "./machines/plate.ts";
import type { Side } from "./machines/side.ts";
import type { Toast } from "./machines/toast.ts";

/** Vegetables that come raw from a crate and must be chopped on a board. */
export type Veg = "lettuce" | "tomato" | "onion";

/** Sauces squeezed straight onto a döner. */
export type Sauce = "garlic" | "herb" | "spicy";

/** What goes on raw dough and decides the pastry: cinnamon sugar, poppy seeds, lye and salt. */
export type Topping = "cinnamon" | "poppy" | "lye";

/** What goes inside a döner or on a pastry. Vegetables inside are always chopped. */
export type Filling = "meat" | Veg | Sauce | Topping;

/** The bread a döner is built on. */
export type Bread = "bread" | "wrap";

/** What a dish is built on: bread for a döner, dough for a pastry. */
export type Base = Bread | "dough";

/** The dry goods a bowl of dough is stirred from. */
export type Dry = "flour" | "butter";

/** A mixing bowl: what is in it so far, and how many ticks the mixer has kneaded it. */
export interface Bowl {
  readonly kind: "bowl";
  readonly contents: Dry[];
  knead: number;
}

/** A dish under construction: its base, where it is on the heat, and what is in or on it. */
export interface Doener {
  readonly kind: "base";
  readonly base: Base;
  toast: Toast;
  readonly fillings: Filling[];
}

/** Something a cook can carry or a station can hold. */
export type Item =
  | { readonly kind: "veg"; readonly veg: Veg; cut: Cut }
  | { readonly kind: "meat"; readonly burnt: boolean }
  | Doener
  | Bowl
  | { readonly kind: "plate"; plate: Plate }
  | { readonly kind: "extinguisher" };

/** What a crate hands out. */
export type CrateGoods = Veg | Bread | Dry;

/** Where a station stands, and its fire. */
interface Burnable {
  readonly x: number;
  readonly y: number;
  fire: Fire;
}

/** A tile of the kitchen that is not floor. Each kind reacts to interact and work differently. */
export type Station = Burnable & (
  | { readonly type: "counter"; item: Item | null }
  | { readonly type: "crate"; readonly goods: CrateGoods; item: null }
  | { readonly type: "board"; item: Item | null }
  | { readonly type: "toaster"; readonly look: "grill" | "oven"; item: Item | null }
  | { readonly type: "sauce"; readonly sauce: Sauce | Topping; item: null }
  | { readonly type: "mixer"; item: Item | null }
  | { readonly type: "spit"; item: null; readonly spit: Spit }
  | { readonly type: "pass"; item: null }
  | { readonly type: "bin"; item: null }
  | { readonly type: "tray"; item: null; veg: Veg | null; portions: number }
  | { readonly type: "rack"; item: null; plates: number }
  | { readonly type: "return"; item: null; plates: number }
  | { readonly type: "sink"; item: null; dirty: number; clean: number; scrub: number }
);

/** The rotating döner spit: only the side facing the heat cooks, and a side left too long burns. */
export interface Spit {
  /** Turns of the spit; the integer part mod 4 is the side facing the heat. */
  angle: number;
  /** Cook level per side: under COOKED is raw, from BURNT on it is burnt. */
  readonly sides: [Side, Side, Side, Side];
  /** Ticks of shaving so far toward the next portion. */
  shave: number;
}
