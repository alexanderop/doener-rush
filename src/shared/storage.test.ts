import { Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStorage, writeStorage } from "./storage.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("given storage the browser blocks or that is full", () => {
  it("reads nothing and forgets writes without throwing", () => {
    const refuse = () => {
      throw new Error("SecurityError");
    };

    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse });
    expect(readStorage("k")).toEqual(Option.none());
    expect(() => writeStorage("k", "v")).not.toThrow();
  });
});

describe("given working storage", () => {
  it("reads back what it wrote", () => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) });
    writeStorage("k", "v");
    expect(readStorage("k")).toEqual(Option.some("v"));
  });
});
