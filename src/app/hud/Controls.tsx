/** Key help under the kitchen. */
export function Controls() {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-3 px-48 text-xs font-semibold text-white">
      <span className="rounded-full bg-[#2a1a10]/80 px-3 py-1"><b className="text-[#ff7a64]">Koch 1</b> WASD laufen · Leertaste sprinten · E nehmen/ablegen · Q halten: schneiden/schaben/spülen/löschen</span>
      <span className="rounded-full bg-[#2a1a10]/80 px-3 py-1"><b className="text-[#7fb8ec]">Koch 2</b> Pfeile laufen · Shift rechts sprinten · / nehmen/ablegen · . halten: arbeiten</span>
    </footer>
  );
}
