import { lookOf, stepLook } from "#/game/runtime/looks.ts";
import type { LookId } from "#/game/runtime/looks.ts";

/**
 * One player's chef on the home page: a picture of the cook with arrows to flip through the
 * looks. `taken` is the other player's look, which the arrows skip.
 */
export function LookPicker({ label, value, taken, portrait, onChange }: {
  readonly label: string;
  readonly value: LookId;
  readonly taken: ReadonlySet<LookId>;
  /** The rendered picture of the look; a colour swatch stands in until it is ready. */
  readonly portrait: string | undefined;
  readonly onChange: (look: LookId) => void;
}) {
  const look = lookOf(value);

  return (
    <div role="group" aria-label={`Aussehen ${label}`} className="flex flex-col items-center">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
      <div className="relative mt-2">
        <div
          className="grid size-32 place-items-center overflow-hidden rounded-[2rem] border-2"
          style={{ borderColor: look.body, background: `radial-gradient(circle at 50% 35%, color-mix(in oklab, ${look.body} 45%, #2a201b), #120d0a 75%)`, boxShadow: `0 14px 40px -12px ${look.body}` }}
        >
          {portrait === undefined
            ? <span className="size-14 rounded-full" style={{ background: look.body }} />
            : <img src={portrait} alt="" className="size-full" />}
        </div>
        <button type="button" className={`${ARROW} -left-4`} aria-label={`${label}: vorheriger Look`} onClick={() => onChange(stepLook(value, -1, taken))}>‹</button>
        <button type="button" className={`${ARROW} -right-4`} aria-label={`${label}: nächster Look`} onClick={() => onChange(stepLook(value, 1, taken))}>›</button>
      </div>
      <output className="mt-2 font-display text-lg font-extrabold" style={{ color: `color-mix(in oklab, ${look.body} 70%, white)` }}>{look.name}</output>
    </div>
  );
}

const ARROW = "absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[#2a201b] text-lg leading-none shadow-lg ring-1 ring-white/15 transition hover:bg-primary hover:text-primary-foreground";
