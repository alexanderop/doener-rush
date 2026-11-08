/**
 * A cook's dash, as a state machine, stepped once per tick with "was dash pressed":
 *
 *   ready ──press──▶ dashing ──DASH_TICKS──▶ cooling ──DASH_COOLDOWN after the press──▶ ready
 *
 * `since` counts ticks from the press through both dashing and cooling, so the cooldown is measured
 * from the start of the dash. A press while dashing or cooling does nothing.
 */
import { DASH_COOLDOWN, DASH_TICKS } from "../prototypes.ts";

/** Where a cook is in the dash cycle. */
export type Dash =
  | { readonly state: "ready" }
  | { readonly state: "dashing"; readonly since: number }
  | { readonly state: "cooling"; readonly since: number };

/** May dash on the next press. */
export const READY: Dash = { state: "ready" };

/** The dash state for this tick; the cook shoots forward while it is `dashing`. */
export function stepDash(dash: Dash, pressed: boolean): Dash {
  if (dash.state === "ready") return pressed ? { state: "dashing", since: 0 } : dash;
  const since = dash.since + 1;

  if (since >= DASH_COOLDOWN) return pressed ? { state: "dashing", since: 0 } : READY;

  return { state: since < DASH_TICKS ? "dashing" : "cooling", since };
}
