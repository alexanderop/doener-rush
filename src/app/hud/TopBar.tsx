import { useAtom } from "@effect/atom-react";
import { OrderRail } from "#/features/orders/client.ts";
import { pausedAtom } from "#/game/runtime/atoms.ts";
import { Button } from "#/shared/ui/button.tsx";
import { MuteButton } from "./MuteButton.tsx";

/** The ticket rail along the top of the screen, with the sound and pause buttons. */
export function TopBar() {
  const [paused, setPaused] = useAtom(pausedAtom);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-4 p-3">
      <div className="min-w-0 flex-1">
        <OrderRail />
      </div>
      <MuteButton />
      <Button className="pointer-events-auto" variant="secondary" size="sm" onClick={() => setPaused(!paused)}>{paused ? "Weiter" : "Pause"}</Button>
    </header>
  );
}
