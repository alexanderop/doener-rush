/**
 * How the cooks look: a table of chefs, each a body colour, skin, hair, something on the head
 * and maybe a moustache or glasses. Players pick theirs on the home page; every other cook
 * takes the next free look, so no two cooks in a shift look alike. Pure data: the 3D models
 * that draw a look live in `gl/models.ts`.
 */
import type { Driver } from "./lineup.ts";

/** What a cook wears on the head; hair styles count too. */
export type Headwear = "toque" | "cap" | "bandana" | "beanie" | "paperhat" | "ponytail" | "bun";

/** Something on the face besides eyes and nose. */
export type Accessory = "none" | "moustache" | "glasses";

/** One chef look. `body` is the cook's colour everywhere: jacket, hat trim, name tag, key help. */
export interface Look {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly skin: string;
  readonly hair: string;
  readonly headwear: Headwear;
  readonly accessory: Accessory;
}

/** Every look, in the order bots take them. */
export const LOOKS = [
  { id: "mehmet", name: "Mehmet", body: "#e94f37", skin: "#d9a57a", hair: "#2b1a10", headwear: "toque", accessory: "moustache" },
  { id: "lena", name: "Lena", body: "#3f88c5", skin: "#f3c79e", hair: "#a0522d", headwear: "cap", accessory: "none" },
  { id: "can", name: "Can", body: "#44bba4", skin: "#a8714c", hair: "#1d1d1d", headwear: "bandana", accessory: "none" },
  { id: "jule", name: "Jule", body: "#f6ae2d", skin: "#f6d3b5", hair: "#e8c547", headwear: "beanie", accessory: "glasses" },
  { id: "elif", name: "Elif", body: "#ef7fb0", skin: "#d9a57a", hair: "#2b1a10", headwear: "ponytail", accessory: "none" },
  { id: "hans", name: "Hans", body: "#6cbf4a", skin: "#f3c79e", hair: "#c0c4c8", headwear: "paperhat", accessory: "glasses" },
  { id: "gerda", name: "Oma Gerda", body: "#a77bd9", skin: "#f6d3b5", hair: "#e4e4e4", headwear: "bun", accessory: "glasses" },
  { id: "deniz", name: "Deniz", body: "#ff8c42", skin: "#a8714c", hair: "#1d1d1d", headwear: "cap", accessory: "moustache" },
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
