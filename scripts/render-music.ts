/**
 * Renders the music chip offline into a WAV, to hear a kitchen's song without starting the game:
 * `pnpm music [level] [out.wav]`. The run tells a shift's story: the bed alone, the arp, the lead,
 * the DJ mixing into the busy "lift" take, every layer, then the "peak" take for the finale.
 * Prints the loudness of each stretch, so a level change in the mix shows as a number too.
 */
import { writeFileSync } from "node:fs";
import { Chip } from "../src/game/runtime/audio/music/chip.ts";
import { isLevelId } from "../src/game/runtime/levels.ts";

const RATE = 44100;

const BAR = RATE * 60 / 128 * 4;

const [levelArg = "imbiss", out = "music.wav"] = process.argv.slice(2);

if (!isLevelId(levelArg)) throw new Error(`No level "${levelArg}"`);

const level = levelArg;

/** From which bar the kitchen asks for what. */
const STORY = [
  { bar: 0, intensity: 0.1, tune: level, what: "bed" },
  { bar: 8, intensity: 0.35, tune: level, what: "arp" },
  { bar: 16, intensity: 0.6, tune: level, what: "lead" },
  { bar: 24, intensity: 0.7, tune: "lift", what: "lift (busy)" },
  { bar: 32, intensity: 0.9, tune: "lift", what: "counter" },
  { bar: 40, intensity: 0.95, tune: "peak", what: "peak (last seconds)" },
] as const;

const BARS = 60;

const chip = new Chip(RATE);

const left = new Float32Array(BARS * BAR);

const right = new Float32Array(BARS * BAR);

chip.receive({ type: "play", on: true });

for (const [i, chapter] of STORY.entries()) {
  chip.receive({ type: "want", tune: chapter.tune, level, how: "dj" });
  chip.receive({ type: "intensity", value: chapter.intensity });
  const end = Math.round((STORY[i + 1]?.bar ?? BARS) * BAR);

  for (let at = Math.round(chapter.bar * BAR); at < end; at += 128) {
    const to = Math.min(at + 128, end);
    chip.render(left.subarray(at, to), right.subarray(at, to));
  }

  const slice = left.subarray(Math.round(chapter.bar * BAR), end);
  const rms = Math.sqrt(slice.reduce((sum, x) => sum + x * x, 0) / slice.length);
  const peak = slice.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
  const { dj, decks } = chip.status();
  console.log(`bar ${String(chapter.bar).padStart(2)} ${chapter.what.padEnd(20)} rms ${rms.toFixed(3)} peak ${peak.toFixed(2)}  then ${dj} [${decks.join(", ")}]`);
}

writeFileSync(out, wav(left, right));

console.log(`wrote ${out}: ${BARS} bars of ${level}`);

/** A 16-bit stereo WAV file of the two channels. */
function wav(l: Float32Array, r: Float32Array): Buffer {
  const data = Buffer.alloc(44 + l.length * 4);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + l.length * 4, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(l.length * 4, 40);

  for (let i = 0; i < l.length; i++) {
    data.writeInt16LE(Math.round((l[i] ?? 0) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round((r[i] ?? 0) * 32767), 46 + i * 4);
  }

  return data;
}
