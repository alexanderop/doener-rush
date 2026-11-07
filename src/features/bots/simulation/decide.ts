import { seconds } from "../../../game/core/grid.ts";
import type { Tile } from "../../../game/core/grid.ts";
import type { Cook } from "../../cooks/public.ts";
import { BURNT, HEAT, TRAY_PORTIONS, isBaked, isBurntBase, isChopped } from "../../kitchen/public.ts";
import type { Filling, Item, Station, Veg } from "../../kitchen/public.ts";
import type { Order, Recipe } from "../../orders/public.ts";
import type { BotMind, Plan, Sight, Step } from "../model.ts";
import { stepsFrom } from "./path.ts";

type Doener = Extract<Item, { kind: "base" }>;

/** Everything one decision reads: the view, the bot, and where it can walk to. */
interface Ctx {
  readonly sight: Sight;
  readonly me: Cook;
  /** The order this bot still builds for, if its customer is still waiting. */
  readonly order: Order | null;
  /** Walking distance in tiles from the bot to stand next to each reachable station. */
  readonly reach: Map<Station, number>;
}

/** One row of the priority table: a plan when the situation applies, null to ask the next row. */
type Rule = (ctx: Ctx) => Plan | null;

/** The order fillings go in: meat at the spit first, then the trays, then the sauces by the pass. */
const FILL_ORDER: readonly Filling[] = ["meat", "lettuce", "tomato", "onion", "garlic", "herb", "spicy"];

const VEGS: readonly Veg[] = ["lettuce", "tomato", "onion"];

/** Ticks before bread burns at which a free bot takes it out of the toaster. */
const SAVE_TOAST = seconds(4);

/** Plates on the rack below which a free bot washes up before starting a new order. */
const LOW_PLATES = 2;

/**
 * The bot's next plan: the first row of the priority table that applies. A pure function of
 * what the bot sees and holds, asked again every tick, so a human taking the bread or putting
 * out the fire just changes the answer.
 */
export function decide(sight: Sight, me: Cook, mind: BotMind): Plan {
  const order = sight.orders.find((o) => o.id === mind.order) ?? null;
  const ctx: Ctx = { sight, me, order, reach: reachOf(sight, me) };

  for (const rule of RULES) {
    const plan = rule(ctx);

    if (plan !== null) return plan;
  }

  return { order: order?.id ?? null, task: null, step: null };
}

function reachOf(sight: Sight, me: Cook): Map<Station, number> {
  const from = { x: Math.floor(me.x), y: Math.floor(me.y) };
  const steps = stepsFrom(sight.width, sight.height, sight.solid, from);
  const reach = new Map<Station, number>();

  for (const s of sight.stations) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const d = steps.get((s.y + dy) * sight.width + s.x + dx);

      if (d !== undefined && d < (reach.get(s) ?? Infinity)) reach.set(s, d);
    }
  }

  return reach;
}

function claimedByOther(ctx: Ctx, task: string): boolean {
  const owner = ctx.sight.claims.get(task);

  return owner !== undefined && owner !== ctx.me.id;
}

/** The nearest reachable, not burning station that passes `match`. */
function nearest(ctx: Ctx, match: (s: Station) => boolean): Station | null {
  let best: Station | null = null;
  let bestDist = Infinity;

  for (const s of ctx.sight.stations) {
    const d = ctx.reach.get(s);

    if (d !== undefined && d < bestDist && s.fire === 0 && match(s)) {
      best = s;
      bestDist = d;
    }
  }

  return best;
}

function at(s: Station): Tile {
  return { x: s.x, y: s.y };
}

function plan(ctx: Ctx, task: string | null, step: Step, order: number | null = ctx.order?.id ?? null): Plan {
  return { order, task, step };
}

function press(s: Station): Step {
  return { kind: "interact", at: at(s) };
}

/** The döner an item is or carries. */
function doenerIn(item: Item | null): Doener | null {
  if (item?.kind === "base") return item;

  if (item?.kind === "plate") return item.food;

  return null;
}

