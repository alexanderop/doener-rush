import { keepFromBurning } from "../../features/kitchen/public.ts";
import { ROUND_TICKS, combinePace } from "../../features/orders/public.ts";
import { seconds } from "../core/grid.ts";
import type { World } from "./world.ts";

/** Three steps for a setting that can be gentler or harsher than normal. */
type Level = 0 | 1 | 2;

/**
 * The house rules of a shift, picked on the home page so players make it easier or harder:
 * whether food burns, whether anything catches fire, whether plates come back dirty, how patient
 * customers are, how many come, and how long the shift lasts.
 */
export interface Rules {
  readonly burning: boolean;
  readonly fire: boolean;
  readonly dishes: boolean;
  /** 0 relaxed, 1 normal, 2 impatient. */
  readonly patience: Level;
  /** 0 few customers, 1 normal, 2 a rush. */
  readonly rush: Level;
  /** Length of the shift in minutes. */
  readonly minutes: number;
}

/** The game as designed. */
export const NORMAL_RULES: Rules = { burning: true, fire: true, dishes: true, patience: 1, rush: 1, minutes: 3 };

/** The presets on the home page. */
export const PRESETS = {
  easy: { burning: false, fire: false, dishes: false, patience: 0, rush: 0, minutes: 3 },
  normal: NORMAL_RULES,
  hard: { burning: true, fire: true, dishes: true, patience: 2, rush: 2, minutes: 3 },
} as const satisfies Record<string, Rules>;

/** Shortest and longest shift a player can pick, in minutes. */
export const MINUTES = { min: 2, max: 5 } as const;

/** How much longer customers wait, by patience level. */
const PATIENCE = [1.5, 1, 0.75] as const;

/** How much longer the gap between two customers is, by rush level. */
const ARRIVAL = [1.4, 1, 0.75] as const;

/** Applies a shift's rules to a freshly built world: the shift length, the customers' pace, and star scores in step with the length. */
export function setRules(world: World, rules: Rules): void {
  world.rules = rules;
  const length = seconds(60 * Math.max(MINUTES.min, Math.min(MINUTES.max, rules.minutes)));
  // a scenario may start late in the shift; keep the time it has left relative to a normal shift
  world.endTick = Math.max(world.tick + 1, world.endTick + length - ROUND_TICKS);
  // a longer shift has time for more döner, so the stars ask for more
  world.orders.pace = combinePace(world.orders.pace, { patience: PATIENCE[rules.patience], arrival: ARRIVAL[rules.rush], stars: length / ROUND_TICKS });
}

/** Runs after the stations each tick: with burning off food stops just short of burnt; with fire off nothing burns. */
export function enforceRules(world: World): void {
  const { burning, fire } = world.rules;

  if (burning && fire) return;

  for (const station of world.stations.values()) {
    if (!burning) keepFromBurning(station);

    if (!fire) station.fire = 0;
  }
}
