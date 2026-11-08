import { seconds } from "../../../game/core/grid.ts";
import type { Tile } from "../../../game/core/grid.ts";
import type { Cook } from "../../cooks/public.ts";
import { DRY, FAMILY, HEAT, TRAY_PORTIONS, accepts, foodOn, heatTicks, isBaked, isBurning, isBurntBase, isChopped } from "../../kitchen/public.ts";
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

/** The order fillings go in: meat at the spit first, then the trays, then the sauces by the pass; a pastry's one topping. */
const FILL_ORDER: readonly Filling[] = ["meat", "lettuce", "tomato", "onion", "garlic", "herb", "spicy", "cinnamon", "poppy", "lye"];

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

    if (d !== undefined && d < bestDist && !isBurning(s.fire) && match(s)) {
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

  if (item?.kind === "plate") return foodOn(item.plate);

  return null;
}

/** True when the dish can still become `recipe`: same base, nothing extra, not burnt, and what is missing still goes in. */
function fits(doener: Doener, recipe: Recipe): boolean {
  if (doener.base !== recipe.base || isBurntBase(doener) || !doener.fillings.every((f) => recipe.fillings.includes(f))) return false;

  return missing(doener, recipe).every((f) => accepts(doener, f));
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

/** The nearest grill or oven with nothing on it. */
function freeHeater(ctx: Ctx): Station | null {
  return nearest(ctx, (s) => s.type === "toaster" && s.item === null);
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
  const burning = ctx.sight.stations.filter((s) => isBurning(s.fire) && ctx.reach.has(s));

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

/** A base with nothing in it yet that can still take its fillings: plain bread, raw dough. */
function isBare(doener: Doener): boolean {
  return doener.fillings.length === 0 && FILL_ORDER.some((f) => accepts(doener, f));
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
  const next = missing(doener, recipe)[0];

  // bread is toasted before it is filled; a pastry gets its topping first, then bakes
  if (!isBaked(doener) && (FAMILY[doener.base] !== "pastry" || next === undefined)) {
    const heater = freeHeater(ctx);

    if (heater !== null && held.kind === "base") return plan(ctx, task, press(heater), claim);

    return park(ctx, task, claim) ?? waitAt(ctx, nearest(ctx, (s) => s.type === "toaster"), task, claim);
  }

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

/** How far along a dish waiting on a station is: plated, baked, on the heat, or raw; then by what is in it. */
function stage(s: Station, dish: Doener): number {
  let step = 0;

  if (s.item?.kind === "plate") step = 3;
  else if (isBaked(dish)) step = 2;
  else if (s.type === "toaster") step = 1;

  return step * 10 + dish.fillings.length;
}

/**
 * A dish for `recipe` on a counter, on the heat or fresh from the mixer, the furthest along first and the nearest
 * of those; with `ready`, only one whose missing vegetables are in the trays.
 */
function waiting(ctx: Ctx, recipe: Recipe, ready = true): Station | null {
  let best: Station | null = null;
  let bestRank = -Infinity;

  for (const s of ctx.sight.stations) {
    if (s.type !== "counter" && s.type !== "toaster" && s.type !== "mixer") continue;
    const doener = doenerIn(s.item);
    const dist = ctx.reach.get(s);

    if (doener === null || dist === undefined || isBurning(s.fire) || !fits(doener, recipe)) continue;

    // toast comes out when it is done, vegetables or not, before it burns
    if (ready && s.type !== "toaster" && !vegReady(ctx, missing(doener, recipe))) continue;
    const rank = stage(s, doener) * 1000 - dist;

    if (rank > bestRank) {
      best = s;
      bestRank = rank;
    }
  }

  return best;
}

/** Holding a clean empty plate: put the waiting döner on it, or take the plate back. */
const plateUp: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind !== "plate" || held.plate.state !== "empty") return null;
  const task = ctx.order === null ? null : `order:${ctx.order.id}`;
  const recipes = ctx.order === null ? ctx.sight.orders.map((o) => o.recipe) : [ctx.order.recipe];

  for (const recipe of recipes) {
    const spot = waiting(ctx, recipe);
    const doener = doenerIn(spot?.item ?? null);

    if (spot === null || doener === null || spot.item?.kind === "plate") continue;

    if (isBaked(doener)) return plan(ctx, task, press(spot));

    if (spot.type === "toaster") return plan(ctx, task, { kind: "wait", at: at(spot) });
  }

  const rack = nearest(ctx, (s) => s.type === "rack");

  return rack === null ? park(ctx, null) : plan(ctx, null, press(rack));
};

/** Dirty plates go into the sink. */
const scrape: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind !== "plate" || held.plate.state !== "dirty") return null;
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
  const spit = nearest(ctx, (s) => s.type === "spit" && s.spit.sides.some((side) => side.state === "burnt"));
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

/** Food left on any grill or in any oven comes out before it burns, or once burnt before it catches fire. */
const rescue: Rule = (ctx) => {
  if (ctx.me.held !== null) return null;

  for (const s of ctx.sight.stations) {
    const food = s.type === "toaster" && !isBurning(s.fire) && ctx.reach.has(s) ? doenerIn(s.item) : null;
    const task = `heat:${s.x},${s.y}`;

    if (food !== null && heatTicks(food.toast) >= HEAT[food.base].burnt - SAVE_TOAST && !claimedByOther(ctx, task)) return plan(ctx, task, press(s));
  }

  return null;
};

