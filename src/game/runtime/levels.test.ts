import { describe, expect, it } from "vitest";
import type { Base, Filling } from "../../features/kitchen/public.ts";
import { RECIPES, ROUND_TICKS } from "../../features/orders/public.ts";
import { LEVELS } from "./levels.ts";
import type { Level } from "./levels.ts";
import { lineupOf } from "./lineup.ts";
import { run, snapshot } from "./step.ts";
import { newWorld } from "./world.ts";

const LEGEND = new Set("=SRKPXBWLTOghstDUNF1234.MYQEzml");

/** The plan characters a base or filling needs: where it comes from and the stations it passes through. */
const SOURCE = {
  bread: "BR",
  wrap: "W",
  dough: "MYQE",
  meat: "S",
  lettuce: "LKt",
  tomato: "TKt",
  onion: "OKt",
  garlic: "g",
  herb: "h",
  spicy: "s",
  cinnamon: "z",
  poppy: "m",
  lye: "l",
} as const satisfies Record<Base | Filling, string>;

/** Stations every kitchen needs whatever the menu: pass, plates, washing up, bin and extinguisher. */
const ALWAYS = ["P", "D", "U", "N", "X", "F"];

const isFloor = (ch: string | undefined) => ch === "." || (ch !== undefined && ch >= "1" && ch <= "4");

/** Everything that keeps a level from being playable, in words; empty when it is. */
function problems(level: Level): string[] {
  const { plan } = level;
  const found: string[] = [];
  const width = plan[0]?.length ?? 0;
  const at = (x: number, y: number) => plan[y]?.[x];
  const tiles = plan.flatMap((row, y) => [...row].map((ch, x) => ({ ch, x, y })));
  const recipes = RECIPES.filter((r) => level.menu.includes(r.id));

  if (plan.some((row) => row.length !== width)) found.push("rows differ in length");

  for (const { ch, x, y } of tiles) {
    if (!LEGEND.has(ch)) found.push(`unknown tile ${ch} at ${x},${y}`);

    if (isFloor(ch) && (x === 0 || y === 0 || x === width - 1 || y === plan.length - 1)) found.push(`floor on the edge at ${x},${y}`);

    if (ch === "P" && y !== 0) found.push(`pass at ${x},${y} is not on the street side`);
  }

  for (const start of ["1", "2", "3", "4"]) {
    const count = tiles.filter((t) => t.ch === start).length;

    if (count !== 1) found.push(`start ${start} appears ${count} times`);
  }

  if (recipes.length !== level.menu.length || recipes.length === 0) found.push("menu names unknown recipes or none");
  const needed = new Set([...ALWAYS, ...recipes.flatMap((r) => [r.base, ...r.fillings].flatMap((part) => [...SOURCE[part]]))]);

  for (const ch of needed) {
    if (!tiles.some((t) => t.ch === ch)) found.push(`no ${ch} for the menu`);
  }

  const start = tiles.find((t) => t.ch === "1");
  const reached = new Set<string>();
  const queue = start === undefined ? [] : [start];

  while (queue.length > 0) {
    const tile = queue.shift();

    if (tile === undefined || reached.has(`${tile.x},${tile.y}`)) continue;
    reached.add(`${tile.x},${tile.y}`);

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (isFloor(at(tile.x + dx, tile.y + dy))) queue.push({ ch: ".", x: tile.x + dx, y: tile.y + dy });
    }
  }

  for (const { ch, x, y } of tiles) {
    if (ch >= "2" && ch <= "4" && !reached.has(`${x},${y}`)) found.push(`start ${ch} cannot reach start 1`);
    const reachable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx = 0, dy = 0]) => reached.has(`${x + dx},${y + dy}`));

    if (!isFloor(ch) && ch !== "=" && !reachable) found.push(`${ch} at ${x},${y} has no floor a cook can reach next to it`);
  }

  return found;
}

describe("given the campaign's kitchens", () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))("%s is playable: every station the menu needs, reachable, four starts", (_id, level) => {
    expect(problems(level)).toEqual([]);
  });

  it("catches a kitchen with a station walled off and a missing crate", () => {
    const broken: Level = { ...LEVELS[0]!, plan: ["==S=R=P=", "=1.2.=XU", "=3.4.=gF", "K.....==", "==D==N==", "========"], menu: ["pur", "classic"] };
    expect(problems(broken)).toEqual(expect.arrayContaining(["no B for the menu", "X at 6,1 has no floor a cook can reach next to it"]));
  });
});

describe("given two bots alone in each kitchen", () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))("%s: they score in a full shift, and customers only order from its menu", (_id, level) => {
    const world = newWorld(1, ROUND_TICKS, lineupOf(0, 2), level);
    const ordered = new Set<string>();

    for (let t = 0; t < ROUND_TICKS; t++) {
      run(world, 1);

      for (const order of world.orders.queue) ordered.add(order.recipe.id);
    }

    expect(snapshot(world).orders.score).toBeGreaterThan(0);
    expect([...ordered].every((id) => level.menu.some((m) => m === id))).toBe(true);
  });
});
