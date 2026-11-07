import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";
import { mutedAtom } from "#/game/runtime/atoms.ts";
import { loadFlag, saveFlag } from "#/shared/storage.ts";
import { Button } from "#/shared/ui/button.tsx";

const MUTED_KEY = "doener-rush:muted";

/** Sound on or off, by click or the M key; the choice is remembered across visits. */
export function MuteButton() {
  const [muted, setMuted] = useAtom(mutedAtom);

  // read after mount: the server render has no storage, so the first paint must not depend on it
  useEffect(() => setMuted(loadFlag(MUTED_KEY)), [setMuted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || e.repeat) return;
      saveFlag(MUTED_KEY, !muted);
      setMuted(!muted);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [muted, setMuted]);

  const toggle = () => {
    saveFlag(MUTED_KEY, !muted);
    setMuted(!muted);
  };

  return (
    <Button className="pointer-events-auto" variant="secondary" size="sm" onClick={toggle} aria-pressed={muted} aria-label={muted ? "Ton an (M)" : "Ton aus (M)"} title="Ton an/aus (M)">
      {muted ? "🔇" : "🔊"}
    </Button>
  );
}
