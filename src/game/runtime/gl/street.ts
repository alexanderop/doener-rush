/**
 * Everything around the cooking: the checkered kitchen floor with grout and soft corners,
 * the thick brick rim that turns the kitchen into a diorama, the striped awning and neon
 * sign over the pass (`shopShell`, shared by every backdrop), and the default backdrop: the
 * town street with lamps, plants, café tables, houses across the road, traffic and pigeons.
 */
import * as THREE from "three";
import type { World } from "../world.ts";
import { flock } from "./flock.ts";
import { customerModel } from "./models.ts";
import { ball, box, canvasTexture, cyl, geo, hash, mapped, mat, rbox, solid, steel } from "./parts.ts";
import type { Backdrop } from "./scenery.ts";
import { drinksFridge, ledgeClutter, menuBoards } from "./shopfront.ts";

const WALL_H = 1.05;

const WALL_T = 0.55;

/** How many tiles around a table the dining room's wooden floor reaches. */
const DINING_REACH = 2;

/** Stations a cook stands at for long stretches: they get a rubber mat on the floor in front. */
const MAT_STATIONS: ReadonlySet<string> = new Set(["board", "toaster", "spit", "sink"]);

/**
 * The kitchen floor: a cool slate checkerboard, one tile per world tile, dark and blue so the
 * warm counters, cooks and food stand out against it. Worn spots, rubber mats in front of the work stations,
 * a drain, and darker floor where it meets a counter.
 */
function floorTexture(world: World): THREE.Texture {
  const px = 128;

  return canvasTexture(`floor|${world.width}x${world.height}`, world.width * px, world.height * px, (g) => {
    g.fillStyle = "#2c3546";
    g.fillRect(0, 0, world.width * px, world.height * px);

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const n = hash(x, y) * 14 - 7;
        const light = (x + y) % 2 === 0;
        g.fillStyle = light ? `rgb(${126 + n},${144 + n},${170 + n})` : `rgb(${74 + n},${90 + n},${118 + n})`;
        g.beginPath();
        g.roundRect(x * px + 3, y * px + 3, px - 6, px - 6, 10);
        g.fill();
        // glaze: a soft highlight on the upper-left of each tile
        const glaze = g.createLinearGradient(x * px, y * px, x * px + px, y * px + px);
        glaze.addColorStop(0, "rgba(230,240,255,0.18)");
        glaze.addColorStop(0.5, "rgba(230,240,255,0)");
        g.fillStyle = glaze;
        g.fillRect(x * px + 3, y * px + 3, px - 6, px - 6);
      }
    }

    // the dining room: wooden boards instead of tiles on the floor around the tables
    const tables = [...world.stations.values()].filter((s) => s.type === "table");

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const under = world.stations.get(y * world.width + x);

        if ((under !== undefined && under.type !== "table") || !tables.some((s) => Math.abs(s.x - x) <= DINING_REACH && Math.abs(s.y - y) <= DINING_REACH)) continue;

        for (let board = 0; board < 4; board++) {
          const n = hash(x * 4 + board, y) * 18 - 9;
          g.fillStyle = `rgb(${168 + n},${112 + n},${70 + n * 0.6})`;
          g.fillRect(x * px, y * px + board * 32, px, 31);
          g.fillStyle = "rgba(60,30,15,0.45)";
          g.fillRect(x * px + ((board * 53 + x * 29) % px), y * px + board * 32, 2, 31);
        }
      }
    }

    // worn, slightly darker patches where the cooks walk most
    for (let i = 0; i < world.width * world.height * 0.18; i++) {
      const cx = hash(i, 7) * world.width * px;
      const cy = hash(i, 13) * world.height * px;
      const r = 40 + hash(i, 21) * 90;
      const spot = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      spot.addColorStop(0, "rgba(20,26,40,0.12)");
      spot.addColorStop(1, "rgba(20,26,40,0)");
      g.fillStyle = spot;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // rubber mats in front of the stations a cook works at
    for (const s of world.stations.values()) {
      if (!MAT_STATIONS.has(s.type)) continue;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const fx = s.x + dx;
        const fy = s.y + dy;

        if (fx < 0 || fy < 0 || fx >= world.width || fy >= world.height || world.stations.has(fy * world.width + fx)) continue;
        const x0 = fx * px + 10;
        const y0 = fy * px + 10;
        g.fillStyle = "#22272e";
        g.beginPath();
        g.roundRect(x0, y0, px - 20, px - 20, 14);
        g.fill();
        g.fillStyle = "#39414b";

        for (let my = 0; my < 6; my++) {
          for (let mx = 0; mx < 6; mx++) {
            g.beginPath();
            g.arc(x0 + 13 + mx * 17.5, y0 + 13 + my * 17.5, 4.5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }

    // a drain in the middle of the floor
    const dx = (world.width / 2) * px;
    const dy = (world.height / 2 + 1.5) * px;
    g.fillStyle = "#5a524c";
    g.beginPath();
    g.arc(dx, dy, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#2e2824";
    g.lineWidth = 3;

    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(dx - 16, dy + i * 7);
      g.lineTo(dx + 16, dy + i * 7);
      g.stroke();
    }

    // fake ambient occlusion: shade the floor along every edge that touches a station; a table stands free on its leg
    const blocky = (x: number, y: number) => {
      const station = world.stations.get(y * world.width + x);

      return station !== undefined && station.type !== "table";
    };

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.stations.has(y * world.width + x)) continue;

        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (!blocky(x + ox, y + oy)) continue;
          const x0 = x * px + (ox === 1 ? px : 0);
          const y0 = y * px + (oy === 1 ? px : 0);

          const grad = ox === 0
            ? g.createLinearGradient(0, y0, 0, y0 - oy * 48)
            : g.createLinearGradient(x0, 0, x0 - ox * 48, 0);

          grad.addColorStop(0, "rgba(12,16,28,0.6)");
          grad.addColorStop(1, "rgba(12,16,28,0)");
          g.fillStyle = grad;
          g.fillRect(x * px, y * px, px, px);
        }
      }
    }
  });
}

