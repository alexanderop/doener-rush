import type { MusicProbe } from "./audio/music/player.ts";
import type { PlayerInput } from "./lineup.ts";
import type { Snapshot } from "./step.ts";
import { run, snapshot } from "./step.ts";
import type { World } from "./world.ts";

/** What `window.__game` offers agents and e2e tests in a dev build. */
interface DevGame {
  /** The live world, for reading state the HUD does not show. */
  readonly world: () => World;
  /** Runs ticks right now, with the given intents (idle when omitted). */
  readonly step: (ticks: number, intents?: readonly PlayerInput[]) => Snapshot;
  /** What the HUD shows now. */
  readonly snapshot: () => Snapshot;
  /** What the music does: the worklet loaded, the DJ and its decks, the bar, the intensity, the output loudness. */
  readonly music: () => MusicProbe;
  /** Plays the 3D view's animations at `factor` of real time (1 is normal), to look at a quick one frame by frame. */
  readonly slowmo: (factor: number) => void;
}

declare global {
  interface Window {
    __game?: DevGame;
  }
}

/** Installs `window.__game` for the given world, its music and the view's clock speed; returns the uninstaller. */
export function installDevGame(current: () => World, music: () => MusicProbe, slowmo: (factor: number) => void): () => void {
  window.__game = {
    world: current,
    step: (ticks, intents = []) => {
      run(current(), ticks, intents);

      return snapshot(current());
    },
    snapshot: () => snapshot(current()),
    music,
    slowmo,
  };

  return () => {
    delete window.__game;
  };
}
