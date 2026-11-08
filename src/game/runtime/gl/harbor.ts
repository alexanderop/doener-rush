/**
 * The harbour backdrop: the shop stands on a wooden pier over open water. Waves roll under
 * it, boats and buoys bob, two jetties lead to a quay stacked with containers, gulls circle.
 */
import * as THREE from "three";
import type { World } from "../world.ts";
import { flock } from "./flock.ts";
import { box, canvasTexture, cyl, geo, hash, mapped, mat, rbox, ring, solid, steel } from "./parts.ts";
import type { Backdrop } from "./scenery.ts";
import { lamp, plant } from "./street.ts";

/** The water surface at rest, below the deck. */
const SEA = -0.7;

const DECK_T = 0.3;

/** How far the pier reaches past the kitchen: left and right, in front (street side), behind. */
const PIER = { side: 2.8, front: 3.2, back: 1.3 } as const;

/** The quay across the water, where the jetties land. */
const QUAY_Z = -8.6;

const BOX_COLORS = ["#d64933", "#2f6fae", "#f2a541", "#3c9d7a", "#8a5ab0", "#e7dcc8"];

/** Planks running along x with dark gaps; tinted by the material colour. */
function plankMap(): THREE.Texture {
  const t = canvasTexture("planks", 128, 128, (g) => {
    g.fillStyle = "#3a2416";
    g.fillRect(0, 0, 128, 128);

    for (let row = 0; row < 4; row++) {
      for (let seg = -1; seg < 2; seg++) {
        const x = seg * 96 + (row % 2) * 48;
        const v = Math.round(hash(row, seg + 3) * 26);
        g.fillStyle = `rgb(${226 + v / 2},${214 + v / 3},${200 + v / 4})`;
        g.fillRect(x + 1, row * 32 + 2, 94, 28);
        g.fillStyle = "rgba(90,50,20,0.25)";
        g.fillRect(x + 6, row * 32 + 10, 1.5, 1.5);
        g.fillRect(x + 88, row * 32 + 20, 1.5, 1.5);
      }
    }
  });

  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;

  return t;
}

/** Corrugated container sides: light ribs on white, tinted by the material colour. */
function ribMap(): THREE.Texture {
  return canvasTexture("ribs", 64, 32, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 64, 32);
    g.fillStyle = "rgba(0,0,0,0.16)";

    for (let x = 0; x < 64; x += 6) g.fillRect(x, 0, 2, 32);
  });
}

/**
 * The sea: a wide plane whose vertices roll in a few crossing sine waves on the GPU. Flat
 * shading takes the facet normals from the displaced surface, so the light catches each wave.
 */
