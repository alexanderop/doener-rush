/**
 * Building blocks for the low-poly models: cached materials and geometries, small mesh
 * helpers and the canvas textures (wood grain, meat layers, soft shadows, emoji labels).
 * Everything is cached by its parameters, so rebuilding an item model costs no GPU upload.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const materials = new Map<string, THREE.MeshStandardMaterial>();

const geometries = new Map<string, THREE.BufferGeometry>();

const textures = new Map<string, THREE.Texture>();

/** A shared matte material of one colour (and optional glow). */
export function mat(color: string, emissive = "#000000", roughness = 0.7): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive}|${roughness}`;
  let m = materials.get(key);

  if (m === undefined) {
    m = new THREE.MeshStandardMaterial({ color, emissive, roughness, metalness: 0 });
    materials.set(key, m);
  }

  return m;
}

/** A shared material tinted over a texture, e.g. wood grain in the counter's colour. */
export function mapped(color: string, map: THREE.Texture, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}|map:${map.uuid}|${roughness}`;
  let m = materials.get(key);

  if (m === undefined) {
    m = new THREE.MeshStandardMaterial({ color, map, roughness, metalness: 0 });
    materials.set(key, m);
  }

  return m;
}

/** A shared slightly shiny steel. */
export function steel(color = "#c3c8ce"): THREE.MeshStandardMaterial {
  const key = `steel|${color}`;
  let m = materials.get(key);

  if (m === undefined) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
    materials.set(key, m);
  }

  return m;
}

/** A geometry built once per key and shared by every mesh that asks for it. */
export function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometries.get(key);

  if (g === undefined) {
    g = make();
    geometries.set(key, g);
  }

  return g;
}

/** A mesh that casts and takes shadows. */
export function solid(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/** A box resting on y (its centre at `y`). */
export function box(w: number, h: number, d: number, material: THREE.Material, y = h / 2): THREE.Mesh {
  const mesh = solid(geo(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), material);
  mesh.position.y = y;

  return mesh;
}

/** A box with bevelled, rounded edges. */
export function rbox(w: number, h: number, d: number, r: number, material: THREE.Material, y = h / 2): THREE.Mesh {
  const mesh = solid(geo(`rbox|${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 1, r)), material);
  mesh.position.y = y;

  return mesh;
}

/** An upright cylinder (or frustum). */
export function cyl(rTop: number, rBottom: number, h: number, material: THREE.Material, segments = 16): THREE.Mesh {
  return solid(geo(`cyl|${rTop}|${rBottom}|${h}|${segments}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, segments)), material);
}

/** A sphere; low segment counts give the faceted low-poly look. */
export function ball(r: number, material: THREE.Material, segments = 14): THREE.Mesh {
  const rows = Math.max(5, Math.floor(segments * 0.7));

  return solid(geo(`ball|${r}|${segments}`, () => new THREE.SphereGeometry(r, segments, rows)), material);
}

/** A faceted blob (icosahedron), for leaves, crumbs and puffs. */
export function blob(r: number, material: THREE.Material, detail = 0): THREE.Mesh {
  return solid(geo(`ico|${r}|${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), material);
}

/** A ring lying flat. */
export function ring(r: number, tube: number, material: THREE.Material): THREE.Mesh {
  const mesh = solid(geo(`torus|${r}|${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 18)), material);
  mesh.rotation.x = Math.PI / 2;

  return mesh;
}

/** A deterministic 0–1 hash of two integers, for stable per-tile variation. */
export function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;

  return s - Math.floor(s);
}

/** A canvas texture drawn once per key. */
export function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  let t = textures.get(key);

  if (t === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");

    if (g !== null) draw(g);
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(key, t);
  }

  return t;
}

/** Light vertical wood grain, tinted by the material colour. */
export function woodMap(): THREE.Texture {
  return canvasTexture("wood", 128, 128, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 128, 128);

    for (let i = 0; i < 40; i++) {
      const x = hash(i, 3) * 128;
      g.strokeStyle = `rgba(90,50,20,${0.03 + hash(i, 7) * 0.05})`;
      g.lineWidth = 1 + hash(i, 9) * 2;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 6, 40, x - 6, 90, x + 3, 128);
      g.stroke();
    }

    // plank joints
    g.fillStyle = "rgba(70,35,10,0.18)";

    for (const x of [0, 42, 85]) g.fillRect(x, 0, 2, 128);
  });
}

/** Stacked layers of a döner cone: bands of light and dark meat with flecks of fat. */
export function meatMap(): THREE.Texture {
  return canvasTexture("meat", 64, 256, (g) => {
    let y = 0;
    let i = 0;

    while (y < 256) {
      const band = 7 + hash(i, 1) * 9;
      const v = Math.round(185 + hash(i, 2) * 70);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, y, 64, band);
      // a dark crisp edge under each layer
      g.fillStyle = "rgba(40,20,10,0.35)";
      g.fillRect(0, y + band - 2, 64, 2);
      y += band;
      i += 1;
    }

    for (let k = 0; k < 70; k++) {
      g.fillStyle = hash(k, 5) > 0.5 ? "rgba(255,240,220,0.45)" : "rgba(50,25,10,0.3)";
      g.fillRect(hash(k, 11) * 64, hash(k, 13) * 256, 2 + hash(k, 17) * 5, 1 + hash(k, 19) * 2);
    }
  });
}

