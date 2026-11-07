import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useState } from "react";
import { snapshotAtom } from "#/game/runtime/atoms.ts";
import { isPaired } from "#/game/runtime/lineup.ts";
import type { Driver } from "#/game/runtime/lineup.ts";
import { pollPads } from "#/game/runtime/input/pads.ts";

/** Key help for each keyboard binding. */
const KEYS = new Map<0 | 1, string>([
  [0, "WASD laufen · Leertaste sprinten · E nehmen/ablegen · F werfen · Q halten: schneiden/schaben/spülen/löschen"],
  [1, "Pfeile laufen · Shift rechts sprinten · / nehmen/ablegen · ' werfen · . halten: arbeiten"],
]);

/** The swap key of each binding, for players who drive two cooks. */
const SWAP = new Map<0 | 1, string>([[0, "R"], [1, "Enter"]]);

/** What a binding's pill names when a pad plays it instead of the keys. */
const PAD = { keys: "Stick laufen · B sprinten · A nehmen/ablegen · LB werfen · X halten: schneiden/schaben/spülen/löschen", swap: "Y" };

/** How many pads are plugged in; pad `i` plays binding `i`. */
function usePadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(pollPads().length);
    update();
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);

    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);

  return count;
}

/** Name colour of each cook, matching their apron in the kitchen. */
const COLORS = ["text-[#ff7a64]", "text-[#7fb8ec]", "text-[#6fd6c2]", "text-[#f8c25c]"];

/** What a pill says about a cook: bot, the keys or pad buttons, or for a swap pair whether the player has it now. */
function help(drivers: readonly Driver[], i: number, control: readonly number[], pads: number): string {
  const driver = drivers[i];

  if (driver === undefined || driver.kind === "bot") return "Bot · kocht von allein";
  const pad = driver.binding < pads;
  const keys = pad ? PAD.keys : (KEYS.get(driver.binding) ?? "");

  if (!isPaired(drivers, i)) return keys;
  const swap = pad ? PAD.swap : (SWAP.get(driver.binding) ?? "");

  return control[driver.binding] === i ? `Du · ${keys} · ${swap} wechseln` : `wartet · ${swap} wechselt hierher`;
}

/** Key help under the kitchen: one pill per cook, the keys for players and a note for bots and parked cooks. */
export function Controls({ drivers }: { readonly drivers: readonly Driver[] }) {
  const snap = useAtomValue(snapshotAtom);
  const control = Option.match(snap, { onNone: () => [0, 1], onSome: (s) => s.control });
  const pads = usePadCount();

  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-3 px-48 text-xs font-semibold text-white">
      {drivers.map((_, i) => (
        <span key={i} className="rounded-full bg-[#2a1a10]/80 px-3 py-1">
          <b className={COLORS[i]}>Koch {i + 1}</b> {help(drivers, i, control, pads)}
        </span>
      ))}
    </footer>
  );
}
