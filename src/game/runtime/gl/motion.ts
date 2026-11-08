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

/** A one-off body gesture a cook plays over its walk and work. */
export type GestureKind = "throw" | "bump" | "look" | "stretch";

/** How a gesture bends a cook: lean forward (+) or back, tilt sideways, turn the body, stretch up (+) or squash, raise the hands (0 to 1). */
export interface Pose {
  lean: number;
  tilt: number;
  turn: number;
  stretch: number;
  lift: number;
}

interface Gesture {
  readonly seconds: number;
  /** Writes the pose at `age` seconds into `out`, so a frame allocates nothing. */
  readonly pose: (age: number, out: Pose) => void;
}

/** Seconds a throw winds up before the item leaves the hand. */
export const WIND_UP = 0.07;

/** Seconds a cook stands still before fidgeting. */
export const IDLE_SECONDS = 5;

/** Every gesture, by kind. */
export const GESTURES: Readonly<Record<GestureKind, Gesture>> = {
  // a short pull back, then a snap forward that stretches the body along the throw
  throw: {
    seconds: 0.4,
    pose: (age, out) => {
      const wind = Math.min(1, age / WIND_UP);
      const snap = easeOutCubic((age - WIND_UP) / 0.08);
      const settle = 1 - Math.max(0, (age - WIND_UP - 0.08) / 0.25);
      out.lean = (-0.35 * wind * (1 - snap) + 0.45 * snap) * settle;
      out.stretch = (-0.12 * wind * (1 - snap) + 0.2 * snap) * settle;
      out.lift = settle;
    },
  },
  // two cooks ran into each other: a damped side-to-side wobble with a squash
  bump: {
    seconds: 0.6,
    pose: (age, out) => {
      out.tilt = Math.sin(age * 28) * 0.24 * Math.exp(-age * 6);
      out.stretch = -0.16 * Math.exp(-age * 10);
    },
  },
  // left alone, a cook looks over one shoulder, then the other
  look: {
    seconds: 1.8,
    pose: (age, out) => {
      out.turn = Math.sin((age / 1.8) * Math.PI * 2) * 0.7;
      out.lean = -0.05 * Math.sin((age / 1.8) * Math.PI);
    },
  },
  // or stretches with both arms up
  stretch: {
    seconds: 1.3,
    pose: (age, out) => {
      const p = Math.sin((age / 1.3) * Math.PI);
      out.stretch = p * 0.14;
      out.lift = p;
      out.lean = -0.12 * p;
    },
  },
};

/** Clears a pose back to standing straight. */
export function restPose(out: Pose): void {
  out.lean = 0;
  out.tilt = 0;
  out.turn = 0;
  out.stretch = 0;
  out.lift = 0;
}
