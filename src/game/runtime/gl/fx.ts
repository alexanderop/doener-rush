/**
 * Juice: pooled particles drawn as three instanced meshes (soft puffs, solid bits, glowing
 * sparks), so a kitchen full of steam and veg crumbs is three draw calls. Effects are
 * cosmetic and render-only; they use their own small random generator, never the world's.
 */
import * as THREE from "three";

// the kinds of burst the scene can ask for
type Burst = "steam" | "smoke" | "dust" | "bits" | "sparks" | "confetti" | "pop" | "flame" | "foam";

type Pool = "puff" | "bit" | "spark";

interface Spec {
  readonly pool: Pool;
  readonly colors: readonly string[];
  readonly life: number;
  readonly size: number;
  /** Size multiplier at the end of life (puffs grow, bits shrink). */
  readonly grow: number;
  readonly spread: number;
  readonly up: number;
  readonly gravity: number;
  readonly drag: number;
}

const SPECS = new Map<Burst, Spec>([
  ["steam", { pool: "puff", colors: ["#ffffff", "#f4efe8"], life: 1.3, size: 0.07, grow: 3.2, spread: 0.18, up: 0.75, gravity: 0.15, drag: 1.4 }],
  ["smoke", { pool: "puff", colors: ["#4a4440", "#5e5650", "#3a3532"], life: 1.8, size: 0.09, grow: 3.6, spread: 0.2, up: 0.65, gravity: 0.1, drag: 1.2 }],
  ["dust", { pool: "puff", colors: ["#fffaf0", "#efe6d6"], life: 0.5, size: 0.06, grow: 2.2, spread: 0.9, up: 0.35, gravity: -0.4, drag: 4 }],
  ["flame", { pool: "spark", colors: ["#ff5a1a", "#ff9a1a", "#ffd23a", "#ff3b1a"], life: 0.7, size: 0.09, grow: 0.3, spread: 0.35, up: 2.2, gravity: 1.5, drag: 1.2 }],
  ["foam", { pool: "puff", colors: ["#ffffff", "#e8f4fb", "#d4ecf7"], life: 0.8, size: 0.06, grow: 2.8, spread: 0.5, up: 0.3, gravity: -1.5, drag: 2.5 }],
  ["pop", { pool: "puff", colors: ["#ffffff"], life: 0.35, size: 0.06, grow: 2.6, spread: 1.6, up: 0.4, gravity: 0, drag: 6 }],
  ["bits", { pool: "bit", colors: ["#6fc23f"], life: 0.7, size: 0.045, grow: 0.3, spread: 1.4, up: 2.2, gravity: -7, drag: 0.6 }],
  ["sparks", { pool: "spark", colors: ["#ffd166", "#ff9a3c", "#fff1c1"], life: 0.45, size: 0.03, grow: 0.2, spread: 2, up: 1.8, gravity: -5, drag: 1 }],
  ["confetti", { pool: "bit", colors: ["#e94f37", "#f6ae2d", "#3f88c5", "#44bba4", "#ef7fb0", "#ffd166"], life: 1.5, size: 0.08, grow: 0.6, spread: 2.2, up: 3.6, gravity: -6, drag: 0.8 }],
]);

const CAPACITY = new Map<Pool, number>([["puff", 220], ["bit", 260], ["spark", 120]]);

interface Particles {
  readonly mesh: THREE.InstancedMesh;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly size: Float32Array;
  readonly grow: Float32Array;
  readonly gravity: Float32Array;
  readonly drag: Float32Array;
  readonly spin: Float32Array;
  next: number;
}

/** All particle pools of one view. */
export interface Fx {
  readonly object: THREE.Group;
  /** Spawns `count` particles of a kind at a point; `color` overrides the kind's palette. */
  readonly emit: (kind: Burst, at: THREE.Vector3, count: number, color?: string) => void;
  /** Moves and fades everything by `dt` seconds. */
  readonly update: (dt: number) => void;
}

function pool(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): Particles {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const white = new THREE.Color("#ffffff");

  for (let i = 0; i < capacity; i++) {
    mesh.setMatrixAt(i, zero);
    mesh.setColorAt(i, white);
  }

  const f = (n: number) => new Float32Array(capacity * n);

  return {
    mesh, pos: f(3), vel: f(3), age: f(1), life: f(1), size: f(1), grow: f(1), gravity: f(1), drag: f(1), spin: f(1), next: 0,
  };
}

