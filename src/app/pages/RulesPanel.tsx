import { MINUTES, NORMAL_RULES, PRESETS } from "#/game/runtime/rules.ts";
import type { Rules } from "#/game/runtime/rules.ts";

type Level = Rules["patience"];

const PRESET_NAMES: readonly (readonly [keyof typeof PRESETS, string])[] = [["easy", "Leicht"], ["normal", "Normal"], ["hard", "Schwer"]];

const LEVELS: readonly Level[] = [0, 1, 2];

const PATIENCE_NAMES = ["Entspannt", "Normal", "Ungeduldig"] as const;

const RUSH_NAMES = ["Wenig", "Normal", "Viel"] as const;

function same(a: Rules, b: Rules): boolean {
  return a.burning === b.burning && a.fire === b.fire && a.dishes === b.dishes && a.patience === b.patience && a.rush === b.rush && a.minutes === b.minutes;
}

/** The `/play` query for rules: only what differs from the game as designed. */
export function rulesQuery(rules: Rules): string {
  const parts = [
    rules.burning ? "" : "&burn=0",
    rules.fire ? "" : "&fire=0",
    rules.dishes ? "" : "&dishes=0",
    rules.patience === NORMAL_RULES.patience ? "" : `&patience=${rules.patience}`,
    rules.rush === NORMAL_RULES.rush ? "" : `&rush=${rules.rush}`,
    rules.minutes === NORMAL_RULES.minutes ? "" : `&minutes=${rules.minutes}`,
  ];

  return parts.join("");
}

const SEGMENT = "rounded-full px-3 py-1.5 text-xs font-semibold transition aria-checked:bg-primary aria-checked:text-primary-foreground aria-checked:shadow not-aria-checked:text-muted-foreground not-aria-checked:hover:text-foreground";

const ROUND = "grid size-7 place-items-center rounded-full bg-white/8 leading-none transition hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-30";

/** A row of buttons where one is chosen. */
function Choice({ label, names, value, onChange }: {
  readonly label: string;
  readonly names: readonly string[];
  readonly value: number;
  readonly onChange: (value: Level) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-0.5 rounded-full bg-black/30 p-1">
        {LEVELS.map((level) => (
          <button key={level} type="button" role="radio" aria-checked={value === level} className={SEGMENT} onClick={() => onChange(level)}>{names[level]}</button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Difficulty on the home page: three presets, and every house rule on its own under them. */
export function RulesPanel({ rules, onChange }: { readonly rules: Rules; readonly onChange: (rules: Rules) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Schwierigkeit" className="grid grid-cols-3 gap-1 rounded-2xl bg-black/30 p-1">
        {PRESET_NAMES.map(([key, name]) => (
          <button key={key} type="button" role="radio" aria-checked={same(rules, PRESETS[key])} className="rounded-xl py-2.5 font-display text-sm font-extrabold transition aria-checked:bg-primary aria-checked:text-primary-foreground aria-checked:shadow-[0_6px_20px_-6px_rgb(255_122_26/0.7)] not-aria-checked:text-muted-foreground not-aria-checked:hover:bg-white/5 not-aria-checked:hover:text-foreground" onClick={() => onChange(PRESETS[key])}>{name}</button>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground transition hover:text-foreground">Einstellungen anpassen</summary>
        <div className="mt-3 space-y-3 rounded-2xl bg-black/25 p-4 ring-1 ring-white/5">
          <Toggle label="Essen verbrennt" checked={rules.burning} onChange={(burning) => onChange({ ...rules, burning })} />
          <Toggle label="Feuer in der Küche" checked={rules.fire} onChange={(fire) => onChange({ ...rules, fire })} />
          <Toggle label="Teller spülen" checked={rules.dishes} onChange={(dishes) => onChange({ ...rules, dishes })} />
          <Choice label="Geduld der Kunden" names={PATIENCE_NAMES} value={rules.patience} onChange={(patience) => onChange({ ...rules, patience })} />
          <Choice label="Kundenandrang" names={RUSH_NAMES} value={rules.rush} onChange={(rush) => onChange({ ...rules, rush })} />
          <div role="group" aria-label="Schichtlänge" className="flex items-center justify-between gap-3">
            <span className="text-sm">Schichtlänge</span>
            <div className="flex items-center gap-2">
              <button type="button" className={ROUND} aria-label="Schicht kürzer" disabled={rules.minutes <= MINUTES.min} onClick={() => onChange({ ...rules, minutes: rules.minutes - 1 })}>−</button>
              <output className="w-14 text-center text-sm font-bold tabular-nums">{rules.minutes} Min.</output>
              <button type="button" className={ROUND} aria-label="Schicht länger" disabled={rules.minutes >= MINUTES.max} onClick={() => onChange({ ...rules, minutes: rules.minutes + 1 })}>+</button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