function brickMap(): THREE.Texture {
  const t = canvasTexture("bricks", 128, 128, (g) => {
    g.fillStyle = "#8c6a5c";
    g.fillRect(0, 0, 128, 128);

    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 4; col++) {
        const x = col * 32 + (row % 2) * 16;
        const v = 225 + Math.round(hash(row, col) * 30);
        g.fillStyle = `rgb(${v},${v - 6},${v - 10})`;
        g.fillRect(x + 1.5, row * 16 + 1.5, 29, 13);
      }
    }
  });

  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;

  return t;
}

function paverMap(): THREE.Texture {
  const t = canvasTexture("pavers", 128, 128, (g) => {
    g.fillStyle = "#b9ab95";
    g.fillRect(0, 0, 128, 128);

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 205 + Math.round(hash(x + 40, y) * 30);
        g.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
        g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
      }
    }
  });

  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;

  return t;
}

/** One straight stretch of the brick rim, with a dark rounded capstone. */
function wallRun(x0: number, z0: number, x1: number, z1: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const w = Math.abs(x1 - x0);
  const d = Math.abs(z1 - z0);
  const bricks = brickMap().clone();
  bricks.needsUpdate = true;
  bricks.repeat.set(Math.max(w, d) / 1.2, height / 0.6);
  const body = solid(new THREE.BoxGeometry(w, height, d), new THREE.MeshStandardMaterial({ color: "#a8644e", map: bricks, roughness: 0.85 }));
  body.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
  g.add(body);
  const cap = rbox(w + 0.12, 0.16, d + 0.12, 0.06, mat("#6f3526", "#000000", 0.7));
  cap.position.set((x0 + x1) / 2, height + 0.06, (z0 + z1) / 2);
  g.add(cap);

  return g;
}

