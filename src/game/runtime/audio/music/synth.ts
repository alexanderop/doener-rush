/**
 * The voices and effects the chip renders sample by sample. The Game Boy half: two pulse voices
 * (one cycles its chord at 60 Hz for the arp), a 4-bit wave voice and a 15-bit LFSR noise voice.
 * The synthwave half: a filtered saw bass, a detuned stereo pad, a kick, a snare, and a ping-pong
 * delay and small reverb after them. No Web Audio, no randomness: the same cues render the same samples.
 */
import type { Hit } from "./score.ts";

const TAU = Math.PI * 2;

/** A MIDI note's pitch in Hz. */
function hz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** The per-sample factor that closes most of a gap in `seconds`. */
function glide(seconds: number, rate: number): number {
  return 1 - Math.exp(-1 / Math.max(1, seconds * rate));
}

/** Smooths the step of a naive oscillator where its phase wraps, so high notes do not alias into noise. */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;

    return x + x - x * x - 1;
  }

  if (t > 1 - dt) {
    const x = (t - 1) / dt;

    return x * x + x + x + 1;
  }

  return 0;
}

/** Attack, decay and release times in seconds, and the level a held note decays to. */
interface Adsr {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

class Envelope {
  private level = 0;
  private stage: "attack" | "decay" | "release" = "release";
  private readonly attack: number;
  private readonly decay: number;
  private readonly release: number;
  private readonly sustain: number;

  constructor(adsr: Adsr, rate: number) {
    this.attack = glide(adsr.attack, rate);
    this.decay = glide(adsr.decay, rate);
    this.release = glide(adsr.release, rate);
    this.sustain = adsr.sustain;
  }

  open(): void {
    this.stage = "attack";
  }

  close(): void {
    this.stage = "release";
  }

  next(): number {
    if (this.stage === "attack") {
      this.level += (1.1 - this.level) * this.attack;

      if (this.level >= 1) {
        this.level = 1;
        this.stage = "decay";
      }
    } else if (this.stage === "decay") {
      this.level += (this.sustain - this.level) * this.decay;
    } else {
      this.level -= this.level * this.release;
    }

    return this.level;
  }
}

/** A melodic voice: plays a note with its arp offsets, stops, and renders one sample at a time. */
export interface Voice {
  readonly play: (note: number, arp: readonly number[]) => void;
  readonly stop: () => void;
  /** One sample; `time` in seconds drives the 60 Hz arp. */
  readonly next: (time: number) => number;
}

/** A Game Boy pulse channel: a square wave of adjustable duty that steps through its chord at 60 Hz. */
export class Pulse implements Voice {
  private phase = 0;
  private freqs: readonly number[] = [440];
  private duty: number;
  private readonly env: Envelope;
  private readonly rate: number;

  constructor(duty: number, adsr: Adsr, rate: number) {
    this.duty = duty;
    this.env = new Envelope(adsr, rate);
    this.rate = rate;
  }

  setDuty(duty: number): void {
    this.duty = duty;
  }

  play(note: number, arp: readonly number[]): void {
    this.freqs = arp.map((offset) => hz(note + offset));
    this.env.open();
  }

  stop(): void {
    this.env.close();
  }

  next(time: number): number {
    const amp = this.env.next();

    if (amp < 1e-4) return 0;
    const freq = this.freqs[Math.floor(time * 60) % this.freqs.length] ?? 440;
    const dt = freq / this.rate;
    this.phase = (this.phase + dt) % 1;
    const square = (this.phase < this.duty ? 1 : -1) + polyBlep(this.phase, dt) - polyBlep((this.phase - this.duty + 1) % 1, dt);

    return square * amp;
  }
}

/** The Game Boy wave channel: a 32-step table of 4-bit samples, played stepped as the hardware does. */
export class Wave implements Voice {
  private phase = 0;
  private freq = 440;
  private table = new Float32Array(32);
  private smooth = 0;
  private readonly env: Envelope;
  private readonly soften: number;
  private readonly rate: number;

  constructor(adsr: Adsr, rate: number) {
    this.rate = rate;
    this.env = new Envelope(adsr, rate);
    this.soften = glide(1 / (TAU * 6000), rate);
  }

  /** Loads a table written as 32 hex digits. */
  setTable(hex: string): void {
    this.table = Float32Array.from(hex.padEnd(32, "0").slice(0, 32), (digit) => parseInt(digit, 16) / 7.5 - 1);
  }

  play(note: number): void {
    this.freq = hz(note);
    this.env.open();
  }

  stop(): void {
    this.env.close();
  }

