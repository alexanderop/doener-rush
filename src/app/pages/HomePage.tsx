import { useState } from "react";
import { MAX_COOKS } from "#/game/runtime/lineup.ts";
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

/** The shop front: title, how to play, who cooks, start. */
export function HomePage() {
  const [humans, setHumans] = useState(1);
  const [bots, setBots] = useState(1);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="neon text-6xl font-black tracking-wide">DÖNER RUSH</h1>
        <p className="mt-4 text-lg">Ein Spieß, drei Minuten, bis zu vier Köche. Baut Döner nach Bestellung, bevor die Kundschaft geht.</p>
        <ol className="mx-auto mt-6 max-w-md space-y-1 text-left text-sm text-muted-foreground">
          <li>1. Brot aus der Kiste holen und in den Toaster legen.</li>
          <li>2. Gemüse holen, auf dem Brett schneiden (Arbeit halten).</li>
          <li>3. Am Spieß Fleisch schaben – aber bevor eine Seite verbrennt.</li>
          <li>4. Soße drauf, auf einen sauberen Teller, an der Ausgabe abgeben.</li>
          <li>5. Teller spülen, Feuer löschen, Leertaste zum Sprinten.</li>
        </ol>
        <div className="mt-8 flex justify-center gap-10">
          <Stepper label="Köche am Keyboard" value={humans} min={1} max={2} onChange={(n) => { setHumans(n); setBots(Math.min(bots, MAX_COOKS - n)); }} />
          <Stepper label="Bots" value={bots} min={0} max={MAX_COOKS - humans} onChange={setBots} />
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <a href={`/play?humans=${humans}&bots=${bots}`}>Schicht starten</a>
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
