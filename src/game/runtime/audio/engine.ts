/**
 * Plays the recipes in `recipes.ts` with the Web Audio API: no sound files, every sound is
 * oscillators and filtered noise under a short envelope. The AudioContext only exists after
 * `unlock`, which the page calls on the first key or click (browser autoplay rules).
 */
import { Option } from "effect";
import type { Cue, Loop, LoopLevels } from "./cues.ts";
import { CRACKLE, LOOPS, SOUNDS } from "./recipes.ts";
import type { Voice } from "./recipes.ts";

/** The game's sound effects: one-shots and loops, all quiet until unlocked. */
export interface Engine {
  /** Starts (or resumes) audio. Call from a key or pointer event. */
  readonly unlock: () => void;
  readonly play: (cue: Cue) => void;
  /** Once per display frame: loop volumes and the mute switch. */
  readonly frame: (levels: LoopLevels, muted: boolean) => void;
  readonly dispose: () => void;
}

const VOLUME = 0.8;

const LOOP_NAMES: readonly Loop[] = ["sizzle", "fire", "spray"];

/** The live audio graph: buses, the shared noise and the loop gains. */
interface Graph {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly sfx: GainNode;
  readonly noise: AudioBuffer;
  readonly loops: Readonly<Record<Loop, GainNode>>;
}

/** A new engine; silent until `unlock`. */
export function createEngine(): Engine {
  let graph = Option.none<Graph>();
  let muted = false;
  const levels: Record<Loop, number> = { sizzle: 0, fire: 0, spray: 0 };

  const unlock = () => {
    if (Option.isSome(graph)) {
      if (graph.value.ctx.state === "suspended") void graph.value.ctx.resume();

      return;
    }

    if (!("AudioContext" in window)) return;
    graph = Option.some(build(new AudioContext(), muted));
  };

  return {
    unlock,
    play: (cue) => {
      if (Option.isNone(graph)) return;

      for (const v of SOUNDS[cue]) voice(graph.value, v, graph.value.ctx.currentTime, graph.value.sfx);
    },
    frame: (wanted, mute) => {
      const flipped = mute !== muted;
      muted = mute;

      if (Option.isNone(graph)) return;
      const g = graph.value;
      const now = g.ctx.currentTime;

      if (flipped) g.master.gain.setTargetAtTime(mute ? 0 : VOLUME, now, 0.02);

      for (const loop of LOOP_NAMES) {
        // only a real change goes on the automation timeline
        if (Math.abs(wanted[loop] - levels[loop]) < 0.01) continue;
        levels[loop] = wanted[loop];
        g.loops[loop].gain.setTargetAtTime(levels[loop] * LOOPS[loop].gain, now, 0.08);
      }

      if (levels.fire > 0 && Math.random() < levels.fire * 0.3) {
        for (const v of CRACKLE) voice(g, v, now + Math.random() * 0.03, g.sfx);
      }
    },
    dispose: () => {
      if (Option.isSome(graph)) void graph.value.ctx.close();
      graph = Option.none();
    },
  };
}

function build(ctx: AudioContext, muted: boolean): Graph {
  const master = gainTo(ctx, muted ? 0 : VOLUME, ctx.destination);
  const sfx = gainTo(ctx, 1, master);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = noise.getChannelData(0);

  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  const loop = (name: Loop): GainNode => {
    const { filter: type, freq, q } = LOOPS[name];
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = gainTo(ctx, 0, sfx);
    source.connect(filter).connect(gain);
    source.start();

    return gain;
  };

  return { ctx, master, sfx, noise, loops: { sizzle: loop("sizzle"), fire: loop("fire"), spray: loop("spray") } };
}

function gainTo(ctx: AudioContext, value: number, to: AudioNode): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = value;
  gain.connect(to);

  return gain;
}

/** Schedules one voice at `t` seconds on the context clock. */
function voice(g: Graph, v: Voice, t: number, bus: AudioNode): void {
  const { ctx } = g;
  const start = t + v.at;
  const end = start + v.length;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(v.gain, start + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  env.connect(bus);

  if (v.source === "noise") {
    const source = ctx.createBufferSource();
    source.buffer = g.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = v.filter;
    filter.frequency.setValueAtTime(v.from, start);
    filter.frequency.exponentialRampToValueAtTime(v.to, end);
    source.connect(filter).connect(env);
    source.start(start, Math.random() * (g.noise.duration - 0.5));
    source.stop(end + 0.02);

    return;
  }

  const osc = ctx.createOscillator();
  osc.type = v.source;
  osc.frequency.setValueAtTime(v.from, start);
  osc.frequency.exponentialRampToValueAtTime(v.to, end);
  osc.connect(env);
  osc.start(start);
  osc.stop(end + 0.02);
}
