/**
 * Low-poly models built from three.js primitives: no asset files. Every model sits on the
 * origin with y up; one world tile is one unit. Geometries and materials come from the
 * caches in `parts.ts`, so building a model again is cheap.
 */
import * as THREE from "three";
import type { Base, Bowl, CrateGoods, Dry, Filling, Item, Sauce, Station, Topping } from "../../../features/kitchen/public.ts";
import { BURNT, COOKED, HEAT, ICONS, foodOn, heatTicks, isChopped } from "../../../features/kitchen/public.ts";
import type { Accessory, Animal, Headwear, Look, Species } from "../looks.ts";
import {
  ball, blob, box, canvasTexture, cyl, emojiBadge, geo, halo, hash, label, mapped, mat, meatMap, rbox, ring, solid, steel, woodMap,
} from "./parts.ts";

/** Height of a counter top. */
export const TOP = 0.9;

type Veg = "lettuce" | "tomato" | "onion";

const CABINET = "#aab2ba";

/** The cabinet colour of each kind of station, so a cook finds heat, water and the pass by colour; the rest are steel. */
const CABINETS: Partial<Record<Station["type"], string>> = {
  crate: "#5a9e3a", toaster: "#3d4554", spit: "#c9402e", sauce: "#e58a2a", pass: "#f0b02c", sink: "#3b82c6", rack: "#3b82c6", return: "#3b82c6", mixer: "#8a5cc0",
};

const WORKTOP = "#f6e3c0";

const BRASS = "#d9a646";

const OUTLINE = new THREE.MeshBasicMaterial({ color: "#2b1810", side: THREE.BackSide });

/** A colour made lighter or darker by `delta` in HSL lightness. */
function shade(color: string, delta: number): string {
  return `#${new THREE.Color(color).offsetHSL(0, 0, delta).getHexString()}`;
}

/** Adds a dark inverted hull behind a mesh: the cartoon outline that keeps silhouettes readable. */
function outlined(mesh: THREE.Mesh, thickness = 1.08): THREE.Mesh {
  const hull = new THREE.Mesh(mesh.geometry, OUTLINE);
  hull.scale.setScalar(thickness);
  mesh.add(hull);

  return mesh;
}

// ---------------------------------------------------------------- counters

/**
 * The cabinet every station stands on: doors in the station's colour, a brass trim and a chunky wooden
 * worktop with rounded edges. Each tile gets a slightly different tone so a row of counters
 * reads as separate blocks.
 */
function counter(s: Station, metalTop = false): THREE.Group {
  const g = new THREE.Group();
  const { x, y } = s;
  const cabinet = CABINETS[s.type] ?? CABINET;
  const tone = (Math.floor(hash(x, y) * 4) / 4 - 0.375) * 2;
  const wood = woodMap();
  g.add(box(0.84, 0.08, 0.82, mat("#1c2230"), 0.04));
  const body = rbox(0.94, TOP - 0.2, 0.92, 0.05, mat(shade(cabinet, tone * 0.04)), 0.08 + (TOP - 0.2) / 2);
  g.add(body);
  const door = rbox(0.74, 0.44, 0.05, 0.02, mat(shade(cabinet, 0.07 + tone * 0.03)), 0.44);
  door.position.z = 0.45;
  g.add(door);
  const knob = ball(0.03, mat(BRASS, "#000000", 0.35), 8);
  knob.position.set(0.27, 0.56, 0.48);
  g.add(knob);
  g.add(box(0.97, 0.04, 0.97, mat(BRASS, "#000000", 0.4), TOP - 0.13));

  const top = metalTop
    ? rbox(1, 0.12, 1, 0.05, steel("#d3d8de"), TOP - 0.06)
    : rbox(1, 0.12, 1, 0.05, mapped(shade(WORKTOP, tone * 0.06), wood), TOP - 0.06);

  g.add(top);

  return g;
}

/** The colour of meat at a cook level, from raw pink to roasted brown to black. */
export function meatColor(level: number): string {
  if (level >= BURNT) return "#2e1c14";

  if (level >= COOKED) {
    const crisp = Math.min(1, (level - COOKED) / (BURNT - COOKED));

    return `#${new THREE.Color("#c26a2e").lerp(new THREE.Color("#6b3415"), crisp).getHexString()}`;
  }

  const raw = Math.max(0, Math.min(1, level / COOKED));

  return `#${new THREE.Color("#f2a7a0").lerp(new THREE.Color("#d58a55"), raw).getHexString()}`;
}

const VEG_COLOR: Readonly<Record<Veg, string>> = { lettuce: "#6fc23f", tomato: "#e8392b", onion: "#b2588f" };

const SAUCE_COLOR: Readonly<Record<Sauce, string>> = { garlic: "#fbf5e6", herb: "#7cc04f", spicy: "#e0301e" };

/** The colour of what a dispenser holds: a sauce, or a pastry topping. */
const DISPENSER_COLOR: Readonly<Record<Sauce | Topping, string>> = { ...SAUCE_COLOR, cinnamon: "#a8642c", poppy: "#2b2b3a", lye: "#f4f1ea" };

/** The colour of a base raw, just done, and about to burn. */
const BAKE: Readonly<Record<Base, readonly [string, string, string]>> = {
  bread: ["#e3a456", "#c27028", "#6e4320"],
  wrap: ["#e3a456", "#c27028", "#6e4320"],
  dough: ["#f3e2bd", "#d08a3c", "#6e4320"],
};

function bakeColor(base: Base, toast: number): string {
  const { done, burnt } = HEAT[base];
  const [raw, baked, dark] = BAKE[base];

  if (toast >= burnt) return "#3b2a1d";

  if (toast <= done) return `#${new THREE.Color(raw).lerp(new THREE.Color(baked), toast / done).getHexString()}`;

  return `#${new THREE.Color(baked).lerp(new THREE.Color(dark), (toast - done) / (burnt - done)).getHexString()}`;
}

// ---------------------------------------------------------------- vegetables

/** A whole raw vegetable, big and faceted so it reads from the camera height. */
function wholeVeg(veg: Veg): THREE.Group {
  const g = new THREE.Group();

  if (veg === "lettuce") {
    const greens = ["#8fd552", "#6fc23f", "#4ea22c"];

    for (let i = 0; i < 7; i++) {
      const leaf = blob(0.12, mat(greens[i % 3] ?? "#6fc23f"));
      const a = i * 0.9;
      const r = i === 0 ? 0 : 0.08;
      leaf.scale.set(1, 0.8, 1);
      leaf.position.set(Math.cos(a) * r, 0.12 + (i === 0 ? 0.05 : 0), Math.sin(a) * r);
      leaf.rotation.set(a, a * 2, 0);
      g.add(leaf);
    }

    return g;
  }

  if (veg === "tomato") {
    const body = ball(0.15, mat(VEG_COLOR.tomato, "#000000", 0.35), 12);
    body.scale.set(1, 0.82, 1);
    body.position.y = 0.13;
    g.add(body);
    const shine = ball(0.035, mat("#ffd2c8", "#000000", 0.2), 6);
    shine.position.set(-0.06, 0.2, 0.08);
    g.add(shine);

    for (let i = 0; i < 5; i++) {
      const sepal = box(0.09, 0.015, 0.03, mat("#2f8a2f"), 0);
      sepal.position.set(Math.cos(i * 1.26) * 0.04, 0.255, Math.sin(i * 1.26) * 0.04);
      sepal.rotation.y = -i * 1.26;
      g.add(sepal);
    }

    const stem = cyl(0.012, 0.016, 0.06, mat("#2f8a2f"), 5);
    stem.position.y = 0.28;
    g.add(stem);

    return g;
  }

  const bulb = ball(0.14, mat(VEG_COLOR.onion, "#000000", 0.45), 10);
  bulb.scale.set(1, 0.92, 1);
  bulb.position.y = 0.13;
  g.add(bulb);
  const tip = cyl(0.008, 0.06, 0.1, mat("#9c4a78"), 7);
  tip.position.y = 0.29;
  g.add(tip);
  const roots = cyl(0.04, 0.02, 0.03, mat("#efe2bf"), 6);
  roots.position.y = 0.005;
  g.add(roots);

  return g;
}

/** A tomato slice: red rim with a lighter seeded centre. */
function tomatoSlice(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.055, 0.055, 0.022, mat(VEG_COLOR.tomato), 10));
  const inner = cyl(0.04, 0.04, 0.026, mat("#ff8466"), 10);
  g.add(inner);

  return g;
}

/** Chopped pieces of one vegetable, laid out in a small heap. */
function choppedPieces(veg: Veg, count: number, spread: number): THREE.Group {
  const g = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const a = i * 2.39;
    const r = spread * Math.sqrt((i + 0.5) / count);
    let piece: THREE.Object3D;

    if (veg === "lettuce") {
      piece = blob(0.055, mat(i % 2 === 0 ? "#8fd552" : "#5fb236"));
      piece.scale.set(1.3, 0.45, 1);
    } else if (veg === "tomato") {
      piece = tomatoSlice();
    } else {
      piece = ring(0.045, 0.013, mat("#c886b5"));
    }

    piece.position.set(Math.cos(a) * r, 0.02 + (i % 3) * 0.018, Math.sin(a) * r);
    piece.rotation.y += i;
    piece.rotation.z += 0.15 * ((i % 3) - 1);
    g.add(piece);
  }

  return g;
}

/** Curled strips of shaved meat. */
function meatStrips(burnt: boolean, count: number, spread: number): THREE.Group {
  const g = new THREE.Group();
  const tones = burnt ? ["#2e1c14", "#241510", "#3a2418"] : ["#a95f2c", "#8a4a22", "#c27236"];

  for (let i = 0; i < count; i++) {
    const strip = box(0.13, 0.026, 0.05, mat(tones[i % 3] ?? "#a95f2c"), 0);
    const a = i * 2.39;
    const r = spread * Math.sqrt((i + 0.5) / count);
    strip.position.set(Math.cos(a) * r, 0.02 + (i % 3) * 0.014, Math.sin(a) * r);
    strip.rotation.set(0.25 * ((i % 3) - 1), i * 1.1, 0.2 * ((i % 2) - 0.5));
    g.add(strip);
  }

  return g;
}

/** A zig-zag drizzle of sauce. */
function drizzle(sauce: Sauce): THREE.Group {
  const g = new THREE.Group();

  for (let i = 0; i < 5; i++) {
    const drop = blob(0.032, mat(SAUCE_COLOR[sauce], "#000000", 0.25), 1);
    drop.scale.set(2.2, 0.5, 0.9);
    drop.position.set(-0.12 + i * 0.06, 0.01, (i % 2 === 0 ? 1 : -1) * 0.03);
    drop.rotation.y = i % 2 === 0 ? 0.5 : -0.5;
    g.add(drop);
  }

  return g;
}

