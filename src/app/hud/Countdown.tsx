import { useAtomValue } from "@effect/atom-react";
import { startAtom } from "#/game/runtime/atoms.ts";

const NUMBER = "hud-stroke text-[11rem] leading-none font-black text-[#fff4d6] [-webkit-text-stroke-width:14px] [text-shadow:0_10px_0_#2a1a10]";

const GO = "hud-stroke whitespace-nowrap rounded-3xl border-[5px] border-[#2a1a10] bg-[linear-gradient(#7fd85f,#2f9e44)] px-12 py-4 text-7xl font-black tracking-tight text-[#fff4d6] shadow-[0_10px_0_#2a1a10,0_24px_40px_rgb(0_0_0/0.5)] [-webkit-text-stroke-width:10px]";

/** "3, 2, 1, LOS!" over the kitchen before the shift runs; each number slams in on its beat. Never takes the pointer. */
export function Countdown() {
  const { beat } = useAtomValue(startAtom);

  if (beat < 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="assertive">
      <p key={beat} data-testid="countdown" className={`animate-[banner-slam_450ms_cubic-bezier(0.2,0.9,0.3,1.1)_both] ${beat === 0 ? GO : NUMBER}`}>
        {beat === 0 ? "LOS!" : beat}
      </p>
    </div>
  );
}
