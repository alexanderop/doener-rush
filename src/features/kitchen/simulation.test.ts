import { describe, expect, it } from "vitest";
import type { Item, Station } from "./model.ts";
import type { Filling } from "./model.ts";
import { BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, FIRE_SPREAD, HEAT, MIX_TICKS, SHAVE_TICKS, TRAY_PORTIONS, WASH_TICKS } from "./prototypes.ts";
import { addTo, interact, isBaked, isBurntBase, isChopped, land, newSpit, spreadFire, stepStation, work } from "./simulation.ts";

const board = (): Station => ({ type: "board", x: 0, y: 0, fire: 0, douse: 0, item: null });

const spitWith = (sides: [number, number, number, number]): Extract<Station, { type: "spit" }> =>
  ({ type: "spit", x: 0, y: 0, fire: 0, douse: 0, item: null, spit: { ...newSpit(), sides } });

const bread = (): Extract<Item, { kind: "base" }> => ({ kind: "base", base: "bread", toast: 0, fillings: [] });

describe("given a cutting board", () => {
  it("chops a tomato after CHOP_TICKS of work, not before", () => {
    const station = board();
    const left = interact(station, { kind: "veg", veg: "tomato", chop: 0 });
    expect(left).toBeNull();

    for (let i = 0; i < CHOP_TICKS - 1; i++) work(station, null);
    expect(isChopped(station.item!)).toBe(false);
    work(station, null);
    expect(isChopped(station.item!)).toBe(true);
  });

  it("puts a chopped vegetable into the bread the cook holds", () => {
    const station = board();
    station.item = { kind: "veg", veg: "onion", chop: CHOP_TICKS };
    const held = interact(station, bread());
    expect(held).toMatchObject({ kind: "base", fillings: ["onion"] });
    expect(station.item).toBeNull();
  });

  it("refuses a raw vegetable in the bread: the cook keeps holding it", () => {
    const station = board();
    station.item = { kind: "veg", veg: "onion", chop: 0 };
    const held = interact(station, bread());
    expect(held).toMatchObject({ kind: "base", fillings: [] });
    expect(station.item).toMatchObject({ kind: "veg" });
  });
});

describe("given an ingredient thrown at a station", () => {
  it("drops chopped lettuce into the döner waiting on a counter", () => {
    const counter: Station = { type: "counter", x: 0, y: 0, fire: 0, douse: 0, item: bread() };
    expect(land(counter, { kind: "veg", veg: "lettuce", chop: CHOP_TICKS })).toBe(true);
    expect(counter.item).toMatchObject({ kind: "base", fillings: ["lettuce"] });
  });

  it("refuses bread at a stocked tray and leaves the tray as it was", () => {
    const tray: Station = { type: "tray", x: 0, y: 0, fire: 0, douse: 0, item: null, veg: "onion", portions: 2 };
    expect(land(tray, bread())).toBe(false);
    expect(tray).toMatchObject({ veg: "onion", portions: 2 });
  });

  it("refuses everything while the station burns", () => {
    const station = { ...board(), fire: 10 };
    expect(land(station, { kind: "veg", veg: "tomato", chop: 0 })).toBe(false);
    expect(station.item).toBeNull();
  });
});

describe("given the döner spit", () => {
  it("shaves nothing while every side is raw", () => {
    const station = spitWith([0.2, 0.2, 0.2, 0.2]);
    let held: Item | null = null;

    for (let i = 0; i < SHAVE_TICKS * 3; i++) held = work(station, held);
    expect(held).toBeNull();
  });

  it("shaves a portion of the most cooked side into an empty hand", () => {
    const station = spitWith([0.5, COOKED + 0.1, 0.3, 0.3]);
    let held: Item | null = null;

    for (let i = 0; i < SHAVE_TICKS; i++) held = work(station, held);
    expect(held).toEqual({ kind: "meat", burnt: false });
    expect(station.spit.sides[1]).toBeLessThan(COOKED);
  });

  it("gives burnt meat from a side left too long, and bread will not take it", () => {
    const station = spitWith([BURNT + 0.1, 0.3, 0.3, 0.3]);
    let held: Item | null = null;

    for (let i = 0; i < SHAVE_TICKS; i++) held = work(station, held);
    expect(held).toEqual({ kind: "meat", burnt: true });
    expect(addTo(bread(), held!)).toBe(false);
  });

  it("cooks only the side facing the heat, and every side in turn", () => {
    const station = spitWith([0, 0, 0, 0]);
    stepStation(station);
    expect(station.spit.sides.filter((s) => s > 0)).toHaveLength(1);

    for (let i = 0; i < 60 * 8; i++) stepStation(station);
    expect(station.spit.sides.every((s) => s > 0)).toBe(true);
  });
});