function sea(time: { value: number }): THREE.Mesh {
  const m = new THREE.MeshStandardMaterial({ color: "#2f97b8", roughness: 0.28, metalness: 0.05, flatShading: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\nvarying float vWave;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vWave = sin(position.x * 0.5 + uTime * 1.1) * 0.11
        + sin(position.y * 0.66 + position.x * 0.2 + uTime * 0.8) * 0.09
        + sin((position.x + position.y) * 1.3 - uTime * 1.7) * 0.035
        + sin(position.x * 1.7 - position.y * 1.1 + uTime * 2.1) * 0.03;
      transformed.z += vWave;`,
    );
    // crests go pale and troughs deepen, so the swell reads from straight above
    shader.fragmentShader = `varying float vWave;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      diffuseColor.rgb *= 0.72 + 0.34 * smoothstep(-0.22, 0.22, vWave);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.95, 1.0), smoothstep(0.12, 0.22, vWave) * 0.7);`,
    );
  };

  m.customProgramCacheKey = () => "sea";
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 110, 110), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA;
  mesh.receiveShadow = true;

  return mesh;
}

/** A white frame of foam where the water laps at a rectangle of piles. */
function foam(x0: number, z0: number, x1: number, z1: number): THREE.Mesh {
  const outline = new THREE.Shape();
  const pad = 0.55;
  outline.moveTo(x0 - pad, -(z0 - pad));
  outline.lineTo(x1 + pad, -(z0 - pad));
  outline.lineTo(x1 + pad, -(z1 + pad));
  outline.lineTo(x0 - pad, -(z1 + pad));
  const hole = new THREE.Path();
  hole.moveTo(x0, -z0);
  hole.lineTo(x0, -z1);
  hole.lineTo(x1, -z1);
  hole.lineTo(x1, -z0);
  outline.holes.push(hole);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshBasicMaterial({ color: "#e8f7fb", transparent: true, opacity: 0.55, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA + 0.12;

  return mesh;
}

/** A deck of planks on piles: the top at y 0, piles down into the water at every `step`. */
function deck(x0: number, z0: number, x1: number, z1: number, step: number): THREE.Group {
  const g = new THREE.Group();
  const w = x1 - x0;
  const d = z1 - z0;
  const planks = plankMap().clone();
  planks.needsUpdate = true;
  planks.repeat.set(w / 3, d / 1.2);
  const top = solid(new THREE.BoxGeometry(w, DECK_T, d), mapped("#c08a5a", planks, 0.85));
  top.position.set(x0 + w / 2, -DECK_T / 2, z0 + d / 2);
  g.add(top);
  const beam = mat("#6e4a30");

  for (const [bx, bz, bw, bd] of [[x0 + w / 2, z0, w + 0.1, 0.14], [x0 + w / 2, z1, w + 0.1, 0.14], [x0, z0 + d / 2, 0.14, d + 0.1], [x1, z0 + d / 2, 0.14, d + 0.1]] as const) {
    const edge = box(bw, 0.22, bd, beam, -0.2);
    edge.position.set(bx, -0.2, bz);
    g.add(edge);
  }

  const pile = mat("#5a3a26");

  const along = (a: number, b: number): number[] => {
    const gaps = Math.max(1, Math.round((b - a) / step));

    return Array.from({ length: gaps + 1 }, (_, i) => a + ((b - a) * i) / gaps);
  };

  for (const x of along(x0, x1)) {
    for (const z of [z0, z1]) g.add(post(x, z, pile));
  }

  for (const z of along(z0, z1).slice(1, -1)) {
    for (const x of [x0, x1]) g.add(post(x, z, pile));
  }

  return g;
}

/** A pile from below the water to just above the deck, with a rope collar. */
function post(x: number, z: number, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const p = cyl(0.13, 0.15, 1.65, material, 8);
  p.position.y = SEA - 0.4 + 1.65 / 2;
  g.add(p);
  const cap = cyl(0.14, 0.14, 0.04, mat("#7a5238"), 8);
  cap.position.y = SEA + 1.27;
  g.add(cap);
  const collar = ring(0.15, 0.03, mat("#d9c08a"));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = SEA + 0.95;
  g.add(collar);

  return g;
}

/** A rope slung between two post tops. */
function rope(x0: number, z0: number, x1: number, z1: number): THREE.Mesh {
  const y = SEA + 1.15;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, y, z0), new THREE.Vector3((x0 + x1) / 2, y - 0.22, (z0 + z1) / 2), new THREE.Vector3(x1, y, z1));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.025, 5, false), mat("#d9c08a"));
  m.castShadow = true;

  return m;
}

function barrel(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = solid(geo("barrel", () => new THREE.CylinderGeometry(0.26, 0.26, 0.62, 12)), mat("#9a6038"));
  body.position.y = 0.31;
  g.add(body);

  for (const y of [0.1, 0.52]) {
    const band = cyl(0.27, 0.27, 0.04, steel("#4a4d52"), 12);
    band.position.y = y;
    g.add(band);
  }

  return g;
}

function crate(x: number, z: number, size: number, turn: number): THREE.Mesh {
  const c = rbox(size, size, size, 0.03, mat("#c8995c"), size / 2);
  c.position.set(x, size / 2, z);
  c.rotation.y = turn;

  return c;
}

/** A red and white ring buoy on a short post. */
function lifebuoy(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const stand = box(0.08, 0.9, 0.08, mat("#6e4a30"), 0.45);
  g.add(stand);

  for (let i = 0; i < 4; i++) {
    const quarter = solid(new THREE.TorusGeometry(0.22, 0.07, 6, 6, Math.PI / 2), mat(i % 2 === 0 ? "#e94f37" : "#f7f1e6"));
    quarter.rotation.z = (i * Math.PI) / 2;
    quarter.position.set(0, 0.72, 0.07);
    g.add(quarter);
  }

  return g;
}

/** A shipping container, ribbed sides in one colour. */
function container(x: number, y: number, z: number, color: string, turn: number): THREE.Mesh {
  const ribs = ribMap();
  ribs.wrapS = THREE.RepeatWrapping;
  const c = solid(geo("container", () => new THREE.BoxGeometry(2.6, 1.1, 1.05)), mapped(color, ribs, 0.6));
  c.position.set(x, y + 0.55, z);
  c.rotation.y = turn;

  return c;
}

/** A gantry crane on the quay: two legs, a boom reaching out over the water, a hook. */
function crane(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const paint = mat("#e0a32a");

  for (const lx of [-1, 1]) {
    for (const lz of [-0.8, 0.8]) {
      const leg = box(0.18, 4.4, 0.18, paint, 2.2);
      leg.position.set(lx, 2.2, lz);
      g.add(leg);
    }
  }

  const beam = box(2.4, 0.3, 1.9, paint, 4.5);
  g.add(beam);
  const boom = box(0.35, 0.28, 7, paint, 4.8);
  boom.position.z = 2.2;
  g.add(boom);
  const cab = rbox(0.9, 0.7, 0.9, 0.06, mat("#d64933"), 4.1);
  cab.position.set(0.9, 4.05, 1);
  g.add(cab);
  const weight = box(1.1, 0.7, 1.1, mat("#4a4d52"), 4.9);
  weight.position.z = -1.4;
  g.add(weight);
  const line = cyl(0.015, 0.015, 2.2, steel("#2c2e33"), 4);
  line.position.set(0, 3.6, 4.8);
  g.add(line);
  const hook = box(0.25, 0.2, 0.25, mat("#d64933"), 2.4);
  hook.position.z = 4.8;
  g.add(hook);

  return g;
}

/** A small fishing cutter: hull, a white wheelhouse, a mast. Faces +x. */
function boat(hull: string): THREE.Group {
  const g = new THREE.Group();
  const paint = mat(hull, "#000000", 0.5);
  const body = rbox(2.2, 0.6, 1.1, 0.18, paint, 0.1);
  g.add(body);
  const bow = solid(geo("bow", () => new THREE.CylinderGeometry(0.55, 0.55, 0.6, 3)), paint);
  bow.scale.set(1.4, 1, 1);
  bow.position.set(1.05, 0.1, 0);
  g.add(bow);
  const rim = box(2.3, 0.07, 1.16, mat("#f7f1e6"), 0.42);
  g.add(rim);
  const floor = box(2, 0.04, 0.95, mat("#c08a5a"), 0.38);
  g.add(floor);
  const house = rbox(0.75, 0.6, 0.8, 0.06, mat("#f7f1e6"), 0.7);
  house.position.x = -0.45;
  g.add(house);
  const glass = box(0.06, 0.2, 0.6, mat("#7fb8cf", "#20384a", 0.2), 0.85);
  glass.position.x = -0.06;
  g.add(glass);
  const roof = box(0.85, 0.06, 0.9, mat(hull), 1.03);
  roof.position.x = -0.45;
  g.add(roof);
  const mast = cyl(0.03, 0.03, 1.3, mat("#6e4a30"), 6);
  mast.position.set(0.4, 1.05, 0);
  g.add(mast);
  const flag = box(0.02, 0.18, 0.3, mat("#f2a541"), 1.6);
  flag.position.set(0.4, 1.6, 0.16);
  g.add(flag);

  return g;
}

function buoy(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = cyl(0.22, 0.28, 0.5, mat(color), 10);
  body.position.y = 0.15;
  g.add(body);
  const band = cyl(0.23, 0.23, 0.1, mat("#f7f1e6"), 10);
  band.position.y = 0.2;
  g.add(band);
  const top = cyl(0.03, 0.03, 0.5, steel("#3a3d42"), 5);
  top.position.y = 0.6;
  g.add(top);
  const light = box(0.1, 0.1, 0.1, mat("#ffe08a", "#c08a30"), 0.88);
  g.add(light);

  return g;
}

/** A floating thing that rides the waves at its spot. */
interface Floater {
  readonly group: THREE.Group;
  readonly x: number;
  readonly z: number;
  readonly phase: number;
}

/** Builds the pier, the sea, the quay and everything on and around them. */
export function harbor(world: World): Backdrop {
  const g = new THREE.Group();
  const live = new THREE.Group();
  const w = world.width;
  const h = world.height;
  const x0 = -PIER.side;
  const x1 = w + PIER.side;
  const z0 = -PIER.front;
  const z1 = h + PIER.back;
  g.add(deck(x0, z0, x1, z1, 2.2));
  g.add(foam(x0, z0, x1, z1));

  // ropes along the sides and the back; the front stays open towards the jetties
  for (const [ax, az, bx, bz] of [[x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z1, x1, z1]] as const) {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2.2));

    for (let i = 0; i < n; i++) g.add(rope(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, ax + ((bx - ax) * (i + 1)) / n, az + ((bz - az) * (i + 1)) / n));
  }

  // two jetties from the front of the pier across to the quay
  for (const jx of [-2.2, w + 1.4]) {
    g.add(deck(jx, QUAY_Z + 0.5, jx + 1.3, z0, 2.6));
    g.add(foam(jx, QUAY_Z + 0.5, jx + 1.3, z0));
  }

  const quay = box(w + 90, 1.2, 30, mat("#a39c90"), 0.35 - 0.6);
  quay.position.set(w / 2, -0.25, QUAY_Z - 15);
  g.add(quay);
  const kerb = box(w + 90, 0.12, 0.5, mat("#cfc8ba"), 0.41);
  kerb.position.set(w / 2, 0.41, QUAY_Z - 0.25);
  g.add(kerb);

  for (let x = -40; x < w + 40; x += 3.5) {
    const fender = solid(geo("fender", () => new THREE.TorusGeometry(0.28, 0.1, 6, 10)), mat("#1d1d1d"));
    fender.position.set(x, -0.2, QUAY_Z + 0.05);
    g.add(fender);
  }

  for (let i = 0, x = -22; x < w + 22; i++) {
    const gap = hash(i, 3) > 0.7 ? 2.2 : 0.15;
    const z = QUAY_Z - 2.6 - hash(i, 4) * 1.2;
    const stack = 1 + Math.floor(hash(i, 5) * 3);

    if (x > -4 && x < w + 4 && hash(i, 6) > 0.5) {
      x += 2.8;
      continue;
    }

    for (let s = 0; s < stack; s++) g.add(container(x, 0.35 + s * 1.1, z - s * 0.02, BOX_COLORS[(i * 3 + s) % BOX_COLORS.length] ?? "#d64933", Math.PI / 2 + (hash(i, s) - 0.5) * 0.06));
    x += 1.2 + gap;
  }

  g.add(crane(w + 9, QUAY_Z - 1.8));
  g.add(crane(-9, QUAY_Z - 1.8));

  for (const x of [-2.4, w + 2.4]) {
    const l = lamp(x, z0 + 0.3);
    l.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(l);
  }

  // things on the pier, kept out of the strip in front of the pass where customers walk
  for (const [bx, bz] of [[-2.1, 1.2], [-2.2, 1.85], [w + 2.1, 2.4], [-2.1, h - 0.6], [w + 2.2, h + 0.7]] as const) g.add(barrel(bx, bz));
  g.add(crate(w + 2, h - 1.6, 0.6, 0.3));
  g.add(crate(w + 2.1, h - 0.9, 0.5, -0.2));
  g.add(crate(-1.9, h + 0.85, 0.55, 0.5));
  g.add(lifebuoy(-PIER.side + 0.4, h / 2));
  g.add(lifebuoy(w + PIER.side - 0.4, h / 2 + 2));
  g.add(plant(-2.2, -2.8, true));
  g.add(plant(w + 2.2, -2.8, true));
  const coil = ring(0.22, 0.06, mat("#d9c08a"));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(w / 2 + 2.5, 0.06, h + 0.9);
  g.add(coil);

  const floaters: Floater[] = [];

  const float = (group: THREE.Group, x: number, z: number, turn: number) => {
    group.rotation.y = turn;
    live.add(group);
    floaters.push({ group, x, z, phase: hash(x, z) * 6 });
  };

  float(boat("#d64933"), x0 - 2.2, h * 0.3, Math.PI / 2 + 0.1);
  float(boat("#2f6fae"), x1 + 2.3, h * 0.65, -Math.PI / 2 - 0.15);
  float(boat("#3c9d7a"), w + 3.6, QUAY_Z + 2.2, Math.PI);
  float(buoy("#e94f37"), -6.5, z1 + 2.5, 0);
  float(buoy("#f2a541"), w / 2, z1 + 4, 0);
  float(buoy("#e94f37"), w + 6.5, z1 + 2, 0);
  float(buoy("#3c9d7a"), -7, -6, 0);
  const time = { value: 0 };
  live.add(sea(time));
  const birdsAbove = flock(w, h, "#f7f7f2", "#c9ccd2");
  live.add(birdsAbove.group);

  const animate = (t: number) => {
    time.value = t;

    for (const f of floaters) {
      const s = t * 1.1 + f.phase;
      f.group.position.set(f.x, SEA + 0.08 + Math.sin(s) * 0.08, f.z);
      f.group.rotation.x = Math.sin(s * 0.8) * 0.06;
      f.group.rotation.z = Math.cos(s * 0.9) * 0.08;
    }

    birdsAbove.animate(t);
  };

  return { still: g, live, sky: "#a6d6e4", animate };
}
