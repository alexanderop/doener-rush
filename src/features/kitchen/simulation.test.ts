import { describe, expect, it } from "vitest";
import { OUT, ignite } from "./machines/fire.ts";
import { CHOPPED, WHOLE } from "./machines/cut.ts";
import { DIRTY, EMPTY } from "./machines/plate.ts";
import { sideAt } from "./machines/side.ts";
import { RAW, toastAt } from "./machines/toast.ts";
import type { Item, Station } from "./model.ts";
import type { Filling } from "./model.ts";
import { BELT_TICKS, BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, FIRE_SPREAD, HEAT, MIX_TICKS, SHAVE_TICKS, TRAY_PORTIONS, WASH_TICKS } from "./prototypes.ts";
import {
  addTo, beltsMove, interact, isBaked, isBurntBase, isChopped, land, moveBelts, newSpit, spreadFire, stepStation, work,
} from "./simulation.ts";

const board = (): Station => ({ type: "board", x: 0, y: 0, fire: OUT, item: null });

const spitWith = (sides: [number, number, number, number]): Extract<Station, { type: "spit" }> =>
  ({ type: "spit", x: 0, y: 0, fire: OUT, item: null, spit: { ...newSpit(), sides: [sideAt(sides[0]), sideAt(sides[1]), sideAt(sides[2]), sideAt(sides[3])] } });

const bread = (): Extract<Item, { kind: "base" }> => ({ kind: "base", base: "bread", toast: RAW, fillings: [] });

describe("given a cutting board", () => {
  it("chops a tomato after CHOP_TICKS of work, not before", () => {
    const station = board();
    const left = interact(station, { kind: "veg", veg: "tomato", cut: WHOLE });
    expect(left).toBeNull();

    for (let i = 0; i < CHOP_TICKS - 1; i++) work(station, null);
    expect(isChopped(station.item!)).toBe(false);
    work(station, null);
    expect(isChopped(station.item!)).toBe(true);
  });

  it("puts a chopped vegetable into the bread the cook holds", () => {
    const station = board();
    station.item = { kind: "veg", veg: "onion", cut: CHOPPED };
    const held = interact(station, bread());
    expect(held).toMatchObject({ kind: "base", fillings: ["onion"] });
    expect(station.item).toBeNull();
  });

  it("refuses a raw vegetable in the bread: the cook keeps holding it", () => {
    const station = board();
    station.item = { kind: "veg", veg: "onion", cut: WHOLE };
    const held = interact(station, bread());
    expect(held).toMatchObject({ kind: "base", fillings: [] });
    expect(station.item).toMatchObject({ kind: "veg" });
  });
});

describe("given an ingredient thrown at a station", () => {
  it("drops chopped lettuce into the döner waiting on a counter", () => {
    const counter: Station = { type: "counter", x: 0, y: 0, fire: OUT, item: bread() };
    expect(land(counter, { kind: "veg", veg: "lettuce", cut: CHOPPED })).toBe(true);
    expect(counter.item).toMatchObject({ kind: "base", fillings: ["lettuce"] });
  });

  it("refuses bread at a stocked tray and leaves the tray as it was", () => {
    const tray: Station = { type: "tray", x: 0, y: 0, fire: OUT, item: null, veg: "onion", portions: 2 };
    expect(land(tray, bread())).toBe(false);
    expect(tray).toMatchObject({ veg: "onion", portions: 2 });
  });

  it("refuses everything while the station burns", () => {
    const station = { ...board(), fire: ignite(OUT) };
    expect(land(station, { kind: "veg", veg: "tomato", cut: WHOLE })).toBe(false);
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
    expect(station.spit.sides[1]?.state).toBe("raw");
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
    expect(station.spit.sides.filter((s) => s.level > 0)).toHaveLength(1);

    for (let i = 0; i < 60 * 8; i++) stepStation(station);
    expect(station.spit.sides.every((s) => s.level > 0)).toBe(true);
  });
});

