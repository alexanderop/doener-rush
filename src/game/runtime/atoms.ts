/**
 * Effect Atom state the UI and the frame loop share. Only coarse, UI-facing values live
 * here; the per-tick world is a plain mutable object the canvas and sim share.
 */
import { Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { StartView } from "./start.ts";
import type { Snapshot } from "./step.ts";

/** The sim is paused: the frame loop keeps drawing but stops stepping. */
export const pausedAtom = Atom.make(false).pipe(Atom.keepAlive);

/** The latest snapshot of the world for the HUD, or none until the first one is taken. */
export const snapshotAtom = Atom.make(Option.none<Snapshot>()).pipe(Atom.keepAlive);

/** The start of the shift: recipe card, countdown, or running. The frame loop publishes it when it changes. */
export const startAtom = Atom.make<StartView>({ phase: "running", beat: -1 }).pipe(Atom.keepAlive);
