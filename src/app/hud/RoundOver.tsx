import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useState } from "react";
import { snapshotAtom } from "#/game/runtime/atoms.ts";
import { Button } from "#/shared/ui/button.tsx";
import type { OrdersSnapshot } from "#/features/orders/public.ts";

/** The banner slams in alone first; the summary card follows after this long. */
const CARD_DELAY_MS = 1200;

function EndOfShift({ orders, onAgain }: { readonly orders: OrdersSnapshot; readonly onAgain: () => void }) {
  const { score, stars, served, missed } = orders;
  const [card, setCard] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCard(true), CARD_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 grid animate-in fade-in duration-300 place-items-center bg-black/55" role="dialog" aria-label="Feierabend">
      <div className="grid place-items-center">
        <div className="col-start-1 row-start-1 transition-transform duration-500 ease-out" style={{ transform: card ? "translateY(-13.5rem) scale(0.7)" : "none" }}>
          <p className="hud-stroke animate-[banner-slam_550ms_cubic-bezier(0.2,0.9,0.3,1.1)_both] whitespace-nowrap rounded-3xl border-[5px] border-[#2a1a10] bg-[linear-gradient(#ff8a2a,#e5322d)] px-10 py-4 text-6xl font-black tracking-tight [word-spacing:0.25em] text-[#fff4d6] shadow-[0_10px_0_#2a1a10,0_24px_40px_rgb(0_0_0/0.5)] [-webkit-text-stroke-width:10px]">
            SCHICHT VORBEI!
          </p>
        </div>
        {card && (
          <div className="col-start-1 row-start-1 w-80 animate-[card-pop_450ms_cubic-bezier(0.3,1.4,0.5,1)_both] rounded-3xl border-[5px] border-[#2a1a10] bg-[#fffaf0] p-6 text-center text-[#2a1a10] shadow-[0_8px_0_#2a1a10,0_24px_40px_rgb(0_0_0/0.5)]">
            <h2 className="text-3xl font-black">Feierabend!</h2>
            <p className="mt-2 text-5xl text-[#f2b420] [text-shadow:0_3px_0_#2a1a10]" aria-label={`${stars} von 3 Sternen`}>
              {"★".repeat(stars)}<span className="text-[#c9b49d] opacity-60">{"★".repeat(3 - stars)}</span>
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums" data-testid="final-score">{score} Punkte</p>
            <p className="text-sm font-semibold text-[#6b5444]">{served} serviert · {missed} verpasst</p>
            <Button className="mt-5 h-12 rounded-full border-[3px] border-[#2a1a10] px-9 text-lg font-black shadow-[0_4px_0_#2a1a10]" onClick={onAgain}>Nochmal</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The end of the shift: a "SCHICHT VORBEI!" banner slams in, then the card with score and stars. */
export function RoundOver({ onAgain }: { readonly onAgain: () => void }) {
  const snap = useAtomValue(snapshotAtom);

  if (Option.isNone(snap) || !snap.value.over) return null;

  return <EndOfShift orders={snap.value.orders} onAgain={onAgain} />;
}