/** True when the döner can still become `recipe`: same bread, nothing extra, not burnt. */
function fits(doener: Doener, recipe: Recipe): boolean {
  return doener.base === recipe.base && !isBurntBase(doener) && doener.fillings.every((f) => recipe.fillings.includes(f));
}

function missing(doener: Doener, recipe: Recipe): Filling[] {
  return FILL_ORDER.filter((f) => recipe.fillings.includes(f) && !doener.fillings.includes(f));
}

/** A tray a döner can take a portion of `veg` from. */
function hasVeg(s: Station, veg: Veg): boolean {
  return s.type === "tray" && s.veg === veg && s.portions > 0;
}

/** Every vegetable in `fillings` is in a tray now. */
function vegReady(ctx: Ctx, fillings: readonly Filling[]): boolean {
  return VEGS.every((v) => !fillings.includes(v) || ctx.sight.stations.some((s) => hasVeg(s, v)));
}

/** The order a döner should go to: this bot's own, else the oldest nobody else builds for. */
function orderFor(ctx: Ctx, doener: Doener): Order | null {
  if (ctx.order !== null && fits(doener, ctx.order.recipe)) return ctx.order;

  return ctx.sight.orders.find((o) => fits(doener, o.recipe) && !claimedByOther(ctx, `order:${o.id}`)) ?? null;
}

function freeCounter(ctx: Ctx): Station | null {
  return nearest(ctx, (s) => s.type === "counter" && s.item === null);
}

function toaster(ctx: Ctx): Station | null {
  return ctx.sight.stations.find((s) => s.type === "toaster") ?? null;
}

/** Puts what the bot holds on the nearest free counter, to come back for it. */
function park(ctx: Ctx, task: string | null, order: number | null = ctx.order?.id ?? null): Plan | null {
  const counter = freeCounter(ctx);

  return counter === null ? null : plan(ctx, task, press(counter), order);
}

/** Where a clean plate comes from: the rack, or the sink's clean stack. */
function plateSource(ctx: Ctx): Station | null {
  return nearest(ctx, (s) => (s.type === "rack" && s.plates > 0) || (s.type === "sink" && s.clean > 0));
}

/** A station burns: one bot drops what it holds, takes the extinguisher and sprays. */
const fight: Rule = (ctx) => {
  const burning = ctx.sight.stations.filter((s) => s.fire > 0 && ctx.reach.has(s));

  if (burning.length === 0 || claimedByOther(ctx, "fire")) return null;
  const held = ctx.me.held;

  if (held?.kind === "extinguisher") {
    const target = burning.reduce((a, b) => ((ctx.reach.get(a) ?? 0) <= (ctx.reach.get(b) ?? 0) ? a : b));

    return plan(ctx, "fire", { kind: "work", at: at(target) });
  }

  const extinguisher = nearest(ctx, (s) => s.item?.kind === "extinguisher");

  if (extinguisher === null) return null;

  if (held !== null) return park(ctx, "fire");

  return plan(ctx, "fire", press(extinguisher));
};

/** Holding something nobody can use: loose meat, burnt or unwanted food, untoasted bread on a plate, the extinguisher after a fire. */
const discard: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind === "extinguisher") return park(ctx, null);
  const doener = doenerIn(held);
  const junk = held?.kind === "meat" || (doener !== null && (!anyFits(ctx, doener) || (held?.kind === "plate" && !isBaked(doener))));

  if (!junk) return null;

  // plain bread nobody ordered yet keeps for the next customer and for tending the spit
  if (held?.kind === "base" && isBare(held)) return park(ctx, null);
  const bin = nearest(ctx, (s) => s.type === "bin");

  return bin === null ? null : plan(ctx, null, press(bin));
};

function isBare(doener: Doener): boolean {
  return doener.fillings.length === 0 && !isBurntBase(doener);
}

function anyFits(ctx: Ctx, doener: Doener): boolean {
  return ctx.sight.orders.some((o) => fits(doener, o.recipe));
}

