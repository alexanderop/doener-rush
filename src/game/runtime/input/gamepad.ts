/** A tap or hold a pad button stands for, the same as one of a keyboard binding's keys. */
type PadAction = "interact" | "work" | "dash" | "swap";

/**
 * Which button of the standard mapping does what. Several buttons may share an action.
 * LB (4) is kept free for throwing.
 */
const PAD_BUTTONS: ReadonlyMap<number, PadAction> = new Map([
  [0, "interact"], // A
  [1, "dash"], // B
  [2, "work"], // X
  [3, "swap"], // Y
  [5, "swap"], // RB
]);

/** A walking direction, each axis -1, 0 or 1 like the keyboard's. */
interface Walk {
  readonly dx: number;
  readonly dy: number;
}

/** D-pad buttons of the standard mapping and the direction each one walks. */
const DPAD: ReadonlyMap<number, Walk> = new Map([
  [12, { dx: 0, dy: -1 }],
  [13, { dx: 0, dy: 1 }],
  [14, { dx: -1, dy: 0 }],
  [15, { dx: 1, dy: 0 }],
]);

/** How far the stick must lean before the cook walks; below it the stick counts as resting. */
const DEADZONE = 0.35;

/** sin 22.5°: a stick within 22.5° of an axis walks straight, so all eight directions get equal 45° sectors. */
const SECTOR = Math.sin(Math.PI / 8);

/** One pad as the loop read it: the axes (left stick first) and which buttons are down. */
export interface PadSnapshot {
  readonly axes: readonly number[];
  readonly buttons: readonly boolean[];
}

/** What one pad holds now, and the taps not yet handed to a tick. */
export interface Pad {
  dx: number;
  dy: number;
  held: ReadonlySet<PadAction>;
  readonly pressed: Set<PadAction>;
}

/** A pad with nothing held, also what a missing pad reads as. */
export function newPad(): Pad {
  return { dx: 0, dy: 0, held: new Set(), pressed: new Set() };
}

/** One step at most each way, as when the stick and the d-pad push together. */
export function clampStep(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

/** The left stick snapped to one of eight directions, or none inside the deadzone. */
function stick(axes: readonly number[]): Walk {
  const x = axes[0] ?? 0;
  const y = axes[1] ?? 0;
  const lean = Math.hypot(x, y);

  if (lean < DEADZONE) return { dx: 0, dy: 0 };

  return { dx: Math.abs(x) > lean * SECTOR ? Math.sign(x) : 0, dy: Math.abs(y) > lean * SECTOR ? Math.sign(y) : 0 };
}

/**
 * Reads one poll of the pad into `pad`: walking from the stick or d-pad, and a press for each
 * action whose button went down since the last poll, so holding A interacts once. A pad that is
 * gone (`undefined`) lets go of everything.
 */
export function readPad(pad: Pad, snap: PadSnapshot | undefined): void {
  const buttons = snap?.buttons ?? [];
  const held = new Set<PadAction>();

  for (const [button, action] of PAD_BUTTONS) if (buttons[button] === true) held.add(action);

  for (const action of held) if (!pad.held.has(action)) pad.pressed.add(action);
  const walk = stick(snap?.axes ?? []);
  let dx = walk.dx;
  let dy = walk.dy;

  for (const [button, step] of DPAD) {
    if (buttons[button] !== true) continue;
    dx += step.dx;
    dy += step.dy;
  }

  pad.dx = clampStep(dx);
  pad.dy = clampStep(dy);
  pad.held = held;
}