/** The thick brick wall around the kitchen; the street side opens at the pass for the customers. */
function rimWall(world: World): THREE.Group {
  const g = new THREE.Group();
  const w = world.width;
  const h = world.height;
  g.add(wallRun(-WALL_T, -WALL_T, 0, h + WALL_T, WALL_H));
  g.add(wallRun(w, -WALL_T, w + WALL_T, h + WALL_T, WALL_H));
  g.add(wallRun(0, h, w, h + WALL_T, WALL_H * 0.8));
  const passes = [...world.stations.values()].flatMap((s) => (s.type === "pass" ? [s.x] : []));
  let start = 0;

  for (let x = 0; x <= w; x++) {
    const open = passes.includes(x);

    if ((open || x === w) && x > start) g.add(wallRun(start, -WALL_T, x, 0, WALL_H));

    if (open) {
      // a low sill under the serving window
      g.add(wallRun(x, -WALL_T, x + 1, 0, 0.55));
      start = x + 1;
    }
  }

  // two windows in the street wall
  for (const x of [w * 0.28, w * 0.52]) {
    const frame = rbox(1.1, 0.5, 0.08, 0.03, mat("#5a3a2a"), 0.55);
    frame.position.set(x, 0.55, -WALL_T - 0.02);
    g.add(frame);
    const glass = box(0.94, 0.36, 0.02, mat("#9fd3e6", "#24485a", 0.15), 0.55);
    glass.position.set(x, 0.55, -WALL_T - 0.06);
    g.add(glass);
  }

  return g;
}

/** White subway tiles with a red band: the kitchen side of the street wall. */
function splashMap(): THREE.Texture {
  const t = canvasTexture("splash", 128, 128, (g) => {
    g.fillStyle = "#b9b2a6";
    g.fillRect(0, 0, 128, 128);

    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 3; col++) {
        const x = col * 64 + (row % 2) * 32;
        const band = row === 5;
        const v = Math.round(hash(row, col + 9) * 10);
        g.fillStyle = band ? `rgb(${204 + v},${46 + v},${38 + v})` : `rgb(${240 - v},${236 - v},${226 - v})`;
        g.beginPath();
        g.roundRect(x + 1.5, row * 16 + 1.5, 61, 13, 3);
        g.fill();
      }
    }
  });

  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;

  return t;
}

const SPLASH_H = 1.55;

const JARS = ["#e94f37", "#f6ae2d", "#6fc23f", "#c886b5", "#f7f1e6"];

/**
 * The back of the kitchen: a tiled splashback on the inside of the street wall and a wooden
 * shelf with spice jars. It stops at the pass so the queue stays in view.
 */
function backWall(world: World): THREE.Group {
  const g = new THREE.Group();
  const passes = new Set([...world.stations.values()].flatMap((s) => (s.type === "pass" ? [s.x] : [])));
  const tiles = splashMap();
  const runs: (readonly [number, number])[] = [];
  let start = 0;

  for (let x = 0; x <= world.width; x++) {
    if (x === world.width || passes.has(x)) {
      if (x > start) runs.push([start, x]);
      start = x + 1;
    }
  }

  for (const [x0, x1] of runs) {
    const w = x1 - x0;
    const map = tiles.clone();
    map.needsUpdate = true;
    map.repeat.set(w / 1, SPLASH_H / 1);
    const panel = solid(new THREE.BoxGeometry(w, SPLASH_H, 0.08), mapped("#ffffff", map, 0.35));
    panel.position.set(x0 + w / 2, SPLASH_H / 2, -0.04);
    g.add(panel);
    const cap = box(w, 0.06, 0.14, mat("#c9342b"), SPLASH_H + 0.03);
    cap.position.set(x0 + w / 2, SPLASH_H + 0.03, -0.04);
    g.add(cap);
    // a shelf with jars, and a rail with ladles, on alternate stretches
    const shelf = box(w - 0.3, 0.05, 0.2, mat("#8a5a3a"), 1.32);
    shelf.position.set(x0 + w / 2, 1.32, 0.09);
    g.add(shelf);

    // jars stand in small groups of two or three, with gaps between them
    for (let cx = x0 + 0.6; cx < x1 - 0.4; cx += 1.6 + hash(cx, 3) * 0.8) {
      const count = 2 + Math.floor(hash(cx, 17) * 2);

      for (let j = 0; j < count; j++) {
        const x = cx + j * 0.15;
        const i = Math.floor(hash(x * 3, 5) * JARS.length);
        const tall = 0.12 + hash(x, 11) * 0.1;
        const jar = cyl(0.065, 0.065, tall, mat("#e8f2f2", "#000000", 0.2), 10);
        jar.position.set(x, 1.345 + tall / 2, 0.09);
        g.add(jar);
        const fill = cyl(0.055, 0.055, tall * 0.7, mat(JARS[i] ?? "#f6ae2d"), 10);
        fill.position.set(x, 1.345 + tall * 0.35, 0.09);
        g.add(fill);
        const lid = cyl(0.07, 0.07, 0.03, mat("#3a2a22"), 10);
        lid.position.set(x, 1.36 + tall, 0.09);
        g.add(lid);
      }
    }
  }

  return g;
}

