import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useState } from "react";
import { snapshotAtom } from "#/game/runtime/atoms.ts";
import { nextLevel } from "#/game/runtime/levels.ts";
import type { Level } from "#/game/runtime/levels.ts";
import { isUnlocked, loadProgress, recordShift, saveProgress } from "#/game/persistence/progress.ts";
import type { Outcome } from "#/game/persistence/progress.ts";
import { Button } from "#/shared/ui/button.tsx";
import type { OrdersSnapshot } from "#/features/orders/public.ts";

/** The banner slams in alone first; the summary card follows after this long. */
const CARD_DELAY_MS = 1200;

const BUTTON = "h-12 rounded-full border-[3px] border-[#2a1a10] px-5 text-base font-black shadow-[0_4px_0_#2a1a10]";

/** What a campaign shift did to the save, and the level it leads to. */
interface Result {
  readonly outcome: Outcome;
  /** The next level when it can be played now, or null. */
  readonly next: Level | null;
  /** True when this shift opened `next`. */
  readonly opened: boolean;
}

/**
 * Adds the finished shift to the save once. The result is worked out from the save as it was before the shift and
 * written in an effect; writing it twice (React's strict mode) stores the same best, so the card keeps its record.
 */
function useResult(level: Level | null, score: number, stars: number): Result | null {
  const [result] = useState(() => {
    if (level === null) return null;
    const before = loadProgress();
    const outcome = recordShift(before, level.id, score, stars);
    const next = nextLevel(level.id);
    const open = next !== null && isUnlocked(outcome.progress, next.id);

    return { outcome, next: open ? next : null, opened: open && !isUnlocked(before, next.id) };
  });

  useEffect(() => {
    if (result !== null) saveProgress(result.outcome.progress);
  }, [result]);

  return result;
}

function EndOfShift({ orders, level, onAgain, onNext }: {
  readonly orders: OrdersSnapshot;
  readonly level: Level | null;
  readonly onAgain: () => void;
  readonly onNext: (next: Level) => void;
}) {
  const { score, stars, served, missed, targets } = orders;
  const [card, setCard] = useState(false);
  const result = useResult(level, score, stars);
  const next = result?.next ?? null;

  useEffect(() => {
    const timer = setTimeout(() => setCard(true), CARD_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 grid animate-in fade-in duration-300 place-items-center bg-black/55" role="dialog" aria-label="Feierabend">
      <div className="grid place-items-center">
        <div className="col-start-1 row-start-1 transition-transform duration-500 ease-out" style={{ transform: card ? "translateY(-15rem) scale(0.7)" : "none" }}>
          <p className="hud-stroke animate-[banner-slam_550ms_cubic-bezier(0.2,0.9,0.3,1.1)_both] whitespace-nowrap rounded-3xl border-[5px] border-[#2a1a10] bg-[linear-gradient(#ff8a2a,#e5322d)] px-10 py-4 text-6xl font-black tracking-tight [word-spacing:0.25em] text-[#fff4d6] shadow-[0_10px_0_#2a1a10,0_24px_40px_rgb(0_0_0/0.5)] [-webkit-text-stroke-width:10px]">
            SCHICHT VORBEI!
          </p>
        </div>
        {card && (
          <div className="col-start-1 row-start-1 w-80 animate-[card-pop_450ms_cubic-bezier(0.3,1.4,0.5,1)_both] rounded-3xl border-[5px] border-[#2a1a10] bg-[#fffaf0] p-6 text-center text-[#2a1a10] shadow-[0_8px_0_#2a1a10,0_24px_40px_rgb(0_0_0/0.5)]">
            <h2 className="text-3xl font-black">Feierabend!</h2>
            {level !== null && <p className="text-sm font-bold text-[#6b5444]">{level.name}</p>}
            <p className="mt-2 text-5xl text-[#f2b420] [text-shadow:0_3px_0_#2a1a10]" aria-label={`${stars} von 3 Sternen`}>
              {"★".repeat(stars)}<span className="text-[#c9b49d] opacity-60">{"★".repeat(3 - stars)}</span>
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums" data-testid="final-score">{score} Punkte</p>
            {result?.outcome.record === true && (
              <p className="mx-auto mt-1 w-fit -rotate-3 rounded-full bg-[#e5322d] px-3 py-0.5 text-sm font-black uppercase text-white shadow-[0_3px_0_#2a1a10]">Neuer Rekord!</p>
            )}
            {result?.outcome.record === false && Option.isSome(result.outcome.previous) && (
              <p className="text-xs font-bold text-[#6b5444]">Rekord: {result.outcome.previous.value} Punkte</p>
            )}
            <ol className="mx-auto mt-2 flex justify-center gap-3 text-xs font-bold text-[#6b5444]" aria-label="Punkte für die Sterne">
              {targets.map((needed, i) => (
                <li key={needed} className={score >= needed ? "text-[#2a1a10]" : "opacity-60"}>{"★".repeat(i + 1)} {needed}</li>
              ))}
            </ol>
            <p className="text-sm font-semibold text-[#6b5444]">{served} serviert · {missed} verpasst</p>
            {result?.opened === true && next !== null && <p className="mt-3 text-sm font-black text-[#2f7d3a]">Freigeschaltet: {next.name}</p>}
            <div className="mt-5 flex justify-center gap-2">
              <Button className={BUTTON} variant={next === null ? "default" : "secondary"} onClick={onAgain}>Nochmal</Button>
              {next !== null && <Button className={BUTTON} onClick={() => onNext(next)}>Nächstes Level</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The end of the shift: a "SCHICHT VORBEI!" banner slams in, then the card with score and stars. On a campaign level
 * (`level` set) the shift goes into the save, and the card names a new record and offers the next level once it is open.
 */
export function RoundOver({ level, onAgain, onNext }: {
  readonly level: Level | null;
  readonly onAgain: () => void;
  readonly onNext: (next: Level) => void;
}) {
  const snap = useAtomValue(snapshotAtom);

  if (Option.isNone(snap) || !snap.value.over) return null;

  return <EndOfShift orders={snap.value.orders} level={level} onAgain={onAgain} onNext={onNext} />;
}