describe("given the toaster", () => {
  it("toasts bread, then burns it if nobody takes it out", () => {
    const station: Station = { type: "toaster", look: "grill", x: 0, y: 0, fire: 0, douse: 0, item: null };
    interact(station, bread());

    for (let i = 0; i < HEAT.bread.done; i++) stepStation(station);
    expect(station.item).toMatchObject({ toast: HEAT.bread.done });

    for (let i = 0; i < 60 * 20; i++) stepStation(station);
    expect(isBurntBase(station.item!)).toBe(true);
  });

  it("will not take a tomato", () => {
    const station: Station = { type: "toaster", look: "grill", x: 0, y: 0, fire: 0, douse: 0, item: null };
    const tomato: Item = { kind: "veg", veg: "tomato", chop: 0 };
    expect(interact(station, tomato)).toBe(tomato);
    expect(station.item).toBeNull();
  });
});

describe("given a sauce bottle", () => {
  it("adds its sauce once", () => {
    const station: Station = { type: "sauce", x: 0, y: 0, fire: 0, douse: 0, sauce: "garlic", item: null };
    const held = interact(station, interact(station, bread()));
    expect(held).toMatchObject({ fillings: ["garlic"] });
  });
});

const plateOf = (food: Extract<Item, { kind: "base" }> | null = null): Item => ({ kind: "plate", dirty: false, food });

describe("given a prep tray", () => {
  const tray = (): Extract<Station, { type: "tray" }> => ({ type: "tray", x: 0, y: 0, fire: 0, douse: 0, item: null, veg: null, portions: 0 });

  it("takes chopped portions of one vegetable, up to TRAY_PORTIONS", () => {
    const station = tray();

    for (let i = 0; i < TRAY_PORTIONS; i++) expect(interact(station, { kind: "veg", veg: "onion", chop: CHOP_TICKS })).toBeNull();
    const extra: Item = { kind: "veg", veg: "onion", chop: CHOP_TICKS };
    expect(interact(station, extra)).toBe(extra);
    expect(station.portions).toBe(TRAY_PORTIONS);
  });

  it("refuses a raw vegetable and a different vegetable", () => {
    const station = tray();
    interact(station, { kind: "veg", veg: "onion", chop: CHOP_TICKS });
    expect(interact(station, { kind: "veg", veg: "onion", chop: 0 })).not.toBeNull();
    expect(interact(station, { kind: "veg", veg: "tomato", chop: CHOP_TICKS })).not.toBeNull();
    expect(station.portions).toBe(1);
  });

  it("puts one portion into the döner on a plate, and empties after the last", () => {
    const station = tray();
    interact(station, { kind: "veg", veg: "lettuce", chop: CHOP_TICKS });
    const held = interact(station, plateOf(bread()));
    expect(held).toMatchObject({ kind: "plate", food: { fillings: ["lettuce"] } });
    expect(station).toMatchObject({ veg: null, portions: 0 });
  });
});

describe("given plates", () => {
  it("a döner on the counter goes onto the plate the cook holds", () => {
    const station = board();
    station.item = bread();
    const held = interact(station, plateOf());
    expect(held).toMatchObject({ kind: "plate", food: { kind: "base" } });
    expect(station.item).toBeNull();
  });

  it("the bin empties a plate but keeps it", () => {
    const bin: Station = { type: "bin", x: 0, y: 0, fire: 0, douse: 0, item: null };
    expect(interact(bin, plateOf(bread()))).toEqual(plateOf());
    expect(interact(bin, { kind: "extinguisher" })).toEqual({ kind: "extinguisher" });
  });

  it("the sink washes a dirty plate after WASH_TICKS of work", () => {
    const sink: Extract<Station, { type: "sink" }> = { type: "sink", x: 0, y: 0, fire: 0, douse: 0, item: null, dirty: 0, clean: 0, scrub: 0 };
    expect(interact(sink, { kind: "plate", dirty: true, food: null })).toBeNull();

    for (let i = 0; i < WASH_TICKS; i++) work(sink, null);
    expect(sink).toMatchObject({ dirty: 0, clean: 1 });
    expect(interact(sink, null)).toEqual(plateOf());
  });
});

