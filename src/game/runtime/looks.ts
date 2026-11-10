/**
 * How the cooks look: a table of chefs, people and animals in turn, each a body colour, skin
 * or fur, hair, something on the head and maybe a moustache or glasses. Players pick theirs on the home page; every other cook
 * takes the next free look, so no two cooks in a shift look alike. Pure data: the 3D models
 * that draw a look live in `gl/models.ts`.
 */
import type { Driver } from "./lineup.ts";

/** What a cook wears on the head; hair styles count too. */
export type Headwear = "toque" | "cap" | "bandana" | "beanie" | "paperhat" | "ponytail" | "bun" | "minitoque" | "none";

/** The animals a cook or a guest can be. */
export type Animal = "cat" | "bear" | "bunny" | "fox" | "frog" | "panda" | "penguin" | "duck";

/** What kind of creature wears a look: it decides ears, muzzle or beak, and tail. */
export type Species = "human" | Animal;

/** Something on the face besides eyes and nose. */
export type Accessory = "none" | "moustache" | "glasses";

/**
 * One chef look. `body` is the cook's colour everywhere: jacket, hat trim, name tag, key help.
 * An animal's `skin` is its fur or feathers and its `hair` the second colour: muzzle, inner ears, beak.
 */
export interface Look {
  readonly id: string;
  readonly name: string;
  readonly species: Species;
  readonly body: string;
  readonly skin: string;
  readonly hair: string;
  readonly headwear: Headwear;
  readonly accessory: Accessory;
}

/** Every look, in the order bots take them. */
export const LOOKS = [
  { id: "mehmet", name: "Mehmet", species: "human", body: "#e94f37", skin: "#d9a57a", hair: "#2b1a10", headwear: "toque", accessory: "moustache" },
  { id: "mimi", name: "Mimi", species: "cat", body: "#ff5d8f", skin: "#f2a65a", hair: "#fff4e6", headwear: "minitoque", accessory: "none" },
  { id: "lena", name: "Lena", species: "human", body: "#3f88c5", skin: "#f3c79e", hair: "#a0522d", headwear: "cap", accessory: "none" },
  { id: "bruno", name: "Bruno", species: "bear", body: "#3558a8", skin: "#9a6a42", hair: "#e8cba6", headwear: "minitoque", accessory: "none" },
  { id: "can", name: "Can", species: "human", body: "#44bba4", skin: "#a8714c", hair: "#1d1d1d", headwear: "bandana", accessory: "none" },
  { id: "hoppel", name: "Hoppel", species: "bunny", body: "#7ec8e3", skin: "#f4f0ea", hair: "#f6b0c0", headwear: "none", accessory: "none" },
  { id: "jule", name: "Jule", species: "human", body: "#f6ae2d", skin: "#f6d3b5", hair: "#e8c547", headwear: "beanie", accessory: "glasses" },
  { id: "finn", name: "Finn", species: "fox", body: "#2f8f5b", skin: "#e8762c", hair: "#fff4e6", headwear: "minitoque", accessory: "none" },
  { id: "elif", name: "Elif", species: "human", body: "#ef7fb0", skin: "#d9a57a", hair: "#2b1a10", headwear: "ponytail", accessory: "none" },
  { id: "quaki", name: "Quaki", species: "frog", body: "#f2d22e", skin: "#6cc24a", hair: "#d8f0a0", headwear: "none", accessory: "none" },
  { id: "hans", name: "Hans", species: "human", body: "#6cbf4a", skin: "#f3c79e", hair: "#c0c4c8", headwear: "paperhat", accessory: "glasses" },
  { id: "bao", name: "Bao", species: "panda", body: "#b5179e", skin: "#f7f5f0", hair: "#22222a", headwear: "minitoque", accessory: "none" },
  { id: "gerda", name: "Oma Gerda", species: "human", body: "#a77bd9", skin: "#f6d3b5", hair: "#e4e4e4", headwear: "bun", accessory: "glasses" },
  { id: "fiete", name: "Fiete", species: "penguin", body: "#16a3b8", skin: "#2d3348", hair: "#f7f5f0", headwear: "minitoque", accessory: "none" },
  { id: "deniz", name: "Deniz", species: "human", body: "#ff8c42", skin: "#a8714c", hair: "#1d1d1d", headwear: "cap", accessory: "moustache" },
  { id: "erna", name: "Erna", species: "duck", body: "#c0392b", skin: "#ffd84a", hair: "#f08a24", headwear: "none", accessory: "none" },
] as const satisfies readonly Look[];

/** The name of a look in links and the save. */
export type LookId = (typeof LOOKS)[number]["id"];

/** Every look id, in table order. */
export const LOOK_IDS: readonly LookId[] = LOOKS.map((l) => l.id);

/** The look each keyboard binding picked: player 1's first, player 2's second. */
export type Picks = readonly [LookId, LookId];

/** What players wear before they choose: the first two looks. */
export const DEFAULT_PICKS: Picks = ["mehmet", "lena"];

/** True when `id` names a look. */
export function isLookId(id: string): id is LookId {
  return LOOKS.some((l) => l.id === id);
}

/** The look with this id. */
export function lookOf(id: LookId): Look {
  return LOOKS.find((l) => l.id === id) ?? LOOKS[0];
}

/** The look `step` places after `id` in the table, wrapping around and skipping looks in `taken`. */
export function stepLook(id: LookId, step: 1 | -1, taken: ReadonlySet<LookId> = new Set()): LookId {
  const at = LOOK_IDS.indexOf(id);

  for (let n = 1; n <= LOOK_IDS.length; n++) {
    const next = LOOK_IDS[(((at + step * n) % LOOK_IDS.length) + LOOK_IDS.length) % LOOK_IDS.length] ?? id;

    if (!taken.has(next)) return next;
  }

  return id;
}

/**
 * One look per cook. The first cook of each keyboard binding wears its player's pick; every
 * other cook (bots, the second cook of a swap pair, a player whose pick the other player has)
 * takes the next free look in table order.
 */
export function crewLooks(drivers: readonly Driver[], picks: Picks): readonly Look[] {
  const taken = new Set<LookId>();

  const chosen = drivers.map((driver, i): LookId | null => {
    if (driver.kind !== "keys" || drivers.findIndex((d) => d.kind === "keys" && d.binding === driver.binding) !== i) return null;
    const pick = picks[driver.binding];

    if (taken.has(pick)) return null;
    taken.add(pick);

    return pick;
  });

  return chosen.map((pick) => {
    const id = pick ?? LOOK_IDS.find((l) => !taken.has(l)) ?? LOOK_IDS[0] ?? "mehmet";
    taken.add(id);

    return lookOf(id);
  });
}