// a soft round shadow for contact shadows under characters
function blobShadowMap(): THREE.Texture {
  return canvasTexture("blob-shadow", 64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, "rgba(30,15,5,0.85)");
    grad.addColorStop(0.55, "rgba(30,15,5,0.4)");
    grad.addColorStop(1, "rgba(30,15,5,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

const shadowMaterial = new Map<number, THREE.MeshBasicMaterial>();

/** A flat soft shadow disc lying on the ground, for grounding characters. */
export function contactShadow(radius: number, opacity = 0.45): THREE.Mesh {
  let m = shadowMaterial.get(opacity);

  if (m === undefined) {
    m = new THREE.MeshBasicMaterial({ map: blobShadowMap(), transparent: true, depthWrite: false, opacity });
    shadowMaterial.set(opacity, m);
  }

  const mesh = new THREE.Mesh(geo("plane|1", () => new THREE.PlaneGeometry(1, 1)), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(radius * 2, radius * 2, 1);
  mesh.position.y = 0.015;
  mesh.renderOrder = 1;

  return mesh;
}

const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

/**
 * Draws an ingredient icon centred at (x, y). Emoji for most; the flatbread is painted by
 * hand because 🫓 is missing from some emoji fonts and would leave an empty disc.
 */
export function drawIcon(g: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number): void {
  if (icon === "🫓") {
    g.save();
    g.translate(x, y);
    g.rotate(-0.35);
    g.fillStyle = "#b8742c";
    g.beginPath();
    g.ellipse(0, size * 0.06, size * 0.48, size * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#eab460";
    g.beginPath();
    g.ellipse(0, 0, size * 0.46, size * 0.27, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f6d48c";
    g.beginPath();
    g.ellipse(0, -size * 0.02, size * 0.3, size * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff6dc";

    for (let i = 0; i < 6; i++) g.fillRect(-size * 0.22 + i * size * 0.08, -size * 0.06 + (i % 2) * size * 0.07, size * 0.04, size * 0.025);
    g.restore();

    return;
  }

  g.font = `${Math.round(size * 0.82)}px ${EMOJI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(icon, x, y + size * 0.05);
}

/** A round badge with an emoji on it, for crate and sauce labels. */
export function emojiBadge(icon: string, rim = "#fff7e8"): THREE.Texture {
  return canvasTexture(`badge|${icon}|${rim}`, 128, 128, (g) => {
    g.fillStyle = rim;
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "rgba(60,30,10,0.55)";
    g.stroke();
    drawIcon(g, icon, 64, 64, 92);
  });
}

/** A flat label plane showing a texture, unlit so it stays readable. */
export function label(map: THREE.Texture, size: number): THREE.Mesh {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false });
  const mesh = new THREE.Mesh(geo("plane|1", () => new THREE.PlaneGeometry(1, 1)), m);
  mesh.scale.set(size, size, 1);

  return mesh;
}

const BAKE_ATTRIBUTES = ["position", "normal", "uv"] as const;

/** A geometry copy in world space with exactly position, normal and uv, non-indexed, so any two can merge. */
function bakeable(mesh: THREE.Mesh): THREE.BufferGeometry {
  const source = mesh.geometry.index === null ? mesh.geometry : mesh.geometry.toNonIndexed();
  const g = new THREE.BufferGeometry();

  for (const name of BAKE_ATTRIBUTES) {
    const attr = source.getAttribute(name);

    if (attr !== undefined) {
      g.setAttribute(name, attr.clone());
    } else {
      const size = name === "uv" ? 2 : 3;
      g.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(source.getAttribute("position").count * size), size));
    }
  }

  g.applyMatrix4(mesh.matrixWorld);

  return g;
}

/**
 * Merges every static mesh under `root` into one mesh per material and shadow mode, so a
 * kitchen of hundreds of little parts draws in a few dozen calls. Subtrees whose name is in
 * `keep` stay as they are, because the scene animates them.
 */
export function bakeStatic(root: THREE.Object3D, keep: ReadonlySet<string>): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; order: number; parts: THREE.BufferGeometry[] }>();
  const doomed: THREE.Mesh[] = [];

  const visit = (o: THREE.Object3D) => {
    if (keep.has(o.name)) return;

    if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.visible) {
      const material: THREE.Material = o.material;
      const key = `${material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
      let bucket = buckets.get(key);

      if (bucket === undefined) {
        bucket = { material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, parts: [] };
        buckets.set(key, bucket);
      }

      bucket.parts.push(bakeable(o));
      doomed.push(o);
    }

    for (const child of o.children) visit(child);
  };

  visit(root);

  // children of a baked mesh (outline hulls) were baked too; lift any kept ones out first
  for (const mesh of doomed) {
    for (const child of mesh.children.filter((c) => keep.has(c.name))) root.attach(child);

    mesh.removeFromParent();
  }

  const baked = new THREE.Group();

  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.parts, false);

    for (const part of bucket.parts) part.dispose();

    if (merged === null) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.renderOrder = bucket.order;
    baked.add(mesh);
  }

  return baked;
}
