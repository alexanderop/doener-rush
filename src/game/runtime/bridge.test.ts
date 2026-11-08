import { describe, expect, it } from "vitest";
import { BRIDGE_WARNING, isClosing, isOpening, isUp, newBridge, stepBridge } from "./bridge.ts";
import type { Bridge } from "./bridge.ts";

const SCHEDULE = { up: 10, down: 5 };

function after(bridge: Bridge, ticks: number, occupied = false): Bridge {
  let next = bridge;

  for (let i = 0; i < ticks; i++) next = stepBridge(next, SCHEDULE, occupied);

  return next;
}

describe("given a bridge on a schedule", () => {
  it("stays up for `up` ticks, down for `down` ticks, then comes back up", () => {
    const start = newBridge(SCHEDULE);
    expect(isUp(after(start, 9))).toBe(true);
    expect(after(start, 10)).toEqual({ state: "down", left: 5 });
    expect(isUp(after(start, 14))).toBe(false);
    expect(after(start, 15)).toEqual({ state: "up", left: 10 });
  });

  it("waits up while a cook stands on it, and sinks the tick they step off", () => {
    const due = after(newBridge(SCHEDULE), 9);
    const held = after(due, 30, true);
    expect(held).toEqual({ state: "held" });
    expect(isUp(held)).toBe(true);
    expect(after(held, 1)).toEqual({ state: "down", left: 5 });
  });

  it("warns BRIDGE_WARNING ticks before it sinks and before it rises", () => {
    const schedule = { up: BRIDGE_WARNING + 5, down: BRIDGE_WARNING + 5 };
    const up = newBridge(schedule);
    expect(isClosing(up)).toBe(false);
    expect(isClosing({ state: "up", left: BRIDGE_WARNING })).toBe(true);
    expect(isClosing({ state: "held" })).toBe(true);
    expect(isOpening({ state: "down", left: BRIDGE_WARNING + 1 })).toBe(false);
    expect(isOpening({ state: "down", left: BRIDGE_WARNING })).toBe(true);
  });
});
