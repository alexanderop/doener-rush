import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { TICK_MS } from "../core/grid.ts";
import { pausedAtom, snapshotAtom } from "./atoms.ts";
import { createShopView } from "./gl/scene.ts";
import { installDevGame } from "./devtools.ts";
import { GAME_KEYS, keyDown, keyUp, newKeys, releaseAll, takeIntents } from "./input/input.ts";
import { isOver, snapshot, step } from "./step.ts";
import type { World } from "./world.ts";

/** Most ticks one frame may run; a longer stall drops time instead of spiralling. */
const MAX_TICKS_PER_FRAME = 5;

/** Ticks between two HUD snapshots (10 a second). */
const SNAPSHOT_EVERY = 6;

/**
 * Runs the game on a canvas: keyboard in, fixed 60 Hz ticks (Game Loop pattern), one draw
 * per display frame in 3D, and a snapshot for the HUD ten times a second.
 */
export function useGameCanvas(canvas: RefObject<HTMLCanvasElement | null>, world: World): void {
  const paused = useAtomValue(pausedAtom);
  const setSnapshot = useAtomSet(snapshotAtom);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const element = canvas.current;

    if (!element) return;
    const view = createShopView(element, world);
    const keys = newKeys();
    let last = performance.now();
    let lag = 0;
    let frame = 0;
    let published = world.tick;

    const onDown = (e: KeyboardEvent) => {
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      keyDown(keys, e.code);
    };

    const onUp = (e: KeyboardEvent) => keyUp(keys, e.code);
    const onBlur = () => releaseAll(keys);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    const uninstall = installDevGame(() => world);
    setSnapshot(Option.some(snapshot(world)));

    const loop = (now: number) => {
      lag += Math.min(now - last, 250);
      last = now;
      let ticks = 0;

      while (lag >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
        if (!pausedRef.current && !isOver(world)) step(world, takeIntents(keys));
        lag -= TICK_MS;
        ticks += 1;
      }

      if (ticks === MAX_TICKS_PER_FRAME) lag = 0;

      // also catches ticks run by `__game.step`, which bypasses this loop
      if (world.tick - published >= SNAPSHOT_EVERY || (world.tick !== published && isOver(world))) {
        published = world.tick;
        setSnapshot(Option.some(snapshot(world)));
      }

      view.render(world, element.clientWidth, element.clientHeight, now);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      uninstall();
      view.dispose();
    };
  }, [canvas, world, setSnapshot]);
}
