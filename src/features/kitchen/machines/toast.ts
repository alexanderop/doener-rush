/**
 * Bread or dough on the heat, as a state machine:
 *
 *   raw ──heat──▶ toasting ──HEAT.done──▶ done ──HEAT.burnt──▶ burnt
 *    │                                                          ▲
 *    └───────────────────── char (a fire on the station) ───────┘
 *
 * Every state past raw keeps `ticks`: the total time on the heat, which the view turns into a colour
 * and the station into the moment it catches fire. The thresholds per base are the `HEAT` table.
 */
import type { Base } from "../model.ts";
import { HEAT } from "../prototypes.ts";

/** How far a base is cooked. */
export type Toast =
  | { readonly state: "raw" }
  | { readonly state: "toasting"; readonly ticks: number }
  | { readonly state: "done"; readonly ticks: number }
  | { readonly state: "burnt"; readonly ticks: number };

/** Never on the heat: a pastry still takes its topping, and bread may still be thrown. */
export const RAW: Toast = { state: "raw" };

/** The state a base is in after `ticks` on the heat. */
export function toastAt(base: Base, ticks: number): Toast {
  const heat = HEAT[base];

  if (ticks <= 0) return RAW;

  if (ticks >= heat.burnt) return { state: "burnt", ticks };

  if (ticks >= heat.done) return { state: "done", ticks };

  return { state: "toasting", ticks };
}

/** Ticks on the heat so far; 0 while raw. */
export function heatTicks(toast: Toast): number {
  return toast.state === "raw" ? 0 : toast.ticks;
}

/** One tick on the toaster or in the oven. */
export function heatUp(base: Base, toast: Toast): Toast {
  return toastAt(base, heatTicks(toast) + 1);
}

/** A fire on the station burns the base at once. */
export function char(base: Base, toast: Toast): Toast {
  return toastAt(base, Math.max(heatTicks(toast), HEAT[base].burnt));
}

/** Holds the base just short of burnt: the easy rule and the tutorial's calm kitchen. */
export function holdBelowBurnt(base: Base, toast: Toast): Toast {
  return toastAt(base, Math.min(heatTicks(toast), HEAT[base].burnt - 1));
}
