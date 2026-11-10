import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { snapshotAtom } from "#/game/runtime/atoms.ts";
import { appHref } from "#/shared/href.ts";
import { Button } from "#/shared/ui/button.tsx";

/** Text with keys marked as `{E}`, with each key drawn as a keycap. */
function WithKeys({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\})/).map((part, i) => (part.startsWith("{")
        ? <kbd key={i} className="mx-0.5 inline-block min-w-7 rounded-md border-2 border-b-4 border-[#2a1a10] bg-white px-1.5 text-center font-black not-italic leading-6">{part.slice(1, -1)}</kbd>
        : <span key={i}>{part}</span>))}
    </>
  );
}

const SIDE: Readonly<Record<"left" | "right", string>> = { left: "left-4", right: "right-4" };

/**
 * The tutorial card at the side of the kitchen: which step of how many, what to do now with the
 * keys to press, why it works that way, and a hint when the player is stuck. The yellow arrow in
 * the kitchen points at the station to use. On the last step it offers the first real shift.
 */
export function TutorialPanel({ onAgain }: { readonly onAgain: () => void }) {
  const snap = useAtomValue(snapshotAtom);
  const view = Option.getOrNull(Option.flatMap(snap, (s) => Option.fromNullishOr(s.tutorial)));

  if (view === null) return null;

  return (
    <aside aria-label="Tutorial" className={`pointer-events-none absolute ${SIDE[view.side]} top-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-y-1/2`}>
      <div key={view.step} className="overflow-hidden rounded-[1.5rem] border-[5px] border-[#2a1a10] bg-[#fffaf0] text-[#2a1a10] shadow-[0_8px_0_#2a1a10,0_24px_50px_rgb(0_0_0/0.5)] animate-[card-pop_450ms_cubic-bezier(0.3,1.4,0.5,1)_both]">
        <div className="flex items-center justify-between border-b-[5px] border-[#2a1a10] bg-[linear-gradient(#4f97d8,#2f6fb0)] px-4 py-1.5">
          <span className="hud-stroke text-2xl font-black tracking-wide text-white [-webkit-text-stroke-width:5px]">TUTORIAL</span>
          <span className="text-sm font-black text-white" data-testid="tutorial-step">Schritt {view.step} von {view.total}</span>
        </div>
        <div className="h-2 bg-[#2a1a10]/15">
          <div className="h-full bg-[#44bba4] transition-[width] duration-500" style={{ width: `${(100 * (view.step - 1)) / (view.total - 1)}%` }} />
        </div>
        <div className="space-y-3 p-4">
          <h2 className="text-2xl font-black" data-testid="tutorial-title">{view.title}</h2>
          <p className="text-lg font-bold leading-snug"><WithKeys text={view.text} /></p>
          <p className="text-sm leading-snug text-[#2a1a10]/75"><WithKeys text={view.why} /></p>
          {view.trouble !== null && (
            <p role="status" className="rounded-lg border-2 border-[#e5322d] bg-[#ffe3df] p-2 text-sm font-bold text-[#a3201b]"><WithKeys text={view.trouble} /></p>
          )}
          {view.finished && (
            <div className="pointer-events-auto flex gap-2 pt-1">
              <Button asChild><a href={appHref("/play?humans=1&bots=1")}>Erste Schicht starten</a></Button>
              <Button variant="secondary" onClick={onAgain}>Nochmal</Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
