import { Option } from "effect";
import { describe, expect, it } from "vitest";
import { isUnlocked, loadProgress, parseProgress, recordShift, saveProgress } from "./progress.ts";
import type { ProgressStore } from "./progress.ts";

function memory(): ProgressStore {
  const items = new Map<string, string>();

  return { read: (key) => Option.fromUndefinedOr(items.get(key)), write: (key, value) => void items.set(key, value) };
}

describe("given a fresh save", () => {
  it("opens only the first level", () => {
    expect(isUnlocked({}, "erster-tag")).toBe(true);
    expect(isUnlocked({}, "imbiss")).toBe(false);
  });

  it("opens the next level once a shift there earns a star, and keeps it open after a worse shift", () => {
    const { progress } = recordShift({}, "erster-tag", 80, 1);
    expect(isUnlocked(progress, "imbiss")).toBe(true);
    expect(isUnlocked(progress, "durchreiche")).toBe(false);
    expect(isUnlocked(recordShift(progress, "erster-tag", 10, 0).progress, "imbiss")).toBe(true);
  });

  it("does not open the next level for a shift without stars", () => {
    expect(isUnlocked(recordShift({}, "erster-tag", 20, 0).progress, "imbiss")).toBe(false);
  });
});

describe("given a level played before", () => {
  const before = recordShift({}, "imbiss", 120, 1).progress;

  it("calls a higher score a new record and keeps it as the best", () => {
    const outcome = recordShift(before, "imbiss", 150, 2);
    expect(outcome.record).toBe(true);
    expect(outcome.previous).toEqual(Option.some(120));
    expect(outcome.progress.imbiss).toEqual({ score: 150, stars: 2 });
  });

  it("keeps the old best after a worse shift, and adding it again changes nothing", () => {
    const worse = recordShift(before, "imbiss", 90, 0);
    expect(worse.record).toBe(false);
    expect(worse.progress.imbiss).toEqual({ score: 120, stars: 1 });
    expect(recordShift(worse.progress, "imbiss", 90, 0).progress).toEqual(worse.progress);
  });
});

describe("given the save in a store", () => {
  it("reads back what it wrote", () => {
    const store = memory();
    const { progress } = recordShift({}, "schlauch", 200, 3);
    saveProgress(progress, store);
    expect(loadProgress(store)).toEqual(progress);
  });

  it("starts empty when there is no save, the text is broken, or a value is out of range", () => {
    expect(loadProgress(memory())).toEqual({});
    expect(parseProgress("{not json")).toEqual({});
    expect(parseProgress(JSON.stringify({ imbiss: { score: 10, stars: 7 } }))).toEqual({});
  });

  it("ignores levels the game no longer has", () => {
    expect(parseProgress(JSON.stringify({ imbiss: { score: 10, stars: 0 }, gone: { score: 5, stars: 1 } }))).toEqual({ imbiss: { score: 10, stars: 0 } });
  });
});