  next(): number {
    const amp = this.env.next();
    this.phase = (this.phase + this.freq / this.rate) % 1;
    this.smooth += ((this.table[Math.floor(this.phase * 32)] ?? 0) * amp - this.smooth) * this.soften;

    return this.smooth;
  }
}

/** The Game Boy noise channel: a 15-bit linear-feedback shift register, or a 7-bit loop in short mode. */
class Lfsr {
  private register = 0x7fff;
  private clock = 0;

  next(rateHz: number, short: boolean, sampleRate: number): number {
    this.clock += rateHz / sampleRate;

    while (this.clock >= 1) {
      this.clock -= 1;
      const bit = (this.register ^ (this.register >> 1)) & 1;
      this.register = (this.register >> 1) | (bit << 14);

      if (short) this.register = (this.register & ~0x40) | (bit << 6);
    }

    return (this.register & 1) === 1 ? -1 : 1;
  }
}

/** A sawtooth through a resonant lowpass whose cutoff opens on each note: the synthwave bass. */
export class Bass implements Voice {
  private phase = 0;
  private freq = 55;
  private low = 0;
  private band = 0;
  private cutoff = 600;
  private readonly env: Envelope;
  private readonly sweep: Envelope;
  private readonly rate: number;

  constructor(rate: number) {
    this.rate = rate;
    this.env = new Envelope({ attack: 0.003, decay: 0.25, sustain: 0.7, release: 0.06 }, rate);
    this.sweep = new Envelope({ attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 }, rate);
  }

  setCutoff(hertz: number): void {
    this.cutoff = hertz;
  }

  play(note: number): void {
    this.freq = hz(note);
    this.env.open();
    this.sweep.open();
  }

  stop(): void {
    this.env.close();
  }

  next(): number {
    const amp = this.env.next();
    const cutoff = Math.min(this.cutoff * (1 + 3 * this.sweep.next()), this.rate / 7);

    if (amp < 1e-4) return 0;
    const dt = this.freq / this.rate;
    this.phase = (this.phase + dt) % 1;
    const saw = 2 * this.phase - 1 - polyBlep(this.phase, dt);
    const f = 2 * Math.sin(Math.PI * cutoff / this.rate);
    this.low += f * this.band;
    this.band += f * (saw - this.low - 0.6 * this.band);

    return this.low * amp;
  }
}

/** Up to five chord notes, each two saws detuned apart and spread left and right: the pad. */
export class Pad {
  left = 0;
  right = 0;
  private freqs: number[] = [];
  private readonly phases = new Float64Array(10);
  private lowL = 0;
  private lowR = 0;
  private soften = 0.1;
  private readonly env: Envelope;
  private readonly rate: number;

  constructor(rate: number) {
    this.rate = rate;
    this.env = new Envelope({ attack: 0.02, decay: 0.6, sustain: 0.65, release: 0.3 }, rate);
  }

  setCutoff(hertz: number): void {
    this.soften = glide(1 / (TAU * hertz), this.rate);
  }

  play(note: number, chord: readonly number[]): void {
    this.freqs = chord.slice(0, 5).flatMap((offset) => {
      const pitch = hz(note + offset);

      return [pitch * 0.996, pitch * 1.004];
    });

    this.env.open();
  }

  stop(): void {
    this.env.close();
  }

  next(): void {
    const amp = this.env.next();
    let l = 0;
    let r = 0;

    for (let i = 0; i < this.freqs.length; i++) {
      const dt = (this.freqs[i] ?? 0) / this.rate;
      const phase = ((this.phases[i] ?? 0) + dt) % 1;
      this.phases[i] = phase;
      const saw = 2 * phase - 1 - polyBlep(phase, dt);

      if (i % 2 === 0) l += saw;
      else r += saw;
    }

    this.lowL += (l * amp - this.lowL) * this.soften;
    this.lowR += (r * amp - this.lowR) * this.soften;
    this.left = this.lowL;
    this.right = this.lowR;
  }
}

/** Seconds since a drum was struck; a long-silent drum reads as this. */
const QUIET = 10;

/** The kick and snare of the bed, and hats on the chip's noise voice. */
export class Drums {
  kick = 0;
  snare = 0;
  hat = 0;
  /** How loud the kick still rings, 0 to 1; the bed ducks under it. */
  pump = 0;
  private kickT = QUIET;
  private snareT = QUIET;
  private hatT = QUIET;
  private hatDecay = 0.03;
  private kickPhase = 0;
  private snarePhase = 0;
  private hatLow = 0;
  private snareLow = 0;
  private readonly noise = new Lfsr();
  private readonly metal = new Lfsr();
  private readonly rate: number;

  constructor(rate: number) {
    this.rate = rate;
  }