function neonSign(text: string): THREE.Mesh {
  const texture = canvasTexture(`neon|${text}`, 1024, 256, (g) => {
    g.fillStyle = "#24140f";
    g.beginPath();
    g.roundRect(8, 8, 1008, 240, 60);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "#f6ae2d";
    g.stroke();
    g.font = "900 128px Rubik, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "#ff3b3b";
    g.shadowBlur = 36;
    g.fillStyle = "#fff0dc";

    for (let i = 0; i < 3; i++) g.fillText(text, 512, 136);
  });

  return new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true }));
}

/** A potted spiky plant. */
export function plant(x: number, z: number, big: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pot = solid(geo("pot", () => new THREE.CylinderGeometry(0.34, 0.26, 0.5, 10)), mat("#c46a3c"));
  pot.position.y = 0.25;
  g.add(pot);
  const soil = cyl(0.3, 0.3, 0.02, mat("#4a3022"), 10);
  soil.position.y = 0.5;
  g.add(soil);
  const leaves = big ? 9 : 6;

  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2;
    const leaf = solid(geo("leaf", () => new THREE.ConeGeometry(0.11, 0.9, 4)), mat(i % 2 === 0 ? "#3f9a3a" : "#5bb44a"));
    leaf.position.set(Math.cos(a) * 0.14, 0.88, Math.sin(a) * 0.14);
    leaf.rotation.set(Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65);
    g.add(leaf);
  }

  return g;
}

/** A street lamp, its head reaching towards +z. */
export function lamp(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const post = cyl(0.06, 0.08, 3, steel("#3a3d42"), 8);
  post.position.y = 1.5;
  g.add(post);
  const arm = box(0.06, 0.06, 0.6, steel("#3a3d42"), 2.95);
  arm.position.z = 0.27;
  g.add(arm);
  const head = cyl(0.12, 0.2, 0.16, mat("#2c2e33"), 10);
  head.position.set(0, 2.9, 0.55);
  g.add(head);
  const bulb = ball(0.11, mat("#fff1c4", "#ffcf70"), 8);
  bulb.scale.y = 0.5;
  bulb.position.set(0, 2.82, 0.55);
  bulb.castShadow = false;
  g.add(bulb);

  return g;
}

function cafeTable(x: number, z: number, cloth: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const leg = cyl(0.04, 0.06, 0.7, steel("#3a3d42"), 8);
  leg.position.y = 0.35;
  g.add(leg);
  const top = cyl(0.4, 0.4, 0.05, mat("#f7f1e6"), 16);
  top.position.y = 0.72;
  g.add(top);
  const runner = cyl(0.41, 0.41, 0.02, mat(cloth), 16);
  runner.scale.set(1, 1, 0.35);
  runner.position.y = 0.75;
  g.add(runner);

  for (const a of [0.4, Math.PI + 0.4]) {
    const chair = new THREE.Group();
    chair.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
    chair.rotation.y = -a + Math.PI / 2;
    chair.add(rbox(0.36, 0.06, 0.36, 0.02, mat("#c0392b"), 0.45));
    const back = rbox(0.36, 0.4, 0.06, 0.02, mat("#c0392b"), 0.68);
    back.position.z = -0.17;
    chair.add(back);

    for (const [lx, lz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]] as const) {
      const l = cyl(0.02, 0.02, 0.45, steel("#3a3d42"), 6);
      l.position.set(lx, 0.22, lz);
      chair.add(l);
    }

    g.add(chair);
  }

  const glass = cyl(0.05, 0.04, 0.12, mat("#f6ae2d", "#000000", 0.2), 8);
  glass.position.set(0.12, 0.81, 0.05);
  g.add(glass);

  return g;
}

