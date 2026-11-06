import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { snapshotAtom } from "#/game/runtime/atoms.ts";

const HEX = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)";

/** The clock pulses red in the last half minute. */
const HURRY_SECONDS = 30;

const CLOCK_TEXT: Readonly<Record<"calm" | "hurry", string>> = {
  calm: "text-white",
  hurry: "text-[#ff4b3e] animate-[clock-pulse_0.8s_ease-in-out_infinite]",
};

function Coin({ score }: { readonly score: number }) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 drop-shadow-[0_6px_0_rgb(42_26_16/0.9)]">
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

/** The score coin in the bottom left and the shift stopwatch in the bottom right, over the kitchen. */
export function Scoreboard() {
  const snap = useAtomValue(snapshotAtom);
  const seconds = Option.match(snap, { onNone: () => 0, onSome: (s) => s.secondsLeft });
  const score = Option.match(snap, { onNone: () => 0, onSome: (s) => s.orders.score });

  return (
    <>
      <Coin score={score} />
      <Stopwatch seconds={seconds} />
    </>
  );
}
