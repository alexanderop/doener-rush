/**
 * Fire on a station, as a state machine:
 *
 *   out ──ignite──▶ burning ──spray × DOUSE_TICKS──▶ out
 *                   │  ▲
 *                   └──┘ burn (every tick; spreads every FIRE_SPREAD ticks)
 *
 * Values are immutable: each transition returns the next state, and the station stores it.
 */
import { DOUSE_TICKS, FIRE_SPREAD } from "../prototypes.ts";

/** A station is either fine or burning. */
export type Fire =
  | { readonly state: "out" }
  /** `ticks` burned so far (1 on the tick it caught), `sprayed` ticks of extinguisher on it. */
  | { readonly state: "burning"; readonly ticks: number; readonly sprayed: number };

/** No fire: every station starts like this. */
export const OUT: Fire = { state: "out" };

/** Catches fire; a fire that already burns keeps burning as it was. */
export function ignite(fire: Fire): Fire {
  return fire.state === "out" ? { state: "burning", ticks: 1, sprayed: 0 } : fire;
}

/** One more tick of burning. */
export function burn(fire: Fire): Fire {
  return fire.state === "burning" ? { ...fire, ticks: fire.ticks + 1 } : fire;
}

/** One tick of the extinguisher: enough of them put the fire out. */
export function spray(fire: Fire): Fire {
  if (fire.state === "out") return fire;

  return fire.sprayed + 1 >= DOUSE_TICKS ? OUT : { ...fire, sprayed: fire.sprayed + 1 };
}

/** True while the station burns: it refuses all use until put out. */
export function isBurning(fire: Fire): fire is Extract<Fire, { state: "burning" }> {
  return fire.state === "burning";
}

/** True on the ticks a fire jumps to its neighbours: every FIRE_SPREAD ticks after it caught. */
export function spreadsNow(fire: Fire): boolean {
  return fire.state === "burning" && fire.ticks > 1 && (fire.ticks - 1) % FIRE_SPREAD === 0;
}

/** How far the extinguisher has got, 0 to 1. */
export function dousing(fire: Fire): number {
  return fire.state === "burning" ? fire.sprayed / DOUSE_TICKS : 0;
}
