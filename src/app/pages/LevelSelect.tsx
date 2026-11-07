import { LEVELS } from "#/game/runtime/levels.ts";
import type { LevelId } from "#/game/runtime/levels.ts";
import { isUnlocked } from "#/game/persistence/progress.ts";
import type { Progress } from "#/game/persistence/progress.ts";

/** The campaign on the home page: one card per kitchen with its best stars and score; locked kitchens cannot be picked. */
export function LevelSelect({ progress, value, onChange }: {
  readonly progress: Progress;
  readonly value: LevelId;
  readonly onChange: (level: LevelId) => void;
}) {
  const chosen = LEVELS.find((l) => l.id === value);

  return (
    <section aria-label="Level" className="mx-auto mt-8 max-w-xl text-left">
      <div role="radiogroup" aria-label="Level" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {LEVELS.map((level, i) => {
          const open = isUnlocked(progress, level.id);
          const best = progress[level.id];
          const stars = best?.stars ?? 0;
          const picked = level.id === value;

          return (
            <button
              key={level.id}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-label={open ? `${level.name}, ${stars} von 3 Sternen` : `${level.name}, gesperrt`}
              data-locked={!open}
              disabled={!open}
              onClick={() => onChange(level.id)}
              className={`flex min-h-28 flex-col items-center justify-between rounded-xl border-2 p-2 text-center transition-colors disabled:cursor-not-allowed ${
                picked ? "border-primary bg-primary/15" : "border-border/60 bg-card/60 hover:bg-card"
              } ${open ? "" : "opacity-45"}`}
            >
              <span className="text-xs font-bold text-muted-foreground">Level {i + 1}</span>
              <span className="text-sm font-black leading-tight">{level.name}</span>
              {open ? (
                <>
                  <span className="text-lg leading-none text-[#f2b420]" aria-hidden>
                    {"★".repeat(stars)}<span className="text-muted-foreground/50">{"★".repeat(3 - stars)}</span>
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{best === undefined ? "Noch nicht gespielt" : `Rekord ${best.score}`}</span>
                </>
              ) : (
                <span className="text-lg" aria-hidden>🔒</span>
              )}
            </button>
          );
        })}
      </div>
      {chosen !== undefined && <p className="mt-2 text-center text-sm text-muted-foreground">{chosen.note}</p>}
    </section>
  );
}