function scooter(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;

  for (const wz of [-0.45, 0.45]) {
    const wheel = solid(geo("wheel", () => new THREE.TorusGeometry(0.16, 0.07, 6, 14)), mat("#1d1d1d"));
    wheel.position.set(0, 0.2, wz);
    wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
  }

  const body = rbox(0.4, 0.3, 0.9, 0.12, mat("#44bba4", "#000000", 0.4), 0.42);
  body.position.z = -0.08;
  g.add(body);
  const seat = rbox(0.3, 0.1, 0.42, 0.05, mat("#3a2a22"), 0.62);
  seat.position.z = -0.18;
  g.add(seat);
  const shield = rbox(0.38, 0.55, 0.12, 0.05, mat("#44bba4", "#000000", 0.4), 0.62);
  shield.position.z = 0.36;
  g.add(shield);
  const bars = box(0.55, 0.05, 0.05, steel(), 0.95);
  bars.position.z = 0.38;
  g.add(bars);
  const carrier = rbox(0.36, 0.3, 0.32, 0.05, mat("#e94f37"), 0.78);
  carrier.position.z = -0.5;
  g.add(carrier);

  return g;
}

/** Hopping pigeons on the sidewalk; returned so the scene can animate them. */
function pigeons(spots: readonly (readonly [number, number])[]): THREE.Group[] {
  return spots.map(([x, z], i) => {
    const g = new THREE.Group();
    g.name = "bird";
    g.position.set(x, 0, z);
    g.rotation.y = i * 2.1;
    const body = ball(0.11, mat("#8a8f99"), 8);
    body.scale.set(0.8, 0.75, 1.3);
    body.position.y = 0.12;
    g.add(body);
    const head = ball(0.065, mat("#6a7080"), 8);
    head.position.set(0, 0.23, 0.11);
    g.add(head);
    const beak = cyl(0.001, 0.02, 0.05, mat("#e8c547"), 5);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.22, 0.18);
    g.add(beak);
    const tail = box(0.1, 0.02, 0.12, mat("#5a5f6a"), 0.12);
    tail.position.z = -0.16;
    g.add(tail);

    return g;
  });
}

const FACADES = ["#e8c9a0", "#d98b6a", "#9cc5c0", "#e7dcc8", "#c7a4c4", "#f0b85a", "#b8c98e"];

const ROOFS = ["#7a4a3a", "#5a5f6a", "#8a3a30", "#4a5560"];

const CARS = ["#e94f37", "#3f88c5", "#f6ae2d", "#44bba4", "#f7f1e6"];

/** A narrow town house, its front facing +z before `facing` turns it: windows, a shop awning or a door, a pitched roof. */
function house(x: number, z: number, width: number, floors: number, seed: number, facing: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  const tall = floors * 1.15 + 0.3;
  g.add(box(width, tall, 3, mat(FACADES[Math.floor(hash(seed, 1) * FACADES.length)] ?? "#e8c9a0"), tall / 2));
  const roof = solid(geo("roof", () => new THREE.CylinderGeometry(1, 1, 1, 3)), mat(ROOFS[Math.floor(hash(seed, 2) * ROOFS.length)] ?? "#7a4a3a"));
  roof.scale.set(1.75, width + 0.1, 0.9);
  roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  roof.position.y = tall + 0.45;
  g.add(roof);
  const glass = mat("#7fb8cf", "#20384a", 0.2);
  const frame = mat("#f7f1e6");
  const cols = Math.max(1, Math.floor(width / 1.1));

  for (let f = 1; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = -width / 2 + (c + 0.5) * (width / cols);
      const y = f * 1.15 + 0.55;
      const pane = box(0.5, 0.6, 0.06, frame, y);
      pane.position.set(wx, y, 1.5);
      g.add(pane);
      const inner = box(0.38, 0.48, 0.06, hash(seed + f, c) > 0.75 ? mat("#ffe2a0", "#c08a30") : glass, y);
      inner.position.set(wx, y, 1.53);
      g.add(inner);
    }
  }

  if (hash(seed, 5) > 0.4) {
    const shop = box(width - 0.6, 0.8, 0.06, glass, 0.6);
    shop.position.z = 1.52;
    g.add(shop);
    const awning = mat(CARS[Math.floor(hash(seed, 6) * CARS.length)] ?? "#e94f37");
    const stripe = (width - 0.4) / 5;

    for (let i = 0; i < 5; i++) {
      const s = box(stripe, 0.04, 0.6, i % 2 === 0 ? awning : mat("#f7f1e6"), 1.15);
      s.position.set(-width / 2 + 0.2 + (i + 0.5) * stripe, 1.15, 1.75);
      s.rotation.x = 0.4;
      g.add(s);
    }
  } else {
    const door = box(0.6, 0.95, 0.06, mat("#5a3a2a"), 0.48);
    door.position.z = 1.52;
    g.add(door);
  }

  return g;
}

