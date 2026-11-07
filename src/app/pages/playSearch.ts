import { Option, Schema } from "effect";
import { isScenario } from "#/game/runtime/testing/scenarios.ts";
import { isLevelId } from "#/game/runtime/levels.ts";
import { isLookId } from "#/game/runtime/looks.ts";
import { MINUTES } from "#/game/runtime/rules.ts";
import type { PlaySearch } from "./PlayPage.tsx";

type RawPlaySearch = { [key in keyof PlaySearch]?: string | number | boolean };

const SeedParam = Schema.Union([
  Schema.Finite,
  Schema.String.check(Schema.isPattern(/\S/)).pipe(Schema.decodeTo(Schema.FiniteFromString)),
]).check(Schema.isInt());

const decodeSeed = Schema.decodeUnknownOption(SeedParam);

/** A whole count in the query, as a number or its text, within `minimum`..`maximum`. */
const countParam = (minimum: number, maximum: number) => SeedParam.check(Schema.isBetween({ minimum, maximum }));

const decodeHumans = Schema.decodeUnknownOption(countParam(0, 2));

const decodeBots = Schema.decodeUnknownOption(countParam(0, 4));

const decodeText = Schema.decodeUnknownOption(Schema.String);

/** A 0/1 switch: `swap=1`, `fire=0`, … */
const decodeSwitch = Schema.decodeUnknownOption(countParam(0, 1));

/** A three-step setting: 0 gentle, 1 normal, 2 harsh. */
const decodeLevel = Schema.decodeUnknownOption(countParam(0, 2));

const decodeMinutes = Schema.decodeUnknownOption(countParam(MINUTES.min, MINUTES.max));

/**
Reads the `/play` query (`?seed=<n>`, `?level=<id>`, `?scenario=<name>`, `?humans=<0–2>&bots=<0–4>&swap=1`, the players' looks
`look1`, `look2` (a look id), and the house rules
`burn`, `fire`, `dishes` (0/1), `patience`, `rush` (0–2), `minutes` (2–5)) into typed options; an invalid field is dropped on its own.
TanStack merges this result over the raw query, so a dropped field is set to `undefined` to overwrite the raw text.
*/
export const validatePlaySearch = (search: RawPlaySearch): PlaySearch => ({
  seed: Option.getOrUndefined(decodeSeed(search.seed)),
  level: Option.getOrUndefined(Option.filter(decodeText(search.level), isLevelId)),
  scenario: Option.getOrUndefined(Option.filter(decodeText(search.scenario), isScenario)),
  humans: Option.getOrUndefined(decodeHumans(search.humans)),
  bots: Option.getOrUndefined(decodeBots(search.bots)),
  swap: Option.getOrUndefined(decodeSwitch(search.swap)),
  look1: Option.getOrUndefined(Option.filter(decodeText(search.look1), isLookId)),
  look2: Option.getOrUndefined(Option.filter(decodeText(search.look2), isLookId)),
  burn: Option.getOrUndefined(decodeSwitch(search.burn)),
  fire: Option.getOrUndefined(decodeSwitch(search.fire)),
  dishes: Option.getOrUndefined(decodeSwitch(search.dishes)),
  patience: Option.getOrUndefined(decodeLevel(search.patience)),
  rush: Option.getOrUndefined(decodeLevel(search.rush)),
  minutes: Option.getOrUndefined(decodeMinutes(search.minutes)),
});
