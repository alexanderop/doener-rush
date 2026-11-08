import { describe, expect, it } from "vitest";
import { Chip } from "./chip.ts";

/** A low rate keeps the test fast; one bar at 128 BPM is 1.875 seconds. */
const RATE = 8000;

const BAR = RATE * 60 / 128 * 4;

/** Renders `bars` bars and returns the left channel. */
function listen(chip: Chip, bars: number): Float32Array {
  const out = new Float32Array(Math.round(bars * BAR));
  const right = new Float32Array(128);

  for (let at = 0; at < out.length; at += 128) {
    const block = out.subarray(at, Math.min(at + 128, out.length));
    chip.render(block, right.subarray(0, block.length));
  }

  return out;
}

const rms = (samples: Float32Array) => Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);

function playing(intensity: number): Chip {
  const chip = new Chip(RATE);
  chip.receive({ type: "want", tune: "imbiss", level: "imbiss", how: "dj" });
  chip.receive({ type: "intensity", value: intensity });
  chip.receive({ type: "play", on: true });

  return chip;
}

describe("the music chip", () => {
  it("stays silent until it is told to play", () => {
    const chip = new Chip(RATE);
    chip.receive({ type: "want", tune: "imbiss", level: "imbiss", how: "dj" });
    expect(rms(listen(chip, 1))).toBe(0);
  });

  it("plays a kitchen's song as finite samples that never clip", () => {
    const samples = listen(playing(1), 2);
    expect(rms(samples)).toBeGreaterThan(0.02);
    expect(samples.every((x) => Number.isFinite(x) && Math.abs(x) <= 1)).toBe(true);
  });

  it("lets the lead in at half intensity and the counter-melody only near the top", () => {
    const calm = playing(0.1);
    const busy = playing(0.6);
    const top = playing(0.9);

    for (const chip of [calm, busy, top]) listen(chip, 1);
    expect(calm.status().layers).toEqual(["bass", "pad"]);
    expect(busy.status().layers).toEqual(["lead", "arp", "bass", "pad"]);
    expect(top.status().layers).toContain("counter");
    expect(rms(listen(top, 2))).toBeGreaterThan(rms(listen(calm, 2)));
  });

  it("mixes into the busy take on the sample clock: sixteen bars held, four bars blended", () => {
    const chip = playing(0.7);
    listen(chip, 1);
    chip.receive({ type: "want", tune: "lift", level: "imbiss", how: "dj" });
    listen(chip, 15.5);
    expect(chip.status()).toMatchObject({ bar: 16, dj: "mixing:blend", decks: ["imbiss", "lift@imbiss"] });
    listen(chip, 4);
    expect(chip.status()).toMatchObject({ bar: 20, dj: "hold", decks: ["", "lift@imbiss"] });
  });

  it("holds its place through a pause and goes quiet meanwhile", () => {
    const chip = playing(0.7);
    listen(chip, 2.5);
    chip.receive({ type: "play", on: false });
    const paused = listen(chip, 3);
    expect(chip.status()).toMatchObject({ playing: false, bar: 2 });
    expect(rms(paused.subarray(paused.length / 2))).toBeLessThan(0.002);
  });
});
