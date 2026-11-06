/**
 * Everything around the cooking: the checkered kitchen floor with grout and soft corners,
 * the thick brick rim that turns the kitchen into a diorama, the striped awning and neon
 * sign over the pass, and the street outside with lamps, plants, café tables and pigeons.
 * Static except for the pigeons, which `animateStreet` hops around.
 */
import * as THREE from "three";
import type { World } from "../world.ts";
import { ball, box, canvasTexture, cyl, geo, hash, mapped, mat, rbox, solid, steel } from "./parts.ts";

const WALL_H = 1.05;

const WALL_T = 0.55;

/** The kitchen floor: 2×2 small checks per tile with grout, darker where the floor meets a counter. */
function floorTexture(world: World): THREE.Texture {
  const px = 128;

  return canvasTexture(`floor|${world.width}x${world.height}`, world.width * px, world.height * px, (g) => {
    const half = px / 2;

    for (let y = 0; y < world.height * 2; y++) {
      for (let x = 0; x < world.width * 2; x++) {
        const light = (x + y) % 2 === 0;
        const n = hash(x, y) * 10 - 5;
        const r = (light ? 232 : 118) + n;
        const gr = (light ? 222 : 112) + n;
        const b = (light ? 200 : 106) + n;
        g.fillStyle = `rgb(${r},${gr},${b})`;
        g.fillRect(x * half, y * half, half, half);
        // a soft highlight on the upper edge of each check
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(x * half, y * half, half, 4);
      }
    }

    g.strokeStyle = "rgba(60,45,35,0.45)";
    g.lineWidth = 2;

    for (let x = 0; x <= world.width * 2; x++) {
      g.beginPath();
      g.moveTo(x * half, 0);
      g.lineTo(x * half, world.height * px);
      g.stroke();
    }

    for (let y = 0; y <= world.height * 2; y++) {
      g.beginPath();
      g.moveTo(0, y * half);
      g.lineTo(world.width * px, y * half);
      g.stroke();
    }

    // fake ambient occlusion: shade the floor along every edge that touches a station
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.stations.has(y * world.width + x)) continue;

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (!world.stations.has((y + dy) * world.width + (x + dx))) continue;
          const x0 = x * px + (dx === 1 ? px : 0);
          const y0 = y * px + (dy === 1 ? px : 0);

          const grad = dx === 0
            ? g.createLinearGradient(0, y0, 0, y0 - dy * 40)
            : g.createLinearGradient(x0, 0, x0 - dx * 40, 0);

          grad.addColorStop(0, "rgba(40,25,15,0.42)");
          grad.addColorStop(1, "rgba(40,25,15,0)");
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

/** One straight stretch of the brick rim, with a lighter rounded cap. */
function wallRun(x0: number, z0: number, x1: number, z1: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const w = Math.abs(x1 - x0);
  const d = Math.abs(z1 - z0);
  const bricks = brickMap().clone();
  bricks.needsUpdate = true;
  bricks.repeat.set(Math.max(w, d) / 1.2, height / 0.6);
  const body = solid(new THREE.BoxGeometry(w, height, d), new THREE.MeshStandardMaterial({ color: "#b0432f", map: bricks, roughness: 0.85 }));
  body.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
  g.add(body);
  const cap = solid(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08), mat("#a9452f", "#000000", 0.7));
  cap.position.set((x0 + x1) / 2, height + 0.05, (z0 + z1) / 2);
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

function plant(x: number, z: number, big: boolean): THREE.Group {
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

function lamp(x: number, z: number): THREE.Group {
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

/** The scenery around the kitchen and the pigeons in it. */
export interface Street {
  readonly group: THREE.Group;
  readonly birds: readonly THREE.Group[];
}

/** Builds the floor, rim, street, storefront and props for a world. */
export function street(world: World): Street {
  const g = new THREE.Group();
  const w = world.width;
  const h = world.height;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#4b4a52", "#000000", 0.95));
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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: floorTexture(world), roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(w / 2, 0.005, h / 2);
  floor.receiveShadow = true;
  g.add(floor);
  g.add(rimWall(world));

  for (let x = -12; x < w + 12; x += 2) {
    const dash = new THREE.Mesh(geo("dash", () => new THREE.PlaneGeometry(1.1, 0.14)), mat("#f2efe6"));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.006, -6.4);
    g.add(dash);
  }

  for (const z of [-4.2, -8.6]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, 0.1), mat("#e6b93a"));
    line.rotation.x = -Math.PI / 2;
    line.position.set(w / 2, 0.006, z);
    g.add(line);
  }

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

  for (const b of birds) g.add(b);

  return { group: g, birds };
}

/** Pigeons peck and hop now and then. */
export function animateStreet(birds: readonly THREE.Group[], t: number): void {
  birds.forEach((b, i) => {
    const phase = t * 1.3 + i * 2.7;
    const hop = Math.max(0, Math.sin(phase * 3)) * (Math.sin(phase * 0.5) > 0.6 ? 0.08 : 0);
    b.position.y = hop;
    const head = b.children[1];

    if (head !== undefined) head.position.y = 0.23 - Math.max(0, Math.sin(phase * 5)) * 0.08;
  });
}
