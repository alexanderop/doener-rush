import { NORMAL_PACE } from "../../features/orders/public.ts";
import type { Pace, RecipeId } from "../../features/orders/public.ts";
import { seconds } from "../core/grid.ts";
import type { BridgeSchedule } from "./bridge.ts";

/** The kitchens of the campaign, in the order they unlock. */
export type LevelId = "erster-tag" | "imbiss" | "durchreiche" | "schlauch" | "grosskueche" | "backstube" | "fliessband" | "hafen" | "bedienung";

/**
 * One kitchen of the campaign: its floor plan, what customers may order there, and how busy it is on top of the
 * crew's pace (`arrival` and `patience` stretch the customers, `stars` scales the scores the stars ask for).
 *
 * Floor plan, one character per tile:
 * `.` floor · `=` counter · `S` spit · `R` toaster · `K` cutting board · `P` pass (top row, facing the street) · `X` bin ·
 * crates `B` bread, `W` wrap, `L` lettuce, `T` tomato, `O` onion ·
 * sauces `g` garlic, `h` herb, `s` spicy · `t` prep tray · `D` plate rack · `U` dirty-plate return ·
 * `N` sink · `F` counter with the fire extinguisher · `1`–`4` where the cooks start (floor) ·
 * bakery: crates `M` flour, `Y` butter · `Q` mixer · `E` oven · toppings `z` cinnamon sugar, `m` poppy, `l` lye and salt ·
 * conveyor belts `>` `<` `^` `v`, running the way they point · `~` water · `#` a bridge over the water, up and down by `bridge` ·
 * `A` a table in the dining room, numbered in reading order. A kitchen with tables seats its guests there and has no pass.
 */
export interface Level {
  readonly id: LevelId;
  readonly name: string;
  /** What is new about this kitchen, for the level card. */
  readonly note: string;
  readonly plan: readonly string[];
  readonly menu: readonly RecipeId[];
  readonly pace: Pace;
  /** How long the `#` bridges stay up and down; only a kitchen with bridges has one. */
  readonly bridge?: BridgeSchedule;
}

/** Every level, easiest first. Level n + 1 unlocks once level n has a star. */
export const LEVELS: readonly Level[] = [
  {
    id: "erster-tag",
    name: "Erster Tag",
    note: "Kleine Küche, nur Döner Pur und Classic.",
    plan: [
      "=S=R=B==P=",
      "=..1.....U",
      "K........g",
      "K..=tt=..=",
      "L........X",
      "O.3..4.2.F",
      "===D==N===",
    ],
    menu: ["pur", "classic"],
    pace: { arrival: 1.15, patience: 1.2, stars: 0.7 },
  },
  {
    id: "imbiss",
    name: "Der Imbiss",
    note: "Die ganze Karte: Dürüm und Veggie kommen dazu.",
    plan: [
      "==S=R=B=W=PP=",
      "=.....3.....U",
      "K...........g",
      "K...=ttt=...h",
      "=...=...=...s",
      "L...=====...F",
      "T.....4.....X",
      "O.1.......2.=",
      "===D=====N===",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: NORMAL_PACE,
  },
  {
    id: "durchreiche",
    name: "Durchreiche",
    note: "Eine Theke teilt die Küche. Reicht den Döner rüber, der Weg außen herum ist lang.",
    plan: [
      "==S=RBW====PP==",
      "K.....1=2.....U",
      "K......=......g",
      "L..tt..=......h",
      "T..t...=......s",
      "O......=......F",
      "X..3...=...4..X",
      "=.............=",
      "=========D==N==",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: { arrival: 1.1, patience: 1.1, stars: 0.9 },
  },
  {
    id: "schlauch",
    name: "Der Schlauch",
    note: "Lang und schmal: der Spieß steht ganz hinten, die Ausgabe ganz vorne.",
    plan: [
      "=S=R=B=W=========PP=",
      "K..1...............U",
      "K..................g",
      "L....=ttt=====.....h",
      "T..................s",
      "O..3......4....2...F",
      "========D====X==N===",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: { arrival: 1.1, patience: 1.15, stars: 0.95 },
  },
  {
    id: "grosskueche",
    name: "Großküche",
    note: "Riesig, zwei Grills, die ganze Karte und Kundschaft im Akkord.",
    plan: [
      "=S=R=B=W==PP=R===",
      "=...............U",
      "K......1........g",
      "K..=ttt===ttt=..h",
      "L...............s",
      "T...............F",
      "O..=====K====2..X",
      "=..3........4...=",
      "=...............=",
      "====D=======N====",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: { arrival: 0.8, patience: 1, stars: 0.8 },
  },
  {
    id: "backstube",
    name: "Backstube",
    note: "Frühschicht: Teig rühren, belegen, backen. Franzbrötchen, Mohnbrötchen, Brezeln.",
    plan: [
      "=M=Y=Q=E=E=PP==",
      "=.1...........U",
      "z.............=",
      "m...=====.....F",
      "l.............X",
      "=..3.....4..2.=",
      "====D=====N====",
    ],
    menu: ["franz", "mohn", "brezel"],
    pace: NORMAL_PACE,
  },
  {
    id: "fliessband",
    name: "Fließband",
    note: "Eine dicke Wand trennt Küche und Theke. Zwei Bänder fahren Döner und Teller rüber, außen herum ist es weit.",
    plan: [
      "=S=RRF====PP=ghs=",
      "B.1...===.......U",
      "W.....===.......=",
      "K.....>>>.......=",
      "K.....===.......X",
      "L.ttt.===.......=",
      "T.....<<<.......=",
      "O.3........4..2.=",
      "=X=N=D===========",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: { arrival: 1.1, patience: 1.2, stars: 0.85 },
  },
  {
    id: "hafen",
    name: "Hafenimbiss",
    note: "Ein Kanal teilt die Küche. Die Brücken gehen auf und ab: werft Brot und Gemüse übers Wasser.",
    plan: [
      "=B=W=L====S=RPP=",
      "T.1....~~...2..U",
      "O......##......g",
      "K......~~t.....h",
      "K......~~t.....s",
      "X......~~t.....F",
      "=..3...##....4.X",
      "=......~~=.....R",
      "==========D=N===",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: { arrival: 1.15, patience: 1.2, stars: 0.8 },
    bridge: { up: seconds(12), down: seconds(7) },
  },
  {
    id: "bedienung",
    name: "Mit Bedienung",
    note: "Die Gäste sitzen im Gastraum. Bringt jeden Teller an den richtigen Tisch.",
    plan: [
      "=S=R=B=W=R=========",
      "K.1.......=.......=",
      "K.........=..A..A.=",
      "L..=ttt=..=.......=",
      "T............A..A.=",
      "O.........=.......=",
      "X..===....=..A..A.=",
      "F.3.....2.=...4...=",
      "=D=N=ghs=U=========",
    ],
    menu: ["classic", "durum", "veggie", "pur"],
    pace: { arrival: 1, patience: 1.15, stars: 0.95 },
  },
];

/** The level a link without `?level=` plays: the shop the game started with. */
export const DEFAULT_LEVEL: Level = levelOf("imbiss");

/** The level with this id. */
export function levelOf(id: LevelId): Level {
  const level = LEVELS.find((l) => l.id === id);

  if (level === undefined) throw new Error(`No level ${id}`);

  return level;
}

/** True when `id` names a level. */
export function isLevelId(id: string): id is LevelId {
  return LEVELS.some((l) => l.id === id);
}

/** The level after this one, or null after the last. */
export function nextLevel(id: LevelId): Level | null {
  return LEVELS[LEVELS.findIndex((l) => l.id === id) + 1] ?? null;
}
