import { useAtomSet } from "@effect/atom-react";
import { useMemo, useRef, useState } from "react";
import { pausedAtom } from "#/game/runtime/atoms.ts";
import { SCENARIOS } from "#/game/runtime/testing/scenarios.ts";
import { useGameCanvas } from "#/game/runtime/useGameCanvas.ts";
import { TWO_PLAYERS, lineupOf } from "#/game/runtime/lineup.ts";
import { NORMAL_RULES, setRules } from "#/game/runtime/rules.ts";
import type { Rules } from "#/game/runtime/rules.ts";
import { Controls } from "../hud/Controls.tsx";
import { Countdown } from "../hud/Countdown.tsx";
import { RecipeIntro } from "../hud/RecipeIntro.tsx";
import { RoundOver } from "../hud/RoundOver.tsx";
import { Scoreboard } from "../hud/Scoreboard.tsx";
import { Toasts } from "../hud/Toasts.tsx";
import { TopBar } from "../hud/TopBar.tsx";
import type { ScenarioName } from "#/game/runtime/testing/scenarios.ts";

/** The `/play` query after validation: the customers' seed, a named starting state, and who cooks. */
export interface PlaySearch {
  readonly seed?: number;
  readonly scenario?: ScenarioName;
  /** Cooks on the keyboard, 0–2. */
  readonly humans?: number;
  /** Bot cooks after them; four cooks at most. */
  readonly bots?: number;
  /** 1: a single player drives two cooks and switches between them. */
  readonly swap?: number;
  /** House rules, normal when missing: 0 turns burning, fire or dirty dishes off. */
  readonly burn?: number;
  readonly fire?: number;
  readonly dishes?: number;
  /** 0 relaxed, 1 normal, 2 impatient customers. */
  readonly patience?: number;
  /** 0 few customers, 1 normal, 2 a rush. */
  readonly rush?: number;
  /** Shift length in minutes. */
  readonly minutes?: number;
}

/** A level from the query, normal when missing. */
function levelOf(value: number | undefined): Rules["patience"] {
  return value === 0 || value === 2 ? value : 1;
}

/** The house rules a query asks for; anything missing stays as designed. */
function rulesOf(search: PlaySearch): Rules {
  return {
    burning: search.burn !== 0,
    fire: search.fire !== 0,
    dishes: search.dishes !== 0,
    patience: levelOf(search.patience),
    rush: levelOf(search.rush),
    minutes: search.minutes ?? NORMAL_RULES.minutes,
  };
}

/** One shift in the shop: the kitchen canvas with the HUD around it. */
export function PlayPage({ search }: { readonly search: PlaySearch }) {
  const [round, setRound] = useState(0);
  const setPaused = useAtomSet(pausedAtom);
  const seed = search.seed ?? 1;
  const scenario = search.scenario ?? "shift";
  const { humans, bots, swap, burn, fire, dishes, patience, rush, minutes } = search;

  // a new round gets a new world; `round` is the key that asks for one
  const world = useMemo(() => {
    const lineup = humans === undefined && bots === undefined ? TWO_PLAYERS : lineupOf(humans ?? 1, bots ?? 0, swap === 1);

    const world = SCENARIOS[scenario].build(seed + round, lineup);
    setRules(world, rulesOf({ burn, fire, dishes, patience, rush, minutes }));

    return world;
  }, [scenario, seed, round, humans, bots, swap, burn, fire, dishes, patience, rush, minutes]);

  const canvas = useRef<HTMLCanvasElement>(null);
  // a named scenario is a test or debugging setup: it starts at once
  useGameCanvas(canvas, world, search.scenario === undefined);

  return (
    <main className="relative h-screen overflow-hidden">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Küche" />
      <TopBar />
      <Scoreboard />
      <Toasts />
      <Controls drivers={world.drivers} />
      <RecipeIntro />
      <Countdown />
      <RoundOver onAgain={() => { setPaused(false); setRound(round + 1); }} />
    </main>
  );
}