describe("given a spit left to itself", () => {
  it("catches fire, the fire spreads to its neighbours, and the extinguisher puts it out", () => {
    const spit = spitWith([1.5, 1.5, 1.5, 1.5]);
    const left: Station = { type: "counter", x: -1, y: 0, fire: 0, douse: 0, item: null };
    const at = (x: number) => (x === -1 ? left : null);
    let ticks = 0;

    while (spit.fire === 0 && ticks < 60 * 60) {
      stepStation(spit);
      ticks += 1;
    }

    expect(spit.fire).toBeGreaterThan(0);

    for (let i = 0; i < FIRE_SPREAD + 2; i++) {
      stepStation(spit);
      spreadFire([spit, left], at);
    }

    expect(left.fire).toBeGreaterThan(0);
    expect(interact(left, bread())).toMatchObject({ kind: "base" });

    for (let i = 0; i < DOUSE_TICKS; i++) work(spit, { kind: "extinguisher" });
    expect(spit.fire).toBe(0);
    expect(Math.max(...spit.spit.sides)).toBeLessThan(BURNT);
  });

  it("burns the bread a forgotten toaster holds until it catches fire", () => {
    const toaster: Station = { type: "toaster", look: "grill", x: 0, y: 0, fire: 0, douse: 0, item: bread() };

    for (let i = 0; i < 60 * 25; i++) stepStation(toaster);
    expect(toaster.fire).toBeGreaterThan(0);
    expect(isBurntBase(toaster.item!)).toBe(true);
  });
});

describe("given the bakery", () => {
  const at = { x: 0, y: 0, fire: 0, douse: 0 };
  const flour = (): Station => ({ ...at, type: "crate", goods: "flour", item: null });
  const butter = (): Station => ({ ...at, type: "crate", goods: "butter", item: null });
  const mixer = (): Station => ({ ...at, type: "mixer", item: null });
  const oven = (): Station => ({ ...at, type: "toaster", look: "oven", item: null });
  const dough = (toast = 0, fillings: Filling[] = []): Extract<Item, { kind: "base" }> => ({ kind: "base", base: "dough", toast, fillings });
  const dispenser = (sauce: "cinnamon" | "poppy" | "lye" | "garlic"): Station => ({ ...at, type: "sauce", sauce, item: null });

  it("fills a bowl at the flour and butter crates, and the mixer kneads it into raw dough on its own", () => {
    const bowl = interact(butter(), interact(flour(), null));
    expect(bowl).toMatchObject({ kind: "bowl", contents: ["flour", "butter"] });
    const station = mixer();
    expect(interact(station, bowl)).toBeNull();

    for (let i = 0; i < MIX_TICKS - 1; i++) stepStation(station);
    expect(station.item).toMatchObject({ kind: "bowl" });
    stepStation(station);
    expect(interact(station, null)).toEqual(dough());
  });

  it("pours each dry good in once, and the mixer will not take a bowl that lacks butter", () => {
    const bowl = interact(flour(), interact(flour(), null));
    expect(bowl).toMatchObject({ contents: ["flour"] });
    const station = mixer();
    expect(interact(station, bowl)).toBe(bowl);
    expect(station.item).toBeNull();
  });

  it.each([
    ["raw dough takes cinnamon sugar", () => dough(), "cinnamon", ["cinnamon"]],
    ["raw dough takes lye and salt", () => dough(), "lye", ["lye"]],
    ["topped dough takes no second topping", () => dough(0, ["cinnamon"]), "poppy", ["cinnamon"]],
    ["baked dough takes no topping", () => dough(HEAT.dough.done), "poppy", []],
    ["dough takes no döner sauce", () => dough(), "garlic", []],
    ["bread takes no pastry topping", bread, "cinnamon", []],
  ] as const)("%s", (_case, dish, topping, fillings) => {
    const held = dish();
    interact(dispenser(topping), held);
    expect(held.fillings).toEqual(fillings);
  });

  it("will not put chopped lettuce or meat into dough", () => {
    const held = dough();
    expect(addTo(held, { kind: "veg", veg: "lettuce", chop: CHOP_TICKS })).toBe(false);
    expect(addTo(held, { kind: "meat", burnt: false })).toBe(false);
    expect(held.fillings).toEqual([]);
  });

  it("bakes dough in the oven slower than bread toasts, burns it, then catches fire", () => {
    const station = oven();
    interact(station, dough(0, ["lye"]));
    const baked = () => station.item?.kind === "base" && isBaked(station.item);

    for (let i = 0; i < HEAT.bread.done; i++) stepStation(station);
    expect(baked()).toBe(false);

    for (let i = HEAT.bread.done; i < HEAT.dough.done; i++) stepStation(station);
    expect(baked()).toBe(true);

    for (let i = HEAT.dough.done; i < HEAT.dough.burnt; i++) stepStation(station);
    expect(isBurntBase(station.item!)).toBe(true);
    expect(station.fire).toBe(0);

    for (let i = HEAT.dough.burnt; i < HEAT.dough.ignite; i++) stepStation(station);
    expect(station.fire).toBeGreaterThan(0);
  });
});
