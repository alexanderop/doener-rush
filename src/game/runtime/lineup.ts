/** Who moves a cook: a player on one of the two keyboard bindings, or a bot. */
export type Driver = { readonly kind: "keys"; readonly binding: 0 | 1 } | { readonly kind: "bot" };

/** Who plays a round: one driver per cook, cook `i + 1` driven by `drivers[i]`. One to four cooks. */
export interface Lineup {
  readonly drivers: readonly Driver[];
}

/** Two players on the keyboard, no bots: the classic couch co-op round. */
export const TWO_PLAYERS: Lineup = { drivers: [{ kind: "keys", binding: 0 }, { kind: "keys", binding: 1 }] };

/** Most cooks a round can have: one per start tile. */
export const MAX_COOKS = 4;

/**
 * The lineup for `humans` keyboard players (0–2, cooks first, on bindings 0 and 1) and `bots`
 * bots after them. Clamps to at most four cooks and at least one, so any request gives a round.
 */
export function lineupOf(humans: number, bots: number): Lineup {
  const keys = Math.max(0, Math.min(2, Math.floor(humans)));
  const auto = Math.max(keys === 0 ? 1 : 0, Math.min(MAX_COOKS - keys, Math.floor(bots)));
  const players = Array.from({ length: keys }, (_, b): Driver => ({ kind: "keys", binding: b === 0 ? 0 : 1 }));

  return { drivers: [...players, ...Array.from({ length: auto }, (): Driver => ({ kind: "bot" }))] };
}