/** Holding a döner: toast it, fill it in a fixed order, plate it, hand it over. */
const build: Rule = (ctx) => {
  const held = ctx.me.held;
  const doener = doenerIn(held);

  if (held === null || doener === null) return null;
  const order = orderFor(ctx, doener);
  const recipe = order?.recipe ?? ctx.sight.orders.find((o) => fits(doener, o.recipe))?.recipe;

  if (recipe === undefined) return null;
  const task = order === null ? null : `order:${order.id}`;
  const claim = order?.id ?? null;

  if (!isBaked(doener)) {
    const grill = toaster(ctx);

    if (grill !== null && grill.item === null && grill.fire === 0 && held.kind === "base") return plan(ctx, task, press(grill), claim);

    return park(ctx, task, claim) ?? waitAt(ctx, grill, task, claim);
  }

  const next = missing(doener, recipe)[0];

  if (next === undefined) {
    if (held.kind === "plate") {
      const pass = nearest(ctx, (s) => s.type === "pass");

      return pass === null ? null : plan(ctx, task, press(pass), claim);
    }

    return park(ctx, task, claim);
  }

  if (next === "meat") {
    const spit = nearest(ctx, (s) => s.type === "spit");

    return spit === null ? park(ctx, task, claim) : plan(ctx, task, { kind: "work", at: at(spit) }, claim);
  }

  if (next === "lettuce" || next === "tomato" || next === "onion") {
    const source = nearest(ctx, (s) => hasVeg(s, next));

    return source === null ? park(ctx, task, claim) : plan(ctx, task, press(source), claim);
  }

  const bottle = nearest(ctx, (s) => s.type === "sauce" && s.sauce === next);

  return bottle === null ? park(ctx, task, claim) : plan(ctx, task, press(bottle), claim);
};

function waitAt(ctx: Ctx, station: Station | null, task: string | null, order: number | null): Plan | null {
  return station === null ? null : plan(ctx, task, { kind: "wait", at: at(station) }, order);
}

/** A döner for `recipe` lying on a counter or in the toaster; with `ready`, only one whose missing vegetables are in the trays. */
function waiting(ctx: Ctx, recipe: Recipe, ready = true): Station | null {
  return nearest(ctx, (s) => {
    if (s.type !== "counter" && s.type !== "toaster") return false;
    const doener = doenerIn(s.item);

    // toast comes out when it is done, vegetables or not, before it burns
    return doener !== null && fits(doener, recipe) && (!ready || s.type === "toaster" || vegReady(ctx, missing(doener, recipe)));
  });
}

/** Holding a clean empty plate: put the waiting döner on it, or take the plate back. */
const plateUp: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind !== "plate" || held.dirty || held.food !== null) return null;
  const task = ctx.order === null ? null : `order:${ctx.order.id}`;
  const recipes = ctx.order === null ? ctx.sight.orders.map((o) => o.recipe) : [ctx.order.recipe];

  for (const recipe of recipes) {
    const spot = waiting(ctx, recipe);
    const doener = doenerIn(spot?.item ?? null);

    if (spot === null || doener === null) continue;

    if (isBaked(doener)) return plan(ctx, task, press(spot));

    if (spot.type === "toaster") return plan(ctx, task, { kind: "wait", at: at(spot) });
  }

  const rack = nearest(ctx, (s) => s.type === "rack");

  return rack === null ? park(ctx, null) : plan(ctx, null, press(rack));
};

/** Dirty plates go into the sink. */
const scrape: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind !== "plate" || !held.dirty) return null;
  const sink = nearest(ctx, (s) => s.type === "sink");

  return sink === null ? null : plan(ctx, "dishes", press(sink), ctx.order?.id ?? null);
};

/** Vegetables: raw ones onto a free board, chopped ones into a tray that takes them. */
const prep: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind !== "veg") return null;
  const task = `stock:${held.veg}`;

  if (!isChopped(held)) {
    const board = nearest(ctx, (s) => s.type === "board" && s.item === null);

    return board === null ? park(ctx, task) : plan(ctx, task, press(board));
  }

  const tray = trayFor(ctx, held.veg);

  if (tray !== null) return plan(ctx, task, press(tray));
  const bin = nearest(ctx, (s) => s.type === "bin");

  return bin === null ? null : plan(ctx, null, press(bin));
};

