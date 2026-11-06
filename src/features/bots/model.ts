import type { Tile } from "../../game/core/grid.ts";
import type { Cook } from "../cooks/public.ts";
import type { Station } from "../kitchen/public.ts";
import type { Order } from "../orders/public.ts";

/**
 * What a bot can see of the round: a read-only view the runtime builds from its world, so the
 * bot never touches the world itself.
 */
export interface Sight {
  readonly width: number;
  readonly height: number;
  /** True where a cook cannot stand: stations and everything outside the shop. */
  readonly solid: (x: number, y: number) => boolean;
  readonly stationAt: (x: number, y: number) => Station | null;
  readonly stations: readonly Station[];
  readonly cooks: readonly Cook[];
  /** Waiting customers, oldest first. */
  readonly orders: readonly Order[];
  /** Ids of the cooks bots drive; the rest are people, who never give way. */
  readonly bots: ReadonlySet<number>;
  /** Who is on which job: task key (`order:<id>`, `fire`, `stock:<veg>`, …) → cook id. */
  readonly claims: ReadonlyMap<string, number>;
}

/**
 * The one thing a bot does next at a station: press interact once, hold work, or stand by it
 * waiting (for bread to toast). The bot walks to a floor tile next to `at` and faces it first.
 */
export type Step =
  | { readonly kind: "interact"; readonly at: Tile }
  | { readonly kind: "work"; readonly at: Tile }
  | { readonly kind: "wait"; readonly at: Tile };

/** What the policy wants now: the order the bot works toward, the job it claims, and its next step. */
export interface Plan {
  /** The customer this bot builds for; kept between steps so no other bot builds the same döner. */
  readonly order: number | null;
  /** The job this step belongs to, so other bots leave it alone. */
  readonly task: string | null;
  readonly step: Step | null;
}

/** A bot's memory between ticks: its claims, and how its walk to the current step is going. */
export interface BotMind {
  order: number | null;
  task: string | null;
  /** The step being walked to, as `kind@x,y`; a new step resets the progress below. */
  stepKey: string;
  /** Closest the bot has come to the step, in tiles. */
  best: number;
  /** Ticks without getting closer. */
  stuck: number;
  /** Ticks left of routing around other cooks after getting stuck. */
  detour: number;
  /** A free tile the bot steps onto to let another cook past, or null. */
  aside: Tile | null;
  /** Ticks left to reach `aside` before giving up on it. */
  asideTicks: number;
}
