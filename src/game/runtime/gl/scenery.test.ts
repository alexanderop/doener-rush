import { describe, expect, it } from "vitest";
import { LEVELS } from "../levels.ts";
import { sceneryOf } from "./scenery.ts";

describe("given the levels without a scenery of their own", () => {
  it.each(LEVELS.filter((level) => level.id !== "hafen").map((level) => [level.id] as const))("stands %s on the street", (id) => {
    expect(sceneryOf(id, null)).toBe("street");
  });
});

describe("given the Hafenimbiss", () => {
  it("stands it in the harbor", () => {
    expect(sceneryOf("hafen", null)).toBe("harbor");
  });
});

describe("given a ?scenery= override", () => {
  it("shows the named backdrop", () => {
    expect(sceneryOf("imbiss", "harbor")).toBe("harbor");
  });

  it("ignores a name no backdrop has", () => {
    expect(sceneryOf("imbiss", "moon")).toBe("street");
  });
});