/** Builds the pools and returns the emitter. */
export function createFx(): Fx {
  const object = new THREE.Group();
  const puffMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.82, depthWrite: false, flatShading: true });
  const bitMat = new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true });
  const sparkMat = new THREE.MeshBasicMaterial({ toneMapped: false, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });

  const pools = new Map<Pool, Particles>([
    ["puff", pool(new THREE.IcosahedronGeometry(1, 0), puffMat, CAPACITY.get("puff") ?? 200)],
    ["bit", pool(new THREE.BoxGeometry(1, 0.6, 1), bitMat, CAPACITY.get("bit") ?? 200)],
    ["spark", pool(new THREE.OctahedronGeometry(1, 0), sparkMat, CAPACITY.get("spark") ?? 100)],
  ]);

  for (const p of pools.values()) {
    p.mesh.renderOrder = 5;
    object.add(p.mesh);
  }

  let seed = 12345;

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;

    return seed / 4294967296;
  };

  const color = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  const emit = (kind: Burst, at: THREE.Vector3, count: number, override?: string) => {
    const spec = SPECS.get(kind);

    if (spec === undefined) return;
    const p = pools.get(spec.pool);

    if (p === undefined) return;
    const capacity = p.age.length;

    for (let n = 0; n < count; n++) {
      const i = p.next;
      p.next = (p.next + 1) % capacity;
      const a = rand() * Math.PI * 2;
      const r = spec.spread * (0.4 + rand() * 0.6);
      p.pos.set([at.x + (rand() - 0.5) * 0.12, at.y, at.z + (rand() - 0.5) * 0.12], i * 3);
      p.vel.set([Math.cos(a) * r * 0.5, spec.up * (0.6 + rand() * 0.6), Math.sin(a) * r * 0.5], i * 3);
      p.age[i] = 0;
      p.life[i] = spec.life * (0.7 + rand() * 0.5);
      p.size[i] = spec.size * (0.7 + rand() * 0.6);
      p.grow[i] = spec.grow;
      p.gravity[i] = spec.gravity;
      p.drag[i] = spec.drag;
      p.spin[i] = (rand() - 0.5) * 12;
      color.set(override ?? spec.colors[Math.floor(rand() * spec.colors.length)] ?? "#ffffff");
      p.mesh.setColorAt(i, color);
    }

    if (p.mesh.instanceColor !== null) p.mesh.instanceColor.needsUpdate = true;
  };

  const update = (dt: number) => {
    for (const p of pools.values()) {
      const capacity = p.age.length;

      for (let i = 0; i < capacity; i++) {
        const life = p.life[i] ?? 0;

        if (life <= 0) continue;
        const age = (p.age[i] ?? 0) + dt;
        p.age[i] = age;

        if (age >= life) {
          p.life[i] = 0;
          m.makeScale(0, 0, 0);
          p.mesh.setMatrixAt(i, m);
          continue;
        }

        const k = i * 3;
        const drag = Math.exp(-(p.drag[i] ?? 0) * dt);
        const vx = (p.vel[k] ?? 0) * drag;
        const vy = ((p.vel[k + 1] ?? 0) + (p.gravity[i] ?? 0) * dt) * drag;
        const vz = (p.vel[k + 2] ?? 0) * drag;
        p.vel.set([vx, vy, vz], k);
        let y = (p.pos[k + 1] ?? 0) + vy * dt;

        // bits land on the floor instead of falling through it
        if (y < 0.03 && vy < 0) y = 0.03;
        p.pos.set([(p.pos[k] ?? 0) + vx * dt, y, (p.pos[k + 2] ?? 0) + vz * dt], k);
        const t = age / life;
        const grow = 1 + ((p.grow[i] ?? 1) - 1) * t;
        // puffs swell in, everything shrinks away at the end
        const ease = Math.min(1, t * 6) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
        const size = (p.size[i] ?? 0) * grow * ease;
        const spin = (p.spin[i] ?? 0) * age;
        e.set(spin, spin * 0.7, 0);
        q.setFromEuler(e);
        v.set(p.pos[k] ?? 0, p.pos[k + 1] ?? 0, p.pos[k + 2] ?? 0);
        s.setScalar(size);
        m.compose(v, q, s);
        p.mesh.setMatrixAt(i, m);
      }

      p.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return { object, emit, update };
}