/** A round low-poly tree about 2.2 tall at `scale` 1. */
function tree(x: number, z: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  const trunk = cyl(0.1, 0.14, 1, mat("#7a5236"), 6);
  trunk.position.y = 0.5;
  g.add(trunk);
  const crown = solid(geo("crown", () => new THREE.IcosahedronGeometry(0.75, 0)), mat(hash(x, z) > 0.5 ? "#4f9a3c" : "#5fae46"));
  crown.position.y = 1.5;
  g.add(crown);
  const top = solid(geo("crown-top", () => new THREE.IcosahedronGeometry(0.45, 0)), mat("#6cbd50"));
  top.position.set(0.2, 2, 0.1);
  g.add(top);

  return g;
}

function lawn(x0: number, z0: number, x1: number, z1: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat("#7fae54", "#000000", 1));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.003, (z0 + z1) / 2);
  m.receiveShadow = true;

  return m;
}

function car(color: string): THREE.Group {
  const g = new THREE.Group();
  const paint = mat(color, "#000000", 0.4);
  g.add(rbox(1.7, 0.45, 0.85, 0.12, paint, 0.38));
  const cabin = rbox(0.95, 0.38, 0.78, 0.1, mat("#cfe6ef", "#1d3340", 0.2), 0.78);
  cabin.position.x = -0.1;
  g.add(cabin);
  const roof = rbox(0.8, 0.06, 0.74, 0.03, paint, 0.99);
  roof.position.x = -0.12;
  g.add(roof);

  for (const [wx, wz] of [[-0.55, 0.42], [0.55, 0.42], [-0.55, -0.42], [0.55, -0.42]] as const) {
    const wheel = cyl(0.17, 0.17, 0.12, mat("#1d1d1d"), 10);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.17, wz);
    g.add(wheel);
  }

  return g;
}

/** Something that loops along x: a car on its lane or a passer-by on the far pavement. */
interface Mover {
  readonly group: THREE.Group;
  readonly rig: THREE.Object3D;
  readonly z: number;
  /** +1 drives left to right. */
  readonly dir: number;
  readonly speed: number;
  readonly offset: number;
}

const LOOP = 64;

/** Where a mover is at `t` on a loop `LOOP` long, centred on `centre`. */
function along(centre: number, t: number, m: Mover): number {
  const x = (((m.offset + t * m.speed) % LOOP) + LOOP) % LOOP;

  return centre + m.dir * (x - LOOP / 2);
}

/**
 * The kitchen every backdrop shares: the tiled floor, the brick rim and splashback, and the
 * storefront over the pass (canopies, neon sign).
 */
