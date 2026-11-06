import { describe, expect, it } from "vitest";
import { IDLE } from "./model.ts";
import { facingTile, newCook, walk } from "./simulation.ts";

const open = () => false;

describe("given a cook", () => {
  it("walks four tiles a second and faces the way they walk", () => {
    const cook = newCook(1, { x: 2, y: 2 });

    for (let i = 0; i < 60; i++) walk(cook, { ...IDLE, dx: 1 }, open, [cook]);
    expect(cook.x).toBeCloseTo(6.5);
    expect(facingTile(cook)).toEqual({ x: 7, y: 2 });
  });

  it("dashes about two tiles ahead, then must wait for the cooldown", () => {
    const cook = newCook(1, { x: 2, y: 2 });
    cook.face = { dx: 1, dy: 0 };
    walk(cook, { ...IDLE, dash: true }, open, [cook]);

    for (let i = 0; i < 12; i++) walk(cook, IDLE, open, [cook]);
    expect(cook.x).toBeGreaterThan(4.4);
    const after = cook.x;
    walk(cook, { ...IDLE, dash: true }, open, [cook]);
    walk(cook, IDLE, open, [cook]);
    expect(cook.x).toBe(after);
  });

  it("stops at a counter", () => {
    const cook = newCook(1, { x: 2, y: 2 });
    const wall = (x: number) => x >= 4;

    for (let i = 0; i < 120; i++) walk(cook, { ...IDLE, dx: 1 }, wall, [cook]);
    expect(cook.x).toBeLessThan(4);
    expect(cook.x).toBeGreaterThan(3.5);
  });

  it("cannot walk through the other cook", () => {
    const a = newCook(1, { x: 2, y: 2 });
    const b = newCook(2, { x: 4, y: 2 });

    for (let i = 0; i < 120; i++) walk(a, { ...IDLE, dx: 1 }, open, [a, b]);
    expect(b.x - a.x).toBeGreaterThanOrEqual(0.69);
  });
});
