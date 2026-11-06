import { useAtomSet } from "@effect/atom-react";
import { useMemo, useRef, useState } from "react";
import { pausedAtom } from "#/game/runtime/atoms.ts";
import { SCENARIOS } from "#/game/runtime/testing/scenarios.ts";
import { useGameCanvas } from "#/game/runtime/useGameCanvas.ts";
import { TWO_PLAYERS, lineupOf } from "#/game/runtime/lineup.ts";
import { Controls } from "../hud/Controls.tsx";
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
}

/** One shift in the shop: the kitchen canvas with the HUD around it. */
export function PlayPage({ search }: { readonly search: PlaySearch }) {
  const [round, setRound] = useState(0);
  const setPaused = useAtomSet(pausedAtom);
  const seed = search.seed ?? 1;
  const scenario = search.scenario ?? "shift";
  const { humans, bots } = search;

  // a new round gets a new world; `round` is the key that asks for one
  const world = useMemo(() => {
    const lineup = humans === undefined && bots === undefined ? TWO_PLAYERS : lineupOf(humans ?? 1, bots ?? 0);

    return SCENARIOS[scenario].build(seed + round, lineup);
  }, [scenario, seed, round, humans, bots]);

  const canvas = useRef<HTMLCanvasElement>(null);
  useGameCanvas(canvas, world);

  return (
    <main className="relative h-screen overflow-hidden">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Küche" />
      <TopBar />
      <Scoreboard />
      <Toasts />
      <Controls drivers={world.drivers} />
      <RecipeIntro key={round} />
      <RoundOver onAgain={() => { setPaused(false); setRound(round + 1); }} />
    </main>
  );
}