export function shopShell(world: World): THREE.Group {
  const g = new THREE.Group();
  const w = world.width;
  const h = world.height;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: floorTexture(world), roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(w / 2, 0.005, h / 2);
  floor.receiveShadow = true;
  g.add(floor);
  g.add(rimWall(world));
  g.add(backWall(world));
  g.add(menuBoards(world, SPLASH_H));
  g.add(ledgeClutter(world, WALL_H, -WALL_T / 2));
  g.add(drinksFridge(w + WALL_T + 0.6, 1.4));

  // small striped canopies over the two windows; the pass stays open so the queue is in view
  for (const x of [w * 0.28, w * 0.52]) {
    for (let i = 0; i < 6; i++) {
      const stripe = solid(geo("canopy", () => new THREE.BoxGeometry(0.25, 0.04, 0.6)), mat(i % 2 === 0 ? "#d63a2f" : "#f7f1e6"));
      stripe.position.set(x - 0.625 + (i + 0.5) * 0.25, 1.32, -WALL_T - 0.22);
      stripe.rotation.x = 0.45;
      g.add(stripe);
    }
  }

  const sign = neonSign("DÖNER RUSH");
  sign.position.set(w / 2, 1.2, -2.2);
  sign.rotation.x = -1;
  g.add(sign);

  for (const x of [w / 2 - 1.3, w / 2 + 1.3]) {
    const post = cyl(0.05, 0.05, 1.1, steel("#3a3d42"), 8);
    post.position.set(x, 0.55, -2.25);
    g.add(post);
  }

  return g;
}

/**
 * The town street: pavement round the shop, the road with traffic in front, a row of houses
 * across it, gardens with trees on the other three sides, pigeons and passers-by.
 */
