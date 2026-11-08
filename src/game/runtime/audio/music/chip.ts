/**
 * The music chip: everything the worklet does, without the worklet, so a test or a script can
 * render it offline. It keeps the bar clock on the sample clock, runs the DJ at every bar line,
 * plays each deck's song through its own voices, lets the stems in by intensity, and mixes the
 * decks through the sidechain, the ping-pong delay and the reverb into a stereo pair.
 */
import { decks, deckGain, nextDj } from "./dj.ts";
import type { Deck, Dj, Spin, Want } from "./dj.ts";
import type { ChipStatus, ToChip } from "./protocol.ts";
import { BPM, compile } from "./score.ts";
import type { Part, Score, Step, Stem } from "./score.ts";
import { songFor } from "./songs.ts";
import { Bass, Drums, Pad, PingPong, Pulse, Reverb, Wave } from "./synth.ts";
import type { Voice } from "./synth.ts";

/** The intensity from which each stem plays; the bass and the pad always do, like the drums. */
const ENTRY: Readonly<Record<Stem, number>> = { bass: 0, pad: 0, arp: 0.25, lead: 0.5, counter: 0.85 };

const STEMS: readonly Stem[] = ["lead", "arp", "counter", "bass", "pad"];

const PARTS: readonly Part[] = [...STEMS, "drums"];

const DECKS: readonly Deck[] = [0, 1];

/** Each part's level in the mix. */
const LEVEL: Readonly<Record<Part, number>> = { lead: 0.13, arp: 0.075, counter: 0.12, bass: 0.3, pad: 0.042, drums: 1 };

/** How far the bed dips under each kick. */
const DUCK = 0.55;

/** Seconds a gain takes to follow a layer entering or a stem changing decks. */
const FOLLOW = 0.015;

/** The echo comes back three sixteenths later: a dotted eighth. */
const ECHO_STEPS = 3;

/** One deck's voices and the song it plays. */
class Turntable {
  readonly lead: Pulse;
  readonly arp: Pulse;
  readonly counter: Wave;
  readonly bass: Bass;
  readonly pad: Pad;
  readonly drums: Drums;
  private score: readonly Score[] = [];
  private start = 0;
  private lastBar = -1;
  private lastStep = -1;

  constructor(rate: number) {
    this.lead = new Pulse(0.25, { attack: 0.004, decay: 0.3, sustain: 0.6, release: 0.08 }, rate);
    this.arp = new Pulse(0.125, { attack: 0.002, decay: 0.12, sustain: 0.5, release: 0.04 }, rate);
    this.counter = new Wave({ attack: 0.006, decay: 0.4, sustain: 0.7, release: 0.1 }, rate);
    this.bass = new Bass(rate);
    this.pad = new Pad(rate);
    this.drums = new Drums(rate);
  }

  /** Puts `score` on with its first bar at clock bar `start`; the same song keeps playing undisturbed. */
  load(score: Score, start: number): void {
    const [playing] = this.score;

    if (playing?.id === score.id && this.start === start) return;
    this.score = [score];
    this.start = start;
    this.lastBar = -1;
    this.lead.setDuty(score.tone.leadDuty);
    this.arp.setDuty(score.tone.arpDuty);
    this.counter.setTable(score.tone.wave);
    this.bass.setCutoff(score.tone.bassCutoff);
    this.pad.setCutoff(score.tone.padCutoff);
  }

  unload(): void {
    if (this.score.length === 0) return;
    this.score = [];
    this.silence();
  }

  silence(): void {
    for (const voice of [this.lead, this.arp, this.counter, this.bass, this.pad]) voice.stop();
  }

