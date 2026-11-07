import type { Cook } from "../../../features/cooks/public.ts";
import { TOAST_DONE, isChopped } from "../../../features/kitchen/public.ts";
import type { Filling, Item, Station } from "../../../features/kitchen/public.ts";
import type { World } from "../world.ts";

/** A döner, loose or on a plate. */
type Doener = Extract<Item, { kind: "base" }>;

type Veg = "lettuce" | "onion";

/** What the tutorial customer orders: a Döner Classic. */
const CLASSIC: readonly Filling[] = ["meat", "lettuce", "onion", "garlic"];

/**
 * One step of the tutorial (a row of a table, not a script): what to do, why it works that way,
 * where to look, and when it is done. Every check reads the world, so a player who skips ahead
 * or does things in another order still moves on. Text marks keys as `{E}`.
 */
export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  /** How the mechanic works, in one or two sentences. */
  readonly why: string;
  /** The stations the 3D arrow points at right now. */
  readonly targets: (world: World) => readonly Station[];
  readonly done: (world: World) => boolean;
  /** A hint when the player is stuck or on the wrong path, or null. */
  readonly trouble: (world: World) => string | null;
  /** The lesson needs the döner being built; when it is gone the tutorial goes back to the bread. */
  readonly needsDoener: boolean;
}

function me(world: World): Cook {
  // SAFETY: the tutorial world always has exactly one cook.
  return world.cooks[0]!;
}

function stations(world: World, match: (s: Station) => boolean): Station[] {
  return [...world.stations.values()].filter(match);
}

function first(world: World, match: (s: Station) => boolean): Station | null {
  return stations(world, match)[0] ?? null;
}

/** The döner being built, wherever it is, and whether it sits on a plate. */
function doenerOf(world: World): { readonly doener: Doener; readonly plated: boolean } | null {
  for (const item of [me(world).held, ...[...world.stations.values()].map((s) => s.item)]) {
    if (item?.kind === "base") return { doener: item, plated: false };

    if (item?.kind === "plate" && item.food !== null) return { doener: item.food, plated: true };
  }

  return null;
}

function hasFilling(world: World, filling: Filling): boolean {
  return doenerOf(world)?.doener.fillings.includes(filling) ?? false;
}

/** How far a vegetable got: 0 none, 1 held raw, 2 on a board, 3 chopped, 4 in a tray or the döner. */
function vegStage(world: World, veg: Veg): number {
  if (hasFilling(world, veg) || stations(world, (s) => s.type === "tray" && s.veg === veg).length > 0) return 4;
  const pieces = [me(world).held, ...[...world.stations.values()].map((s) => s.item)];

  if (pieces.some((item) => item?.kind === "veg" && item.veg === veg && isChopped(item))) return 3;

  if (stations(world, (s) => s.type === "board" && s.item?.kind === "veg" && s.item.veg === veg).length > 0) return 2;
  const held = me(world).held;

  return held?.kind === "veg" && held.veg === veg ? 1 : 0;
}

/** Where to go next for a vegetable at its stage. */
function vegTargets(world: World, veg: Veg): Station[] {
  switch (vegStage(world, veg)) {
    case 0: return stations(world, (s) => s.type === "crate" && s.goods === veg);
    case 1: return stations(world, (s) => s.type === "board" && s.item === null);
    case 2: return stations(world, (s) => s.type === "board" && s.item?.kind === "veg" && s.item.veg === veg);
    default: return stations(world, (s) => s.type === "tray" && (s.veg === null || s.veg === veg));
  }
}

function sink(world: World): Extract<Station, { type: "sink" }> | null {
  const found = first(world, (s) => s.type === "sink");

  return found?.type === "sink" ? found : null;
}

function burning(world: World): Station[] {
  return stations(world, (s) => s.fire > 0);
}

const HANDS_FULL = "Erst die Hände frei machen: leg ab, was du trägst ({E} an einer freien Theke).";

/** Hint for a step that starts with empty hands. */
function needsFreeHands(world: World): string | null {
  return me(world).held === null ? null : HANDS_FULL;
}

