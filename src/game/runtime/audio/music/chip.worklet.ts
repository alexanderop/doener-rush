/**
 * The AudioWorklet entry: registers a processor that renders the chip on the audio thread. The
 * page only posts small cues (the song it wants, the intensity, play, mute); the chip answers with
 * its status at every bar line.
 */
import { Chip } from "./chip.ts";
import { CHIP } from "./protocol.ts";
import type { ToChip } from "./protocol.ts";

declare global {
  /** The audio thread's sample rate, a global of the worklet scope. */
  const sampleRate: number;

  /** The base class of every worklet processor. */
  class AudioWorkletProcessor {
    readonly port: MessagePort;
  }

  /** Makes a processor class available to `new AudioWorkletNode(context, name)`. */
  function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;
}

class ChipProcessor extends AudioWorkletProcessor {
  private readonly chip = new Chip(sampleRate);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<ToChip>) => {
      this.chip.receive(event.data);

      if (event.data.type === "play") this.port.postMessage(this.chip.status());
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, right] = outputs[0] ?? [];

    if (left === undefined || right === undefined) return true;

    if (this.chip.render(left, right)) this.port.postMessage(this.chip.status());

    return true;
  }
}

registerProcessor(CHIP, ChipProcessor);
