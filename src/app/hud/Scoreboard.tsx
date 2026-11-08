import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useRef, useState } from "react";
import type { OrderEvent } from "#/features/orders/public.ts";
import { snapshotAtom } from "#/game/runtime/atoms.ts";

const HEX = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)";

/** The clock pulses red in the last half minute. */
const HURRY_SECONDS = 30;

const CLOCK_TEXT: Readonly<Record<"calm" | "hurry", string>> = {
  calm: "text-white",
  hurry: "text-[#ff4b3e] animate-[clock-pulse_0.8s_ease-in-out_infinite]",
};

/** Three stars over the coin that fill as the score passes each target, and the points the next one needs. */
function StarMeter({ score, targets }: { readonly score: number; readonly targets: readonly number[] }) {
  const next = targets.find((needed) => score < needed);

  return (
    <div className="mb-1 flex flex-col items-center" aria-label={`${targets.filter((n) => score >= n).length} von 3 Sternen`}>
      <div className="flex gap-0.5 text-3xl leading-none [text-shadow:0_3px_0_#2a1a10]">
        {targets.map((needed) => (
          <span key={needed} className={score >= needed ? "animate-[coin-pop_520ms_cubic-bezier(0.3,1.4,0.5,1)] text-[#ffd84a]" : "text-[#7a6656]"}>★</span>
        ))}
      </div>
      <span className="hud-stroke mt-0.5 text-xs font-black text-white [-webkit-text-stroke-width:3px]">
        {next === undefined ? "Alle Sterne!" : `nächster Stern: ${next}`}
      </span>
    </div>
  );
}

function Coin({ score, targets }: { readonly score: number; readonly targets: readonly number[] }) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 flex flex-col items-center drop-shadow-[0_6px_0_rgb(42_26_16/0.9)]">
      {targets.length > 0 && <StarMeter score={score} targets={targets} />}
      <div key={score} className="relative grid h-24 w-28 animate-[coin-pop_520ms_cubic-bezier(0.3,1.4,0.5,1)] place-items-center">
        <div className="absolute inset-0 bg-[#6e4308]" style={{ clipPath: HEX }} />
        <div className="absolute inset-[5px] bg-[linear-gradient(160deg,#fff3a8,#f7c831_45%,#d9930f)]" style={{ clipPath: HEX }} />
        <div className="absolute inset-[13px] bg-[linear-gradient(340deg,#ffe57a,#f2b420_60%,#e7a414)] opacity-90" style={{ clipPath: HEX }} />
        <span className="sr-only">Punkte</span>
        <span className="hud-stroke relative text-[2.6rem] font-black tabular-nums leading-none text-white [-webkit-text-stroke-width:7px]" data-testid="score">{score}</span>
      </div>
    </div>
  );
}

/** Coins one serve sends from the pass to the score coin. */
const COINS_PER_SERVE = 3;

/** Long enough for the last coin of a burst to land. */
const COIN_BURST_MS = 1100;

/** One burst of coins per serve, each burst kept until its coins have landed. */
function useCoinBursts(events: readonly OrderEvent[]): readonly number[] {
  const seen = useRef(new WeakSet<OrderEvent>());
  const next = useRef(0);
  const [bursts, setBursts] = useState<readonly number[]>([]);

  useEffect(() => {
    const fresh = events.flatMap((event) => (event.type === "served" && !seen.current.has(event) ? [event] : []));

    for (const event of events) seen.current.add(event);

    if (fresh.length === 0) return;
    const ids = fresh.map(() => (next.current += 1));
    setBursts((list) => [...list, ...ids]);
    // no cleanup: the effect re-runs on every snapshot, and the burst must still be cleared afterwards
    setTimeout(() => setBursts((list) => list.filter((id) => !ids.includes(id))), COIN_BURST_MS);
  }, [events]);

  return bursts;
}

/** Coins that fly from the pass (where the scene says it is on screen) into the score coin, one burst per serve. */
function CoinShower({ events }: { readonly events: readonly OrderEvent[] }) {
  const bursts = useCoinBursts(events);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bursts.flatMap((burst) =>
        Array.from({ length: COINS_PER_SERVE }, (_, i) => (
          <span
            key={`${burst}-${i}`}
            className="absolute bottom-[48px] left-[56px] grid size-10 animate-[coin-fly_720ms_cubic-bezier(0.45,0,0.7,0.5)_both] place-items-center rounded-full border-[3px] border-[#6e4308] bg-[radial-gradient(circle_at_35%_30%,#fff3a8,#f7c831_55%,#d9930f)] text-base font-black text-[#6e4308] shadow-[0_3px_0_#2a1a10]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            €
          </span>
        )),
      )}
    </div>
  );
}

function Stopwatch({ seconds }: { readonly seconds: number }) {
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const mood = seconds <= HURRY_SECONDS ? "hurry" : "calm";

  return (
    <div className="pointer-events-none absolute bottom-4 right-5 grid w-44 place-items-center drop-shadow-[0_5px_0_rgb(42_26_16/0.85)]">
      {/* crown and button on top, a side knob */}
      <div className="absolute left-1/2 top-0 h-4 w-9 -translate-x-1/2 rounded-md border-[3px] border-[#2a1a10] bg-[linear-gradient(#f4f6f8,#9ba6b0)]" />
      <div className="absolute left-1/2 top-3 h-3 w-4 -translate-x-1/2 border-x-[3px] border-[#2a1a10] bg-[#c9d1d8]" />
      <div className="absolute right-9 top-6 h-3.5 w-6 rotate-45 rounded-sm border-[3px] border-[#2a1a10] bg-[linear-gradient(#f4f6f8,#9ba6b0)]" />
      <div className="mt-5 grid size-28 place-items-center rounded-full border-4 border-[#2a1a10] bg-[radial-gradient(circle_at_35%_28%,#ffffff,#d5dce2_45%,#8d99a4)]">
        <div className="size-[5.6rem] rounded-full border-[3px] border-[#7d8892] bg-[radial-gradient(circle_at_50%_40%,#ffffff,#e8edf1)]" />
      </div>
      <div className="absolute inset-x-0 bottom-7 text-center">
        <span className="sr-only">Zeit</span>
        <span className={`hud-stroke inline-block text-[2.6rem] font-black tabular-nums leading-none tracking-tight [-webkit-text-stroke-width:6px] ${CLOCK_TEXT[mood]}`} data-testid="clock">
          {time}
        </span>
      </div>
    </div>
  );
}

/** The score coin in the bottom left with the star meter over it, and the shift stopwatch in the bottom right; `clock` false (the tutorial) drops both the clock and the stars. */
export function Scoreboard({ clock = true }: { readonly clock?: boolean }) {
  const snap = useAtomValue(snapshotAtom);
  const seconds = Option.match(snap, { onNone: () => 0, onSome: (s) => s.secondsLeft });
  const score = Option.match(snap, { onNone: () => 0, onSome: (s) => s.orders.score });
  const targets = Option.match(snap, { onNone: () => [], onSome: (s) => s.orders.targets });
  const events = Option.match(snap, { onNone: () => [], onSome: (s) => s.orders.events });

  return (
    <>
      <CoinShower events={events} />
      <Coin score={score} targets={clock ? targets : []} />
      {clock && <Stopwatch seconds={seconds} />}
    </>
  );
}