  hit(hits: readonly Hit[]): void {
    for (const hit of hits) {
      if (hit === "kick") this.kickT = 0;

      if (hit === "snare") this.snareT = 0;

      if (hit === "hat" || hit === "open") {
        this.hatT = 0;
        this.hatDecay = hit === "open" ? 0.18 : 0.03;
      }
    }
  }

  next(): void {
    const step = 1 / this.rate;

    this.pump = Math.exp(-this.kickT / 0.2);
    const kickFreq = 45 + 110 * Math.exp(-this.kickT / 0.03);
    this.kickPhase = (this.kickPhase + kickFreq * step) % 1;
    this.kick = Math.sin(TAU * this.kickPhase) * Math.exp(-this.kickT / 0.25);
    this.kickT = Math.min(this.kickT + step, QUIET);

    this.snarePhase = (this.snarePhase + 185 * step) % 1;
    const rattle = this.noise.next(14000, false, this.rate);
    this.snareLow += (rattle - this.snareLow) * 0.35;
    this.snare = (rattle - this.snareLow) * Math.exp(-this.snareT / 0.13) + 0.5 * Math.sin(TAU * this.snarePhase) * Math.exp(-this.snareT / 0.05);
    this.snareT = Math.min(this.snareT + step, QUIET);

    const sizzle = this.metal.next(36000, true, this.rate);
    this.hatLow += (sizzle - this.hatLow) * 0.5;
    this.hat = (sizzle - this.hatLow) * Math.exp(-this.hatT / this.hatDecay);
    this.hatT = Math.min(this.hatT + step, QUIET);
  }
}

/** A dotted-eighth echo that bounces between the left and the right channel. */
export class PingPong {
  left = 0;
  right = 0;
  private readonly bufL: Float32Array;
  private readonly bufR: Float32Array;
  private index = 0;
  private dampL = 0;
  private dampR = 0;

  constructor(seconds: number, rate: number) {
    const length = Math.max(1, Math.round(seconds * rate));
    this.bufL = new Float32Array(length);
    this.bufR = new Float32Array(length);
  }

  next(input: number): void {
    const outL = this.bufL[this.index] ?? 0;
    const outR = this.bufR[this.index] ?? 0;
    this.dampL += (outL - this.dampL) * 0.4;
    this.dampR += (outR - this.dampR) * 0.4;
    // the left line hears the input and the right echo, the right line only the left echo
    this.bufL[this.index] = input + this.dampR * 0.42;
    this.bufR[this.index] = this.dampL * 0.42;
    this.index = (this.index + 1) % this.bufL.length;
    this.left = outL;
    this.right = outR;
  }
}

class Comb {
  private readonly buffer: Float32Array;
  private index = 0;
  private damp = 0;

  constructor(length: number) {
    this.buffer = new Float32Array(length);
  }

  next(input: number): number {
    const out = this.buffer[this.index] ?? 0;
    this.damp += (out - this.damp) * 0.6;
    this.buffer[this.index] = input + this.damp * 0.8;
    this.index = (this.index + 1) % this.buffer.length;

    return out;
  }
}

class Allpass {
  private readonly buffer: Float32Array;
  private index = 0;

  constructor(length: number) {
    this.buffer = new Float32Array(length);
  }

  next(input: number): number {
    const delayed = this.buffer[this.index] ?? 0;
    this.buffer[this.index] = input + delayed * 0.5;
    this.index = (this.index + 1) % this.buffer.length;

    return delayed - input;
  }
}

/** Comb lengths of Freeverb at 44.1 kHz; the right channel's are a little longer, which makes it wide. */
const COMBS = [1116, 1188, 1277, 1356];

const ALLPASSES = [556, 441];

/** A small Schroeder room: four combs into two allpasses per channel. */
export class Reverb {
  left = 0;
  right = 0;
  private readonly combsL: Comb[];
  private readonly combsR: Comb[];
  private readonly passL: Allpass[];
  private readonly passR: Allpass[];

  constructor(rate: number) {
    const scale = rate / 44100;
    const sized = (length: number) => Math.max(1, Math.round(length * scale));
    this.combsL = COMBS.map((length) => new Comb(sized(length)));
    this.combsR = COMBS.map((length) => new Comb(sized(length + 23)));
    this.passL = ALLPASSES.map((length) => new Allpass(sized(length)));
    this.passR = ALLPASSES.map((length) => new Allpass(sized(length + 23)));
  }

  next(input: number): void {
    let l = 0;
    let r = 0;

    for (const comb of this.combsL) l += comb.next(input);

    for (const comb of this.combsR) r += comb.next(input);

    for (const pass of this.passL) l = pass.next(l);

    for (const pass of this.passR) r = pass.next(r);
    this.left = l * 0.25;
    this.right = r * 0.25;
  }
}
