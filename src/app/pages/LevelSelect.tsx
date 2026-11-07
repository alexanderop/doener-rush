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
    <div>
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
              className={`group relative flex min-h-30 flex-col justify-between overflow-hidden rounded-2xl p-2.5 text-left transition disabled:cursor-not-allowed ${
                picked
                  ? "bg-gradient-to-b from-primary/30 to-primary/5 ring-2 ring-primary shadow-[0_10px_30px_-10px_rgb(255_122_26/0.6)]"
                  : open
                    ? "bg-black/25 ring-1 ring-white/8 hover:-translate-y-0.5 hover:bg-black/35 hover:ring-white/20"
                    : "bg-black/15 ring-1 ring-white/5"
              }`}
            >
              <span className={`font-display text-3xl leading-none font-extrabold ${picked ? "text-primary" : "text-white/15"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className={`mt-2 text-xs leading-tight font-bold tracking-tight break-words ${open ? "" : "text-muted-foreground/60"}`}>{level.name}</span>
              {open ? (
                <span className="mt-1.5 flex flex-col gap-0.5">
                  <span className="text-sm leading-none tracking-tight text-[#f2b420]" aria-hidden>
                    {"★".repeat(stars)}<span className="text-white/15">{"★".repeat(3 - stars)}</span>
                  </span>
                  <span className="text-[10px] leading-tight tabular-nums text-muted-foreground">{best === undefined ? "Noch nicht gespielt" : `Rekord ${best.score}`}</span>
                </span>
              ) : (
                <span className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3 fill-current"><path d="M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" /></svg>
                  Gesperrt
                </span>
              )}
            </button>
          );
        })}
      </div>
      {chosen !== undefined && <p className="mt-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{chosen.name}:</span> {chosen.note}</p>}
    </div>
  );
}