/** A scatter of grains: sugar, seeds or salt on a pastry. */
function sprinkle(topping: Topping, count = 14, spread = 0.12): THREE.Group {
  const g = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const grain = ball(topping === "lye" ? 0.016 : 0.011, mat(DISPENSER_COLOR[topping], "#000000", 0.4), 5);
    const a = i * 2.39;
    const r = spread * Math.sqrt((i + 0.5) / count);
    grain.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.7);
    g.add(grain);
  }

  return g;
}

/** The piece that stands for one filling inside a döner. */
function fillingPiece(f: Filling): THREE.Group {
  if (f === "meat") return meatStrips(false, 6, 0.07);

  if (f === "garlic" || f === "herb" || f === "spicy") return drizzle(f);

  if (f === "cinnamon" || f === "poppy" || f === "lye") return sprinkle(f);

  return choppedPieces(f, 4, 0.06);
}

// ---------------------------------------------------------------- bread

/** One Turkish flatbread loaf: a golden puffy oval with a raised rim, sesame and, once toasted, grill marks. */
function pide(color: string, toasted: boolean, thickness = 1): THREE.Group {
  const g = new THREE.Group();
  const dome = ball(0.2, mat(color, "#000000", 0.8), 16);
  dome.scale.set(1.45, 0.6 * thickness, 0.72);
  dome.position.y = 0.035;
  g.add(dome);
  const rim = ring(0.2, 0.055, mat(shade(color, -0.17), "#000000", 0.85));
  rim.scale.set(1.45, 0.72, 0.9 * thickness);
  rim.position.y = 0.04;
  g.add(rim);

  for (let i = 0; i < 9; i++) {
    const seed = ball(0.02, mat(i % 3 === 0 ? "#2a2018" : "#fff3d2"), 5);
    seed.scale.set(1.6, 0.6, 1);
    const a = i * 2.39;
    const r = 0.13 * Math.sqrt((i + 0.5) / 9);
    seed.position.set(Math.cos(a) * r * 1.45, 0.035 + 0.118 * thickness - r * 0.3, Math.sin(a) * r * 0.72);
    seed.rotation.y = a;
    g.add(seed);
  }

  if (toasted) {
    for (const x of [-0.1, 0, 0.1]) {
      const mark = box(0.03, 0.015, 0.2, mat("#5a3417"), 0.03 + 0.118 * thickness);
      mark.position.x = x;
      mark.rotation.y = 0.5;
      g.add(mark);
    }
  }

  return g;
}

/** A thin round dürüm wrap with a few toasted spots. */
function lavash(color: string, spots: number): THREE.Group {
  const g = new THREE.Group();
  const disc = cyl(0.25, 0.25, 0.022, mat(color, "#000000", 0.85), 20);
  disc.position.y = 0.012;
  g.add(disc);

  for (let i = 0; i < spots; i++) {
    const spot = cyl(0.025 + hash(i, 4) * 0.02, 0.03, 0.024, mat(shade(color, -0.18)), 7);
    const a = i * 2.39;
    const r = 0.18 * Math.sqrt((i + 0.5) / spots);
    spot.position.set(Math.cos(a) * r, 0.013, Math.sin(a) * r);
    g.add(spot);
  }

  return g;
}

/** A Franzbrötchen: a flat swirl of rolled dough with cinnamon in the grooves and sugar on top. */
function franz(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = ball(0.19, mat(color, "#000000", 0.8), 16);
  body.scale.set(1, 0.38, 0.85);
  body.position.y = 0.05;
  g.add(body);

  for (const [r, y] of [[0.15, 0.075], [0.1, 0.095], [0.05, 0.11]] as const) {
    const roll = ring(r, 0.028, mat(shade(color, 0.04), "#000000", 0.8));
    roll.scale.set(1, 0.85, 1);
    roll.position.y = y;
    g.add(roll);
    const groove = ring(r - 0.025, 0.012, mat("#7a3f17", "#000000", 0.7));
    groove.scale.set(1, 0.85, 1);
    groove.position.y = y + 0.008;
    g.add(groove);
  }

  return g;
}

/** A Mohnbrötchen: a round roll with a cut across the top. */
function mohn(color: string): THREE.Group {
  const g = new THREE.Group();
  const roll = ball(0.16, mat(color, "#000000", 0.8), 16);
  roll.scale.set(1, 0.72, 1);
  roll.position.y = 0.1;
  g.add(roll);
  const cut = box(0.24, 0.02, 0.03, mat(shade(color, 0.12)), 0.21);
  cut.rotation.y = 0.5;
  g.add(cut);

  return g;
}

/** A Brezel: a thick belly at the bottom, two arms crossing into loops, all from bent rolls of dough. */
function brezel(color: string): THREE.Group {
  const g = new THREE.Group();
  const dough = mat(color, "#000000", 0.45);
  const arc = (r: number, angle: number) => solid(geo(`arc|${r}|${angle}`, () => new THREE.TorusGeometry(r, 0.045, 8, 18, angle)), dough);
  const belly = arc(0.18, Math.PI);
  belly.rotation.set(-Math.PI / 2, 0, Math.PI);
  belly.position.set(0, 0.045, -0.02);
  g.add(belly);

  for (const side of [-1, 1]) {
    const loop = arc(0.1, Math.PI * 1.5);
    loop.rotation.set(-Math.PI / 2, 0, side < 0 ? 0 : Math.PI / 2);
    loop.position.set(side * 0.09, 0.045, -0.02);
    g.add(loop);
  }

  return g;
}

/** Each topping's pastry: how it is built, and how high the topping sits on it. */
const PASTRY: Readonly<Record<Topping, { readonly build: (color: string) => THREE.Group; readonly top: number }>> = {
  cinnamon: { build: franz, top: 0.12 },
  poppy: { build: mohn, top: 0.2 },
  lye: { build: brezel, top: 0.09 },
};

/** Dough: a pale ball until a topping makes it a pastry, which browns in the oven. */
function pastry(toast: number, topping: Filling | undefined): THREE.Group {
  const color = bakeColor("dough", toast);

  if (topping !== "cinnamon" && topping !== "poppy" && topping !== "lye") {
    const g = new THREE.Group();
    const lump = blob(0.16, mat(color, "#000000", 0.95), 2);
    lump.scale.set(1.1, 0.75, 1);
    lump.position.y = 0.11;
    g.add(lump);

    return g;
  }

  const { build, top: height } = PASTRY[topping];
  const g = build(topping === "lye" ? shade(color, -0.12) : color);
  const top = sprinkle(topping, topping === "lye" ? 9 : 18, 0.13);
  top.position.y = height;
  g.add(top);

  return g;
}

/** A döner under construction: a split pide or a wrap with what is in it so far; dough becomes a pastry. */
function doener(base: Base, toast: number, fillings: readonly Filling[]): THREE.Group {
  if (base === "dough") return pastry(toast, fillings[0]);
  const g = new THREE.Group();
  const toasted = toast >= HEAT[base].done * 0.7;

  if (base === "wrap") {
    const color = bakeColor(base, Math.min(toast, HEAT[base].done));
    g.add(lavash(color, toasted ? 7 : 3));

    // the edges start to roll up once something is inside
    if (fillings.length > 0) {
      for (const x of [-0.17, 0.17]) {
        const roll = solid(geo("capsule|0.05|0.3", () => new THREE.CapsuleGeometry(0.05, 0.3, 4, 10)), mat(color, "#000000", 0.85));
        roll.rotation.x = Math.PI / 2;
        roll.position.set(x, 0.05, 0);
        g.add(roll);
      }
    }
  } else if (fillings.length === 0) {
    g.add(pide(bakeColor(base, toast), toasted));
  } else {
    // cut open: the bottom half, the fillings, the top half tipped back like a lid
    g.add(pide(bakeColor(base, toast), false, 0.6));
    const lid = pide(bakeColor(base, toast), toasted, 0.7);
    lid.position.set(0, 0.13, -0.12);
    lid.rotation.x = -0.75;
    lid.scale.setScalar(0.95);
    g.add(lid);
  }

  const floor = base === "bread" ? 0.06 : 0.025;
  fillings.forEach((f, i) => {
    const part = fillingPiece(f);
    const sauce = f === "garlic" || f === "herb" || f === "spicy";
    const a = i * 2.2;
    const r = sauce ? 0 : 0.05;
    part.position.set(Math.cos(a) * r * 1.3, floor + i * 0.022, Math.sin(a) * r * 0.6 + 0.02);
    part.rotation.y = i * 0.7;
    g.add(part);
  });

  return g;
}

/** A paper tray of freshly shaved meat. */
function meatPortion(burnt: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.3, 0.04, 0.22, 0.015, mat("#f7f0e0"), 0.02));
  const strips = meatStrips(burnt, 8, 0.09);
  strips.position.y = 0.03;
  g.add(strips);

  return g;
}

/** A white plate; dirty ones have brown smears. */
function plate(dirty: boolean): THREE.Group {
  const g = new THREE.Group();
  const china = mat(dirty ? "#e9e1cf" : "#fbfaf6", "#000000", 0.35);
  const base = cyl(0.22, 0.17, 0.035, china, 24);
  base.position.y = 0.018;
  g.add(base);
  const rim = solid(geo("plate-rim", () => new THREE.TorusGeometry(0.22, 0.022, 6, 24)), china);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);

  if (dirty) {
    for (let i = 0; i < 3; i++) {
      const smear = cyl(0.05 + i * 0.012, 0.05 + i * 0.012, 0.006, mat(i === 1 ? "#8a5a2c" : "#b98a4a"), 10);
      smear.position.set(Math.cos(i * 2.2) * 0.08, 0.04, Math.sin(i * 2.2) * 0.08);
      smear.scale.set(1.3, 1, 0.8);
      g.add(smear);
    }
  }

  return g;
}

/** A plate with whatever döner lies on it. */
function platedModel(dirty: boolean, food: Item | null): THREE.Group {
  const g = plate(dirty);

  if (food !== null) {
    const d = itemModel(food);
    d.position.y = 0.045;
    d.scale.setScalar(0.92);
    g.add(d);
  }

  return g;
}

/** A plate stack of `count` plates, for the rack, the return hatch and the sink. */
export function plateStack(count: number, dirty: boolean): THREE.Group {
  const g = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const p = plate(dirty);
    p.position.set(Math.sin(i * 1.9) * 0.015, i * 0.045, Math.cos(i * 1.9) * 0.015);
    g.add(p);
  }

  return g;
}

