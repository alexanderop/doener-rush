import { MINUTES, NORMAL_RULES, PRESETS } from "#/game/runtime/rules.ts";
import type { Rules } from "#/game/runtime/rules.ts";
import { Button } from "#/shared/ui/button.tsx";

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
      <div className="flex gap-1">
        {LEVELS.map((level) => (
          <Button key={level} role="radio" aria-checked={value === level} size="sm" variant={value === level ? "default" : "secondary"} onClick={() => onChange(level)}>{names[level]}</Button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" className="size-4 accent-[#e94f37]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Difficulty on the home page: three presets, and every house rule on its own under them. */
export function RulesPanel({ rules, onChange }: { readonly rules: Rules; readonly onChange: (rules: Rules) => void }) {
  return (
    <section aria-label="Schwierigkeit" className="mx-auto mt-8 max-w-md rounded-2xl border border-border/60 bg-card/60 p-4 text-left">
      <div role="radiogroup" aria-label="Schwierigkeit" className="flex justify-center gap-2">
        {PRESET_NAMES.map(([key, name]) => (
          <Button key={key} role="radio" aria-checked={same(rules, PRESETS[key])} variant={same(rules, PRESETS[key]) ? "default" : "secondary"} onClick={() => onChange(PRESETS[key])}>{name}</Button>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-center text-sm text-muted-foreground">Einstellungen anpassen</summary>
        <div className="mt-3 space-y-3">
          <Toggle label="Essen verbrennt" checked={rules.burning} onChange={(burning) => onChange({ ...rules, burning })} />
          <Toggle label="Feuer in der Küche" checked={rules.fire} onChange={(fire) => onChange({ ...rules, fire })} />
          <Toggle label="Teller spülen" checked={rules.dishes} onChange={(dishes) => onChange({ ...rules, dishes })} />
          <Choice label="Geduld der Kunden" names={PATIENCE_NAMES} value={rules.patience} onChange={(patience) => onChange({ ...rules, patience })} />
          <Choice label="Kundenandrang" names={RUSH_NAMES} value={rules.rush} onChange={(rush) => onChange({ ...rules, rush })} />
          <div role="group" aria-label="Schichtlänge" className="flex items-center justify-between gap-3">
            <span className="text-sm">Schichtlänge</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon-sm" aria-label="Schicht kürzer" disabled={rules.minutes <= MINUTES.min} onClick={() => onChange({ ...rules, minutes: rules.minutes - 1 })}>−</Button>
              <output className="w-14 text-center text-sm font-bold tabular-nums">{rules.minutes} Min.</output>
              <Button variant="secondary" size="icon-sm" aria-label="Schicht länger" disabled={rules.minutes >= MINUTES.max} onClick={() => onChange({ ...rules, minutes: rules.minutes + 1 })}>+</Button>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
