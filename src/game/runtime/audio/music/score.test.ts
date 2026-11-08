import { describe, expect, it } from "vitest";
import { REST, compile, parseHits, parseNotes } from "./score.ts";
import type { Row, Song } from "./score.ts";

const TONE = { leadDuty: 0.25, arpDuty: 0.125, wave: "0123456789abcdeffedcba9876543210", bassCutoff: 600, padCutoff: 1800 };

const row = (lead: string, drums = REST): Row => ({ lead, arp: REST, counter: REST, bass: REST, pad: REST, drums });

const song = (patterns: Song["patterns"], order: readonly Row[]): Song => ({ id: "test", theme: "t", grid: "4/4", tone: TONE, patterns, order });

describe("parsing a pattern line", () => {
  it("reads note names as MIDI numbers, C4 being middle C", () => {
    expect(parseNotes("C4 F#3 Bb2 E-1")).toEqual([
      { kind: "note", note: 60, arp: [0] },
      { kind: "note", note: 54, arp: [0] },
      { kind: "note", note: 46, arp: [0] },
      { kind: "note", note: 4, arp: [0] },
    ]);
  });

  it("reads `-` as holding the note and `.` as a rest", () => {
    expect(parseNotes("A4 - . -").map((step) => step.kind)).toEqual(["note", "hold", "rest", "hold"]);
  });

  it("reads an arp chord as semitones above the root, hex digits past nine", () => {
    expect(parseNotes("C4:47")).toEqual([{ kind: "note", note: 60, arp: [0, 4, 7] }]);
    expect(parseNotes("E3:47a")).toEqual([{ kind: "note", note: 52, arp: [0, 4, 7, 10] }]);
  });

  it("ignores the bar lines between tokens", () => {
    expect(parseNotes("C4 - | D4 -")).toHaveLength(4);
  });

  it("refuses a token that is no note", () => {
    expect(() => parseNotes("C4 H4")).toThrow(/H4/u);
  });

  it("reads drum tokens as the hits on each step", () => {
    expect(parseHits("k . kh s o")).toEqual([["kick"], [], ["kick", "hat"], ["snare"], ["open"]]);
    expect(() => parseHits("x")).toThrow(/x/u);
  });
});

describe("compiling a song", () => {
  it("plays each row's patterns bar by bar and keeps a rested part silent", () => {
    const score = compile(song({ up: "C4 - - - D4 - - - E4 - - - F4 - - -", beat: "k h s h" }, [row("up", "beat"), row(REST)]));
    expect(score.steps).toBe(16);
    expect(score.bars[0]?.lead[8]).toEqual({ kind: "note", note: 64, arp: [0] });
    expect(score.bars[0]?.drums).toEqual([["kick"], ["hat"], ["snare"], ["hat"]]);
    expect(score.bars[1]?.lead).toEqual([{ kind: "rest" }]);
  });

  it("refuses a pattern that does not fill a bar evenly or is missing", () => {
    expect(() => compile(song({ short: "C4 - - - - - - - - - - - - - -" }, [row("short")]))).toThrow(/15 steps/u);
    expect(() => compile(song({}, [row("gone")]))).toThrow(/gone/u);
  });
});