/** A red fire extinguisher with a black hose and nozzle. */
function extinguisherModel(): THREE.Group {
  const g = new THREE.Group();
  const red = mat("#d62b1f", "#000000", 0.35);
  const body = outlined(cyl(0.1, 0.1, 0.42, red, 16));
  body.position.y = 0.23;
  g.add(body);
  const dome = ball(0.1, red, 12);
  dome.scale.y = 0.5;
  dome.position.y = 0.44;
  g.add(dome);
  const head = rbox(0.08, 0.08, 0.08, 0.02, steel("#2b2b2b"), 0.5);
  g.add(head);
  const handle = rbox(0.18, 0.02, 0.05, 0.01, steel(), 0.56);
  handle.position.x = 0.05;
  g.add(handle);
  const hose = cyl(0.02, 0.02, 0.24, mat("#1d1d1d"), 8);
  hose.position.set(0.1, 0.43, 0.05);
  hose.rotation.z = -0.9;
  g.add(hose);
  const label = rbox(0.002, 0.14, 0.12, 0.001, mat("#fff4e0"), 0.26);
  label.position.x = 0.1;
  g.add(label);

  return g;
}

/** A heap of one dry good: a mound of flour or a block of butter. */
function dryHeap(dry: Dry): THREE.Group {
  const g = new THREE.Group();

  if (dry === "flour") {
    const mound = ball(0.13, mat("#f6f1e4", "#000000", 0.95), 10);
    mound.scale.set(1, 0.45, 1);
    g.add(mound);

    return g;
  }

  const block = rbox(0.16, 0.08, 0.1, 0.015, mat("#f7d65a", "#000000", 0.5), 0.04);
  block.rotation.y = 0.4;
  g.add(block);

  return g;
}

/** A steel mixing bowl with what has been poured in so far. */
function bowlModel(bowl: Bowl): THREE.Group {
  const g = new THREE.Group();
  const shell = solid(geo("bowl", () => new THREE.SphereGeometry(0.22, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), steel("#d7dce2"));
  shell.position.y = 0.2;
  g.add(shell);
  const rim = ring(0.22, 0.015, steel("#eef1f4"));
  rim.position.y = 0.2;
  g.add(rim);

  if (bowl.knead > 0) {
    const mass = blob(0.14, mat(BAKE.dough[0], "#000000", 0.95), 2);
    mass.scale.set(1, 0.55, 1);
    mass.position.y = 0.12;
    g.add(mass);

    return g;
  }

  bowl.contents.forEach((dry, i) => {
    const heap = dryHeap(dry);
    heap.position.set(i === 0 ? -0.05 : 0.06, 0.1 + i * 0.02, i === 0 ? 0.02 : -0.03);
    g.add(heap);
  });

  return g;
}

/** A model for any item a cook can carry or a station can hold. */
export function itemModel(item: Item): THREE.Group {
  switch (item.kind) {
    case "veg":
      return isChopped(item) ? choppedPieces(item.veg, 9, 0.12) : wholeVeg(item.veg);
    case "meat":
      return meatPortion(item.burnt);
    case "base":
      return doener(item.base, heatTicks(item.toast), item.fillings);
    case "bowl":
      return bowlModel(item);
    case "plate":
      return platedModel(item.plate.state === "dirty", foodOn(item.plate));
    case "extinguisher":
      return extinguisherModel();
  }
}

/** A key that changes whenever an item's model would look different. */
export function itemKey(item: Item | null): string {
  if (item === null) return "";

  switch (item.kind) {
    case "veg": return `veg:${item.veg}:${isChopped(item)}`;
    case "meat": return `meat:${item.burnt}`;
    case "base": return `base:${item.base}:${Math.min(heatTicks(item.toast), HEAT[item.base].burnt) >> 4}:${item.fillings.join(",")}`;
    case "bowl": return `bowl:${item.contents.join(",")}:${item.knead > 0}`;
    case "plate": return `plate:${item.plate.state}:${itemKey(foodOn(item.plate))}`;
    case "extinguisher": return "extinguisher";
  }
}

// ---------------------------------------------------------------- stations

/** A front label: an emoji badge on the counter's face, so every crate and sauce reads at a glance. */
function frontBadge(icon: string, y: number, z: number, size = 0.3): THREE.Mesh {
  const badge = label(emojiBadge(icon), size);
  badge.position.set(0, y, z);

  return badge;
}

function crateContents(goods: CrateGoods): THREE.Group {
  const g = new THREE.Group();

  if (goods === "flour") {
    for (const [x, z, ry] of [[-0.18, -0.02, 0.3], [0.17, 0.02, -0.2]] as const) {
      const sack = ball(0.2, mat("#efe4c8", "#000000", 0.95), 10);
      sack.scale.set(0.9, 1, 0.75);
      sack.position.set(x, 0.17, z);
      sack.rotation.y = ry;
      g.add(sack);
      const tie = cyl(0.04, 0.06, 0.08, mat("#c9a76b"), 8);
      tie.position.set(x, 0.38, z);
      g.add(tie);
    }

    return g;
  }

  if (goods === "butter") {
    for (const [x, y, z, ry] of [[-0.15, 0.05, -0.08, 0.2], [0.15, 0.05, 0.06, -0.3], [0, 0.15, 0, 0.6]] as const) {
      const pack = rbox(0.26, 0.1, 0.15, 0.02, mat("#f7d65a", "#000000", 0.5), y);
      pack.position.set(x, y, z);
      pack.rotation.y = ry;
      g.add(pack);
      const wrapper = box(0.27, 0.04, 0.155, mat("#e9eef2"), y - 0.02);
      wrapper.position.set(x, y - 0.02, z);
      wrapper.rotation.y = ry;
      g.add(wrapper);
    }

    return g;
  }

  if (goods === "bread") {
    for (const [x, y, z, ry] of [[-0.12, 0.03, -0.06, 0.2], [0.13, 0.03, 0.04, -0.3], [0, 0.13, 0, 0.1]] as const) {
      const loaf = pide(bakeColor("bread", 0), false);
      loaf.position.set(x, y, z);
      loaf.rotation.set(0.12, ry, 0.08);
      loaf.scale.setScalar(0.85);
      g.add(loaf);
    }

    return g;
  }

  if (goods === "wrap") {
    for (let i = 0; i < 6; i++) {
      const sheet = lavash(bakeColor("wrap", 0), 0);
      sheet.position.set(Math.sin(i) * 0.02, 0.025 + i * 0.026, Math.cos(i) * 0.02);
      sheet.scale.setScalar(0.95);
      g.add(sheet);
    }

    return g;
  }

  for (const [x, z, y] of [[-0.16, -0.1, 0.03], [0.16, -0.09, 0.03], [-0.13, 0.12, 0.03], [0.15, 0.13, 0.03], [0, 0.01, 0.12]] as const) {
    const veg = wholeVeg(goods);
    veg.scale.setScalar(0.92);
    veg.position.set(x, y, z);
    veg.rotation.y = x * 9 + z * 5;
    g.add(veg);
  }

  return g;
}

function crateModel(s: Station, goods: CrateGoods): THREE.Group {
  const g = counter(s);
  const crate = new THREE.Group();
  crate.position.y = TOP;
  const wood = mapped("#c4884a", woodMap());

  for (const [x, z, w, d] of [[0, 0.33, 0.84, 0.07], [0, -0.33, 0.84, 0.07], [0.39, 0, 0.07, 0.6], [-0.39, 0, 0.07, 0.6]] as const) {
    for (const y of [0.05, 0.16]) {
      const slat = rbox(w, 0.09, d, 0.02, wood, y);
      slat.position.set(x, y, z);
      crate.add(slat);
    }
  }

  crate.add(box(0.76, 0.03, 0.6, mat("#7a4c25"), 0.015));
  const goodsGroup = crateContents(goods);
  goodsGroup.position.y = 0.02;
  crate.add(goodsGroup);
  crate.add(frontBadge(ICONS[goods], 0.12, 0.375, 0.26));
  g.add(crate);

  return g;
}

function boardModel(s: Station): THREE.Group {
  const g = counter(s);
  const board = rbox(0.74, 0.06, 0.54, 0.025, mapped("#e6ad69", woodMap()), TOP + 0.03);
  g.add(board);
  const groove = rbox(0.66, 0.008, 0.46, 0.004, mapped("#cf9554", woodMap()), TOP + 0.062);
  g.add(groove);
  const knife = new THREE.Group();
  knife.name = "knife";
  knife.position.set(0.14, TOP + 0.08, -0.2);
  knife.rotation.y = 0.45;
  const blade = rbox(0.26, 0.014, 0.1, 0.006, steel("#e4e9ee"), 0);
  knife.add(blade);
  const handle = rbox(0.13, 0.035, 0.04, 0.012, mat("#4a2c1a"), 0);
  handle.position.x = -0.19;
  knife.add(handle);
  g.add(knife);

  return g;
}

/** The warm bloom over a heater at work, named `ember`; dark until the scene lights it. */
function ember(y: number, z: number): THREE.Sprite {
  const glow = halo("#ff8a2a", 1.5, 0);
  glow.name = "ember";
  glow.position.set(0, y, z);

  return glow;
}

/** A contact grill: ridged plates, a hinged lid with a handle and a status lamp. */
function grillModel(s: Station): THREE.Group {
  const g = counter(s, true);

  if (s.y === 0) g.add(extractor());
  g.add(rbox(0.8, 0.12, 0.66, 0.03, mat("#33363b", "#000000", 0.5), TOP + 0.06));
  const plate = box(0.66, 0.02, 0.52, mat("#1c1d20", "#000000", 0.5), TOP + 0.13);
  g.add(plate);

  for (let i = 0; i < 6; i++) {
    const ridge = box(0.64, 0.015, 0.025, mat("#2c2e33", "#000000", 0.4), TOP + 0.145);
    ridge.position.z = -0.22 + i * 0.088;
    g.add(ridge);
  }

  const lid = new THREE.Group();
  lid.name = "lid";
  lid.position.set(0, TOP + 0.19, -0.3);
  const shell = rbox(0.78, 0.1, 0.62, 0.04, mat("#4a4f57", "#000000", 0.45), 0);
  shell.position.z = 0.3;
  lid.add(shell);
  const stripe = box(0.6, 0.02, 0.5, mat("#e94f37"), 0.055);
  stripe.position.z = 0.3;
  lid.add(stripe);

  for (const x of [-0.26, 0.26]) {
    const post = box(0.04, 0.08, 0.04, steel(), 0.06);
    post.position.set(x, 0.06, 0.6);
    lid.add(post);
  }

  const handle = solid(geo("handle", () => new THREE.CylinderGeometry(0.03, 0.03, 0.62, 10)), mat("#1f1f22", "#000000", 0.5));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.1, 0.63);
  lid.add(handle);
  g.add(lid);
  const lamp = ball(0.04, new THREE.MeshStandardMaterial({ color: "#3a3a3a", emissive: "#000000" }), 10);
  lamp.name = "lamp";
  lamp.position.set(0.3, TOP + 0.08, 0.34);
  g.add(lamp);

  g.add(ember(TOP + 0.22, 0.02));

  return g;
}

