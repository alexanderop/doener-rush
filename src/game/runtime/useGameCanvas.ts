import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { TICK_MS } from "../core/grid.ts";
import { mutedAtom, pausedAtom, snapshotAtom, startAtom } from "./atoms.ts";
import { createSoundtrack } from "./audio/soundtrack.ts";
import { createShopView } from "./gl/scene.ts";
import { installDevGame } from "./devtools.ts";
import { newPad, readPad } from "./input/gamepad.ts";
import { GAME_KEYS, keyDown, keyUp, newKeys, releaseAll, takeIntents } from "./input/input.ts";
import { pollPads } from "./input/pads.ts";
import { advanceStart, newStart, startView } from "./start.ts";
import { isOver, snapshot, step } from "./step.ts";
import type { World } from "./world.ts";

/** Most ticks one frame may run; a longer stall drops time instead of spiralling. */
const MAX_TICKS_PER_FRAME = 5;

/** Ticks between two HUD snapshots (10 a second). */
const SNAPSHOT_EVERY = 6;

/**
 * Runs the game on a canvas: keyboard and gamepads in (pads polled once a frame), fixed 60 Hz
 * ticks (Game Loop pattern), one draw per display frame in 3D, and a snapshot for the HUD ten
 * times a second. With `countdown` the shift opens with the recipe card and "3, 2, 1, LOS!",
 * and the world waits until then.
 */
export function useGameCanvas(canvas: RefObject<HTMLCanvasElement | null>, world: World, countdown: boolean): void {
  const paused = useAtomValue(pausedAtom);
  const setSnapshot = useAtomSet(snapshotAtom);
  const setStart = useAtomSet(startAtom);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const muted = useAtomValue(mutedAtom);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const element = canvas.current;

    if (!element) return;
    const view = createShopView(element, world);
    const keys = newKeys();
    const pads = [newPad(), newPad()];
    let last = performance.now();
    let lag = 0;
    let frame = 0;
    let published = world.tick;
    let start = newStart(countdown);
    let shown = startView(start);
    let skip = false;
    const sound = createSoundtrack(world);

    const onDown = (e: KeyboardEvent) => {
      skip = true;
      sound.unlock();

      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      keyDown(keys, e.code);
    };

    const onUp = (e: KeyboardEvent) => keyUp(keys, e.code);
    const onBlur = () => releaseAll(keys);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", sound.unlock);
    const uninstall = installDevGame(() => world);
    setSnapshot(Option.some(snapshot(world)));
    setStart(shown);

    const loop = (now: number) => {
      const dt = Math.min(now - last, 250);
      lag += dt;
      last = now;
      let ticks = 0;
      const polled = pollPads();
      pads.forEach((pad, i) => readPad(pad, polled[i]));

      // a pad button takes the recipe card away like a key does
      if (pads.some((pad) => pad.pressed.size > 0)) skip = true;

      if (!pausedRef.current) start = advanceStart(start, dt, skip);
      skip = false;
      const opening = startView(start);

      if (opening.phase !== shown.phase || opening.beat !== shown.beat) {
        shown = opening;
        setStart(opening);
      }

      while (lag >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
        // presses during the countdown or a pause are dropped, so a mashed key does not act on the first tick
        const intents = takeIntents(keys, pads);

        if (start.phase === "running" && !pausedRef.current && !isOver(world)) step(world, intents);
        lag -= TICK_MS;
        ticks += 1;
      }

      if (ticks === MAX_TICKS_PER_FRAME) lag = 0;

      // also catches ticks run by `__game.step`, which bypasses this loop
      if (world.tick - published >= SNAPSHOT_EVERY || (world.tick !== published && isOver(world))) {
        published = world.tick;
        setSnapshot(Option.some(snapshot(world)));
      }

      sound.frame(shown, pausedRef.current, mutedRef.current);
      view.render(world, element.clientWidth, element.clientHeight, now);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", sound.unlock);
      sound.dispose();
      uninstall();
      view.dispose();
    };
  }, [canvas, world, countdown, setSnapshot, setStart]);
}
