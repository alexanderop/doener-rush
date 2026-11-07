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
import { Button } from "#/shared/ui/button.tsx";

/** A number with − and + buttons, for picking how many cooks of a kind join the shift. */
function Stepper({ label, value, min, max, onChange }: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon-sm" aria-label={`${label} weniger`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</Button>
        <output className="w-6 text-center text-2xl font-black tabular-nums">{value}</output>
        <Button variant="secondary" size="icon-sm" aria-label={`${label} mehr`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</Button>
      </div>
    </div>
  );
}

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

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-2xl text-center">
        <h1 className="neon text-6xl font-black tracking-wide">DÖNER RUSH</h1>
        <p className="mt-4 text-lg">Ein Spieß, drei Minuten, bis zu vier Köche. Baut Döner nach Bestellung, bevor die Kundschaft geht.</p>
        <ol className="mx-auto mt-6 max-w-md space-y-1 text-left text-sm text-muted-foreground">
          <li>1. Brot aus der Kiste holen und in den Toaster legen.</li>
          <li>2. Gemüse holen, auf dem Brett schneiden (Arbeit halten).</li>
          <li>3. Am Spieß Fleisch schaben – aber bevor eine Seite verbrennt.</li>
          <li>4. Soße drauf, auf einen sauberen Teller, an der Ausgabe abgeben.</li>
          <li>5. Teller spülen, Feuer löschen, Leertaste zum Sprinten.</li>
        </ol>
        <LevelSelect progress={progress} value={level} onChange={setPicked} />
        <p className="mt-4 text-sm">Controller gehen auch: einstecken, eine Taste drücken. Der erste Controller spielt Spieler 1, der zweite Spieler 2.</p>
        <div className="mt-8 flex justify-center gap-10">
          <Stepper label="Köche am Keyboard" value={humans} min={1} max={2} onChange={(n) => { setHumans(n); setBots(Math.min(bots, MAX_COOKS - (swap && n === 1 ? 2 : n))); }} />
          <Stepper label="Bots" value={bots} min={0} max={MAX_COOKS - players} onChange={setBots} />
        </div>
        <div className="mt-6 flex justify-center gap-10">
          <LookPicker label={humans === 1 ? "Dein Koch" : "Spieler 1"} value={picks[0]} taken={new Set(humans === 2 ? [picks[1]] : [])} portrait={portraits.get(picks[0])} onChange={(l) => pick(0, l)} />
          {humans === 2 && <LookPicker label="Spieler 2" value={picks[1]} taken={new Set([picks[0]])} portrait={portraits.get(picks[1])} onChange={(l) => pick(1, l)} />}
        </div>
        {humans === 1 && (
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[#e94f37]" checked={swap} onChange={(e) => { setSwap(e.target.checked); setBots(Math.min(bots, MAX_COOKS - (e.target.checked ? 2 : 1))); }} />
            Zwei Köche steuern – mit R wechseln, der andere schneidet oder spült weiter
          </label>
        )}
        <RulesPanel rules={rules} onChange={setRules} />
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <a href={`/play?level=${level}&humans=${humans}&bots=${bots}${pair ? "&swap=1" : ""}&look1=${picks[0]}${humans === 2 ? `&look2=${picks[1]}` : ""}${rulesQuery(rules)}`}>Schicht starten</a>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <a href="/tutorial">Tutorial</a>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Neu hier? Das Tutorial zeigt dir Schritt für Schritt die ganze Küche.</p>
      </div>
    </main>
  );
}
