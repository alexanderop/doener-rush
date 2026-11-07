/**
 * The campaign's save: the best shift on each level, as JSON in browser storage. Reading parses it with a schema;
 * a missing, broken or blocked save is an empty one.
 */
import { Option, Schema } from "effect";
import { readStorage, writeStorage } from "#/shared/storage.ts";
import { LEVELS } from "../runtime/levels.ts";
import type { LevelId } from "../runtime/levels.ts";

/** Where the save is read from and written to; the browser's storage by default, a map in tests. */
export interface ProgressStore {
  readonly read: (key: string) => Option.Option<string>;
  readonly write: (key: string, value: string) => void;
}

const Best = Schema.Struct({
  score: Schema.Int,
  stars: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 })),
});

/** The best shift on one level. */
type Best = typeof Best.Type;

const ProgressJson = Schema.fromJsonString(Schema.Record(Schema.Literals(LEVELS.map((l) => l.id)), Schema.optional(Best)));

/** The best shift per level; a level never finished has none. */
export type Progress = Readonly<Partial<Record<LevelId, Best>>>;

/** How a finished shift compares with the save before it. */
export interface Outcome {
  readonly progress: Progress;
  /** True when this shift beat the level's best, or set the first best above zero. */
  readonly record: boolean;
  /** The best score before this shift, if the level was played before. */
  readonly previous: Option.Option<number>;
}

const KEY = "doener-rush/progress/v1";

const BROWSER: ProgressStore = { read: readStorage, write: writeStorage };

const decode = Schema.decodeUnknownOption(ProgressJson);

/** Reads a save from its text; anything unreadable is an empty save. */
export function parseProgress(text: string): Progress {
  return Option.getOrElse(decode(text), () => ({}));
}

/** The save in the store, or an empty one when there is none. */
export function loadProgress(store: ProgressStore = BROWSER): Progress {
  return Option.match(store.read(KEY), { onNone: () => ({}), onSome: parseProgress });
}

/** Writes the save; a store that cannot keep it keeps the old one. */
export function saveProgress(progress: Progress, store: ProgressStore = BROWSER): void {
  store.write(KEY, JSON.stringify(progress));
}

/** Adds a finished shift to the save: the level keeps its best score and its most stars. Adding the same shift twice changes nothing. */
export function recordShift(progress: Progress, level: LevelId, score: number, stars: number): Outcome {
  const before = progress[level];
  const best = { score: Math.max(score, before?.score ?? score), stars: Math.max(stars, before?.stars ?? 0) };
  const record = before === undefined ? score > 0 : score > before.score;

  return { progress: { ...progress, [level]: best }, record, previous: Option.fromUndefinedOr(before?.score) };
}

/** True when a level can be played: the first always, every other once the level before it has a star. */
export function isUnlocked(progress: Progress, level: LevelId): boolean {
  const index = LEVELS.findIndex((l) => l.id === level);
  const before = LEVELS[index - 1];

  return index === 0 || (before !== undefined && (progress[before.id]?.stars ?? 0) >= 1);
}
