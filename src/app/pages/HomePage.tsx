import { Button } from "#/shared/ui/button.tsx";

/** The shop front: title, how to play, start. */
export function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="neon text-6xl font-black tracking-wide">DÖNER RUSH</h1>
        <p className="mt-4 text-lg">Zwei Köche, ein Spieß, drei Minuten. Baut Döner nach Bestellung, bevor die Kundschaft geht.</p>
        <ol className="mx-auto mt-6 max-w-md space-y-1 text-left text-sm text-muted-foreground">
          <li>1. Brot aus der Kiste holen und in den Toaster legen.</li>
          <li>2. Gemüse holen, auf dem Brett schneiden (Arbeit halten).</li>
          <li>3. Am Spieß Fleisch schaben – aber bevor eine Seite verbrennt.</li>
          <li>4. Soße drauf, an der Ausgabe abgeben.</li>
        </ol>
        <Button asChild size="lg" className="mt-8">
          <a href="/play">Schicht starten</a>
        </Button>
      </div>
    </main>
  );
}
