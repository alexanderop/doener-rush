import type { StartView } from "../start.ts";
import type { World } from "../world.ts";
import { SILENT, cuesBetween, hear, loopLevels } from "./cues.ts";
import { createEngine } from "./engine.ts";

/** The sound of one shift: listens to its world each frame and plays what changed. */
export interface Soundtrack {
  /** Starts audio; call from a key or pointer event. */
  readonly unlock: () => void;
  /** Once per display frame, after the ticks. */
  readonly frame: (start: StartView, paused: boolean, muted: boolean) => void;
  readonly dispose: () => void;
}

/** The soundtrack of `world`. */
export function createSoundtrack(world: World): Soundtrack {
  const engine = createEngine();
  let heard = hear(world);
  let beat = -1;

  // after "Nochmal" the page has had its gesture already, so the new round may sound at once
  if (navigator.userActivation.hasBeenActive) engine.unlock();

  return {
    unlock: engine.unlock,
    frame: (start, paused, muted) => {
      if (start.beat !== beat) {
        beat = start.beat;

        if (beat > 0) engine.play("count");

        if (beat === 0) engine.play("go");
      }

      if (world.tick !== heard.tick) {
        const next = hear(world);

        for (const cue of cuesBetween(heard, next)) engine.play(cue);
        heard = next;
      }

      const live = !paused && !heard.over && start.phase !== "intro";
      engine.frame(live ? loopLevels(heard) : SILENT, muted);
    },
    dispose: engine.dispose,
  };
}
