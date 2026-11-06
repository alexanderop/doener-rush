import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useState } from "react";
import { ICONS } from "#/features/kitchen/public.ts";
import { snapshotAtom } from "#/game/runtime/atoms.ts";

/** How long the card stays up when nobody presses a key. */
const SHOW_MS = 3500;

/** Past this many ticks the round is under way (or was fast-forwarded) and the card has no business showing. */
const LATE_TICKS = 60 * 4;

/** Length of the fade-out once the card goes. */
const OUT_MS = 350;

type Phase = "in" | "out" | "gone";

const MOTION: Readonly<Record<Exclude<Phase, "gone">, string>> = {
  in: "animate-[card-pop_500ms_cubic-bezier(0.3,1.4,0.5,1)_both]",
  out: "animate-[card-out_350ms_ease-in_forwards]",
};

const STEPS: readonly { readonly icons: string; readonly tool: string; readonly label: string }[] = [
  { icons: ICONS.bread, tool: "♨️", label: "Brot in den Kontaktgrill" },
  { icons: ICONS.meat, tool: "🔪", label: "Fleisch vom Spieß" },
  { icons: `${ICONS.lettuce}${ICONS.tomato}${ICONS.onion}`, tool: "🪵", label: "Gemüse schneiden, ab in die Wanne" },
  { icons: ICONS.garlic, tool: "🥄", label: "Soße drauf" },
  { icons: "🍽️", tool: "🧽", label: "Auf einen sauberen Teller" },
  { icons: ICONS.doener, tool: "🛎️", label: "Ab zur Ausgabe" },
];

function Arrow() {
  return (
    <svg viewBox="0 0 40 24" className="mt-7 w-9 shrink-0 text-[#2f6fb0]" aria-hidden>
      <path d="M3 16 Q 18 2 32 12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 6 L 34 13 L 24 16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The recipe card at the start of a shift: how a döner is built, gone after a few seconds or on any key. Never takes the pointer. */
export function RecipeIntro() {
  const [phase, setPhase] = useState<Phase>("in");
  const late = Option.match(useAtomValue(snapshotAtom), { onNone: () => false, onSome: (snap) => snap.tick > LATE_TICKS });

  useEffect(() => {
    if (phase === "gone") return;

    if (phase === "out") {
      const timer = setTimeout(() => setPhase("gone"), OUT_MS);

      return () => clearTimeout(timer);
    }

    const leave = () => setPhase("out");
    const timer = setTimeout(leave, SHOW_MS);
    window.addEventListener("keydown", leave, { once: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", leave);
    };
  }, [phase]);

  if (phase === "gone" || late) return null;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      <div className={`relative w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border-[5px] border-[#2a1a10] bg-[#fffaf0] text-[#2a1a10] shadow-[0_10px_0_#2a1a10,0_30px_60px_rgb(0_0_0/0.55)] ${MOTION[phase]}`}>
        <div className="border-b-[5px] border-[#2a1a10] bg-[linear-gradient(#4f97d8,#2f6fb0)] py-2 text-center">
          <h2 className="hud-stroke text-5xl font-black tracking-wide text-white">DÖNER!</h2>
        </div>
        <div className="absolute -right-2 -top-2 grid size-24 rotate-12 place-items-center bg-[#ffd84a] text-center text-xs font-black uppercase leading-tight text-[#2a1a10] [clip-path:polygon(50%_0,61%_18%,82%_10%,80%_32%,100%_38%,86%_55%,98%_74%,76%_76%,70%_98%,52%_84%,32%_100%,26%_78%,4%_76%,14%_56%,0_38%,20%_32%,18%_10%,39%_18%)]">
          Neues<br />Rezept
        </div>
        <ol className="flex items-start justify-center gap-0.5 px-4 pb-2 pt-5">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex items-start">
              {i > 0 && <Arrow />}
              <div className="flex w-[5.4rem] flex-col items-center text-center">
                <div className="relative grid size-[4.5rem] place-items-center rounded-full border-4 border-[#2a1a10] bg-white text-3xl leading-none shadow-[0_4px_0_#2a1a10]">
                  <span className="whitespace-nowrap tracking-[-0.2em]">{step.icons}</span>
                  <span className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-[#2a1a10] bg-[#ffe9a8] text-base">{step.tool}</span>
                </div>
                <span className="mt-2.5 text-xs font-extrabold leading-tight">{step.label}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="-rotate-3 pb-4 text-center text-2xl font-black italic text-[#e5322d]">So baut man einen Döner!</p>
      </div>
    </div>
  );
}
