import { Option, Schema } from "effect";
import { isScenario } from "#/game/runtime/testing/scenarios.ts";
import type { PlaySearch } from "./PlayPage.tsx";

type RawPlaySearch = { [key in keyof PlaySearch]?: string | number | boolean };

const SeedParam = Schema.Union([
  Schema.Finite,
  Schema.String.check(Schema.isPattern(/\S/)).pipe(Schema.decodeTo(Schema.FiniteFromString)),
]).check(Schema.isInt());

const decodeSeed = Schema.decodeUnknownOption(SeedParam);

const decodeText = Schema.decodeUnknownOption(Schema.String);

/**
Reads the `/play` query (`?seed=<n>`, `?scenario=<name>`) into typed options; an invalid field is dropped on its own.
TanStack merges this result over the raw query, so a dropped field is set to `undefined` to overwrite the raw text.
*/
export const validatePlaySearch = (search: RawPlaySearch): PlaySearch => ({
  seed: Option.getOrUndefined(decodeSeed(search.seed)),
  scenario: Option.getOrUndefined(Option.filter(decodeText(search.scenario), isScenario)),
});