  /** Plays the steps that start at clock time `bar` + `within` (0 to 1). */
  advance(bar: number, within: number): void {
    const [score] = this.score;

    if (score === undefined) return;
    const step = Math.floor(within * score.steps);

    if (bar === this.lastBar && step === this.lastStep) return;
    this.lastBar = bar;
    this.lastStep = step;
    const length = score.bars.length;
    const row = score.bars[(((bar - this.start) % length) + length) % length];

    if (row === undefined) return;
    sound(this.lead, row.lead, step);
    sound(this.arp, row.arp, step);
    sound(this.counter, row.counter, step);
    sound(this.bass, row.bass, step);
    sound(this.pad, row.pad, step);
    this.drums.hit(row.drums[step % row.drums.length] ?? []);
  }
}

function sound(voice: Voice | Pad, line: readonly Step[], step: number): void {
  const event = line[step % line.length];

  if (event?.kind === "note") voice.play(event.note, event.arp);
  else if (event?.kind === "rest") voice.stop();
}

/** The chip at a sample rate; quiet until it is told a song and to play. */
export class Chip {
  private dj: Dj = { kind: "silent" };
  private wants: readonly Want[] = [];
  private intensity = 0;
  private playing = false;
  private muted = false;
  private bar = -1;
  /** Samples into the bar clock; it only runs while playing. */
  private clock = 0;
  /** Seconds since the chip started, for the 60 Hz arp. */
  private time = 0;
  private pump = 0;
  private dcL = 0;
  private dcR = 0;
  private lastL = 0;
  private lastR = 0;
  private layers: readonly Stem[] = [];
  private readonly gains = new Float32Array(PARTS.length * DECKS.length);
  private readonly targets = new Float32Array(PARTS.length * DECKS.length);
  private readonly decks: readonly Turntable[];
  private readonly scores = new Map<string, Score>();
  private readonly echo: PingPong;
  private readonly room: Reverb;
  private readonly barLength: number;
  private readonly follow: number;
  private readonly rate: number;

  constructor(rate: number) {
    this.rate = rate;
    this.barLength = rate * 60 / BPM * 4;
    this.decks = DECKS.map(() => new Turntable(rate));
    this.echo = new PingPong(this.barLength / 16 * ECHO_STEPS / rate, rate);
    this.room = new Reverb(rate);
    this.follow = 1 - Math.exp(-1 / (FOLLOW * rate));
  }

  receive(message: ToChip): void {
    switch (message.type) {
      case "want": {
        const song = songFor(message.tune, message.level);

        if (!this.scores.has(song.id)) this.scores.set(song.id, compile(song));
        this.wants = [{ track: { id: song.id, theme: song.theme, grid: song.grid }, how: message.how }];

        return;
      }

      case "intensity":
        this.intensity = Math.min(Math.max(message.value, 0), 1);

        return;
      case "play":
        this.playing = message.on;

        if (!message.on) for (const deck of this.decks) deck.silence();

        return;
      case "mute":
        this.muted = message.on;
    }
  }

  status(): ChipStatus {
    return {
      playing: this.playing,
      bar: this.bar,
      dj: this.dj.kind === "mixing" ? `mixing:${this.dj.fade}` : this.dj.kind,
      decks: decks(this.dj),
      intensity: this.intensity,
      layers: this.layers,
    };
  }

  /** Renders one block into `left` and `right`; true when a bar line passed in it. */
  render(left: Float32Array, right: Float32Array): boolean {
    let newBar = false;
    this.aim();

    for (let i = 0; i < left.length; i++) {
      if (this.playing) {
        const bar = Math.floor(this.clock / this.barLength);

        if (bar !== this.bar) {
          this.onBar(bar);
          newBar = true;
        }

        const within = this.clock / this.barLength - bar;

        for (const deck of this.decks) deck.advance(bar, within);
        this.clock += 1;
      }

      this.time += 1 / this.rate;

      if (this.muted) {
        left[i] = 0;
        right[i] = 0;
      } else {
        this.mix(left, right, i);
      }
    }

    return newBar;
  }

