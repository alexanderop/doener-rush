import { describe, expect, it } from "vitest";
import { SLIDE_WARNING, isSliding, newSlide, stepSlide } from "./slide.ts";
import type { Slide } from "./slide.ts";

const SCHEDULE = { home: 10, away: 5 };

function after(slide: Slide, ticks: number, blocked = false): Slide {
  let next = slide;

  for (let i = 0; i < ticks; i++) next = stepSlide(next, SCHEDULE, blocked);

  return next;
}

describe("given sliding counters on a schedule", () => {
  it("rest home for `home` ticks, away for `away` ticks, then come back", () => {
    const start = newSlide(SCHEDULE);
    expect(after(start, 9).at).toBe("home");
    expect(after(start, 10)).toEqual({ at: "away", left: 5 });
    expect(after(start, 14).at).toBe("away");
    expect(after(start, 15)).toEqual({ at: "home", left: 10 });
  });

  it("wait while a cook stands in the gap, and slide the tick they step out", () => {
    const due = after(newSlide(SCHEDULE), 9);
    const held = after(due, 30, true);
    expect(held).toEqual({ at: "home", left: 1 });
    expect(after(held, 1)).toEqual({ at: "away", left: 5 });
  });

  it("warn SLIDE_WARNING ticks before they slide", () => {
    expect(isSliding({ at: "home", left: SLIDE_WARNING + 1 })).toBe(false);
    expect(isSliding({ at: "home", left: SLIDE_WARNING })).toBe(true);
    expect(isSliding({ at: "away", left: 1 })).toBe(true);
  });
});