describe("given the toaster", () => {
  it("toasts bread, then burns it if nobody takes it out", () => {
    const station: Station = { type: "toaster", look: "grill", x: 0, y: 0, fire: OUT, item: null };
    interact(station, bread());

    for (let i = 0; i < HEAT.bread.done; i++) stepStation(station);
    expect(station.item).toMatchObject({ toast: { state: "done", ticks: HEAT.bread.done } });

    for (let i = 0; i < 60 * 20; i++) stepStation(station);
    expect(isBurntBase(station.item!)).toBe(true);
  });

  it("will not take a tomato", () => {
    const station: Station = { type: "toaster", look: "grill", x: 0, y: 0, fire: OUT, item: null };
    const tomato: Item = { kind: "veg", veg: "tomato", cut: WHOLE };
    expect(interact(station, tomato)).toBe(tomato);
    expect(station.item).toBeNull();
  });
});

describe("given a sauce bottle", () => {
  it("adds its sauce once", () => {
    const station: Station = { type: "sauce", x: 0, y: 0, fire: OUT, sauce: "garlic", item: null };
    const held = interact(station, interact(station, bread()));
    expect(held).toMatchObject({ fillings: ["garlic"] });
  });
});

const plateOf = (food: Extract<Item, { kind: "base" }> | null = null): Item => ({ kind: "plate", plate: food === null ? EMPTY : { state: "full", food } });

describe("given a prep tray", () => {
  const tray = (): Extract<Station, { type: "tray" }> => ({ type: "tray", x: 0, y: 0, fire: OUT, item: null, veg: null, portions: 0 });

  it("takes chopped portions of one vegetable, up to TRAY_PORTIONS", () => {
    const station = tray();

    for (let i = 0; i < TRAY_PORTIONS; i++) expect(interact(station, { kind: "veg", veg: "onion", cut: CHOPPED })).toBeNull();
    const extra: Item = { kind: "veg", veg: "onion", cut: CHOPPED };
    expect(interact(station, extra)).toBe(extra);
    expect(station.portions).toBe(TRAY_PORTIONS);
  });

  it("refuses a raw vegetable and a different vegetable", () => {
    const station = tray();
    interact(station, { kind: "veg", veg: "onion", cut: CHOPPED });
    expect(interact(station, { kind: "veg", veg: "onion", cut: WHOLE })).not.toBeNull();
    expect(interact(station, { kind: "veg", veg: "tomato", cut: CHOPPED })).not.toBeNull();
    expect(station.portions).toBe(1);
  });

  it("puts one portion into the döner on a plate, and empties after the last", () => {
    const station = tray();
    interact(station, { kind: "veg", veg: "lettuce", cut: CHOPPED });
    const held = interact(station, plateOf(bread()));
    expect(held).toMatchObject({ kind: "plate", plate: { food: { fillings: ["lettuce"] } } });
    expect(station).toMatchObject({ veg: null, portions: 0 });
  });
});

describe("given plates", () => {
  it("a döner on the counter goes onto the plate the cook holds", () => {
    const station = board();
    station.item = bread();
    const held = interact(station, plateOf());
    expect(held).toMatchObject({ kind: "plate", plate: { food: { kind: "base" } } });
    expect(station.item).toBeNull();
  });

  it("the bin empties a plate but keeps it", () => {
    const bin: Station = { type: "bin", x: 0, y: 0, fire: OUT, item: null };
    expect(interact(bin, plateOf(bread()))).toEqual(plateOf());
    expect(interact(bin, { kind: "extinguisher" })).toEqual({ kind: "extinguisher" });
  });

  it("the sink washes a dirty plate after WASH_TICKS of work", () => {
    const sink: Extract<Station, { type: "sink" }> = { type: "sink", x: 0, y: 0, fire: OUT, item: null, dirty: 0, clean: 0, scrub: 0 };
    expect(interact(sink, { kind: "plate", plate: DIRTY })).toBeNull();

    for (let i = 0; i < WASH_TICKS; i++) work(sink, null);
    expect(sink).toMatchObject({ dirty: 0, clean: 1 });
    expect(interact(sink, null)).toEqual(plateOf());
  });
});