/** The tray a chopped vegetable goes in: one already holding it, or an empty one if none does. */
function trayFor(ctx: Ctx, veg: Veg): Station | null {
  const same = nearest(ctx, (s) => s.type === "tray" && s.veg === veg && s.portions < TRAY_PORTIONS);

  if (same !== null) return same;

  if (ctx.sight.stations.some((s) => s.type === "tray" && s.veg === veg)) return null;

  return nearest(ctx, (s) => s.type === "tray" && s.veg === null);
}

/**
 * A spit side has burnt. Shaving it while holding a döner throws the burnt meat away and adds
 * nothing (the burnt side is always the one taken), so the bot tends the spit with whatever
 * döner it carries, or takes a fresh base first, and never walks burnt meat to the bin.
 */
const tend: Rule = (ctx) => {
  const spit = nearest(ctx, (s) => s.type === "spit" && s.spit.sides.some((level) => level >= BURNT));
  const held = ctx.me.held;

  if (spit === null || claimedByOther(ctx, "spit")) return null;

  if (doenerIn(held) !== null) return plan(ctx, "spit", { kind: "work", at: at(spit) });

  if (held !== null) return null;
  const spare = nearest(ctx, (s) => s.type === "counter" && s.item?.kind === "base" && isBare(s.item));

  if (spare !== null) return plan(ctx, "spit", press(spare));
  const next = ctx.order ?? ctx.sight.orders.find((o) => !claimedByOther(ctx, `order:${o.id}`));
  const base = next?.recipe.base ?? "bread";
  const crate = nearest(ctx, (s) => s.type === "crate" && s.goods === base);

  return crate === null ? null : plan(ctx, "spit", press(crate));
};

/** Bread left in the toaster comes out before it burns, or once burnt before it catches fire. */
const rescue: Rule = (ctx) => {
  const grill = toaster(ctx);
  const bread = doenerIn(grill?.item ?? null);

  if (ctx.me.held !== null || grill === null || bread === null || bread.toast < HEAT[bread.base].burnt - SAVE_TOAST || claimedByOther(ctx, "toaster")) return null;

  return plan(ctx, "toaster", press(grill));
};

/** Chopping in progress: keep at a board with a raw vegetable, take a chopped one to the trays. */
const chop: Rule = (ctx) => {
  if (ctx.me.held !== null) return null;

  for (const s of ctx.sight.stations) {
    if (s.type !== "board" || s.item?.kind !== "veg" || !ctx.reach.has(s) || s.fire > 0) continue;
    const task = `board:${s.x},${s.y}`;

    if (claimedByOther(ctx, task)) continue;

    if (!isChopped(s.item)) return plan(ctx, task, { kind: "work", at: at(s) });

    if (trayFor(ctx, s.item.veg) !== null) return plan(ctx, task, press(s));
  }

  return null;
};

/** Carry on with the bot's own order: a döner waiting for it, a plate for toast, or a new base. */
const resume: Rule = (ctx) => {
  if (ctx.me.held !== null || ctx.order === null) return null;
  const task = `order:${ctx.order.id}`;
  const next = carryOn(ctx, ctx.order, task);

  // its döner is parked waiting for vegetables: no second one
  if (next !== null || waiting(ctx, ctx.order.recipe, false) !== null) return next;

  return start(ctx, ctx.order, task);
};

function carryOn(ctx: Ctx, order: Order, task: string): Plan | null {
  const spot = waiting(ctx, order.recipe);
  const doener = doenerIn(spot?.item ?? null);

  if (spot === null || doener === null) return null;

  if (spot.item?.kind === "plate") return plan(ctx, task, press(spot), order.id);

  const grill = toaster(ctx);

  if (!isBaked(doener)) {
    // parked raw bread waits until the toaster is free
    if (spot.type === "counter" && grill !== null && grill.item === null) return plan(ctx, task, press(spot), order.id);

    if (spot.type === "counter") return null;
  }

  const plates = plateSource(ctx);

  if (plates !== null) return plan(ctx, task, press(plates), order.id);

  // no clean plate anywhere: fill it now and plate it later
  if (isBaked(doener) && missing(doener, order.recipe).length > 0) return plan(ctx, task, press(spot), order.id);

  return null;
}

