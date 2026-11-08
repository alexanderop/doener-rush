import type { LevelId } from "../levels.ts";
import type { StartView } from "../start.ts";
import type { World } from "../world.ts";
import { FIRST_TAKE, SILENT, cuesBetween, hear, intensity, loopLevels, nextTake } from "./cues.ts";
import { createEngine } from "./engine.ts";
import type { MusicProbe } from "./music/player.ts";

/** The sound of one shift: listens to its world each frame and plays what changed. */
export interface Soundtrack {
  /** Starts audio; call from a key or pointer event. */
  readonly unlock: () => void;
  /** Once per display frame, after the ticks. */
  readonly frame: (start: StartView, paused: boolean, muted: boolean) => void;
  /** What the music does now, for the dev hook. */
  readonly music: () => MusicProbe;
  readonly dispose: () => void;
}

/** The soundtrack of `world`, played in kitchen `level`. */
export function createSoundtrack(world: World, level: LevelId): Soundtrack {
  const engine = createEngine();
  let heard = hear(world);
  let take = FIRST_TAKE;
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
        take = nextTake(take, heard);
      }

      const live = !paused && !heard.over && start.phase !== "intro";
      const music = { playing: live, tune: take.take === "level" ? level : take.take, level, how: "dj", intensity: intensity(heard) } as const;
      engine.frame(live ? loopLevels(heard) : SILENT, music, muted);
    },
    music: engine.probe,
    dispose: engine.dispose,
  };
}
