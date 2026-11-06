import type { Driver } from "#/game/runtime/lineup.ts";

/** Key help for each keyboard binding. */
const KEYS = new Map<0 | 1, string>([
  [0, "WASD laufen · Leertaste sprinten · E nehmen/ablegen · Q halten: schneiden/schaben/spülen/löschen"],
  [1, "Pfeile laufen · Shift rechts sprinten · / nehmen/ablegen · . halten: arbeiten"],
]);

/** Name colour of each cook, matching their apron in the kitchen. */
const COLORS = ["text-[#ff7a64]", "text-[#7fb8ec]", "text-[#6fd6c2]", "text-[#f8c25c]"];

/** Key help under the kitchen: one pill per cook, the keys for players and a note for bots. */
export function Controls({ drivers }: { readonly drivers: readonly Driver[] }) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-3 px-48 text-xs font-semibold text-white">
      {drivers.map((driver, i) => (
        <span key={i} className="rounded-full bg-[#2a1a10]/80 px-3 py-1">
          <b className={COLORS[i]}>Koch {i + 1}</b> {driver.kind === "bot" ? "Bot · kocht von allein" : KEYS.get(driver.binding)}
        </span>
      ))}
    </footer>
  );
}
