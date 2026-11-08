/**
 * The page's side of the music: loads the chip worklet into the AudioContext, posts it a cue only
 * when one changes, and keeps the chip's last status and an analyser for the dev hook.
 */
import { Option } from "effect";
import type { LevelId } from "../../levels.ts";
import chipUrl from "./chip.worklet.ts?worker&url";
import type { How } from "./dj.ts";
import { CHIP } from "./protocol.ts";
import type { ChipStatus, ToChip } from "./protocol.ts";
import type { Tune } from "./songs.ts";

/** What the music should do this frame. */
export interface MusicCue {
  readonly playing: boolean;
  readonly tune: Tune;
  readonly level: LevelId;
  readonly how: How;
  readonly intensity: number;
}

/** What the music does now, for `window.__game.music()`. */
export interface MusicProbe {
  /** The worklet has loaded and its node is connected. */
  readonly loaded: boolean;
  readonly status: ChipStatus;
  /** Loudness of the music bus right now, 0 to 1. */
  readonly rms: number;
}

/** The music of one AudioContext. */
export interface Player {
  readonly cue: (music: MusicCue, muted: boolean) => void;
  readonly probe: () => MusicProbe;
}

const MUSIC_VOLUME = 0.35;

const QUIET: ChipStatus = { playing: false, bar: -1, dj: "silent", decks: ["", ""], intensity: 0, layers: [] };

/** The probe before audio is unlocked. */
export const NO_MUSIC: MusicProbe = { loaded: false, status: QUIET, rms: 0 };

/** Starts loading the chip into `ctx`; it plays into `destination` once loaded. */
export function createPlayer(ctx: AudioContext, destination: AudioNode): Player {
  const volume = ctx.createGain();
  volume.gain.value = MUSIC_VOLUME;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  volume.connect(analyser).connect(destination);
  const samples = new Float32Array(analyser.fftSize);
  let node = Option.none<AudioWorkletNode>();
  let latest = Option.none<{ readonly music: MusicCue; readonly muted: boolean }>();
  let status = QUIET;
  // what the chip was last told, per message type, so a frame only posts what changed
  const told = new Map<ToChip["type"], string>();

  const tell = (port: MessagePort, message: ToChip, key: string) => {
    if (told.get(message.type) === key) return;
    told.set(message.type, key);
    port.postMessage(message);
  };

  const flush = () => {
    if (Option.isNone(node) || Option.isNone(latest)) return;
    const { port } = node.value;
    const { music, muted } = latest.value;
    // the song first, so the first bar the chip plays already knows it
    tell(port, { type: "want", tune: music.tune, level: music.level, how: music.how }, `${music.tune}@${music.level}:${music.how}`);
    tell(port, { type: "intensity", value: music.intensity }, music.intensity.toFixed(2));
    tell(port, { type: "mute", on: muted }, String(muted));
    tell(port, { type: "play", on: music.playing }, String(music.playing));
  };

  ctx.audioWorklet.addModule(chipUrl).then(() => {
    const chip = new AudioWorkletNode(ctx, CHIP, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    chip.port.onmessage = (event: MessageEvent<ChipStatus>) => {
      status = event.data;
    };

    chip.connect(volume);
    node = Option.some(chip);
    flush();
  }, () => {
    console.warn("Döner Rush: the music worklet did not load; the game plays without music.");
  });

  return {
    cue: (music, muted) => {
      latest = Option.some({ music, muted });
      flush();
    },
    probe: () => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);

      return { loaded: Option.isSome(node), status, rms };
    },
  };
}