/** A dispenser on a board: a squeeze bottle for a sauce, a shaker with a steel cap for a topping. */
function sauceModel(s: Station, sauce: Sauce | Topping): THREE.Group {
  const shaker = sauce === "cinnamon" || sauce === "poppy" || sauce === "lye";
  const g = counter(s);
  g.add(rbox(0.5, 0.05, 0.4, 0.02, mapped("#b77a3f", woodMap()), TOP + 0.025));
  const bottleGroup = new THREE.Group();
  bottleGroup.scale.setScalar(1.3);
  bottleGroup.position.y = -TOP * 0.3;
  g.add(bottleGroup);
  const color = DISPENSER_COLOR[sauce];
  const bottle = cyl(0.12, 0.13, 0.4, mat(color, "#000000", 0.3), 16);
  bottle.position.y = TOP + 0.25;
  bottleGroup.add(bottle);
  const shoulder = ball(0.12, mat(color, "#000000", 0.3), 16);
  shoulder.scale.set(1, 0.5, 1);
  shoulder.position.y = TOP + 0.45;
  bottleGroup.add(shoulder);

  if (shaker) {
    const dome = ball(0.11, steel("#dfe3e8"), 12);
    dome.scale.set(1, 0.6, 1);
    dome.position.y = TOP + 0.5;
    bottleGroup.add(dome);
  } else {
    const cap = cyl(0.07, 0.08, 0.07, mat(sauce === "garlic" ? "#3f88c5" : "#fbf5e6"), 12);
    cap.position.y = TOP + 0.52;
    bottleGroup.add(cap);
    const nozzle = cyl(0.012, 0.045, 0.14, mat(sauce === "garlic" ? "#3f88c5" : "#fbf5e6"), 10);
    nozzle.position.y = TOP + 0.62;
    bottleGroup.add(nozzle);
  }

  const band = cyl(0.122, 0.132, 0.16, mat("#fff7e8"), 16);
  band.position.y = TOP + 0.24;
  bottleGroup.add(band);
  bottleGroup.add(frontBadge(ICONS[sauce], TOP + 0.24, 0.135, 0.17));
  const puddle = shaker ? sprinkle(sauce, 12, 0.07) : cyl(0.07, 0.07, 0.012, mat(color, "#000000", 0.2), 12);
  puddle.scale.set(1.4, 1, 1);
  puddle.position.set(0.24, TOP + 0.056, 0.12);
  g.add(puddle);

  return g;
}

/** A stand mixer: a heavy foot, a column and a head over the bowl, the whisk turning under it. */
function mixerModel(s: Station): THREE.Group {
  const g = counter(s);
  const body = mat("#e94f37", "#000000", 0.35);
  g.add(rbox(0.62, 0.08, 0.66, 0.04, body, TOP + 0.04));
  const column = rbox(0.26, 0.66, 0.24, 0.08, body, TOP + 0.33);
  column.position.z = -0.24;
  g.add(column);
  const head = rbox(0.34, 0.22, 0.56, 0.1, body, TOP + 0.72);
  head.position.z = -0.06;
  g.add(head);
  const trim = box(0.36, 0.04, 0.3, steel("#e6eaee"), TOP + 0.66);
  trim.position.z = 0.08;
  g.add(trim);
  const whisk = new THREE.Group();
  whisk.name = "whisk";
  whisk.position.set(0, TOP + 0.58, 0.04);
  const shaft = cyl(0.015, 0.015, 0.2, steel(), 6);
  shaft.position.y = -0.1;
  whisk.add(shaft);

  for (let i = 0; i < 3; i++) {
    const wire = ring(0.06, 0.007, steel("#e6eaee"));
    wire.scale.set(1, 1.6, 1);
    wire.rotation.y = (i * Math.PI) / 3;
    wire.position.y = -0.24;
    whisk.add(wire);
  }

  g.add(whisk);
  const lamp = ball(0.035, new THREE.MeshStandardMaterial({ color: "#3a3a3a", emissive: "#000000" }), 10);
  lamp.name = "lamp";
  lamp.position.set(0.18, TOP + 0.74, 0.12);
  g.add(lamp);

  return g;
}

/** A deck oven: a dark steel box with a door hinged at the bottom that folds down while it stands empty. */
function ovenModel(s: Station): THREE.Group {
  const g = counter(s, true);
  const shell = mat("#3d4148", "#000000", 0.45);
  g.add(rbox(0.9, 0.08, 0.84, 0.03, shell, TOP + 0.04));
  g.add(rbox(0.9, 0.08, 0.84, 0.03, shell, TOP + 0.47));

  for (const x of [-0.42, 0.42]) {
    const wall = box(0.06, 0.4, 0.84, shell, TOP + 0.25);
    wall.position.x = x;
    g.add(wall);
  }

  const back = box(0.84, 0.4, 0.06, shell, TOP + 0.25);
  back.position.z = -0.39;
  g.add(back);
  g.add(box(0.78, 0.02, 0.72, mat("#1c1d20", "#000000", 0.6), TOP + 0.09));
  const glow = box(0.7, 0.01, 0.6, mat("#ff7a2a", "#c2410c", 0.6), TOP + 0.1);
  glow.position.z = -0.02;
  g.add(glow);
  const lid = new THREE.Group();
  lid.name = "lid";
  lid.position.set(0, TOP + 0.09, 0.42);
  const door = rbox(0.82, 0.34, 0.05, 0.02, mat("#565b63", "#000000", 0.4), 0.17);
  lid.add(door);
  const window = rbox(0.5, 0.16, 0.02, 0.02, new THREE.MeshStandardMaterial({ color: "#2a2a2a", emissive: "#000000" }), 0.17);
  window.name = "lamp";
  window.position.z = 0.03;
  lid.add(window);
  const handle = solid(geo("handle", () => new THREE.CylinderGeometry(0.03, 0.03, 0.62, 10)), steel("#e6eaee"));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.3, 0.07);
  lid.add(handle);
  g.add(lid);
  g.add(frontBadge("🔥", TOP + 0.47, 0.43, 0.14));

  g.add(ember(TOP + 0.3, 0.2));

  return g;
}

/** One quarter of the meat cone, with bumpy stacked layers; shared between all spits. */
function coneQuarter(side: number): THREE.BufferGeometry {
  return geo(`cone|${side}`, () => {
    const rings = 14;
    const g = new THREE.CylinderGeometry(0.47, 0.26, 1.15, 5, rings, false, side * (Math.PI / 2), Math.PI / 2);
    const pos = g.attributes.position;

    if (pos === undefined) return g;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);

      if (r < 1e-4) continue;
      const level = Math.round(((pos.getY(i) + 0.575) / 1.15) * rings);
      const theta = Math.round(Math.atan2(x, z) * 100);
      const bump = 1 + (level % 2 === 0 ? 0 : 0.07) + hash(level, 1) * 0.05 + hash(level, theta) * 0.03;
      pos.setX(i, x * bump);
      pos.setZ(i, z * bump);
    }

    g.computeVertexNormals();

    return g;
  });
}

const GLASS = new THREE.MeshStandardMaterial({ color: "#cfe8f2", transparent: true, opacity: 0.26, roughness: 0.05 });

/** The extraction hood over a station against the back wall: a steel canopy with a red stripe, a back plate and a duct. */
function extractor(): THREE.Group {
  const g = new THREE.Group();
  const plate = box(1, 1.3, 0.04, steel("#b9c0c7"), TOP + 1.4);
  plate.position.z = -0.52;
  g.add(plate);
  const skirt = rbox(1, 0.14, 0.5, 0.03, steel("#c3c8ce"), TOP + 1.97);
  skirt.position.z = -0.29;
  g.add(skirt);
  const stripe = box(1, 0.05, 0.02, mat("#c9342b"), TOP + 1.97);
  stripe.position.z = -0.035;
  g.add(stripe);
  const crown = rbox(0.78, 0.16, 0.36, 0.03, steel("#aeb5bd"), TOP + 2.11);
  crown.position.z = -0.33;
  g.add(crown);
  const duct = cyl(0.13, 0.13, 0.36, steel("#9aa1a8"), 12);
  duct.position.set(0, TOP + 2.36, -0.34);
  g.add(duct);

  return g;
}

/** The spit: a tall heater with glowing burners, a drip tray and a bumpy layered cone of four sides. */
function spitModel(s: Station): THREE.Group {
  const g = counter(s, true);
  const housing = rbox(0.9, 1.45, 0.2, 0.05, steel("#8a9097"), TOP + 0.72);
  housing.position.z = -0.4;
  g.add(housing);
  const inner = box(0.7, 1.15, 0.02, mat("#2a2320"), TOP + 0.7);
  inner.position.z = -0.295;
  g.add(inner);
  const glowMat = new THREE.MeshStandardMaterial({ color: "#ff8a2a", emissive: "#ff4d00", emissiveIntensity: 1, roughness: 0.6 });

  for (const x of [-0.22, 0, 0.22]) {
    const burner = rbox(0.15, 1.02, 0.04, 0.02, glowMat, TOP + 0.7);
    burner.position.set(x, TOP + 0.7, -0.28);
    burner.castShadow = false;

    if (x === 0) burner.name = "glow";
    g.add(burner);
  }

  const bloom = halo("#ff7a2a", 1.9, 0.38);
  bloom.position.set(0, TOP + 0.7, -0.1);
  g.add(bloom);
  const hood = rbox(0.96, 0.09, 0.42, 0.035, steel("#9aa1a8"), TOP + 1.46);
  hood.position.z = -0.27;
  g.add(hood);
  const tray = cyl(0.4, 0.34, 0.07, steel("#b5bbc1"), 20);
  tray.position.y = TOP + 0.035;
  g.add(tray);
  const oil = cyl(0.35, 0.35, 0.072, mat("#d38b2a", "#4a2000", 0.15), 20);
  oil.position.y = TOP + 0.04;
  g.add(oil);
  const rod = cyl(0.025, 0.025, 1.45, steel("#d8dde2"), 8);
  rod.position.y = TOP + 0.76;
  g.add(rod);
  const cone = new THREE.Group();
  cone.name = "cone";
  cone.position.y = TOP + 0.66;
  const meat = meatMap();

  for (let side = 0; side < 4; side++) {
    const part = solid(
      coneQuarter(side),
      new THREE.MeshStandardMaterial({ color: meatColor(0.9), map: meat, roughness: 0.5, flatShading: true }),
    );

    part.name = `side${side}`;
    cone.add(part);
  }

  const crust = cyl(0.5, 0.5, 0.05, mat("#8a4a22", "#000000", 0.8), 12);
  crust.position.y = 0.6;
  cone.add(crust);
  const cap = cyl(0.13, 0.17, 0.06, steel(), 12);
  cap.position.y = 0.65;
  cone.add(cap);
  // the tomato every döner man spears on top
  const tomato = ball(0.1, mat("#e23a2a", "#000000", 0.35), 12);
  tomato.scale.y = 0.85;
  tomato.position.y = 0.75;
  cone.add(tomato);
  const stalk = cyl(0.035, 0.05, 0.03, mat("#4f9a3a"), 6);
  stalk.position.y = 0.84;
  cone.add(stalk);
  g.add(cone);

  if (s.y === 0) g.add(extractor());
  const heat = new THREE.PointLight("#ff8a3c", 2.2, 2.6, 1.6);
  heat.name = "heat";
  heat.position.set(0, TOP + 0.7, -0.05);
  g.add(heat);

  return g;
}

