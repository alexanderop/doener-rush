import { describe, expect, it } from "vitest";
import { newPad, readPad } from "./gamepad.ts";
import type { Pad, PadSnapshot } from "./gamepad.ts";
import { keyDown, newKeys, takeIntents } from "./input.ts";
import type { Keys } from "./input.ts";

const A = 0;

const B = 1;

const X = 2;

const Y = 3;

const DPAD_LEFT = 14;

function pad(stick: readonly [number, number], ...down: readonly number[]): PadSnapshot {
  return { axes: [stick[0], stick[1], 0, 0], buttons: Array.from({ length: 17 }, (_, i) => down.includes(i)) };
}

/** Polls player 1's pad once and takes player 1's intent for one tick, as the loop does each frame. */
function tick(one: Pad, snap: PadSnapshot | undefined, keys: Keys = newKeys()) {
  readPad(one, snap);
  const [intent] = takeIntents(keys, [one, newPad()]);

  if (intent === undefined) throw new Error("no intent for player 1");

  return intent;
}

describe("gamepad input", () => {
  it("walks once the stick leans past the deadzone, and not before", () => {
    expect(tick(newPad(), pad([0.2, 0.1]))).toMatchObject({ dx: 0, dy: 0 });
    expect(tick(newPad(), pad([0.9, 0.05]))).toMatchObject({ dx: 1, dy: 0 });
    expect(tick(newPad(), pad([0, -0.8]))).toMatchObject({ dx: 0, dy: -1 });
  });

  it("snaps a diagonal stick to a diagonal step", () => {
    expect(tick(newPad(), pad([-0.6, 0.6]))).toMatchObject({ dx: -1, dy: 1 });
  });

  it("walks with the d-pad", () => {
    expect(tick(newPad(), pad([0, 0], DPAD_LEFT))).toMatchObject({ dx: -1, dy: 0 });
  });

  it("interacts once per A press, not again while A stays down", () => {
    const one = newPad();

    expect(tick(one, pad([0, 0], A)).interact).toBe(true);
    expect(tick(one, pad([0, 0], A)).interact).toBe(false);
    expect(tick(one, pad([0, 0])).interact).toBe(false);
    expect(tick(one, pad([0, 0], A)).interact).toBe(true);
  });

  it("keeps a tap that lands in a frame without a tick for the next tick", () => {
    const one = newPad();
    readPad(one, pad([0, 0], B));
    readPad(one, pad([0, 0]));

    expect(takeIntents(newKeys(), [one])[0]?.dash).toBe(true);
  });

  it("keeps working every tick while X is held", () => {
    const one = newPad();

    expect([1, 2, 3].map(() => tick(one, pad([0, 0], X)).work)).toEqual([true, true, true]);
    expect(tick(one, pad([0, 0])).work).toBe(false);
  });

  it("throws with LB", () => {
    expect(tick(newPad(), pad([0, 0], 4))).toMatchObject({ throw: true, interact: false });
  });

  it("swaps with Y and dashes with B", () => {
    expect(tick(newPad(), pad([0, 0], Y, B))).toMatchObject({ swap: true, dash: true, interact: false });
  });

  it("lets go of everything when the pad is unplugged", () => {
    const one = newPad();
    tick(one, pad([1, 0], X));

    expect(tick(one, undefined)).toMatchObject({ dx: 0, work: false });
  });

  it("drives player 2 with the second pad and leaves player 1 alone", () => {
    const second = newPad();
    readPad(second, pad([1, 0], A));
    const [p1, p2] = takeIntents(newKeys(), [newPad(), second]);

    expect(p1).toMatchObject({ dx: 0, interact: false });
    expect(p2).toMatchObject({ dx: 1, interact: true });
  });
});

describe("keyboard and pad together", () => {
  it("takes a press from either one", () => {
    const keys = newKeys();
    keyDown(keys, "KeyE");

    expect(tick(newPad(), pad([0, 0], X), keys)).toMatchObject({ interact: true, work: true });
  });

  it("walks one step even when both push the same way", () => {
    const keys = newKeys();
    keyDown(keys, "KeyD");

    expect(tick(newPad(), pad([1, 0]), keys).dx).toBe(1);
  });

  it("cancels out when they push opposite ways", () => {
    const keys = newKeys();
    keyDown(keys, "KeyA");

    expect(tick(newPad(), pad([1, 0]), keys).dx).toBe(0);
  });

  it("still works with no pad at all", () => {
    const keys = newKeys();
    keyDown(keys, "KeyW");

    expect(takeIntents(keys)[0]).toMatchObject({ dx: 0, dy: -1 });
  });
});

describe("arrow keys", () => {
  it("walk player 1 when nobody plays on the second binding", () => {
    const keys = newKeys();
    keyDown(keys, "ArrowLeft");

    expect(takeIntents(keys, [], true)[0]).toMatchObject({ dx: -1, dy: 0 });
  });

  it("stay player 2's keys in a two-player round", () => {
    const keys = newKeys();
    keyDown(keys, "ArrowLeft");
    const [p1, p2] = takeIntents(keys, [], false);

    expect(p1?.dx).toBe(0);
    expect(p2?.dx).toBe(-1);
  });
});
