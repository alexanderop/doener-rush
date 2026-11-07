import { lookOf, stepLook } from "#/game/runtime/looks.ts";
import type { LookId } from "#/game/runtime/looks.ts";
import { Button } from "#/shared/ui/button.tsx";

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
    <div role="group" aria-label={`Aussehen ${label}`} className="flex flex-col items-center gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon-sm" aria-label={`${label}: vorheriger Look`} onClick={() => onChange(stepLook(value, -1, taken))}>‹</Button>
        <div
          className="grid size-28 place-items-center overflow-hidden rounded-full border-4"
          style={{ borderColor: look.body, background: `radial-gradient(circle at 50% 40%, color-mix(in oklab, ${look.body} 35%, #2a201b), #1d1612 70%)` }}
        >
          {portrait === undefined
            ? <span className="size-14 rounded-full" style={{ background: look.body }} />
            : <img src={portrait} alt="" className="size-full" />}
        </div>
        <Button variant="secondary" size="icon-sm" aria-label={`${label}: nächster Look`} onClick={() => onChange(stepLook(value, 1, taken))}>›</Button>
      </div>
      <output className="text-lg font-black" style={{ color: `color-mix(in oklab, ${look.body} 75%, white)` }}>{look.name}</output>
    </div>
  );
}