/** The pass: a steel shelf under two warm heat lamps, with a service bell. */
function passModel(s: Station): THREE.Group {
  const g = counter(s, true);
  g.add(rbox(0.66, 0.035, 0.46, 0.015, mat("#d4362b"), TOP + 0.018));

  for (const x of [-0.44, 0.44]) {
    const post = cyl(0.025, 0.025, 1.05, steel("#7f868e"), 8);
    post.position.set(x, TOP + 0.52, -0.4);
    g.add(post);
  }

  const bar = rbox(0.96, 0.06, 0.08, 0.02, steel("#7f868e"), TOP + 1.05);
  bar.position.z = -0.4;
  g.add(bar);
  const bulbMat = mat("#ffe2a8", "#ffa040");

  for (const x of [-0.22, 0.22]) {
    const arm = box(0.03, 0.03, 0.3, steel("#7f868e"), TOP + 1.05);
    arm.position.set(x, TOP + 1.05, -0.25);
    g.add(arm);
    const lamp = cyl(0.07, 0.15, 0.13, mat("#d4362b", "#000000", 0.4), 14);
    lamp.position.set(x, TOP + 0.98, -0.1);
    g.add(lamp);
    const bulb = ball(0.07, bulbMat, 10);
    bulb.scale.set(1, 0.4, 1);
    bulb.position.set(x, TOP + 0.915, -0.1);
    bulb.castShadow = false;
    g.add(bulb);
  }

  const bell = ball(0.08, mat("#e8c547", "#000000", 0.25), 12);
  bell.scale.set(1, 0.75, 1);
  bell.position.set(0.32, TOP + 0.06, 0.32);
  g.add(bell);
  const knob = ball(0.02, mat("#3a3d42"), 6);
  knob.position.set(0.32, TOP + 0.13, 0.32);
  g.add(knob);

  return g;
}

function binModel(): THREE.Group {
  const g = new THREE.Group();
  const can = cyl(0.33, 0.27, 0.8, mat("#4f9a52", "#000000", 0.55), 18);
  can.position.y = 0.4;
  g.add(can);

  for (const y of [0.22, 0.58]) {
    const band = cyl(0.32 - (0.8 - y) * 0.05, 0.31 - (0.8 - y) * 0.05, 0.05, mat("#3a7a3d"), 18);
    band.position.y = y;
    band.scale.setScalar(1.04);
    g.add(band);
  }

  const rim = solid(geo("bin-rim", () => new THREE.TorusGeometry(0.33, 0.04, 6, 20)), mat("#2f6a32"));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.8;
  g.add(rim);
  const hole = cyl(0.3, 0.3, 0.02, mat("#1b1b1b"), 18);
  hole.position.y = 0.79;
  g.add(hole);
  const pedal = rbox(0.18, 0.04, 0.1, 0.015, steel(), 0.04);
  pedal.position.z = 0.32;
  g.add(pedal);
  g.add(frontBadge("🗑️", 0.45, 0.31, 0.24));

  return g;
}

/** A steel prep tray (bain-marie) set into the counter, behind a glass sneeze guard; the scene fills its `stock`. */
function trayModel(s: Station): THREE.Group {
  const g = counter(s, true);
  const pan = rbox(0.78, 0.1, 0.62, 0.03, steel("#aeb5bd"), TOP + 0.02);
  g.add(pan);
  const well = rbox(0.7, 0.02, 0.54, 0.02, steel("#6f767e"), TOP + 0.075);
  g.add(well);

  // the sneeze guard of a salad bar: a slanted pane on two posts under a steel shelf
  for (const x of [-0.47, 0.47]) {
    const post = box(0.03, 0.5, 0.03, steel("#9aa1a9"), TOP + 0.25);
    post.position.set(x, TOP + 0.25, -0.45);
    g.add(post);
  }

  const shelf = rbox(1, 0.03, 0.2, 0.01, steel("#c3c8ce"), TOP + 0.51);
  shelf.position.z = -0.4;
  g.add(shelf);
  const pane = box(0.96, 0.4, 0.015, GLASS, 0);
  pane.position.set(0, TOP + 0.34, -0.2);
  pane.rotation.x = -0.75;
  pane.castShadow = false;
  g.add(pane);

  return g;
}

/** Chopped vegetables in a tray: one heap per portion. */
export function trayStock(veg: Veg | null, portions: number): THREE.Group {
  const g = new THREE.Group();

  if (veg === null) return g;

  for (let i = 0; i < portions; i++) {
    const heap = choppedPieces(veg, 7, 0.1);
    heap.position.set(-0.22 + i * 0.22, TOP + 0.08, 0);
    g.add(heap);
  }

  return g;
}

/** A plate rack on the counter: wire uprights the clean plates lean between. */
function rackModel(s: Station): THREE.Group {
  const g = counter(s);
  g.add(rbox(0.6, 0.03, 0.5, 0.01, steel("#9aa1a9"), TOP + 0.015));

  for (const x of [-0.27, 0.27]) {
    const upright = cyl(0.015, 0.015, 0.3, steel("#9aa1a9"), 6);
    upright.position.set(x, TOP + 0.15, -0.2);
    g.add(upright);
  }

  g.add(frontBadge("🍽️", 0.5, 0.48, 0.24));

  return g;
}

/** The hatch where served plates come back dirty: a counter with a little window frame and arrow. */
function returnModel(s: Station): THREE.Group {
  const g = counter(s, true);
  const frame = rbox(0.9, 0.5, 0.08, 0.03, mat("#3a3d42"), TOP + 0.25);
  frame.position.z = -0.42;
  g.add(frame);
  const window = rbox(0.7, 0.34, 0.02, 0.02, mat("#1c1d20"), TOP + 0.25);
  window.position.z = -0.37;
  g.add(window);
  g.add(frontBadge("↩️", 0.5, 0.48, 0.24));

  return g;
}

/** A steel sink with a tap; dirty plates soak in it, clean ones dry beside it. */
function sinkModel(s: Station): THREE.Group {
  const g = counter(s, true);
  const basin = rbox(0.56, 0.04, 0.5, 0.03, mat("#5e7f99", "#000000", 0.2), TOP - 0.02);
  basin.position.x = -0.1;
  g.add(basin);
  const water = rbox(0.5, 0.01, 0.44, 0.02, mat("#9fd3f0", "#0a2030", 0.1), TOP + 0.005);
  water.position.x = -0.1;
  water.name = "water";
  g.add(water);
  const tap = cyl(0.025, 0.025, 0.3, steel(), 8);
  tap.position.set(-0.1, TOP + 0.15, -0.36);
  g.add(tap);
  const spout = rbox(0.04, 0.04, 0.18, 0.015, steel(), TOP + 0.3);
  spout.position.set(-0.1, TOP + 0.3, -0.28);
  g.add(spout);
  g.add(frontBadge("🧽", 0.5, 0.48, 0.24));

  return g;
}

/** Chevrons on one belt tile; the scene slides them along so the belt reads as running. */
export const BELT_CHEVRONS = 4;

/**
 * A conveyor belt set into a steel counter: dark rubber between two rails, yellow chevrons pointing the way it
 * runs. Built along +x and turned to face `dir`; the chevrons sit in the `belt` group the scene animates.
 */
function beltModel(s: Extract<Station, { type: "belt" }>): THREE.Group {
  const g = counter(s, true);
  const run = new THREE.Group();
  run.rotation.y = Math.atan2(-s.dir.dy, s.dir.dx);
  g.add(run);
  run.add(box(1, 0.05, 0.7, mat("#2a2c31", "#000000", 0.95), TOP + 0.01));

  for (const z of [-0.41, 0.41]) {
    const rail = box(1, 0.08, 0.08, steel("#8d949c"), TOP + 0.03);
    rail.position.z = z;
    run.add(rail);
  }

  const chevrons = new THREE.Group();
  chevrons.name = "belt";
  run.add(chevrons);

  for (let i = 0; i < BELT_CHEVRONS; i++) {
    const chevron = new THREE.Group();

    for (const side of [-1, 1]) {
      const arm = box(0.05, 0.012, 0.3, mat("#f2c230", "#3a2a00", 0.6), TOP + 0.04);
      arm.position.z = side * 0.12;
      arm.rotation.y = -side * 0.75;
      chevron.add(arm);
    }

    chevrons.add(chevron);
  }

  return g;
}

/** Where a guest sits at a table, from the tile's centre: on the chair behind it, lifted onto the seat. */
export const GUEST_SEAT = { z: -0.3, lift: 0.17 } as const;

/** How high the top of a dining table is. */
const TABLE_TOP = 0.64;

/** A red and white checked plastic tablecloth. */
function checkerMap(): THREE.Texture {
  return canvasTexture("checker", 64, 64, (g) => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 === 0 ? "#d8322a" : "#fbf4ea";
        g.fillRect(x * 16, y * 16, 16, 16);
      }
    }
  });
}

/** The table's number on a round yellow sign, big enough to read from the camera. */
function tableNumber(n: number): THREE.Texture {
  return canvasTexture(`table-no|${n}`, 128, 128, (g) => {
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "#2a1a10";
    g.stroke();
    g.fillStyle = "#2a1a10";
    g.font = "900 84px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), 64, 70);
  });
}

/**
 * A table in the dining room: a checked cloth on one steel leg, a tulip in a glass, chili flakes and a napkin box, the
 * table's number on a stand, and a white plastic chair behind it where the guest sits.
 */
