import type { Intent } from "../../features/cooks/public.ts";

/** Who moves a cook: a player on one of the two keyboard bindings, or a bot. Two cooks on the same binding are a swap pair: the player moves one and switches. */
export type Driver = { readonly kind: "keys"; readonly binding: 0 | 1 } | { readonly kind: "bot" };

/** Who plays a round: one driver per cook, cook `i + 1` driven by `drivers[i]`. One to four cooks. */
export interface Lineup {
  readonly drivers: readonly Driver[];
}

/** Two players on the keyboard, no bots: the classic couch co-op round. */
export const TWO_PLAYERS: Lineup = { drivers: [{ kind: "keys", binding: 0 }, { kind: "keys", binding: 1 }] };

/** Most cooks a round can have: one per start tile. */
export const MAX_COOKS = 4;

/** What a player's keys ask for in one tick: the cook's intent, plus switching to their other cook. */
export interface PlayerInput extends Intent {
  /** Swap was pressed this tick: control moves to the player's next cook. */
  readonly swap?: boolean;
}

/**
 * The lineup for `humans` keyboard players (0–2, cooks first, on bindings 0 and 1) and `bots`
 * bots after them. With `swap`, a single player gets two cooks and switches between them.
 * Clamps to at most four cooks and at least one, so any request gives a round.
 */
export function lineupOf(humans: number, bots: number, swap = false): Lineup {
  const keys = Math.max(0, Math.min(2, Math.floor(humans)));
  const pair = swap && keys === 1;

  const players: Driver[] = pair
    ? [{ kind: "keys", binding: 0 }, { kind: "keys", binding: 0 }]
    : Array.from({ length: keys }, (_, b): Driver => ({ kind: "keys", binding: b === 0 ? 0 : 1 }));

  const auto = Math.max(players.length === 0 ? 1 : 0, Math.min(MAX_COOKS - players.length, Math.floor(bots)));

  return { drivers: [...players, ...Array.from({ length: auto }, (): Driver => ({ kind: "bot" }))] };
}

/** How many cooks act at once: one per keyboard binding (a swap pair counts once) plus every bot. It sets the shift's pace. */
export function crewOf(lineup: Lineup): number {
  const bindings = new Set(lineup.drivers.flatMap((d) => (d.kind === "keys" ? [d.binding] : [])));

  return bindings.size + lineup.drivers.filter((d) => d.kind === "bot").length;
}

/** True when cook `i` is one of a swap pair: its player drives another cook too. */
export function isPaired(drivers: readonly Driver[], i: number): boolean {
  const driver = drivers[i];

  return driver?.kind === "keys" && drivers.filter((d) => d.kind === "keys" && d.binding === driver.binding).length > 1;
}
