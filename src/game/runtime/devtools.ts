import type { Intent } from "../../features/cooks/public.ts";
import type { Snapshot } from "./step.ts";
import { run, snapshot } from "./step.ts";
import type { World } from "./world.ts";

/** What `window.__game` offers agents and e2e tests in a dev build. */
interface DevGame {
  /** The live world, for reading state the HUD does not show. */
  readonly world: () => World;
  /** Runs ticks right now, with the given intents (idle when omitted). */
  readonly step: (ticks: number, intents?: readonly Intent[]) => Snapshot;
  /** What the HUD shows now. */
  readonly snapshot: () => Snapshot;
}

declare global {
  interface Window {
    __game?: DevGame;
  }
}

/** Installs `window.__game` for the given world; returns the uninstaller. */
export function installDevGame(current: () => World): () => void {
  window.__game = {
    world: current,
    step: (ticks, intents = []) => {
      run(current(), ticks, intents);

      return snapshot(current());
    },
    snapshot: () => snapshot(current()),
  };

  return () => {
    delete window.__game;
  };
}