function tableModel(s: Extract<Station, { type: "table" }>): THREE.Group {
  const g = new THREE.Group();
  const leg = steel("#9aa1a9");
  const foot = cyl(0.16, 0.19, 0.03, leg, 18);
  foot.position.set(0, 0.02, 0.08);
  g.add(foot);
  const post = cyl(0.045, 0.045, TABLE_TOP, leg, 10);
  post.position.set(0, TABLE_TOP / 2, 0.08);
  g.add(post);
  const top = rbox(0.86, 0.05, 0.64, 0.02, mat("#7a4a2c"), TABLE_TOP);
  top.position.z = 0.08;
  g.add(top);
  const cloth = rbox(0.9, 0.025, 0.68, 0.01, mapped("#ffffff", checkerMap(), 0.6), TABLE_TOP + 0.035);
  cloth.position.z = 0.08;
  g.add(cloth);

  const glass = cyl(0.04, 0.035, 0.12, mat("#bfe3ea", "#000000", 0.15), 10);
  glass.position.set(-0.3, TABLE_TOP + 0.11, -0.05);
  g.add(glass);
  const stem = cyl(0.008, 0.008, 0.14, mat("#3f8a3a"), 5);
  stem.position.set(-0.3, TABLE_TOP + 0.22, -0.05);
  g.add(stem);
  const tulip = ball(0.045, mat("#e8392b", "#000000", 0.5), 8);
  tulip.scale.set(1, 1.3, 1);
  tulip.position.set(-0.3, TABLE_TOP + 0.3, -0.05);
  g.add(tulip);
  const chili = cyl(0.03, 0.03, 0.08, mat("#f4ead8"), 8);
  chili.position.set(-0.18, TABLE_TOP + 0.09, -0.12);
  g.add(chili);
  const flakes = cyl(0.026, 0.026, 0.04, mat("#c0301c"), 8);
  flakes.position.set(-0.18, TABLE_TOP + 0.075, -0.12);
  g.add(flakes);
  const napkins = box(0.12, 0.08, 0.06, mat("#f7f1e6"), TABLE_TOP + 0.09);
  napkins.position.set(0.12, TABLE_TOP + 0.09, -0.14);
  g.add(napkins);

  const stand = box(0.03, 0.14, 0.03, steel(), TABLE_TOP + 0.1);
  stand.position.set(0.3, TABLE_TOP + 0.1, 0.2);
  g.add(stand);
  const sign = label(tableNumber(s.table), 0.3);
  sign.position.set(0.3, TABLE_TOP + 0.3, 0.22);
  sign.rotation.x = -0.45;
  g.add(sign);

  // the monobloc chair the guest sits on
  const plastic = mat("#f1efe8", "#000000", 0.45);
  const seat = rbox(0.44, 0.05, 0.36, 0.02, plastic, 0.42);
  seat.position.z = GUEST_SEAT.z;
  g.add(seat);
  const back = rbox(0.44, 0.38, 0.05, 0.03, plastic, 0.64);
  back.position.z = GUEST_SEAT.z - 0.18;
  back.rotation.x = -0.12;
  g.add(back);

  for (const [x, z] of [[-0.18, -0.15], [0.18, -0.15], [-0.18, -0.45], [0.18, -0.45]] as const) {
    const chairLeg = cyl(0.025, 0.03, 0.42, plastic, 6);
    chairLeg.position.set(x, 0.21, z);
    g.add(chairLeg);
  }

  return g;
}

/** How far above the counter top an item sits, for stations with something under it. */
const SLOT_LIFT = new Map<Station["type"], number>([["toaster", 0.15], ["board", 0.065], ["pass", 0.04], ["mixer", 0.06], ["belt", 0.04]]);

/** The model of a station. Its `slot` child is where a held item sits. A `rolling` counter is one that slides: steel top, yellow kick band. */
export function stationModel(s: Station, rolling = false): THREE.Group {
  let g: THREE.Group;

  switch (s.type) {
    case "counter":
      g = counter(s, rolling);

      if (rolling) g.add(box(0.98, 0.1, 0.96, mat("#f2b420"), 0.13));
      break;
    case "belt": g = beltModel(s); break;
    case "crate": g = crateModel(s, s.goods); break;
    case "board": g = boardModel(s); break;
    case "toaster": g = s.look === "oven" ? ovenModel(s) : grillModel(s); break;
    case "sauce": g = sauceModel(s, s.sauce); break;
    case "spit": g = spitModel(s); break;
    case "pass": g = passModel(s); break;
    case "table": g = tableModel(s); break;
    case "bin": g = binModel(); break;
    case "tray": g = trayModel(s); break;
    case "rack": g = rackModel(s); break;
    case "return": g = returnModel(s); break;
    case "sink": g = sinkModel(s); break;
    case "mixer": g = mixerModel(s); break;
  }

  const stock = new THREE.Group();
  stock.name = "stock";
  g.add(stock);

  const slot = new THREE.Group();
  slot.name = "slot";
  slot.position.y = TOP + (SLOT_LIFT.get(s.type) ?? 0);
  g.add(slot);

  return g;
}

// ---------------------------------------------------------------- characters

/** A dome: the top half of a sphere, open underneath. Hats and hair sit on the head with it. */
function dome(r: number, material: THREE.Material): THREE.Mesh {
  return solid(geo(`dome|${r}`, () => new THREE.SphereGeometry(r, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2)), material);
}

/** Hair over the top and back of the head, leaving the forehead free. */
function hairCap(rig: THREE.Group, look: Look): void {
  const hair = outlined(dome(0.245, mat(look.hair, "#000000", 0.8)), 1.06);
  hair.scale.set(1, 0.9, 1);
  hair.position.set(0, 0.95, -0.02);
  hair.rotation.x = -0.4;
  rig.add(hair);
}

/** What each look wears on its head, built onto the cook's rig. */
const HEADWEAR: Record<Headwear, (rig: THREE.Group, look: Look) => void> = {
  toque: (rig, look) => {
    const brim = outlined(cyl(0.2, 0.21, 0.1, mat("#ffffff", "#000000", 0.8), 18), 1.06);
    brim.position.y = 1.11;
    rig.add(brim);
    const puff = outlined(ball(0.25, mat("#ffffff", "#000000", 0.8), 12), 1.06);
    puff.scale.set(1, 0.78, 1);
    puff.position.y = 1.28;
    rig.add(puff);
    const band = cyl(0.205, 0.215, 0.035, mat(look.body), 18);
    band.position.y = 1.08;
    rig.add(band);
  },
  cap: (rig, look) => {
    const crown = outlined(dome(0.25, mat(look.body, "#000000", 0.6)), 1.06);
    crown.scale.set(1, 0.72, 1);
    crown.position.y = 0.99;
    rig.add(crown);
    const peak = outlined(rbox(0.26, 0.035, 0.2, 0.015, mat(shade(look.body, -0.12)), 0), 1.1);
    peak.position.set(0, 1.06, 0.21);
    peak.rotation.x = -0.12;
    rig.add(peak);
    const button = ball(0.035, mat(shade(look.body, 0.2)), 8);
    button.position.y = 1.17;
    rig.add(button);
  },
  bandana: (rig, look) => {
    const cloth = outlined(dome(0.248, mat(look.body, "#000000", 0.7)), 1.06);
    cloth.scale.set(1, 0.72, 1);
    cloth.position.y = 0.99;
    rig.add(cloth);

    for (const [x, y, z] of [[0, 1.17, 0.02], [0.13, 1.12, 0.13], [-0.13, 1.12, 0.13], [0.16, 1.12, -0.1], [-0.16, 1.12, -0.1]] as const) {
      const dot = ball(0.03, mat("#fbf6ec"), 6);
      dot.scale.set(1, 0.5, 1);
      dot.position.set(x, y, z);
      rig.add(dot);
    }

    for (const x of [-0.05, 0.05]) {
      const knot = outlined(blob(0.06, mat(shade(look.body, -0.08))), 1.1);
      knot.position.set(x, 1.0, -0.25);
      knot.rotation.z = x * 8;
      rig.add(knot);
    }
  },
  beanie: (rig, look) => {
    const knit = outlined(dome(0.25, mat(look.body, "#000000", 0.9)), 1.06);
    knit.scale.set(1, 1.05, 1);
    knit.position.y = 0.99;
    rig.add(knit);
    const cuff = outlined(cyl(0.258, 0.262, 0.08, mat(shade(look.body, -0.1), "#000000", 0.9), 18), 1.04);
    cuff.position.y = 1.02;
    rig.add(cuff);
    const pom = outlined(ball(0.08, mat("#fbf6ec", "#000000", 0.9), 10), 1.1);
    pom.position.y = 1.27;
    rig.add(pom);
  },
  paperhat: (rig, look) => {
    hairCap(rig, look);
    const hat = outlined(rbox(0.44, 0.13, 0.2, 0.05, mat("#ffffff", "#000000", 0.8), 0), 1.06);
    hat.position.set(0, 1.15, 0.01);
    rig.add(hat);
    const stripe = rbox(0.45, 0.04, 0.21, 0.015, mat(look.body), 0);
    stripe.position.set(0, 1.1, 0.01);
    rig.add(stripe);
  },
  ponytail: (rig, look) => {
    hairCap(rig, look);
    const tail = outlined(ball(0.1, mat(look.hair, "#000000", 0.8), 10), 1.08);
    tail.scale.set(0.85, 1.35, 0.85);
    tail.position.set(0, 0.92, -0.3);
    rig.add(tail);
    const tie = ring(0.055, 0.025, mat(look.body));
    tie.position.set(0, 1.04, -0.27);
    rig.add(tie);
  },
  bun: (rig, look) => {
    hairCap(rig, look);
    const bun = outlined(ball(0.12, mat(look.hair, "#000000", 0.8), 12), 1.08);
    bun.position.set(0, 1.2, -0.08);
    rig.add(bun);
    const tie = ring(0.1, 0.025, mat(look.body));
    tie.position.set(0, 1.14, -0.07);
    rig.add(tie);
  },
  // a little chef's hat that sits between an animal's ears
  minitoque: (rig, look) => {
    const hat = new THREE.Group();
    hat.scale.setScalar(0.62);
    hat.position.y = 0.45;
    HEADWEAR.toque(hat, look);
    rig.add(hat);
  },
  none: () => {},
};