describe("given a spit left to itself", () => {
  it("catches fire, the fire spreads to its neighbours, and the extinguisher puts it out", () => {
    const spit = spitWith([1.5, 1.5, 1.5, 1.5]);
    const left: Station = { type: "counter", x: -1, y: 0, fire: OUT, item: null };
    const at = (x: number) => (x === -1 ? left : null);
    let ticks = 0;

    while (spit.fire.state === "out" && ticks < 60 * 60) {
      stepStation(spit);
      ticks += 1;
    }

    expect(spit.fire.state).toBe("burning");

    for (let i = 0; i < FIRE_SPREAD + 2; i++) {
      stepStation(spit);
      spreadFire([spit, left], at);
    }

    expect(left.fire.state).toBe("burning");
    expect(interact(left, bread())).toMatchObject({ kind: "base" });

    for (let i = 0; i < DOUSE_TICKS; i++) work(spit, { kind: "extinguisher" });
    expect(spit.fire.state).toBe("out");
    expect(spit.spit.sides.every((s) => s.state !== "burnt")).toBe(true);
  });

  it("burns the bread a forgotten toaster holds until it catches fire", () => {
    const toaster: Station = { type: "toaster", look: "grill", x: 0, y: 0, fire: OUT, item: bread() };

    for (let i = 0; i < 60 * 25; i++) stepStation(toaster);
    expect(toaster.fire.state).toBe("burning");
    expect(isBurntBase(toaster.item!)).toBe(true);
  });
});

describe("given the bakery", () => {
  const at = { x: 0, y: 0, fire: OUT };
  const flour = (): Station => ({ ...at, type: "crate", goods: "flour", item: null });
  const butter = (): Station => ({ ...at, type: "crate", goods: "butter", item: null });
  const mixer = (): Station => ({ ...at, type: "mixer", item: null });
  const oven = (): Station => ({ ...at, type: "toaster", look: "oven", item: null });
  const dough = (toast = 0, fillings: Filling[] = []): Extract<Item, { kind: "base" }> => ({ kind: "base", base: "dough", toast: toastAt("dough", toast), fillings });
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
    expect(addTo(held, { kind: "veg", veg: "lettuce", cut: CHOPPED })).toBe(false);
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
    expect(station.fire.state).toBe("out");

    for (let i = HEAT.dough.burnt; i < HEAT.dough.ignite; i++) stepStation(station);
    expect(station.fire.state).toBe("burning");
  });
});

describe("given a line of conveyor belts", () => {
  type Belt = Extract<Station, { type: "belt" }>;

  const veg = (v: "lettuce" | "tomato" | "onion"): Item => ({ kind: "veg", veg: v, cut: WHOLE });

  /** Four belts running right along row 0, listed tail first so plan order cannot carry the line along by itself. */
  function line(): Belt[] {
    return [0, 1, 2, 3].map((x) => ({ type: "belt", x, y: 0, fire: OUT, dir: { dx: 1, dy: 0 }, item: null }));
  }

  function move(belts: Belt[]): void {
    moveBelts(belts, (x, y) => belts.find((b) => b.x === x && b.y === y) ?? null);
  }

  it("moves a full line one tile together, the head first", () => {
    const belts = line();
    const [a, b, c] = [veg("lettuce"), veg("tomato"), veg("onion")];
    belts[0]!.item = a;
    belts[1]!.item = b;
    belts[2]!.item = c;
    move(belts);
    expect(belts.map((s) => s.item)).toEqual([null, a, b, c]);
  });

  it("stops each item at the end of the belt and closes the gaps behind it", () => {
    const belts = line();
    const [a, b] = [veg("lettuce"), veg("tomato")];
    belts[0]!.item = a;
    belts[2]!.item = b;

    for (let i = 0; i < 5; i++) move(belts);
    expect(belts.map((s) => s.item)).toEqual([null, null, a, b]);
  });

  it("leaves an item on a burning belt where it is", () => {
    const belts = line();
    const a = veg("onion");
    belts[1]!.item = a;
    belts[1]!.fire = ignite(OUT);
    move(belts);
    expect(belts[1]!.item).toBe(a);
  });

  it("holds and hands back an item like a counter, and takes one thrown at it", () => {
    const [belt] = line();
    expect(interact(belt!, veg("onion"))).toBeNull();
    expect(interact(belt!, null)).toMatchObject({ kind: "veg", veg: "onion" });
    expect(land(belt!, veg("tomato"))).toBe(true);
    expect(belt!.item).toMatchObject({ veg: "tomato" });
  });

  it("moves every BELT_TICKS ticks", () => {
    expect([0, 1, BELT_TICKS - 1, BELT_TICKS, BELT_TICKS * 2].map(beltsMove)).toEqual([true, false, false, true, true]);
  });
});
