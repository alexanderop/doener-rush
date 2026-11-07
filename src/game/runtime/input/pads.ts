import type { PadSnapshot } from "./gamepad.ts";

/**
 * The plugged-in pads in order, as plain snapshots: the first one plays binding 0, the second
 * binding 1, whatever slot the browser gave them.
 */
export function pollPads(): PadSnapshot[] {
  return navigator.getGamepads().flatMap((pad) => (pad?.connected === true ? [{ axes: [...pad.axes], buttons: pad.buttons.map((b) => b.pressed) }] : []));
}
