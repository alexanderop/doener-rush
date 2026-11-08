/**
 * One side of the döner spit, as a state machine:
 *
 *   raw ──roast──▶ cooked ──roast──▶ burnt ──roast to SPIT_IGNITE──▶ (the spit catches fire)
 *    ▲               │                 │
 *    └──── shave ────┘                 │
 *    └──── shave, or scraped when a spit fire is put out ┘
 *
 * Only the side facing the heat roasts. Every state keeps its cook `level`, which the view turns
 * into a colour; the thresholds are COOKED and BURNT.
 */
import { AFTER_SHAVE, BURNT, COOKED, SPIT_HEAT } from "../prototypes.ts";

/** How far one side of the meat is cooked. */
export interface Side {
  readonly state: "raw" | "cooked" | "burnt";
  readonly level: number;
}

/** The state a side is in at cook `level`. */
export function sideAt(level: number): Side {
  if (level >= BURNT) return { state: "burnt", level };

  return { state: level >= COOKED ? "cooked" : "raw", level };
}

/** One tick facing the heat. */
export function roast(side: Side): Side {
  return sideAt(side.level + SPIT_HEAT);
}

/** A portion is shaved off: the raw layer underneath shows. */
export function shaveOff(): Side {
  return sideAt(AFTER_SHAVE);
}

/** A spit fire is put out: the charred outside is scraped off, the rest stays. */
export function scrapeIfBurnt(side: Side): Side {
  return side.state === "burnt" ? shaveOff() : side;
}

/** Holds the side just short of burnt: the easy rule and the tutorial's calm kitchen. */
export function holdSideBelowBurnt(side: Side): Side {
  return side.state === "burnt" ? sideAt(BURNT - 0.01) : side;
}