/** Chopping in progress: keep at a board with a raw vegetable, take a chopped one to the trays. */
const chop: Rule = (ctx) => {
  if (ctx.me.held !== null) return null;

  for (const s of ctx.sight.stations) {
    if (s.type !== "board" || s.item?.kind !== "veg" || !ctx.reach.has(s) || isBurning(s.fire)) continue;
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

  if (!isBaked(doener) && spot.type !== "toaster") {
    // raw dough is picked up for its topping; parked raw food waits until a grill or oven is free
    const topping = FAMILY[doener.base] === "pastry" && missing(doener, order.recipe).length > 0;

    return topping || freeHeater(ctx) !== null ? plan(ctx, task, press(spot), order.id) : null;
  }

  const plates = plateSource(ctx);

  if (plates !== null) return plan(ctx, task, press(plates), order.id);

  // no clean plate anywhere: fill it now and plate it later
  if (isBaked(doener) && missing(doener, order.recipe).length > 0) return plan(ctx, task, press(spot), order.id);

  return null;
}

function start(ctx: Ctx, order: Order, task: string): Plan | null {
  const base = order.recipe.base;

  if (base === "dough") return startDough(ctx, order);

  if (base === "bread" && !heaterFree(ctx)) return null;
  const crate = nearest(ctx, (s) => s.type === "crate" && s.goods === base);

  return crate === null ? null : plan(ctx, task, press(crate), order.id);
}

/**
 * More grills or ovens stand empty than bots carry raw food to them. A person may hold bread as long as they
 * like.
 */
function heaterFree(ctx: Ctx): boolean {
  const free = ctx.sight.stations.filter((s) => s.type === "toaster" && s.item === null && !isBurning(s.fire) && ctx.reach.has(s)).length;
  const coming = ctx.sight.cooks.filter((c) => ctx.sight.bots.has(c.id) && c.held?.kind === "base" && !isBaked(c.held)).length;

  return free > coming;
}

/** Dough has no crate: wait at a mixer that kneads a bowl nobody else waits for, or fill a bowl for an empty one. */
function startDough(ctx: Ctx, order: Order): Plan | null {
  const kneading = nearest(ctx, (s) => s.type === "mixer" && s.item?.kind === "bowl" && !claimedByOther(ctx, `knead:${s.x},${s.y}`));

  if (kneading !== null) return plan(ctx, `knead:${kneading.x},${kneading.y}`, { kind: "wait", at: at(kneading) }, order.id);

  return feedMixer(ctx, order.id);
}

/** Toward a bowl for an empty mixer: a bowl left on a counter, else a fresh one from a dry-goods crate. One bot at a time. */
function feedMixer(ctx: Ctx, order: number | null): Plan | null {
  if (claimedByOther(ctx, "mixer") || nearest(ctx, (s) => s.type === "mixer" && s.item === null) === null) return null;
  const bowl = nearest(ctx, (s) => s.type === "counter" && s.item?.kind === "bowl");

  if (bowl !== null) return plan(ctx, "mixer", press(bowl), order);
  const crate = nearest(ctx, (s) => s.type === "crate" && DRY.some((d) => d === s.goods));

  return crate === null ? null : plan(ctx, "mixer", press(crate), order);
}

/** Holding a bowl: pour in what it still lacks, then into an empty mixer; with every mixer busy, put it down. */
const mix: Rule = (ctx) => {
  const held = ctx.me.held;

  if (held?.kind !== "bowl") return null;
  const lacking = DRY.find((d) => !held.contents.includes(d));

  const target = lacking === undefined
    ? nearest(ctx, (s) => s.type === "mixer" && s.item === null)
    : nearest(ctx, (s) => s.type === "crate" && s.goods === lacking);

  return target === null ? park(ctx, null) : plan(ctx, "mixer", press(target));
};

/** Pastry customers outnumber the bowls and the dough that could still become their pastries. */
function doughShort(ctx: Ctx): boolean {
  const wanted = ctx.sight.orders.filter((o) => o.recipe.base === "dough").length;
  const items = [...ctx.sight.stations.map((s) => s.item), ...ctx.sight.cooks.map((c) => c.held)];

  const supply = items.filter((item) => {
    const dish = doenerIn(item);

    return item?.kind === "bowl" || (dish?.base === "dough" && anyFits(ctx, dish));
  }).length;

  return wanted > supply;
}

/** An empty mixer and a bowl left on a counter, or too little dough for the pastry customers: start the next bowl. */
const knead: Rule = (ctx) => {
  if (ctx.me.held !== null) return null;
  const left = ctx.sight.stations.some((s) => s.type === "counter" && s.item?.kind === "bowl");

  return left || doughShort(ctx) ? feedMixer(ctx, ctx.order?.id ?? null) : null;
};

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
  fight, tend, discard, build, mix, plateUp, scrape, prep, rescue, chop, resume, washUrgent, stockNeeded, knead, claim, washSoon, topUp,
  dishes,
];
