import { describe, expect, it } from "vitest";
import type { Doener } from "../model.ts";
import { RAW } from "./toast.ts";
import { DIRTY, EMPTY, fill, foodOn, scrape } from "./plate.ts";

const bread = (): Doener => ({ kind: "base", base: "bread", toast: RAW, fillings: [] });

describe("plate", () => {
  it("takes a döner only while clean and empty", () => {
    const food = bread();
    const full = fill(EMPTY, food);

    expect(foodOn(full)).toBe(food);
    expect(fill(full, bread())).toBe(full);
    expect(fill(DIRTY, food)).toBe(DIRTY);
  });

  it("is scraped back to empty in the bin; a dirty plate stays dirty", () => {
    expect(scrape(fill(EMPTY, bread()))).toBe(EMPTY);
    expect(scrape(DIRTY)).toBe(DIRTY);
  });
});
