/** Vegetables that come raw from a crate and must be chopped on a board. */
type Veg = "lettuce" | "tomato" | "onion";

/** Sauces squeezed straight onto a döner. */
export type Sauce = "garlic" | "herb" | "spicy";

/** What goes inside a döner. Vegetables inside are always chopped. */
export type Filling = "meat" | Veg | Sauce;

/** The bread a döner is built on. */
export type Base = "bread" | "wrap";

/** A döner under construction: its bread, how long it was toasted, and what is in it. */
export interface Doener {
  readonly kind: "base";
  readonly base: Base;
  toast: number;
  readonly fillings: Filling[];
}

/** Something a cook can carry or a station can hold. */
export type Item =
  | { readonly kind: "veg"; readonly veg: Veg; chop: number }
  | { readonly kind: "meat"; readonly burnt: boolean }
  | Doener
  | { readonly kind: "plate"; dirty: boolean; food: Doener | null }
  | { readonly kind: "extinguisher" };

/** What a crate hands out. */
export type CrateGoods = Veg | Base;

/** Fire on a station: how long it has burned (0 = not burning) and how long it has been sprayed. */
interface Burnable {
  readonly x: number;
  readonly y: number;
  fire: number;
  douse: number;
}

/** A tile of the kitchen that is not floor. Each kind reacts to interact and work differently. */
export type Station = Burnable & (
  | { readonly type: "counter"; item: Item | null }
  | { readonly type: "crate"; readonly goods: CrateGoods; item: null }
  | { readonly type: "board"; item: Item | null }
  | { readonly type: "toaster"; item: Item | null }
  | { readonly type: "sauce"; readonly sauce: Sauce; item: null }
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
  readonly sides: [number, number, number, number];
  /** Ticks of shaving so far toward the next portion. */
  shave: number;
}
