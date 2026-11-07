import { describe, expect, it } from "vitest";
import { LOOKS } from "../looks.ts";
import { cookModel } from "./models.ts";

/** The parts `scene.ts` looks up by name to animate a cook. */
const ANIMATED_PARTS = ["rig", "held", "handL", "handR", "footL", "footR", "eyes"];

describe("given every chef look", () => {
  it.each(LOOKS.map((look) => [look.id, look] as const))("builds %s with every part the scene animates", (_, look) => {
    const model = cookModel(look);
    expect(ANIMATED_PARTS.filter((name) => model.getObjectByName(name) === undefined)).toEqual([]);
  });
});
