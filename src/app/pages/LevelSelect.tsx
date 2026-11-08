import { LEVELS } from "#/game/runtime/levels.ts";
import type { LevelId } from "#/game/runtime/levels.ts";
import type { Progress } from "#/game/persistence/progress.ts";

/** The campaign on the home page: one card per kitchen with its best stars and score; every kitchen can be picked. */
export function LevelSelect({ progress, value, onChange }: {
  readonly progress: Progress;
  readonly value: LevelId;
  readonly onChange: (level: LevelId) => void;
}) {
  const chosen = LEVELS.find((l) => l.id === value);

  return (
    <div>
      <div role="radiogroup" aria-label="Level" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LEVELS.map((level, i) => {
          const best = progress[level.id];
          const stars = best?.stars ?? 0;
          const picked = level.id === value;

          return (
            <button
              key={level.id}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-label={`${level.name}, ${stars} von 3 Sternen`}
              onClick={() => onChange(level.id)}
              className={`group relative flex min-h-30 flex-col justify-between overflow-hidden rounded-2xl p-2.5 text-left transition ${
                picked
                  ? "bg-gradient-to-b from-primary/30 to-primary/5 ring-2 ring-primary shadow-[0_10px_30px_-10px_rgb(255_122_26/0.6)]"
                  : "bg-black/25 ring-1 ring-white/8 hover:-translate-y-0.5 hover:bg-black/35 hover:ring-white/20"
              }`}
            >
              <span className={`font-display text-3xl leading-none font-extrabold ${picked ? "text-primary" : "text-white/15"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-2 text-xs leading-tight font-bold tracking-tight break-words">{level.name}</span>
              <span className="mt-1.5 flex flex-col gap-0.5">
                <span className="text-sm leading-none tracking-tight text-[#f2b420]" aria-hidden>
                  {"★".repeat(stars)}<span className="text-white/15">{"★".repeat(3 - stars)}</span>
                </span>
                <span className="text-[10px] leading-tight tabular-nums text-muted-foreground">{best === undefined ? "Noch nicht gespielt" : `Rekord ${best.score}`}</span>
              </span>
            </button>
          );
        })}
      </div>
      {chosen !== undefined && <p className="mt-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{chosen.name}:</span> {chosen.note}</p>}
    </div>
  );
}
