/**
 * Pure motion helpers for the 3D view: easing curves and the rules that read an animation out of
 * two frames of the world. No three.js objects live here, so the rules are testable on their own.
 */

/** Fast start, soft landing. */
export function easeOutCubic(p: number): number {
  const q = 1 - Math.min(1, Math.max(0, p));

  return 1 - q * q * q;
}

/** How an item moved between a cook's hands and the station in front of them since the last frame. */
export type Handoff = "drop" | "take" | "none";

/** What a cook's hands did between two frames. */
export interface HandsChange {
  readonly heldBefore: boolean;
  readonly heldAfter: boolean;
  /** The cook threw this frame: the item flies on its own arc, not into a station. */
  readonly threw: boolean;
  /** The cook caught a throw this frame: the item came through the air, not from a station. */
  readonly caught: boolean;
  readonly facesStation: boolean;
}

/**
 * Empty hands that now hold something took it from the station in front; full hands that are now
 * empty put it down there. Swapping one item for another in hand (a combine) stays in hand.
 */
export function handoffOf(change: HandsChange): Handoff {
  if (!change.facesStation) return "none";

  if (!change.heldBefore && change.heldAfter && !change.caught) return "take";

  if (change.heldBefore && !change.heldAfter && !change.threw) return "drop";

  return "none";
}
