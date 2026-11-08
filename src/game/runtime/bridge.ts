/**
 * The bridges over the water of a harbour kitchen, as one state machine they all share:
 *
 *   up ──left 0, nobody on it──▶ down ──left 0──▶ up
 *    │                            ▲
 *    └──left 0, a cook on it──▶ held ──everyone off──┘
 *
 * While up (or held) a bridge is floor; while down it is water. It never sinks under a cook: it waits for them.
 * Values are immutable and count ticks, so a seed replays the same round.
 */
import { seconds } from "../core/grid.ts";

/** How long the bridges stay up and stay down, in ticks. */
export interface BridgeSchedule {
  readonly up: number;
  readonly down: number;
}

/** Where the bridges are in their schedule; `left` counts the ticks until they move. */
export type Bridge =
  | { readonly state: "up"; readonly left: number }
  /** Due to sink, but a cook still stands on a bridge. */
  | { readonly state: "held" }
  | { readonly state: "down"; readonly left: number };

/** The bridges of a kitchen: their tiles (`y * width + x`), their schedule and where they are in it. */
export interface Bridges {
  readonly tiles: ReadonlySet<number>;
  readonly schedule: BridgeSchedule;
  state: Bridge;
}

/** Ticks before the bridges move that the view warns and bots stop stepping on a bridge about to sink. */
export const BRIDGE_WARNING = seconds(2);

/** Bridges at the start of a shift: up, for a full stretch. */
export function newBridge(schedule: BridgeSchedule): Bridge {
  return { state: "up", left: schedule.up };
}

/** One tick of the schedule; `occupied` is true while any cook stands on a bridge tile. */
export function stepBridge(bridge: Bridge, schedule: BridgeSchedule, occupied: boolean): Bridge {
  switch (bridge.state) {
    case "up":
      if (bridge.left > 1) return { state: "up", left: bridge.left - 1 };

      return occupied ? { state: "held" } : { state: "down", left: schedule.down };
    case "held":
      return occupied ? bridge : { state: "down", left: schedule.down };
    case "down":
      return bridge.left > 1 ? { state: "down", left: bridge.left - 1 } : { state: "up", left: schedule.up };
  }
}

/** True while a cook can walk over the bridges. */
export function isUp(bridge: Bridge): boolean {
  return bridge.state !== "down";
}

/** True when the bridges are about to sink, or are only waiting for a cook to step off. */
export function isClosing(bridge: Bridge): boolean {
  return bridge.state === "held" || (bridge.state === "up" && bridge.left <= BRIDGE_WARNING);
}

/** True when the bridges are about to rise out of the water. */
export function isOpening(bridge: Bridge): boolean {
  return bridge.state === "down" && bridge.left <= BRIDGE_WARNING;
}
