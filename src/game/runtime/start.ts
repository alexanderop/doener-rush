/**
 * The start of a shift, before the world ticks: the recipe card, then "3, 2, 1, LOS!". The frame
 * loop owns one of these and steps the world only while it is running. Plain data, advanced by
 * wall-clock milliseconds, so the sim never sees it.
 */

/** How long the recipe card stays up when nobody presses a key. */
const INTRO_MS = 3500;

/** How long each number of the countdown shows. */
const BEAT_MS = 800;

/** The countdown counts down from this. */
const BEATS = 3;

/** How long "LOS!" stays up once the shift runs. */
const GO_MS = 800;

/** Where the start of a shift is, and how long it has been there. */
export type Start =
  | { readonly phase: "intro"; readonly ms: number }
  | { readonly phase: "countdown"; readonly ms: number }
  | { readonly phase: "running"; readonly ms: number };

/** What the HUD shows of the start: the phase, and the number on screen (3, 2, 1, 0 for "LOS!", -1 for none). */
export interface StartView {
  readonly phase: Start["phase"];
  readonly beat: number;
}

/** A shift that opens with the card and the countdown, or one that runs at once (tutorial, test scenarios). */
export function newStart(countdown: boolean): Start {
  return countdown ? { phase: "intro", ms: 0 } : { phase: "running", ms: GO_MS };
}

/** Moves the start on by `ms` of unpaused time; `skip` (any key) takes the card away early. */
export function advanceStart(start: Start, ms: number, skip: boolean): Start {
  const t = start.ms + ms;

  switch (start.phase) {
    case "intro": return skip || t >= INTRO_MS ? { phase: "countdown", ms: 0 } : { phase: "intro", ms: t };
    case "countdown": return t >= BEATS * BEAT_MS ? { phase: "running", ms: t - BEATS * BEAT_MS } : { phase: "countdown", ms: t };
    case "running": return start.ms >= GO_MS ? start : { phase: "running", ms: t };
  }
}

/** The HUD's view of the start. */
export function startView(start: Start): StartView {
  return { phase: start.phase, beat: beatOf(start) };
}

function beatOf(start: Start): number {
  switch (start.phase) {
    case "intro": return -1;
    case "countdown": return BEATS - Math.floor(start.ms / BEAT_MS);
    case "running": return start.ms < GO_MS ? 0 : -1;
  }
}
