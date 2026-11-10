/**
 * The sliding counters of a kitchen, as one state machine they all share:
 *
 *   home ──left 1, gap free──▶ away ──left 1, gap free──▶ home
 *     └──left 1, a cook in the gap──┘ (stays at 1 until they step out)
 *
 * A run of counters shifts one tile along its track and takes its items along. The track is one tile longer than
 * the run, so one end is always open floor: the gap. Home, the gap is the `:` tile of the plan; away, it is the
 * tile at the run's other end. Counters never slide into a cook: they wait for the gap to clear.
 * Values are immutable and count ticks, so a seed replays the same round.
 */
import { seconds } from "../core/grid.ts";
import type { Dir, Tile } from "../core/grid.ts";
import type { Station } from "../../features/kitchen/public.ts";

/** How long the counters rest at home and away, in ticks. */
export interface SlideSchedule {
  readonly home: number;
  readonly away: number;
}

/** Which end of its track a run rests at. */
type Side = "home" | "away";

/** Where the counters are in their schedule; `left` counts the ticks until they slide. */
export interface Slide {
  readonly at: Side;
  readonly left: number;
}

/** One line of counters on its track. */
export interface SlideRun {
  /** The counters of the run; they move, so their `x` and `y` are where they stand now. */
  readonly stations: readonly Station[];
  /** One step from home to away. */
  readonly dir: Dir;
  /** The open tile while the run is home, and the one while it is away. */
  readonly gaps: Readonly<Record<Side, Tile>>;
}

/** The sliding counters of a kitchen: their runs, their schedule and where they are in it. */
export interface Slides {
  readonly runs: readonly SlideRun[];
  readonly schedule: SlideSchedule;
  state: Slide;
  /** The tick the counters last slid, for the view's glide; -1 before the first. */
  moved: number;
}

/** Ticks before the counters slide that the view warns and bots stop stepping into a gap about to close. */
export const SLIDE_WARNING = seconds(2);

/** Counters at the start of a shift: home, for a full stretch. */
export function newSlide(schedule: SlideSchedule): Slide {
  return { at: "home", left: schedule.home };
}

/** One tick of the schedule; `blocked` is true while any cook stands in a gap about to close. */
export function stepSlide(slide: Slide, schedule: SlideSchedule, blocked: boolean): Slide {
  if (slide.left > 1) return { at: slide.at, left: slide.left - 1 };

  if (blocked) return { at: slide.at, left: 1 };

  return slide.at === "home" ? { at: "away", left: schedule.away } : { at: "home", left: schedule.home };
}

/** True when the counters are about to slide, or only wait for a cook to step out of the gap. */
export function isSliding(slide: Slide): boolean {
  return slide.left <= SLIDE_WARNING;
}

/** The tiles open now: the next slide closes them. */
export function openGaps(slides: Slides): Tile[] {
  return slides.runs.map((run) => run.gaps[slides.state.at]);
}