/** What each look has on its face. */
const ACCESSORIES: Record<Accessory, (rig: THREE.Group, look: Look) => void> = {
  none: () => {},
  moustache: (rig, look) => {
    for (const x of [-0.055, 0.055]) {
      const half = ball(0.055, mat(look.hair, "#000000", 0.8), 8);
      half.scale.set(1.35, 0.55, 0.6);
      half.position.set(x, 0.855, 0.215);
      half.rotation.z = x < 0 ? 0.35 : -0.35;
      rig.add(half);
    }
  },
  glasses: (rig) => {
    const frame = mat("#2b1810", "#000000", 0.4);

    for (const x of [-0.08, 0.08]) {
      const lens = solid(geo("glasses-rim", () => new THREE.TorusGeometry(0.055, 0.013, 6, 14)), frame);
      lens.position.set(x, 0.95, 0.225);
      rig.add(lens);
    }

    const bridge = box(0.05, 0.014, 0.014, frame, 0.96);
    bridge.position.z = 0.235;
    rig.add(bridge);
  },
};

// ---------------------------------------------------------------- species

/** The radius of a cook's head; faces are built round its centre and scaled for smaller heads. */
const HEAD = 0.23;

/** The two colours of a creature: skin, fur or feathers, and the second one (muzzle, inner ears, beak). */
interface Coat {
  readonly fur: string;
  readonly trim: string;
}

/**
 * A species' face, built round the centre of a head of radius `HEAD`: where the eyes and the
 * mouth sit, what grows on the head (`ears` go into their own group so they can fold back),
 * and the tail, if it has one.
 */
interface Face {
  readonly eyes: { readonly x: number; readonly y: number; readonly z: number };
  /** Where the mouth sits; null for a beak, which has none. */
  readonly mouth: { readonly y: number; readonly z: number } | null;
  readonly build: (head: THREE.Group, ears: THREE.Group, coat: Coat) => void;
  readonly tail: ((coat: Coat) => THREE.Object3D) | null;
}

const PINK = "#f29b8a";

const SNOUT = "#2b1d1a";

function fur(color: string): THREE.MeshStandardMaterial {
  return mat(color, "#000000", 0.75);
}

/** Two rosy cheeks. */
function cheeks(head: THREE.Group, x: number, y: number, z: number): void {
  for (const side of [-x, x]) {
    const cheek = ball(0.04, mat(PINK), 8);
    cheek.scale.set(1, 0.6, 0.4);
    cheek.position.set(side, y, z);
    head.add(cheek);
  }
}

/** A small nose button. */
function snoutTip(head: THREE.Group, color: string, r: number, y: number, z: number): void {
  const tip = ball(r, mat(color, "#000000", 0.35), 8);
  tip.scale.set(1.25, 0.8, 0.7);
  tip.position.set(0, y, z);
  head.add(tip);
}

/** Two pointed ears with a coloured inside, tilted outwards. */
function pointedEars(ears: THREE.Group, coat: Coat, size: number): void {
  for (const x of [-0.165, 0.165]) {
    const ear = outlined(solid(geo("ear-cone", () => new THREE.ConeGeometry(0.09, 0.18, 4)), fur(coat.fur)), 1.1);
    ear.scale.setScalar(size);
    ear.position.set(x, 0.2, -0.01);
    ear.rotation.set(0, Math.PI / 4, x < 0 ? 0.45 : -0.45);
    ears.add(ear);
    const inner = solid(geo("ear-cone", () => new THREE.ConeGeometry(0.09, 0.18, 4)), mat(coat.trim));
    inner.castShadow = false;
    inner.scale.setScalar(size * 0.55);
    inner.position.set(x, 0.19, 0.035);
    inner.rotation.copy(ear.rotation);
    ears.add(inner);
  }
}

/** Two round ears with a coloured inside. */
function roundEars(ears: THREE.Group, outer: string, inside: string): void {
  for (const x of [-0.17, 0.17]) {
    const ear = outlined(ball(0.085, fur(outer), 10), 1.1);
    ear.position.set(x, 0.17, -0.02);
    ears.add(ear);
    const inner = ball(0.05, mat(inside), 8);
    inner.castShadow = false;
    inner.scale.set(1, 1, 0.5);
    inner.position.set(x, 0.17, 0.045);
    ears.add(inner);
  }
}

/** A broad, soft muzzle with a nose on it. */
function muzzle(head: THREE.Group, color: string, reach: number): void {
  const m = ball(0.095, fur(color), 12);
  m.scale.set(1.1, 0.8, reach);
  m.position.set(0, -0.07, 0.17);
  head.add(m);
  snoutTip(head, SNOUT, 0.03, -0.035, 0.17 + 0.095 * reach - 0.005);
}

/** A tail that sticks out behind and a little up; the scene wags it at its root. */
function tailOf(length: number, width: number, color: string, tip: string | null): THREE.Group {
  const tail = new THREE.Group();
  const stem = outlined(solid(geo(`tail|${length}|${width}`, () => new THREE.CapsuleGeometry(width, length, 4, 10)), fur(color)), 1.1);
  stem.rotation.x = -1.05;
  stem.position.set(0, (length / 2 + width) * 0.5, -(length / 2 + width) * 0.87);
  tail.add(stem);

  if (tip !== null) {
    const end = ball(width * 1.05, fur(tip), 10);
    end.position.set(0, (length + width) * 0.5, -(length + width) * 0.87);
    tail.add(end);
  }

  return tail;
}

/** A round scut. */
function scut(r: number, color: string): THREE.Group {
  const tail = new THREE.Group();
  const puff = outlined(ball(r, fur(color), 10), 1.1);
  puff.position.z = -r * 0.6;
  tail.add(puff);

  return tail;
}

/** Every species' face. Faces differ by what they grow, so each is a small builder. */
const FACES: Record<Species, Face> = {
  human: {
    eyes: { x: 0.08, y: 0.03, z: 0.2 },
    mouth: { y: -0.1, z: 0.208 },
    build: (head, _, coat) => {
      cheeks(head, 0.13, -0.04, 0.19);
      const nose = ball(0.045, mat(shade(coat.fur, -0.06)), 8);
      nose.position.set(0, -0.02, 0.23);
      head.add(nose);
    },
    tail: null,
  },
  cat: {
    eyes: { x: 0.085, y: 0.03, z: 0.2 },
    mouth: { y: -0.105, z: 0.238 },
    build: (head, ears, coat) => {
      pointedEars(ears, { fur: coat.fur, trim: PINK }, 1.3);

      for (const x of [-0.042, 0.042]) {
        const pad = ball(0.055, fur(coat.trim), 10);
        pad.scale.set(1, 0.85, 0.7);
        pad.position.set(x, -0.075, 0.195);
        head.add(pad);
      }

      snoutTip(head, "#e8778a", 0.022, -0.04, 0.24);
      cheeks(head, 0.15, -0.05, 0.17);
    },
    tail: (coat) => tailOf(0.26, 0.04, coat.fur, coat.trim),
  },
  bear: {
    eyes: { x: 0.085, y: 0.04, z: 0.2 },
    mouth: { y: -0.11, z: 0.243 },
    build: (head, ears, coat) => {
      roundEars(ears, coat.fur, coat.trim);
      muzzle(head, coat.trim, 0.8);
    },
    tail: (coat) => scut(0.065, coat.fur),
  },
  bunny: {
    eyes: { x: 0.085, y: 0.03, z: 0.2 },
    mouth: { y: -0.105, z: 0.238 },
    build: (head, ears, coat) => {
      for (const x of [-0.08, 0.08]) {
        const ear = outlined(solid(geo("ear-long", () => new THREE.CapsuleGeometry(0.05, 0.24, 4, 10)), fur(coat.fur)), 1.1);
        ear.position.set(x, 0.36, -0.03);
        ear.rotation.z = x < 0 ? 0.16 : -0.16;
        ears.add(ear);
        const inner = solid(geo("ear-long", () => new THREE.CapsuleGeometry(0.05, 0.24, 4, 10)), mat(coat.trim));
        inner.castShadow = false;
        inner.scale.set(0.55, 0.8, 0.4);
        inner.position.set(x, 0.36, 0.005);
        inner.rotation.z = ear.rotation.z;
        ears.add(inner);
      }

      for (const x of [-0.04, 0.04]) {
        const pad = ball(0.052, fur("#ffffff"), 10);
        pad.scale.set(1, 0.85, 0.7);
        pad.position.set(x, -0.075, 0.195);
        head.add(pad);
      }

      snoutTip(head, "#e8778a", 0.02, -0.04, 0.238);
      cheeks(head, 0.15, -0.05, 0.17);
    },
    tail: () => scut(0.085, "#ffffff"),
  },
  fox: {
    eyes: { x: 0.09, y: 0.04, z: 0.2 },
    mouth: { y: -0.115, z: 0.25 },
    build: (head, ears, coat) => {
      pointedEars(ears, { fur: coat.fur, trim: SNOUT }, 1.4);
      const snout = ball(0.08, fur(coat.trim), 12);
      snout.scale.set(0.95, 0.7, 1.3);
      snout.position.set(0, -0.07, 0.185);
      head.add(snout);
      snoutTip(head, SNOUT, 0.027, -0.045, 0.285);

      for (const x of [-0.19, 0.19]) {
        const fluff = blob(0.075, fur(coat.trim));
        fluff.position.set(x, -0.08, 0.04);
        head.add(fluff);
      }
    },
    tail: (coat) => tailOf(0.22, 0.085, coat.fur, coat.trim),
  },
  frog: {
    eyes: { x: 0.115, y: 0.2, z: 0.135 },
    mouth: { y: -0.05, z: 0.222 },
    build: (head, _, coat) => {
      for (const x of [-0.115, 0.115]) {
        const bump = outlined(ball(0.088, fur(coat.fur), 12), 1.1);
        bump.position.set(x, 0.19, 0.06);
        head.add(bump);
      }

      for (const x of [-0.03, 0.03]) {
        const nostril = ball(0.011, mat(SNOUT), 6);
        nostril.position.set(x, 0.03, 0.227);
        head.add(nostril);
      }

      cheeks(head, 0.15, -0.03, 0.165);
    },
    tail: null,
  },
  panda: {
    eyes: { x: 0.085, y: 0.03, z: 0.205 },
    mouth: { y: -0.11, z: 0.243 },
    build: (head, ears, coat) => {
      roundEars(ears, coat.trim, coat.trim);

      for (const x of [-0.085, 0.085]) {
        const patch = ball(0.068, fur(coat.trim), 10);
        patch.scale.set(1, 1.25, 0.4);
        patch.position.set(x, 0.02, 0.172);
        patch.rotation.z = x < 0 ? -0.35 : 0.35;
        head.add(patch);
      }

      muzzle(head, coat.fur, 0.8);
    },
    tail: (coat) => scut(0.06, coat.fur),
  },
  penguin: {
    eyes: { x: 0.08, y: 0.04, z: 0.238 },
    mouth: null,
    build: (head, _, coat) => {
      const face = ball(0.2, fur(coat.trim), 14);
      face.scale.set(0.86, 0.95, 0.86);
      face.position.set(0, -0.02, 0.075);
      head.add(face);
      const beak = solid(geo("beak-cone", () => new THREE.ConeGeometry(0.05, 0.11, 8).rotateX(Math.PI / 2)), mat("#f59a23", "#000000", 0.5));
      beak.position.set(0, -0.05, 0.285);
      head.add(beak);
      cheeks(head, 0.13, -0.06, 0.215);
    },
    tail: (coat) => scut(0.05, coat.fur),
  },
  duck: {
    eyes: { x: 0.085, y: 0.05, z: 0.2 },
    mouth: null,
    build: (head, _, coat) => {
      const bill = rbox(0.17, 0.05, 0.14, 0.022, mat(coat.trim, "#000000", 0.5), 0);
      bill.position.set(0, -0.05, 0.255);
      head.add(bill);

      for (const [x, z, r] of [[0, 0, 0.06], [0.035, -0.05, 0.045]] as const) {
        const tuft = blob(r, fur(coat.fur));
        tuft.position.set(x, 0.24, z);
        head.add(tuft);
      }

      cheeks(head, 0.15, -0.04, 0.17);
    },
    tail: (coat) => tailOf(0.1, 0.055, coat.fur, null),
  },
};