function start(ctx: Ctx, order: Order, task: string): Plan | null {
  const base = order.recipe.base;

  if (base === "bread" && !toasterFree(ctx)) return null;
  const crate = nearest(ctx, (s) => s.type === "crate" && s.goods === base);

  return crate === null ? null : plan(ctx, task, press(crate), order.id);
}

/** No bread in the toaster or in another bot's hands on its way there. A person may hold bread as long as they like. */
function toasterFree(ctx: Ctx): boolean {
  const grill = toaster(ctx);

  if (grill === null || grill.item !== null || grill.fire > 0) return false;

  return !ctx.sight.cooks.some((c) => ctx.sight.bots.has(c.id) && c.held?.kind === "base" && !isBaked(c.held));
}

/** Washing up: clean plates to the rack, dirty ones scrubbed, the return hatch emptied. */
function dishes(ctx: Ctx): Plan | null {
  if (ctx.me.held !== null || claimedByOther(ctx, "dishes")) return null;
  const sink = nearest(ctx, (s) => s.type === "sink");

  if (sink?.type !== "sink") return null;

  if (sink.dirty > 0) return plan(ctx, "dishes", { kind: "work", at: at(sink) });
  const hatch = nearest(ctx, (s) => s.type === "return" && s.plates > 0);

  if (hatch !== null) return plan(ctx, "dishes", press(hatch));

  if (sink.clean > 0) return plan(ctx, "dishes", press(sink));

  return null;
}

function rackPlates(ctx: Ctx): number {
  return ctx.sight.stations.reduce((n, s) => n + (s.type === "rack" ? s.plates : 0), 0);
}

/** No clean plate left: wash before anything new is started. */
const washUrgent: Rule = (ctx) => (rackPlates(ctx) === 0 ? dishes(ctx) : null);

/** A vegetable some waiting customer needs is in no tray: fetch, chop and stock it. */
const stockNeeded: Rule = (ctx) => {
  const needed = VEGS.filter((v) => ctx.sight.orders.some((o) => o.recipe.fillings.includes(v)));

  return stock(ctx, needed.filter((v) => !vegReady(ctx, [v])));
};

function stock(ctx: Ctx, vegs: readonly Veg[]): Plan | null {
  if (ctx.me.held !== null) return null;

  for (const veg of vegs) {
    const task = `stock:${veg}`;

    if (claimedByOther(ctx, task) || trayFor(ctx, veg) === null) continue;

    if (!ctx.sight.stations.some((s) => s.type === "board" && s.item === null)) return null;
    const crate = nearest(ctx, (s) => s.type === "crate" && s.goods === veg);

    if (crate !== null) return plan(ctx, task, press(crate));
  }

  return null;
}

/** Claim the oldest order nobody builds for and whose vegetables are ready. */
const claim: Rule = (ctx) => {
  if (ctx.me.held !== null || ctx.order !== null) return null;

  for (const order of ctx.sight.orders) {
    const task = `order:${order.id}`;

    if (claimedByOther(ctx, task) || !vegReady(ctx, order.recipe.fillings)) continue;
    const next = carryOn(ctx, order, task) ?? start(ctx, order, task);

    if (next !== null) return next;
  }

  return null;
};

/** Plates running low: wash before they run out. */
const washSoon: Rule = (ctx) => (rackPlates(ctx) < LOW_PLATES ? dishes(ctx) : null);

/** Nothing urgent: top the trays up for the next customers. */
const topUp: Rule = (ctx) => {
  const low = VEGS.filter((v) => {
    const tray = ctx.sight.stations.find((s) => s.type === "tray" && s.veg === v);

    return tray?.type !== "tray" || tray.portions < TRAY_PORTIONS;
  });

  return stock(ctx, low);
};

/** The priority table: the first row that has a plan wins. */
const RULES: readonly Rule[] = [
  fight, tend, discard, build, plateUp, scrape, prep, rescue, chop, resume, washUrgent, stockNeeded, claim, washSoon, topUp, dishes,
];