/** Hint when the döner on the way is not a Döner Classic any more. */
function wrongDoener(world: World): string | null {
  const found = doenerOf(world);

  if (found === null) return null;

  if (found.doener.base !== "bread") return "Das ist ein Wrap. Der Döner Classic braucht Brot: ab in den Müll damit ({E} am Mülleimer rechts).";

  if (found.doener.fillings.some((f) => !CLASSIC.includes(f))) return "Das gehört nicht in einen Döner Classic. Ab in den Müll ({E} am Mülleimer rechts) und neu bauen.";

  return null;
}

const NONE = (): null => null;

/** The tutorial, in order. The last lesson is the goodbye and is never done. */
export const LESSONS: readonly Lesson[] = [
  {
    id: "walk",
    title: "Laufen",
    text: "Lauf mit {W} {A} {S} {D} durch die Küche.",
    why: "Du bist Koch 1 mit der roten Schürze. Der gelbe Rahmen vor dir zeigt die Station, mit der du gerade arbeitest.",
    targets: () => [],
    done: (world) => Math.hypot(me(world).x - 2.5, me(world).y - 7.5) > 2,
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "dash",
    title: "Sprinten",
    text: "Lauf los und drück dabei die {Leertaste}.",
    why: "Ein Sprint schießt dich ein paar Felder nach vorn. Danach braucht er einen Moment, bis er wieder geht.",
    targets: () => [],
    done: (world) => me(world).dashCooldown > 0,
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "lettuce",
    title: "Salat holen",
    text: "Geh zur Salatkiste links und drück {E}.",
    why: "{E} nimmt etwas und legt es ab. Kisten werden nie leer.",
    targets: (world) => stations(world, (s) => s.type === "crate" && s.goods === "lettuce"),
    done: (world) => vegStage(world, "lettuce") >= 1,
    trouble: needsFreeHands,
    needsDoener: false,
  },
  {
    id: "board",
    title: "Aufs Brett",
    text: "Leg den Salat aufs Schneidebrett ({E}).",
    why: "Gemüse muss geschnitten sein, bevor es in den Döner darf.",
    targets: (world) => vegTargets(world, "lettuce"),
    done: (world) => vegStage(world, "lettuce") >= 2,
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "chop",
    title: "Schneiden",
    text: "Bleib am Brett stehen und halte {Q}, bis der Balken voll ist.",
    why: "{Q} halten heißt arbeiten: schneiden, Fleisch schaben, spülen und löschen. Lässt du los, bleibt der Fortschritt erhalten.",
    targets: (world) => vegTargets(world, "lettuce"),
    done: (world) => vegStage(world, "lettuce") >= 3,
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "tray",
    title: "In die Wanne",
    text: "Nimm den Salat ({E}) und leg ihn in eine Wanne in der Mitte.",
    why: "Eine Wanne hält bis zu drei Portionen einer Sorte. Daraus bedient sich jeder Koch, auch deine Bots.",
    targets: (world) => vegTargets(world, "lettuce"),
    done: (world) => vegStage(world, "lettuce") >= 4,
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "onion",
    title: "Zwiebel",
    text: "Jetzt allein: Zwiebel aus der Kiste, aufs Brett, {Q} halten, ab in eine freie Wanne.",
    why: "Der Döner Classic braucht Salat und Zwiebel. Gute Köche füllen die Wannen auf, bevor die Bestellung kommt.",
    targets: (world) => vegTargets(world, "onion"),
    done: (world) => vegStage(world, "onion") >= 4,
    trouble: (world) => (vegStage(world, "onion") === 0 ? needsFreeHands(world) : null),
    needsDoener: false,
  },
  {
    id: "bread",
    title: "Brot holen",
    text: "Hol Brot aus der Brotkiste oben ({E}).",
    why: "Oben hängt der Bon: ein Döner Classic. Brot, Fleisch, Salat, Zwiebel, Knoblauchsoße.",
    targets: (world) => stations(world, (s) => s.type === "crate" && s.goods === "bread"),
    done: (world) => doenerOf(world) !== null,
    trouble: needsFreeHands,
    needsDoener: false,
  },
  {
    id: "toaster",
    title: "Toasten",
    text: "Leg das Brot in den Kontaktgrill ({E}).",
    why: "Brot muss goldbraun sein. In der echten Schicht verbrennt es nach 14 Sekunden und fängt dann Feuer. Hier im Tutorial nicht.",
    targets: (world) => stations(world, (s) => s.type === "toaster"),
    done: (world) => {
      const found = doenerOf(world);

      return found !== null && (found.plated || found.doener.toast > 0);
    },
    trouble: wrongDoener,
    needsDoener: true,
  },
  {
    id: "plate",
    title: "Teller holen",
    text: "Hol einen sauberen Teller vom Tellerstapel unten ({E}).",
    why: "Ohne Teller nimmt dir niemand einen Döner ab. Im Laden gibt es nur drei Teller.",
    targets: (world) => stations(world, (s) => s.type === "rack"),
    done: (world) => {
      const held = me(world).held;

      return (held?.kind === "plate" && !held.dirty) || doenerOf(world)?.plated === true;
    },
    trouble: (world) => {
      const held = me(world).held;

      return held !== null && held.kind !== "plate" ? HANDS_FULL : wrongDoener(world);
    },
    needsDoener: true,
  },
  {
    id: "plate-up",
    title: "Brot auf den Teller",
    text: "Warte, bis das Brot goldbraun ist. Dann mit dem Teller am Grill {E} drücken.",
    why: "Der Balken über dem Grill zeigt, wie weit das Brot ist. Ein grüner Haken heißt fertig.",
    targets: (world) => stations(world, (s) => s.type === "toaster" && s.item !== null),
    done: (world) => {
      const found = doenerOf(world);

      return found !== null && found.plated && found.doener.toast >= TOAST_DONE;
    },
    trouble: (world) => {
      const found = doenerOf(world);

      if (found?.plated === true && found.doener.toast < TOAST_DONE) return "Zu früh, das Brot ist noch nicht durch. Ab in den Müll ({E} am Mülleimer rechts) und neues Brot holen.";

      return wrongDoener(world);
    },
    needsDoener: true,
  },
  {
    id: "meat",
    title: "Fleisch",
    text: "Geh mit dem Teller zum Spieß und halte {Q}.",
    why: "Der Spieß dreht sich und brät nur die Seite vor der Hitze. Schaben nimmt die beste Seite. Bleibt eine Seite zu lange vorn, verbrennt sie.",
    targets: (world) => stations(world, (s) => s.type === "spit"),
    done: (world) => hasFilling(world, "meat"),
    trouble: wrongDoener,
    needsDoener: true,
  },
  {
    id: "veg",
    title: "Gemüse drauf",
    text: "Hol Salat und Zwiebel aus den Wannen ({E} mit dem Teller in der Hand).",
    why: "Jedes {E} an einer Wanne legt eine Portion auf den Döner. Jede Zutat passt nur einmal drauf.",
    targets: (world) => stations(world, (s) => s.type === "tray" && s.veg !== null && (s.veg === "lettuce" || s.veg === "onion") && !hasFilling(world, s.veg)),
    done: (world) => hasFilling(world, "lettuce") && hasFilling(world, "onion"),
    trouble: (world) => {
      const empty = (["lettuce", "onion"] as const).find((veg) => !hasFilling(world, veg) && stations(world, (s) => s.type === "tray" && s.veg === veg).length === 0);

      if (empty !== undefined) return `Keine ${empty === "lettuce" ? "Salat" : "Zwiebel"} mehr in den Wannen. Stell den Teller ab und schneide neue.`;

      return wrongDoener(world);
    },
    needsDoener: true,
  },
  {
    id: "sauce",
    title: "Soße",
    text: "Knoblauchsoße drauf: die weiße Flasche rechts ({E}).",
    why: "Soße kommt direkt aus der Flasche auf den Döner. Rechts stehen Knoblauch, Kräuter und Scharf.",
    targets: (world) => stations(world, (s) => s.type === "sauce" && s.sauce === "garlic"),
    done: (world) => hasFilling(world, "garlic"),
    trouble: wrongDoener,
    needsDoener: true,
  },
  {
    id: "serve",
    title: "Ausgeben",
    text: "Bring den Teller zur Ausgabe oben rechts ({E}).",
    why: "Passt der Döner zum Bon, gibt es Punkte. Je schneller, desto mehr Trinkgeld. Wer zu lange wartet, geht und kostet Punkte.",
    targets: (world) => stations(world, (s) => s.type === "pass"),
    done: (world) => world.orders.served > 0,
    trouble: wrongDoener,
    needsDoener: true,
  },
  {
    id: "return",
    title: "Abwasch",
    text: "Gleich kommt der Teller schmutzig zurück. Hol ihn rechts oben an der Rückgabe ({E}).",
    why: "Nach dem Essen landet jeder Teller schmutzig in der Rückgabe. Ohne Abwasch gehen euch die Teller aus.",
    targets: (world) => stations(world, (s) => s.type === "return"),
    done: (world) => {
      const held = me(world).held;
      const basin = sink(world);

      return (held?.kind === "plate" && held.dirty) || (basin !== null && basin.dirty + basin.clean > 0);
    },
    trouble: needsFreeHands,
    needsDoener: false,
  },
  {
    id: "sink",
    title: "Spüle",
    text: "Leg den Teller in die Spüle unten ({E}).",
    why: "In der Spüle können mehrere Teller warten.",
    targets: (world) => stations(world, (s) => s.type === "sink"),
    done: (world) => {
      const basin = sink(world);

      return basin !== null && basin.dirty + basin.clean > 0;
    },
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "wash",
    title: "Spülen",
    text: "Halte {Q} an der Spüle, mit leeren Händen.",
    why: "Wie beim Schneiden: {Q} halten, bis der Balken voll ist.",
    targets: (world) => stations(world, (s) => s.type === "sink"),
    done: (world) => (sink(world)?.clean ?? 0) > 0,
    trouble: needsFreeHands,
    needsDoener: false,
  },
  {
    id: "rack",
    title: "Zurück in den Stapel",
    text: "Nimm den sauberen Teller aus der Spüle ({E}) und stell ihn auf den Tellerstapel.",
    why: "Jetzt ist der Teller bereit für den nächsten Döner.",
    targets: (world) => (me(world).held?.kind === "plate" ? stations(world, (s) => s.type === "rack") : stations(world, (s) => s.type === "sink")),
    done: (world) => (sink(world)?.clean ?? 0) === 0 && me(world).held?.kind !== "plate",
    trouble: NONE,
    needsDoener: false,
  },
  {
    id: "extinguisher",
    title: "Feuer!",
    text: "Der Grill brennt! Hol den Feuerlöscher rechts ({E}).",
    why: "Vergessenes Brot und ein Spieß, um den sich keiner kümmert, fangen Feuer. Eine brennende Station nimmt nichts an und gibt nichts her.",
    targets: (world) => stations(world, (s) => s.item?.kind === "extinguisher"),
    done: (world) => me(world).held?.kind === "extinguisher" || burning(world).length === 0,
    trouble: (world) => (me(world).held?.kind === "extinguisher" ? null : needsFreeHands(world)),
    needsDoener: false,
  },
  {
    id: "douse",
    title: "Löschen",
    text: "Stell dich vor das Feuer und halte {Q}.",
    why: "In der echten Schicht springt Feuer alle 6 Sekunden auf die Nachbarn über. Hier bleibt es beim Grill.",
    targets: burning,
    done: (world) => burning(world).length === 0,
    trouble: (world) => (me(world).held?.kind === "extinguisher" ? null : "Ohne Feuerlöscher geht es nicht. Hol ihn zurück."),
    needsDoener: false,
  },
  {
    id: "finish",
    title: "Geschafft!",
    text: "Du kennst jetzt die ganze Küche.",
    why: "In der echten Schicht kommen Bestellungen alle 14 bis 24 Sekunden, Brot und Spieß können brennen, und nach drei Minuten ist Feierabend. Bots helfen dir, wenn du willst.",
    targets: () => [],
    done: () => false,
    trouble: NONE,
    needsDoener: false,
  },
];

/** Where the lesson about fire starts: the tutorial sets the grill alight when it gets there. */
export const FIRE_LESSON = LESSONS.findIndex((l) => l.id === "extinguisher");

/** Where the tutorial goes back to when the döner on the way is gone. */
export const BREAD_LESSON = LESSONS.findIndex((l) => l.id === "bread");
