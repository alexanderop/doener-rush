import type { PlayerInput } from "../lineup.ts";
import { clampStep, newPad } from "./gamepad.ts";
import type { Pad } from "./gamepad.ts";

/** The keys of one player, by `KeyboardEvent.code`. */
interface Binding {
  readonly up: string;
  readonly down: string;
  readonly left: string;
  readonly right: string;
  readonly interact: string;
  readonly work: string;
  readonly dash: string;
  /** Throw the raw ingredient in hand straight ahead. */
  readonly throw: string;
  /** Switch to the player's other cook in a swap pair. */
  readonly swap: string;
}

/** Player 1 on the left of the keyboard, player 2 on the right. */
const BINDINGS: readonly Binding[] = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", interact: "KeyE", work: "KeyQ", dash: "Space", throw: "KeyF", swap: "KeyR" },
  {
    up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", interact: "Slash", work: "Period", dash: "ShiftRight", throw: "Quote",
    swap: "Enter",
  },
];

/** Every key the game reads, so the page can stop the browser from scrolling on them. */
export const GAME_KEYS = new Set(BINDINGS.flatMap((b) => Object.values(b)));

/** Keys held now, and presses not yet handed to a tick. */
export interface Keys {
  readonly down: Set<string>;
  readonly pressed: Set<string>;
}

/** No key held. */
export function newKeys(): Keys {
  return { down: new Set(), pressed: new Set() };
}

/** Records a key going down; a repeat while held is not a new press. */
export function keyDown(keys: Keys, code: string): void {
  if (!keys.down.has(code)) keys.pressed.add(code);
  keys.down.add(code);
}

/** Records a key going up. */
export function keyUp(keys: Keys, code: string): void {
  keys.down.delete(code);
}

/** Lets go of every key, as when the window loses focus. */
export function releaseAll(keys: Keys): void {
  keys.down.clear();
}

/**
 * The intents for one tick, from the keyboard and pad `i` for binding `i`; either one works.
 * With `solo` nobody plays on the second binding, so its arrow keys walk player 1 as well.
 * Consumes the presses, so a tap of interact acts once even when a frame runs several ticks,
 * and a tap between two ticks is not lost.
 */
export function takeIntents(keys: Keys, pads: readonly Pad[] = [], solo = false): PlayerInput[] {
  const held = (b: Binding, dir: "up" | "down" | "left" | "right") =>
    Number(keys.down.has(b[dir]) || (solo && b === BINDINGS[0] && keys.down.has(BINDINGS[1]?.[dir] ?? "")));

  const intents = BINDINGS.map((b, i) => {
    const pad = pads[i] ?? newPad();

    return {
      dx: clampStep(held(b, "right") - held(b, "left") + pad.dx),
      dy: clampStep(held(b, "down") - held(b, "up") + pad.dy),
      interact: keys.pressed.has(b.interact) || pad.pressed.has("interact"),
      work: keys.down.has(b.work) || pad.held.has("work"),
      dash: keys.pressed.has(b.dash) || pad.pressed.has("dash"),
      throw: keys.pressed.has(b.throw) || pad.pressed.has("throw"),
      swap: keys.pressed.has(b.swap) || pad.pressed.has("swap"),
    };
  });

  keys.pressed.clear();

  for (const pad of pads) pad.pressed.clear();

  return intents;
}