/**
 * Builds a species' face onto a head of radius `r` centred `y` above `parent`: eyes (named
 * `eyes`), a mouth (named `mouth`, with a `smile` and a `gasp` the scene switches between)
 * and the species' own features, its ears in a group named `ears`.
 */
function faceOn(parent: THREE.Object3D, species: Species, coat: Coat, y: number, r: number): void {
  const spec = FACES[species];
  const head = new THREE.Group();
  head.position.y = y;
  head.scale.setScalar(r / HEAD);
  parent.add(head);
  const ears = new THREE.Group();
  ears.name = "ears";
  head.add(ears);
  spec.build(head, ears, coat);
  const eyes = new THREE.Group();
  eyes.name = "eyes";
  eyes.position.set(0, spec.eyes.y, spec.eyes.z);

  for (const x of [-spec.eyes.x, spec.eyes.x]) {
    const eye = ball(0.035, mat("#1d1d1d", "#000000", 0.3), 8);
    eye.scale.set(0.85, 1.15, 0.6);
    eye.position.x = x;
    eyes.add(eye);
    const glint = ball(0.011, mat("#ffffff", "#ffffff"), 5);
    glint.position.set(x + 0.012, 0.016, 0.022);
    eyes.add(glint);
  }

  head.add(eyes);

  if (spec.mouth === null) return;
  const mouth = new THREE.Group();
  mouth.name = "mouth";
  mouth.position.set(0, spec.mouth.y, spec.mouth.z);
  const dark = mat("#3a1c16", "#000000", 0.5);
  const smile = new THREE.Mesh(geo("smile", () => new THREE.TorusGeometry(0.04, 0.011, 5, 10, Math.PI).rotateZ(Math.PI)), dark);
  smile.name = "smile";
  smile.position.y = 0.02;
  const gasp = new THREE.Mesh(geo("gasp", () => new THREE.SphereGeometry(0.03, 10, 8)), dark);
  gasp.name = "gasp";
  gasp.scale.set(1, 1, 0.35);
  gasp.visible = false;
  mouth.add(smile, gasp);
  head.add(mouth);
}

/** A species' tail on a body, named `tail` so the scene can wag it; nothing for a species without. */
function tailOn(parent: THREE.Object3D, species: Species, coat: Coat, y: number, z: number, scale: number): void {
  const tail = FACES[species].tail?.(coat);

  if (tail === undefined) return;
  tail.name = "tail";
  tail.position.set(0, y, z);
  tail.scale.setScalar(scale);
  parent.add(tail);
}

/** How much bigger than life a cook's head is, and the height of the neck it grows from. */
const HEAD_SCALE = 1.28;

const NECK = 0.72;

/**
 * A round little cook in one chef look: a big head on a chunky body in the look's colour, apron, scarf, the
 * look's headwear and its species' face and tail, and a dark outline. Parts the scene animates
 * are named: `rig` (squash and stretch), `held`, `handL`/`handR`, `footL`/`footR`, `eyes`,
 * `mouth` (with `smile` and `gasp`), and an animal's `ears` and `tail`.
 */
export function cookModel(look: Look): THREE.Group {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = "rig";
  g.add(rig);
  const body = outlined(solid(geo("cook-body", () => new THREE.CapsuleGeometry(0.27, 0.2, 6, 16)), mat(look.body, "#000000", 0.6)), 1.07);
  body.position.y = 0.44;
  rig.add(body);
  const apron = solid(geo("apron", () => new THREE.CylinderGeometry(0.278, 0.285, 0.34, 16, 1, true, -0.95, 1.9)), mat("#fbf6ec"));
  apron.position.y = 0.36;
  rig.add(apron);
  const pocket = rbox(0.14, 0.08, 0.03, 0.01, mat("#e9e0cf"), 0.3);
  pocket.position.z = 0.27;
  rig.add(pocket);
  const scarf = solid(geo("scarf", () => new THREE.TorusGeometry(0.17, 0.05, 6, 16)), mat(shade(look.body, 0.12)));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.72;
  rig.add(scarf);
  // the head and all it wears, grown from the neck: a big head on a short body reads from far above
  const face = new THREE.Group();
  face.scale.setScalar(HEAD_SCALE);
  face.position.y = NECK * (1 - HEAD_SCALE);
  rig.add(face);
  const head = outlined(ball(HEAD, mat(look.skin, "#000000", 0.6), 18), 1.07);
  head.position.y = 0.92;
  face.add(head);
  const coat = { fur: look.skin, trim: look.hair };
  faceOn(face, look.species, coat, 0.92, HEAD);
  tailOn(rig, look.species, coat, 0.3, -0.25, 1);
  HEADWEAR[look.headwear](face, look);
  ACCESSORIES[look.accessory](face, look);

  for (const x of [-0.3, 0.3]) {
    const hand = outlined(ball(0.11, mat(look.skin), 10), 1.12);
    hand.position.set(x * 1.07, 0.5, 0.18);
    hand.name = x < 0 ? "handL" : "handR";
    rig.add(hand);
  }

  for (const x of [-0.12, 0.12]) {
    const foot = ball(0.105, mat("#3a2a22"), 10);
    foot.scale.set(1, 0.55, 1.35);
    foot.position.set(x, 0.05, 0.04);
    foot.name = x < 0 ? "footL" : "footR";
    g.add(foot);
  }

  const held = new THREE.Group();
  held.name = "held";
  held.position.set(0, 0.66, 0.4);
  held.scale.setScalar(1.35);
  rig.add(held);

  return g;
}

const SHIRTS = ["#3f88c5", "#f6ae2d", "#7b4ea3", "#2e9e44", "#e94f37", "#ef7fb0"];

const SKIN = ["#f3c79e", "#d9a57a", "#a8714c", "#f6d3b5"];

/** The animals that come to eat, and what each wears. */
const GUEST_COATS: Record<Animal, Coat> = {
  cat: { fur: "#8d8f98", trim: "#f1f1f1" },
  bear: { fur: "#6e4a2e", trim: "#d9b98e" },
  bunny: { fur: "#d9c3a5", trim: "#f6b0c0" },
  fox: { fur: "#e8762c", trim: "#fff4e6" },
  frog: { fur: "#6cc24a", trim: "#d8f0a0" },
  panda: { fur: "#f7f5f0", trim: "#22222a" },
  penguin: { fur: "#2d3348", trim: "#f7f5f0" },
  duck: { fur: "#fbfaf5", trim: "#f08a24" },
};

const GUEST_ANIMALS: readonly Animal[] = ["cat", "bear", "bunny", "fox", "frog", "panda", "penguin", "duck"];

const HAIR = ["#2b1a10", "#a0522d", "#e8c547", "#1d1d1d", "#c0c4c8"];

/** A customer waiting outside the pass: shirt, skin, hair and headgear vary with `index`. */
export function customerModel(index: number): THREE.Group {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = "rig";
  g.add(rig);
  const shirt = SHIRTS[index % SHIRTS.length] ?? "#3f88c5";
  const hair = HAIR[(index * 7) % HAIR.length] ?? "#2b1a10";
  // two guests in five are animals
  const animal = index % 5 < 2 ? GUEST_ANIMALS[(index * 3) % GUEST_ANIMALS.length] : undefined;
  const coat = animal === undefined ? { fur: SKIN[(index * 3) % SKIN.length] ?? "#f3c79e", trim: hair } : GUEST_COATS[animal];
  const skin = coat.fur;

  for (const x of [-0.1, 0.1]) {
    const leg = cyl(0.07, 0.065, 0.26, mat("#33415c"), 8);
    leg.position.set(x, 0.13, 0);
    rig.add(leg);
  }

  const body = outlined(solid(geo("guest-body", () => new THREE.CapsuleGeometry(0.21, 0.26, 6, 14)), mat(shirt, "#000000", 0.65)), 1.07);
  body.position.y = 0.55;
  rig.add(body);

  for (const x of [-0.25, 0.25]) {
    const arm = solid(geo("guest-arm", () => new THREE.CapsuleGeometry(0.055, 0.22, 4, 8)), mat(shirt));
    arm.position.set(x, 0.55, 0);
    arm.rotation.z = x < 0 ? -0.2 : 0.2;
    arm.name = x < 0 ? "armL" : "armR";
    rig.add(arm);
  }

  const head = outlined(ball(0.19, mat(skin, "#000000", 0.6), 16), 1.07);
  head.position.y = 0.98;
  rig.add(head);

  faceOn(rig, animal ?? "human", coat, 0.98, 0.19);

  if (animal !== undefined) {
    tailOn(rig, animal, coat, 0.42, -0.2, 0.85);

    return g;
  }

  const style = index % 3;

  if (style === 0) {
    const cap = ball(0.2, mat(SHIRTS[(index + 2) % SHIRTS.length] ?? "#e94f37"), 14);
    cap.scale.set(1, 0.55, 1);
    cap.position.y = 1.07;
    rig.add(cap);
    const peak = rbox(0.22, 0.03, 0.16, 0.012, mat(SHIRTS[(index + 2) % SHIRTS.length] ?? "#e94f37"), 1.07);
    peak.position.z = 0.17;
    rig.add(peak);
  } else {
    const top = ball(0.2, mat(hair), 14);
    top.scale.set(1.04, 0.62, 1.04);
    top.position.set(0, 1.06, -0.02);
    rig.add(top);

    if (style === 1) {
      const bun = ball(0.09, mat(hair), 10);
      bun.position.set(0, 1.2, -0.1);
      rig.add(bun);
    }
  }

  return g;
}
