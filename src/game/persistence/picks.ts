/**
 * The looks the two players last picked, as JSON in browser storage. Reading parses it with a
 * schema; a missing, broken or blocked entry gives the default looks.
 */
import { Option, Schema } from "effect";
import { readStorage, writeStorage } from "#/shared/storage.ts";
import { DEFAULT_PICKS, LOOK_IDS } from "../runtime/looks.ts";
import type { Picks } from "../runtime/looks.ts";

const LookId = Schema.Literals(LOOK_IDS);

const PicksJson = Schema.fromJsonString(Schema.Tuple([LookId, LookId]));

const decode = Schema.decodeUnknownOption(PicksJson);

const KEY = "doener-rush/looks/v1";

/** Reads saved picks from their text; anything unreadable gives the default looks. */
export function parsePicks(text: string): Picks {
  return Option.getOrElse(decode(text), () => DEFAULT_PICKS);
}

/** The players' saved looks, or the default ones. */
export function loadPicks(read: (key: string) => Option.Option<string> = readStorage): Picks {
  return Option.match(read(KEY), { onNone: () => DEFAULT_PICKS, onSome: parsePicks });
}

/** Remembers the players' looks; without storage they last until the page reloads. */
export function savePicks(picks: Picks): void {
  writeStorage(KEY, JSON.stringify(picks));
}
