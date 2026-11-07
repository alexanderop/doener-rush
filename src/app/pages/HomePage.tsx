import { useEffect, useState } from "react";
import { isUnlocked, loadProgress } from "#/game/persistence/progress.ts";
import type { Progress } from "#/game/persistence/progress.ts";
import { loadPicks, savePicks } from "#/game/persistence/picks.ts";
import { LEVELS } from "#/game/runtime/levels.ts";
import type { LevelId } from "#/game/runtime/levels.ts";
import { MAX_COOKS } from "#/game/runtime/lineup.ts";
import { DEFAULT_PICKS, LOOKS } from "#/game/runtime/looks.ts";
import type { LookId, Picks } from "#/game/runtime/looks.ts";
import { NORMAL_RULES } from "#/game/runtime/rules.ts";
import type { Rules } from "#/game/runtime/rules.ts";
import { LevelSelect } from "./LevelSelect.tsx";
import { LookPicker } from "./LookPicker.tsx";
import { RulesPanel, rulesQuery } from "./RulesPanel.tsx";

/** A number with − and + buttons, for picking how many cooks of a kind join the shift. */
function Stepper({ label, hint, value, min, max, onChange }: {
  readonly label: string;
  readonly hint: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-3 rounded-2xl bg-black/25 p-3 ring-1 ring-white/5">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-black/30 p-1">
        <button type="button" className={STEP} aria-label={`${label} weniger`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <output className="w-7 text-center font-display text-xl font-extrabold tabular-nums">{value}</output>
        <button type="button" className={STEP} aria-label={`${label} mehr`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

const STEP = "grid size-8 place-items-center rounded-full bg-white/8 text-lg leading-none transition hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-30";

/** A numbered heading for one part of the shift planner. */
function Part({ n, title, children, delay }: { readonly n: string; readonly title: string; readonly children: React.ReactNode; readonly delay: number }) {
  return (
    <section aria-label={title} className="rise" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-xs font-extrabold tracking-[0.2em] text-primary">{n}</span>
        <span className="font-display text-lg font-extrabold tracking-tight">{title}</span>
        <span className="h-px flex-1 translate-y-[-4px] bg-gradient-to-r from-white/15 to-transparent" />
      </h2>
      {children}
    </section>
  );
}

const STEPS = [
  ["Brot", "aus der Kiste holen, in den Toaster legen"],
  ["Gemüse", "auf dem Brett schneiden – Arbeit halten"],
  ["Fleisch", "am Spieß schaben, bevor eine Seite verbrennt"],
  ["Abgeben", "Soße drauf, sauberer Teller, an die Ausgabe"],
  ["Nebenbei", "Teller spülen, Feuer löschen, Leertaste sprintet"],
] as const;

/** The furthest level the save has opened: where a returning player carries on. */
function latestOpen(progress: Progress): LevelId {
  return [...LEVELS].reverse().find((l) => isUnlocked(progress, l.id))?.id ?? "erster-tag";
}

/** Pictures of every look, drawn in the browser once the page is up; none while drawing or without WebGL. */
function usePortraits(): ReadonlyMap<string, string> {
  const [portraits, setPortraits] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let live = true;

    import("#/game/runtime/gl/portraits.ts")
      .then(({ renderPortraits }) => live && setPortraits(renderPortraits(LOOKS)))
      // no WebGL: the pickers keep their colour swatches
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, []);

  return portraits;
}

/** The shop front: title, how to play, which kitchen, who cooks in which look, start. */
export function HomePage() {
  // the save lives in the browser; the server renders a fresh campaign and the effect fills it in
  const [progress, setProgress] = useState<Progress>({});
  const [picked, setPicked] = useState<LevelId | null>(null);
  const level = picked ?? latestOpen(progress);
  const [humans, setHumans] = useState(1);

  const [picks, setPicks] = useState<Picks>(DEFAULT_PICKS);
  const portraits = usePortraits();

  useEffect(() => {
    setProgress(loadProgress());
    setPicks(loadPicks());
  }, []);

  const pick = (binding: 0 | 1, look: LookId) => {
    const next: Picks = binding === 0 ? [look, picks[1]] : [picks[0], look];
    setPicks(next);
    savePicks(next);
  };

  const [bots, setBots] = useState(1);
  const [swap, setSwap] = useState(false);
  const [rules, setRules] = useState<Rules>(NORMAL_RULES);
  const pair = swap && humans === 1;
  const players = pair ? 2 : humans;

  const chosen = LEVELS.find((l) => l.id === level);
  const href = `/play?level=${level}&humans=${humans}&bots=${bots}${pair ? "&swap=1" : ""}&look1=${picks[0]}${humans === 2 ? `&look2=${picks[1]}` : ""}${rulesQuery(rules)}`;

  return (
    <main className="shop-wall min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14 lg:px-10">
        <div className="flex flex-col">
          <span className="rise inline-flex w-fit items-center gap-2 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold tracking-wide text-primary ring-1 ring-primary/30">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Koop-Kochspiel · 1–4 Köche
          </span>
          <h1 className="neon neon-flicker rise mt-5 font-display text-6xl leading-[0.9] font-extrabold tracking-tight sm:text-7xl" style={{ animationDelay: "60ms" }}>
            DÖNER<br />RUSH
          </h1>
          <p className="rise mt-5 max-w-sm text-lg text-foreground/85" style={{ animationDelay: "120ms" }}>
            Ein Spieß, drei Minuten, bis zu vier Köche. Baut Döner nach Bestellung, bevor die Kundschaft geht.
          </p>

          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
            <a
              href={href}
              className="group inline-flex h-14 items-center gap-3 rounded-2xl bg-primary pr-3 pl-6 font-display text-lg font-extrabold text-primary-foreground shadow-[0_12px_40px_-8px_rgb(255_122_26/0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_50px_-6px_rgb(255_122_26/0.85)] focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              Schicht starten
              <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-black/15 transition group-hover:translate-x-0.5">→</span>
            </a>
            <a href="/tutorial" className="inline-flex h-14 items-center rounded-2xl px-5 font-semibold ring-1 ring-white/15 transition hover:bg-white/5 hover:ring-white/30">Tutorial</a>
          </div>
          <p className="rise mt-3 text-sm text-muted-foreground" style={{ animationDelay: "200ms" }}>
            {chosen === undefined ? "" : `${chosen.name} · ${rules.minutes} Min. · `}Neu hier? Das Tutorial zeigt dir die ganze Küche.
          </p>

          <ol className="rise mt-10 space-y-2.5" style={{ animationDelay: "260ms" }}>
            {STEPS.map(([head, rest], i) => (
              <li key={head} className="flex items-start gap-3 text-sm">
                <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-white/6 font-display text-xs font-extrabold text-primary ring-1 ring-white/10">{i + 1}</span>
                <span><span className="font-semibold">{head}</span> <span className="text-muted-foreground">{rest}</span></span>
              </li>
            ))}
          </ol>
          <p className="rise mt-6 flex items-center gap-2 text-xs text-muted-foreground" style={{ animationDelay: "300ms" }}>
            <span aria-hidden>🎮</span> Controller gehen auch: einstecken, eine Taste drücken. Der erste spielt Spieler 1, der zweite Spieler 2.
          </p>
        </div>

        <div className="glass rise space-y-8 rounded-[28px] p-5 sm:p-7" style={{ animationDelay: "120ms" }}>
          <Part n="01" title="Küche" delay={200}>
            <LevelSelect progress={progress} value={level} onChange={setPicked} />
          </Part>

          <Part n="02" title="Team" delay={280}>
            <div className={`grid gap-4 ${humans === 2 ? "" : "sm:grid-cols-[auto_1fr] sm:items-center"}`}>
              <div className="flex justify-center gap-12 px-4">
                <LookPicker label={humans === 1 ? "Dein Koch" : "Spieler 1"} value={picks[0]} taken={new Set(humans === 2 ? [picks[1]] : [])} portrait={portraits.get(picks[0])} onChange={(l) => pick(0, l)} />
                {humans === 2 && <LookPicker label="Spieler 2" value={picks[1]} taken={new Set([picks[0]])} portrait={portraits.get(picks[1])} onChange={(l) => pick(1, l)} />}
              </div>
              <div className="space-y-2">
                <Stepper label="Köche am Keyboard" hint="WASD und Pfeiltasten" value={humans} min={1} max={2} onChange={(n) => { setHumans(n); setBots(Math.min(bots, MAX_COOKS - (swap && n === 1 ? 2 : n))); }} />
                <Stepper label="Bots" hint="kochen von allein mit" value={bots} min={0} max={MAX_COOKS - players} onChange={setBots} />
                {humans === 1 && (
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-black/25 p-3 text-sm ring-1 ring-white/5">
                    <span>
                      <span className="block font-semibold">Zwei Köche steuern</span>
                      <span className="block text-xs text-muted-foreground">Mit R wechseln, der andere schneidet oder spült weiter</span>
                    </span>
                    <input type="checkbox" className="switch" checked={swap} onChange={(e) => { setSwap(e.target.checked); setBots(Math.min(bots, MAX_COOKS - (e.target.checked ? 2 : 1))); }} />
                  </label>
                )}
              </div>
            </div>
          </Part>

          <Part n="03" title="Schwierigkeit" delay={360}>
            <RulesPanel rules={rules} onChange={setRules} />
          </Part>
        </div>
      </div>
    </main>
  );
}
