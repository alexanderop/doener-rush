/**
 * Low-poly models built from three.js primitives: no asset files. Every model sits on the
 * origin with y up; one world tile is one unit. Geometries and materials come from the
 * caches in `parts.ts`, so building a model again is cheap.
 */
import * as THREE from "three";
import type { Base, CrateGoods, Filling, Item, Sauce, Station } from "../../../features/kitchen/public.ts";
import { BURNT, COOKED, ICONS, TOAST_BURNT, TOAST_DONE, isChopped } from "../../../features/kitchen/public.ts";
import {
  ball, blob, box, cyl, emojiBadge, geo, hash, label, mapped, mat, meatMap, rbox, ring, solid, steel, woodMap,
} from "./parts.ts";

/** Height of a counter top. */
export const TOP = 0.9;

type Veg = "lettuce" | "tomato" | "onion";

const CABINET = "#b4602c";

const WORKTOP = "#f5bd4f";

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
 * The cabinet every station stands on: teal tiled doors, a brass trim and a chunky wooden
 * worktop with rounded edges. Each tile gets a slightly different tone so a row of counters
 * reads as separate blocks.
 */
function counter(x: number, y: number, metalTop = false): THREE.Group {
  const g = new THREE.Group();
  const tone = (Math.floor(hash(x, y) * 4) / 4 - 0.375) * 2;
  const wood = woodMap();
  g.add(box(0.84, 0.08, 0.82, mat("#4a2414"), 0.04));
  const body = box(0.92, TOP - 0.2, 0.9, mat(shade(CABINET, tone * 0.05)), 0.08 + (TOP - 0.2) / 2);
  g.add(body);
  const door = rbox(0.74, 0.44, 0.05, 0.02, mat(shade(CABINET, 0.06 + tone * 0.04)), 0.44);
  door.position.z = 0.44;
  g.add(door);
  const knob = ball(0.03, mat(BRASS, "#000000", 0.35), 8);
  knob.position.set(0.27, 0.56, 0.48);
  g.add(knob);
  g.add(box(0.97, 0.04, 0.97, mat(BRASS, "#000000", 0.4), TOP - 0.13));

  const top = metalTop
    ? rbox(1, 0.12, 1, 0.035, steel("#c9ced4"), TOP - 0.06)
    : rbox(1, 0.12, 1, 0.035, mapped(shade(WORKTOP, tone * 0.06), wood), TOP - 0.06);

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

function breadColor(toast: number): string {
  if (toast >= TOAST_BURNT) return "#3b2a1d";
  const share = Math.min(1, toast / TOAST_DONE);

  if (toast <= TOAST_DONE) return `#${new THREE.Color("#e3a456").lerp(new THREE.Color("#c27028"), share).getHexString()}`;
  const over = (toast - TOAST_DONE) / (TOAST_BURNT - TOAST_DONE);

  return `#${new THREE.Color("#c27028").lerp(new THREE.Color("#6e4320"), over).getHexString()}`;
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

/** The piece that stands for one filling inside a döner. */
function fillingPiece(f: Filling): THREE.Group {
  if (f === "meat") return meatStrips(false, 6, 0.07);

  if (f === "garlic" || f === "herb" || f === "spicy") return drizzle(f);

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

/** A döner under construction: a split pide or a wrap with what is in it so far. */
function doener(base: Base, toast: number, fillings: readonly Filling[]): THREE.Group {
  const g = new THREE.Group();
  const toasted = toast >= TOAST_DONE * 0.7;

  if (base === "wrap") {
    const color = breadColor(Math.min(toast, TOAST_DONE));
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
    g.add(pide(breadColor(toast), toasted));
  } else {
    // cut open: the bottom half, the fillings, the top half tipped back like a lid
    g.add(pide(breadColor(toast), false, 0.6));
    const lid = pide(breadColor(toast), toasted, 0.7);
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

/** A model for any item a cook can carry or a station can hold. */
export function itemModel(item: Item): THREE.Group {
  switch (item.kind) {
    case "veg":
      return isChopped(item) ? choppedPieces(item.veg, 9, 0.12) : wholeVeg(item.veg);
    case "meat":
      return meatPortion(item.burnt);
    case "base":
      return doener(item.base, item.toast, item.fillings);
    case "plate":
      return platedModel(item.dirty, item.food);
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
    case "base": return `base:${item.base}:${Math.min(item.toast, TOAST_BURNT) >> 4}:${item.fillings.join(",")}`;
    case "plate": return `plate:${item.dirty}:${itemKey(item.food)}`;
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

  if (goods === "bread") {
    for (const [x, y, z, ry] of [[-0.12, 0.03, -0.06, 0.2], [0.13, 0.03, 0.04, -0.3], [0, 0.13, 0, 0.1]] as const) {
      const loaf = pide(breadColor(0), false);
      loaf.position.set(x, y, z);
      loaf.rotation.set(0.12, ry, 0.08);
      loaf.scale.setScalar(0.85);
      g.add(loaf);
    }

    return g;
  }

  if (goods === "wrap") {
    for (let i = 0; i < 6; i++) {
      const sheet = lavash(breadColor(0), 0);
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
  const g = counter(s.x, s.y);
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
  const g = counter(s.x, s.y);
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

/** A contact grill: ridged plates, a hinged lid with a handle and a status lamp. */
function grillModel(s: Station): THREE.Group {
  const g = counter(s.x, s.y, true);
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

  return g;
}

function sauceModel(s: Station, sauce: Sauce): THREE.Group {
  const g = counter(s.x, s.y);
  g.add(rbox(0.5, 0.05, 0.4, 0.02, mapped("#b77a3f", woodMap()), TOP + 0.025));
  const bottleGroup = new THREE.Group();
  bottleGroup.scale.setScalar(1.3);
  bottleGroup.position.y = -TOP * 0.3;
  g.add(bottleGroup);
  const color = SAUCE_COLOR[sauce];
  const bottle = cyl(0.12, 0.13, 0.4, mat(color, "#000000", 0.3), 16);
  bottle.position.y = TOP + 0.25;
  bottleGroup.add(bottle);
  const shoulder = ball(0.12, mat(color, "#000000", 0.3), 16);
  shoulder.scale.set(1, 0.5, 1);
  shoulder.position.y = TOP + 0.45;
  bottleGroup.add(shoulder);
  const cap = cyl(0.07, 0.08, 0.07, mat(sauce === "garlic" ? "#3f88c5" : "#fbf5e6"), 12);
  cap.position.y = TOP + 0.52;
  bottleGroup.add(cap);
  const nozzle = cyl(0.012, 0.045, 0.14, mat(sauce === "garlic" ? "#3f88c5" : "#fbf5e6"), 10);
  nozzle.position.y = TOP + 0.62;
  bottleGroup.add(nozzle);
  const band = cyl(0.122, 0.132, 0.16, mat("#fff7e8"), 16);
  band.position.y = TOP + 0.24;
  bottleGroup.add(band);
  bottleGroup.add(frontBadge(ICONS[sauce], TOP + 0.24, 0.135, 0.17));
  const puddle = cyl(0.07, 0.07, 0.012, mat(color, "#000000", 0.2), 12);
  puddle.scale.set(1.4, 1, 1);
  puddle.position.set(0.24, TOP + 0.056, 0.12);
  g.add(puddle);

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

/** The spit: a tall heater with glowing burners, a drip tray and a bumpy layered cone of four sides. */
function spitModel(s: Station): THREE.Group {
  const g = counter(s.x, s.y, true);
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
      new THREE.MeshStandardMaterial({ color: meatColor(0.9), map: meat, roughness: 0.75, flatShading: true }),
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
  g.add(cone);
  const heat = new THREE.PointLight("#ff8a3c", 2.2, 2.6, 1.6);
  heat.name = "heat";
  heat.position.set(0, TOP + 0.7, -0.05);
  g.add(heat);

  return g;
}

/** The pass: a steel shelf under two warm heat lamps, with a service bell. */
function passModel(s: Station): THREE.Group {
  const g = counter(s.x, s.y, true);
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

/** A steel prep tray (bain-marie) set into the counter; the scene fills its `stock`. */
function trayModel(s: Station): THREE.Group {
  const g = counter(s.x, s.y, true);
  const pan = rbox(0.78, 0.1, 0.62, 0.03, steel("#aeb5bd"), TOP + 0.02);
  g.add(pan);
  const well = rbox(0.7, 0.02, 0.54, 0.02, steel("#6f767e"), TOP + 0.075);
  g.add(well);

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
  const g = counter(s.x, s.y);
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
  const g = counter(s.x, s.y, true);
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
  const g = counter(s.x, s.y, true);
  const basin = rbox(0.56, 0.04, 0.5, 0.03, mat("#5e7f99", "#000000", 0.2), TOP - 0.02);
  basin.position.x = -0.1;
  g.add(basin);
  const water = rbox(0.5, 0.01, 0.44, 0.02, mat("#9fd3f0", "#0a2030", 0.1), TOP + 0.005);
  water.position.x = -0.1;
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

/** How far above the counter top an item sits, for stations with something under it. */
const SLOT_LIFT = new Map<Station["type"], number>([["toaster", 0.15], ["board", 0.065], ["pass", 0.04]]);

/** The model of a station. Its `slot` child is where a held item sits. */
export function stationModel(s: Station): THREE.Group {
  let g: THREE.Group;

  switch (s.type) {
    case "counter": g = counter(s.x, s.y); break;
    case "crate": g = crateModel(s, s.goods); break;
    case "board": g = boardModel(s); break;
    case "toaster": g = grillModel(s); break;
    case "sauce": g = sauceModel(s, s.sauce); break;
    case "spit": g = spitModel(s); break;
    case "pass": g = passModel(s); break;
    case "bin": g = binModel(); break;
    case "tray": g = trayModel(s); break;
    case "rack": g = rackModel(s); break;
    case "return": g = returnModel(s); break;
    case "sink": g = sinkModel(s); break;
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

/**
 * A round little cook: chunky body in the player colour, apron, scarf, tall hat and a
 * dark outline. Parts the scene animates are named: `rig` (squash and stretch), `held`,
 * `handL`/`handR`, `footL`/`footR`, `eyes`.
 */
export function cookModel(color: string): THREE.Group {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = "rig";
  g.add(rig);
  const body = outlined(solid(geo("cook-body", () => new THREE.CapsuleGeometry(0.27, 0.2, 6, 16)), mat(color, "#000000", 0.6)), 1.07);
  body.position.y = 0.44;
  rig.add(body);
  const apron = solid(geo("apron", () => new THREE.CylinderGeometry(0.278, 0.285, 0.34, 16, 1, true, -0.95, 1.9)), mat("#fbf6ec"));
  apron.position.y = 0.36;
  rig.add(apron);
  const pocket = rbox(0.14, 0.08, 0.03, 0.01, mat("#e9e0cf"), 0.3);
  pocket.position.z = 0.27;
  rig.add(pocket);
  const scarf = solid(geo("scarf", () => new THREE.TorusGeometry(0.17, 0.05, 6, 16)), mat(shade(color, 0.12)));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.72;
  rig.add(scarf);
  const head = outlined(ball(0.23, mat("#f3c79e", "#000000", 0.6), 18), 1.07);
  head.position.y = 0.92;
  rig.add(head);
  const eyes = new THREE.Group();
  eyes.name = "eyes";
  eyes.position.set(0, 0.95, 0.2);

  for (const x of [-0.08, 0.08]) {
    const eye = ball(0.035, mat("#1d1d1d", "#000000", 0.3), 8);
    eye.scale.set(0.85, 1.15, 0.6);
    eye.position.x = x;
    eyes.add(eye);
    const glint = ball(0.011, mat("#ffffff", "#ffffff"), 5);
    glint.position.set(x + 0.012, 0.016, 0.022);
    eyes.add(glint);
  }

  rig.add(eyes);

  for (const x of [-0.13, 0.13]) {
    const cheek = ball(0.04, mat("#f29b8a"), 8);
    cheek.scale.set(1, 0.6, 0.4);
    cheek.position.set(x, 0.88, 0.19);
    rig.add(cheek);
  }

  const nose = ball(0.045, mat("#e9ad86"), 8);
  nose.position.set(0, 0.9, 0.23);
  rig.add(nose);
  const brim = outlined(cyl(0.2, 0.21, 0.1, mat("#ffffff", "#000000", 0.8), 18), 1.06);
  brim.position.y = 1.11;
  rig.add(brim);
  const puff = outlined(ball(0.25, mat("#ffffff", "#000000", 0.8), 12), 1.06);
  puff.scale.set(1, 0.78, 1);
  puff.position.y = 1.28;
  rig.add(puff);
  const band = cyl(0.205, 0.215, 0.035, mat(color), 18);
  band.position.y = 1.08;
  rig.add(band);

  for (const x of [-0.3, 0.3]) {
    const hand = outlined(ball(0.085, mat("#f3c79e"), 10), 1.12);
    hand.position.set(x, 0.5, 0.18);
    hand.name = x < 0 ? "handL" : "handR";
    rig.add(hand);
  }

  for (const x of [-0.12, 0.12]) {
    const foot = ball(0.09, mat("#3a2a22"), 10);
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

const HAIR = ["#2b1a10", "#a0522d", "#e8c547", "#1d1d1d", "#c0c4c8"];

/** A customer waiting outside the pass: shirt, skin, hair and headgear vary with `index`. */
export function customerModel(index: number): THREE.Group {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = "rig";
  g.add(rig);
  const shirt = SHIRTS[index % SHIRTS.length] ?? "#3f88c5";
  const skin = SKIN[(index * 3) % SKIN.length] ?? "#f3c79e";
  const hair = HAIR[(index * 7) % HAIR.length] ?? "#2b1a10";

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

  for (const x of [-0.065, 0.065]) {
    const eye = ball(0.026, mat("#1d1d1d"), 6);
    eye.scale.set(0.85, 1.2, 0.6);
    eye.position.set(x, 1, 0.17);
    rig.add(eye);
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