  private onBar(bar: number): void {
    this.bar = bar;

    for (const want of this.wants) this.dj = nextDj(this.dj, bar, want);

    for (const deck of DECKS) {
      const [spin] = spinsOn(this.dj, deck);
      const score = spin === undefined ? undefined : this.scores.get(spin.track.id);
      const table = this.decks[deck];

      if (spin !== undefined && score !== undefined) table?.load(score, spin.start);
      else table?.unload();
    }

    this.layers = STEMS.filter((stem) => this.intensity >= ENTRY[stem]);
  }

  /** Sets where each part's gain on each deck heads during the next block. */
  private aim(): void {
    const at = this.clock / this.barLength;

    PARTS.forEach((part, p) => {
      const layer = part === "drums" || this.layers.includes(part) ? 1 : 0;

      for (const deck of DECKS) this.targets[p * 2 + deck] = deckGain(this.dj, at, part, deck) * layer;
    });
  }

  /** The gain now of the part at index `part` of `PARTS` on `deck`. */
  private gain(part: number, deck: Deck): number {
    return this.gains[part * 2 + deck] ?? 0;
  }

  private mix(left: Float32Array, right: Float32Array, i: number): void {
    const duck = 1 - DUCK * this.pump;
    let l = 0;
    let r = 0;
    let echoIn = 0;
    let roomIn = 0;
    let pump = 0;

    for (let g = 0; g < this.gains.length; g++) this.gains[g] = (this.gains[g] ?? 0) + ((this.targets[g] ?? 0) - (this.gains[g] ?? 0)) * this.follow;

    for (const deck of DECKS) {
      const table = this.decks[deck];

      if (table === undefined) continue;
      const lead = table.lead.next(this.time) * this.gain(0, deck) * LEVEL.lead;
      const arp = table.arp.next(this.time) * this.gain(1, deck) * LEVEL.arp * duck;
      const counter = table.counter.next() * this.gain(2, deck) * LEVEL.counter;
      const bass = table.bass.next() * this.gain(3, deck) * LEVEL.bass * duck;
      table.pad.next();
      const padL = table.pad.left * this.gain(4, deck) * LEVEL.pad * duck;
      const padR = table.pad.right * this.gain(4, deck) * LEVEL.pad * duck;
      table.drums.next();
      const drums = this.gain(5, deck);
      const kick = table.drums.kick * drums * 0.42;
      const snare = table.drums.snare * drums * 0.16;
      const hat = table.drums.hat * drums * 0.05;
      pump = Math.max(pump, table.drums.pump * drums);

      l += lead + arp * 1.2 + counter * 0.8 + bass + padL + kick + snare + hat * 0.8;
      r += lead + arp * 0.8 + counter * 1.2 + bass + padR + kick + snare + hat * 1.2;
      echoIn += lead * 0.35 + arp * 0.6;
      roomIn += (padL + padR) * 0.6 + lead * 0.3 + counter * 0.2 + snare * 0.4;
    }

    this.pump = pump;
    this.echo.next(echoIn);
    this.room.next(roomIn);
    l += this.echo.left * 0.7 + this.room.left * duck;
    r += this.echo.right * 0.7 + this.room.right * duck;
    // a DC blocker for the pulse voices' offset, then a soft clip instead of a hard one
    this.dcL = l - this.lastL + 0.995 * this.dcL;
    this.dcR = r - this.lastR + 0.995 * this.dcR;
    this.lastL = l;
    this.lastR = r;
    left[i] = Math.tanh(this.dcL * 1.2);
    right[i] = Math.tanh(this.dcR * 1.2);
  }
}

/** The song on `deck`, as a list of none or one. */
function spinsOn(dj: Dj, deck: Deck): readonly Spin[] {
  switch (dj.kind) {
    case "silent": return [];
    case "hold": return dj.spin.deck === deck ? [dj.spin] : [];
    case "mixing": return [dj.from, dj.to].filter((spin) => spin.deck === deck);
  }
}
