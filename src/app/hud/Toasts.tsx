import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { snapshotAtom } from "#/game/runtime/atoms.ts";

/** A wrong dish at the pass, called out over the kitchen; served and lost tickets show their own points on the rail. */
export function Toasts() {
  const events = Option.match(useAtomValue(snapshotAtom), { onNone: () => [], onSome: (s) => s.orders.events });
  const wrong = events.flatMap((event) => (event.type === "wrong" ? [event.reason] : []));

  return (
    <ul className="pointer-events-none absolute inset-x-0 top-48 flex flex-col items-center gap-2" aria-live="polite">
      {wrong.slice(-2).map((reason, i) => (
        <li key={i} className="animate-[card-pop_350ms_cubic-bezier(0.3,1.4,0.5,1)_both] rounded-full border-[3px] border-[#2a1a10] bg-[#e5322d] px-5 py-1.5 text-base font-extrabold text-white shadow-[0_4px_0_#2a1a10]">
          ✋ {reason}
        </li>
      ))}
    </ul>
  );
}