export function street(world: World): Backdrop {
  const g = new THREE.Group();
  const live = new THREE.Group();
  const w = world.width;
  const h = world.height;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat("#4b4a52", "#000000", 0.95));
  road.rotation.x = -Math.PI / 2;
  road.position.set(w / 2, -0.02, h / 2);
  road.receiveShadow = true;
  g.add(road);
  const pavers = paverMap();
  pavers.repeat.set((w + 8) / 1.5, (h + 6) / 1.5);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, h + 6), mapped("#ffffff", pavers, 0.9));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(w / 2, 0, h / 2 - 0.5);
  walk.receiveShadow = true;
  g.add(walk);
  const curb = box(w + 8, 0.08, 0.2, mat("#d9d2c4"), 0.04);
  curb.position.set(w / 2, 0.04, -3.6);
  g.add(curb);

  for (let x = -40; x < w + 40; x += 2) {
    const dash = new THREE.Mesh(geo("dash", () => new THREE.PlaneGeometry(1.1, 0.14)), mat("#f2efe6"));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.006, -5.8);
    g.add(dash);
  }

  for (const z of [-4.2, -7.4]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w + 80, 0.1), mat("#e6b93a"));
    line.rotation.x = -Math.PI / 2;
    line.position.set(w / 2, 0.006, z);
    g.add(line);
  }

  // the far pavement and the houses across the road
  const far = paverMap().clone();
  far.needsUpdate = true;
  far.repeat.set((w + 80) / 1.5, 3 / 1.5);
  const farWalk = new THREE.Mesh(new THREE.PlaneGeometry(w + 80, 3), mapped("#ffffff", far, 0.9));
  farWalk.rotation.x = -Math.PI / 2;
  farWalk.position.set(w / 2, 0.004, -9.3);
  farWalk.receiveShadow = true;
  g.add(farWalk);
  const farCurb = box(w + 80, 0.08, 0.2, mat("#d9d2c4"), 0.04);
  farCurb.position.set(w / 2, 0.04, -7.9);
  g.add(farCurb);

  for (let x = -26, seed = 0; x < w + 26; seed++) {
    const width = 2.6 + Math.floor(hash(seed, 9) * 3) * 0.8;
    g.add(house(x + width / 2, -12.3, width, 2 + Math.floor(hash(seed, 4) * 3), seed, 0));
    x += width + 0.1;
  }

  // gardens on the other three sides, with trees, hedges and a house further out
  g.add(lawn(-40, -3.5, -4, h + 40));
  g.add(lawn(w + 4, -3.5, w + 40, h + 40));
  g.add(lawn(-4, h + 2.5, w + 4, h + 40));

  for (let i = 0; i < 16; i++) {
    const x = i % 2 === 0 ? -5.5 - hash(i, 1) * 7 : w + 5.5 + hash(i, 1) * 7;
    g.add(tree(x, -1.5 + hash(i, 2) * (h + 6), 0.9 + hash(i, 3) * 0.4));
  }

  for (let i = 0; i < 6; i++) g.add(tree((w * (i + 0.5)) / 6 + hash(i, 8) - 0.5, h + 3.3 + hash(i, 6) * 1.2, 0.8 + hash(i, 7) * 0.3));

  for (const x of [-4.4, w + 4.4]) {
    const hedge = rbox(0.6, 0.7, h + 5.5, 0.2, mat("#4a8a3a"), 0.35);
    hedge.position.set(x, 0.35, h / 2 - 0.4);
    g.add(hedge);
  }

  g.add(house(-16, h / 2, 5, 3, 41, Math.PI / 2));
  g.add(house(w + 16, h / 2 - 1, 5, 2, 42, -Math.PI / 2));

  for (const [x, z, big] of [[-1.4, 1.2, true], [w + 1.4, 1.4, false], [-1.4, h - 1.2, false], [w + 1.4, h - 1], [-2.2, -2.4, true], [w + 2.4, -2.2, true]] as const) {
    g.add(plant(x, z, big === true));
  }

  for (const x of [-3.5, w / 2 - 3.6, w / 2 + 4, w + 3.5]) g.add(lamp(x, -4));
  g.add(cafeTable(-1.8, -1.6, "#3f88c5"));
  g.add(cafeTable(w + 1.9, -1.4, "#44bba4"));
  g.add(scooter(w - 1.5, -3.1));

  for (let i = 0; i < 5; i++) {
    const bollard = cyl(0.08, 0.09, 0.6, mat("#2c2e33"), 8);
    bollard.position.set(1.2 + i * 2.6, 0.3, -3.35);
    g.add(bollard);
  }

  const birds = pigeons([[3.2, -2.6], [3.6, -2.9], [w - 3.5, -2.4]]);

  for (const b of birds) live.add(b);

  const cars: Mover[] = [0, 1, 2, 3].map((i) => {
    const group = car(CARS[i % CARS.length] ?? "#e94f37");
    const dir = i % 2 === 0 ? 1 : -1;
    group.rotation.y = dir > 0 ? 0 : Math.PI;
    live.add(group);

    return { group, rig: group, z: dir > 0 ? -5 : -6.6, dir, speed: 3.2 + hash(i, 4) * 1.5, offset: i * 17 };
  });

  const walkers: Mover[] = [0, 1, 2].map((i) => {
    const group = customerModel(101 + i * 2);
    const dir = i === 1 ? -1 : 1;
    group.rotation.y = (dir * Math.PI) / 2;
    live.add(group);

    return { group, rig: group.getObjectByName("rig") ?? group, z: -8.9 - i * 0.35, dir, speed: 0.9 + hash(i, 6) * 0.3, offset: i * 21 };
  });

  const birdsAbove = flock(w, h, "#8a8f99", "#6a7080");
  live.add(birdsAbove.group);

  const animate = (t: number) => {
    animatePigeons(birds, t);

    for (const c of cars) c.group.position.set(along(w / 2, t, c), 0, c.z);

    for (const p of walkers) {
      p.group.position.set(along(w / 2, t, p), 0, p.z);
      p.rig.position.y = Math.abs(Math.sin(t * 7 + p.offset)) * 0.05;
    }

    birdsAbove.animate(t);
  };

  return { still: g, live, sky: "#a9c7d6", animate };
}

/** Pigeons peck and hop now and then. */
function animatePigeons(birds: readonly THREE.Group[], t: number): void {
  birds.forEach((b, i) => {
    const phase = t * 1.3 + i * 2.7;
    const hop = Math.max(0, Math.sin(phase * 3)) * (Math.sin(phase * 0.5) > 0.6 ? 0.08 : 0);
    b.position.y = hop;
    const head = b.children[1];

    if (head !== undefined) head.position.y = 0.23 - Math.max(0, Math.sin(phase * 5)) * 0.08;
  });
}

