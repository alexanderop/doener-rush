import { useMemo, useRef, useState } from "react";
import { loadPicks } from "#/game/persistence/picks.ts";
import { crewLooks } from "#/game/runtime/looks.ts";
import { newTutorialWorld } from "#/game/runtime/tutorial/tutorial.ts";
import { useGameCanvas } from "#/game/runtime/useGameCanvas.ts";
import { Controls } from "../hud/Controls.tsx";
import { Scoreboard } from "../hud/Scoreboard.tsx";
import { Toasts } from "../hud/Toasts.tsx";
import { TopBar } from "../hud/TopBar.tsx";
import { TutorialPanel } from "../hud/TutorialPanel.tsx";

function Lesson({ onAgain }: { readonly onAgain: () => void }) {
  const world = useMemo(newTutorialWorld, []);
  const looks = useMemo(() => crewLooks(world.drivers, loadPicks()), [world]);
  const canvas = useRef<HTMLCanvasElement>(null);
  useGameCanvas(canvas, world, looks, false);

  return (
    <main className="relative h-screen overflow-hidden">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Küche" />
      <TopBar />
      <Scoreboard clock={false} />
      <Toasts />
      <Controls drivers={world.drivers} looks={looks} />
      <TutorialPanel onAgain={onAgain} />
    </main>
  );
}

/** The guided first shift: one player, one patient customer, step by step through the whole kitchen. */
export function TutorialPage() {
  const [round, setRound] = useState(0);

  // a new key builds a fresh tutorial world
  return <Lesson key={round} onAgain={() => setRound(round + 1)} />;
}
