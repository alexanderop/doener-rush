/**
 * The 3D view of the shop (three.js): a steep camera over the kitchen diorama, warm sun with
 * soft shadows, the brick rim and the street, customers walking up to the pass, and the
 * overlays and particles that make every action read. It reads the world each frame and
 * never changes it.
 */
import * as THREE from "three";
import { facingTile } from "../../../features/cooks/public.ts";
import type { Item, Station } from "../../../features/kitchen/public.ts";
import { BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, SHAVE_TICKS, TOAST_BURNT, TOAST_DONE, WASH_TICKS, isChopped } from "../../../features/kitchen/public.ts";
import type { World } from "../world.ts";
import { createFx } from "./fx.ts";
import type { Fx } from "./fx.ts";
import { TOP, cookModel, customerModel, itemKey, itemModel, meatColor, plateStack, stationModel, trayStock } from "./models.ts";
import { bubbleSprite, progressBar, setBubble, showBar, spitBubble, tickSprite, warningSprite } from "./overlays.ts";
import type { Bar } from "./overlays.ts";
import { bakeStatic, contactShadow, geo } from "./parts.ts";
import { animateStreet, street } from "./street.ts";

const COOK_COLORS = ["#e94f37", "#3f88c5", "#44bba4", "#f6ae2d"];

const TILT = THREE.MathUtils.degToRad(64);

const ITEM_SCALE = 1.55;

const BUBBLE = 0.36;

/** Parts the scene moves; everything else in the kitchen and street is baked. */
const ANIMATED: ReadonlySet<string> = new Set(["slot", "stock", "knife", "lid", "cone", "lamp", "glow", "heat", "bird"]);

/** Veg colours for the bits that fly off the board. */
const BIT_COLOR = new Map<string, string>([["lettuce", "#6fc23f"], ["tomato", "#e8392b"], ["onion", "#c886b5"]]);

/** The animated pieces of a station model, looked up once. */
interface StationParts {
  readonly knife: THREE.Object3D;
  readonly lid: THREE.Object3D;
  readonly cone: THREE.Object3D;
  readonly lamp: THREE.MeshStandardMaterial | null;
  readonly glow: THREE.MeshStandardMaterial | null;
  readonly sides: readonly (THREE.MeshStandardMaterial | null)[];
  readonly heat: THREE.PointLight | null;
}

function partsOf(group: THREE.Group): StationParts {
  const heat = group.getObjectByName("heat");

  return {
    knife: named(group, "knife"),
    lid: named(group, "lid"),
    cone: named(group, "cone"),
    lamp: standardOf(group, "lamp"),
    glow: standardOf(group, "glow"),
    sides: [0, 1, 2, 3].map((side) => standardOf(group, `side${side}`)),
    heat: heat instanceof THREE.PointLight ? heat : null,
  };
}

interface StationView {
  readonly station: Station;
  readonly parts: StationParts;
  readonly group: THREE.Group;
  readonly slot: THREE.Object3D;
  /** Plates, tray portions: what the station keeps besides its one item. */
  readonly stock: THREE.Object3D;
  stockKey: string;
  readonly bar: Bar;
  readonly bubble: THREE.Sprite;
  readonly tick: THREE.Sprite;
  readonly warning: THREE.Sprite;
  readonly danger: THREE.Mesh;
  readonly centre: THREE.Vector3;
  key: string;
  /** Seconds since the item last changed, for the landing pop. */
  pop: number;
  /** Seconds since the tick appeared; large when none. */
  tickAge: number;
  /** Progress last frame, to notice when work completes. */
  done: boolean;
  shave: number;
  emitAcc: number;
}

interface CookView {
  readonly group: THREE.Group;
  readonly rig: THREE.Object3D;
  readonly held: THREE.Object3D;
  readonly bubble: THREE.Sprite;
  readonly hands: readonly THREE.Object3D[];
  readonly feet: readonly THREE.Object3D[];
  readonly eyes: THREE.Object3D;
  readonly focus: THREE.Mesh;
  readonly focusBin: THREE.Mesh;
  key: string;
  yaw: number;
  lastX: number;
  lastY: number;
  stride: number;
  walking: boolean;
  squash: number;
  dust: number;
  blink: number;
}

interface CustomerView {
  readonly group: THREE.Group;
  readonly rig: THREE.Object3D;
  target: THREE.Vector3;
  leaving: "no" | "happy" | "angry";
  age: number;
}

/** A running 3D view: draw a frame, follow the canvas size, free the GPU. */
export interface ShopView {
  readonly render: (world: World, width: number, height: number, timeMs: number) => void;
  readonly dispose: () => void;
}

function named(root: THREE.Object3D, name: string): THREE.Object3D {
  return root.getObjectByName(name) ?? new THREE.Object3D();
}

function standardOf(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial | null {
  const mesh = root.getObjectByName(name);

  if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return null;

  return mesh.material;
}

/** A glowing additive overlay that tints a counter slab (yellow focus, red danger). */
function slabGlow(color: string, round: boolean): THREE.Mesh {
  const geometry = round
    ? geo("glow-bin", () => new THREE.CylinderGeometry(0.38, 0.38, 0.1, 20))
    : geo("glow-slab", () => new THREE.BoxGeometry(1.04, 0.14, 1.04));

  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, m);
  mesh.renderOrder = 4;
  mesh.visible = false;

  return mesh;
}

/** Overshooting scale for something that just landed: 0.55 → 1.15 → 1. */
function popScale(age: number): number {
  if (age > 0.6) return 1;

  return 1 - Math.exp(-age * 9) * Math.cos(age * 22) * 0.45;
}

/** A darkened rim over the whole frame, drawn last. */
function vignette(): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vec2 d = (vUv - 0.5) * vec2(1.25, 1.0);",
      "  float a = smoothstep(0.42, 0.85, length(d));",
      "  gl_FragColor = vec4(0.12, 0.06, 0.03, a * 0.55);",
      "}",
    ].join("\n"),
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;

  return mesh;
}

/** Sets up three.js on a canvas for one world. */
export function createShopView(canvas: HTMLCanvasElement, world: World): ShopView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const background = new THREE.Color("#3d3a40");
  scene.background = background;
  scene.fog = new THREE.Fog(background, 24, 46);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight("#fff3dc", "#6a4a3a", 1.25));
  const sun = new THREE.DirectionalLight("#ffe0b0", 2.7);
  sun.position.set(world.width / 2 - 6, 16, world.height / 2 + 7);
  sun.target.position.set(world.width / 2, 0, world.height / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#cfe0ff", 0.55);
  fill.position.set(world.width / 2 + 8, 8, world.height / 2 + 10);
  scene.add(fill);
  const outside = street(world);
  // everything that never moves is merged into a few meshes once the stations are built
  const still = new THREE.Group();
  still.add(outside.group);
  scene.add(still);
  const fx: Fx = createFx();
  scene.add(fx.object);
  scene.add(vignette());

  const stations: StationView[] = [];

  for (const station of world.stations.values()) {
    const group = stationModel(station);
    group.position.set(station.x + 0.5, 0, station.y + 0.5);
    const centre = new THREE.Vector3(station.x + 0.5, TOP, station.y + 0.5);
    const bar = progressBar();
    bar.group.position.set(centre.x, TOP + 0.12, centre.z + 0.55);
    const bubble = bubbleSprite();
    const tick = tickSprite();
    tick.position.set(centre.x, TOP + 0.75, centre.z);
    const warning = warningSprite();
    warning.position.set(centre.x + 0.42, TOP + (station.type === "spit" ? 1.55 : 0.75), centre.z);
    const danger = slabGlow("#ff2a1a", false);
    danger.position.set(centre.x, TOP - 0.06, centre.z);
    still.add(group);
    scene.add(bar.group, bubble, tick, warning, danger);
    stations.push({
      station, group, parts: partsOf(group), slot: named(group, "slot"), stock: named(group, "stock"), stockKey: "", bar, bubble, tick, warning, danger, centre,
      key: "", pop: 9, tickAge: 9, done: false, shave: 0, emitAcc: 0,
    });
  }

  scene.add(bakeStatic(still, ANIMATED));

  const cooks: CookView[] = world.cooks.map((cook, i) => {
    const color = COOK_COLORS[i] ?? "#ffffff";
    const group = cookModel(color);
    group.scale.setScalar(1.22);
    const shadow = contactShadow(0.36, 0.5);
    group.add(shadow);
    const focus = slabGlow("#ffd23f", false);
    const focusBin = slabGlow("#ffd23f", true);
    const bubble = bubbleSprite();
    scene.add(group, focus, focusBin, bubble);

    return {
      group, focus, focusBin, bubble,
      rig: named(group, "rig"), held: named(group, "held"), eyes: named(group, "eyes"),
      hands: [named(group, "handL"), named(group, "handR")], feet: [named(group, "footL"), named(group, "footR")],
      key: "", yaw: 0, lastX: cook.x, lastY: cook.y, stride: 0, walking: false, squash: 9, dust: 0, blink: 2 + i,
    };
  });

  const passes = stations.flatMap((v) => (v.station.type === "pass" ? [v] : []));
  const customers = new Map<number, CustomerView>();
  const seen = new WeakSet<object>();
  const held = new THREE.Vector3();
  const at = new THREE.Vector3();
  let lastW = 0;
  let lastH = 0;
  let lastT = -1;
  // adaptive quality: slow machines (or software WebGL) drop resolution, then shadows
  let quality = 0;
  let slowFor = 0;
  let frameAvg = 1 / 60;
  let frames = 0;

  function lowerQuality(): void {
    quality += 1;
    slowFor = 0;

    if (quality === 1) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * 0.7);
      lastW = 0;
    } else if (quality === 2) {
      sun.castShadow = false;
      sun.shadow.map?.dispose();

      for (const v of stations) {
        if (v.parts.heat !== null) v.parts.heat.visible = false;
      }
    } else {
      renderer.setPixelRatio(0.5);
      lastW = 0;
    }
  }

  function fits(cx: number, cz: number, distance: number, points: readonly THREE.Vector3[]): boolean {
    camera.position.set(cx, Math.sin(TILT) * distance, cz + Math.cos(TILT) * distance);
    camera.lookAt(cx, 0, cz);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    return points.every((p) => {
      const v = p.clone().project(camera);

      return Math.abs(v.x) <= 0.97 && v.y <= 0.97 && v.y >= -0.97;
    });
  }

  function fitCamera(width: number, height: number): void {
    camera.aspect = width / Math.max(1, height);
    const w = world.width;
    const h = world.height;

    // the kitchen with its rim, the customers at the pass and the sign over it
    const points = [
      new THREE.Vector3(-0.6, 0, h + 0.6), new THREE.Vector3(w + 0.6, 0, h + 0.6),
      new THREE.Vector3(-0.6, 1, -1.4), new THREE.Vector3(w + 0.6, 1, -1.4),
      new THREE.Vector3(w / 2, 1.45, -2.55),
    ];

    const cx = w / 2;
    const cz = h / 2 - 0.3;
    let distance = 6;

    while (distance < 60 && !fits(cx, cz, distance, points)) distance += 0.2;
  }

  function slotOf(index: number): THREE.Vector3 {
    const pass = passes[index];

    if (pass !== undefined) return new THREE.Vector3(pass.centre.x, 0, -0.95);
    // the rest wait in a line along the street wall, left of the pass
    const first = passes[0]?.centre.x ?? 0;

    return new THREE.Vector3(first - 0.85 * (index - passes.length + 1), 0, -1.15);
  }

  function syncCustomers(w: World, dt: number, t: number): void {
    const queue = w.orders.queue;
    const present = new Set(queue.map((o) => o.id));
    queue.forEach((order, i) => {
      let view = customers.get(order.id);

      if (view === undefined) {
        const group = customerModel(order.id);
        group.scale.setScalar(1.15);
        group.add(contactShadow(0.3, 0.45));
        group.position.set(order.id % 2 === 0 ? -2.5 : w.width + 2.5, 0, -1.9);
        scene.add(group);
        view = { group, rig: named(group, "rig"), target: slotOf(i), leaving: "no", age: 0 };
        customers.set(order.id, view);
      }

      view.target = slotOf(i);
      const patience = order.ticksLeft / Math.max(1, order.recipe.patience);
      // impatient customers stamp and wobble
      view.rig.rotation.z = patience < 0.25 ? Math.sin(t * 18 + order.id) * 0.08 : 0;
    });

    for (const [id, view] of customers) {
      view.age += dt;

      if (!present.has(id) && view.leaving === "no") {
        const served = w.orders.events.some((e) => e.event.type === "served" && e.event.orderId === id);
        view.leaving = served ? "happy" : "angry";
        view.age = 0;
        view.target = new THREE.Vector3(served ? w.width + 4 : -4, 0, -2);

        if (!served) fx.emit("smoke", at.set(view.group.position.x, 1.4, view.group.position.z), 8);
      }

      const pos = view.group.position;
      const dx = view.target.x - pos.x;
      const dz = view.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const speed = view.leaving === "no" ? 2.6 : 3.4;
      const moving = dist > 0.04;

      if (moving) {
        const step = Math.min(dist, speed * dt);
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
        view.group.rotation.y = Math.atan2(dx, dz);
      } else {
        view.group.rotation.y = 0;
      }

      const jump = view.leaving === "happy" && view.age < 0.9 ? Math.abs(Math.sin(view.age * 10)) * 0.35 : 0;
      const bob = moving ? Math.abs(Math.sin(t * 12 + id)) * 0.06 : Math.sin(t * 2 + id) * 0.01;
      view.rig.position.y = bob + jump;
      const s = 1 + (moving ? Math.sin(t * 24 + id) * 0.04 : 0);
      view.rig.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

      if (view.leaving !== "no" && !moving) {
        scene.remove(view.group);
        customers.delete(id);
      }
    }
  }

  function syncEvents(w: World): void {
    for (const entry of w.orders.events) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      const pass = passes[0];

      if (pass === undefined) continue;
      at.set(pass.centre.x + (passes.length > 1 ? 0.5 : 0), TOP + 0.3, pass.centre.z);

      if (entry.event.type === "served") {
        fx.emit("confetti", at, 40);
        fx.emit("sparks", at, 24, "#ffd166");
      } else if (entry.event.type === "wrong") {
        fx.emit("smoke", at, 10);
      }
    }
  }

  function syncCook(w: World, cookIndex: number, dt: number, t: number): void {
    const cook = w.cooks[cookIndex];
    const view = cooks[cookIndex];

    if (cook === undefined || view === undefined) return;
    view.group.position.set(cook.x, 0, cook.y);
    const target = Math.atan2(cook.face.dx, cook.face.dy);
    let diff = target - view.yaw;

    while (diff > Math.PI) diff -= Math.PI * 2;

    while (diff < -Math.PI) diff += Math.PI * 2;
    view.yaw += diff * Math.min(1, dt * 18);
    view.group.rotation.y = view.yaw;
    const moved = Math.hypot(cook.x - view.lastX, cook.y - view.lastY);
    view.lastX = cook.x;
    view.lastY = cook.y;
    const walking = moved > 0.001 && moved < 0.5;
    view.stride += moved * 9;
    view.dust -= dt;
    at.set(cook.x - Math.sin(view.yaw) * 0.25, 0.06, cook.y - Math.cos(view.yaw) * 0.25);

    if (cook.dash > 0) fx.emit("dust", at, 3);

    if (cook.working && cook.held?.kind === "extinguisher") {
      for (let k = 1; k <= 3; k++) {
        spray.set(cook.x + cook.face.dx * 0.35 * k, 0.75, cook.y + cook.face.dy * 0.35 * k);
        fx.emit("foam", spray, 1);
      }
    }

    if (walking && !view.walking) fx.emit("dust", at, 5);
    else if (walking && Math.abs(diff) > 1.2) fx.emit("dust", at, 4);
    else if (walking && view.dust <= 0) {
      fx.emit("dust", at, 1);
      view.dust = 0.11;
    }

    view.walking = walking;
    // squash and stretch: a bounce while walking, a quick squish when picking up or putting down
    view.squash += dt;
    const bounce = walking ? Math.sin(view.stride * 2) * 0.06 : 0;
    const chop = cook.working ? Math.abs(Math.sin(t * 22)) * 0.05 : 0;
    const squish = view.squash < 0.6 ? -Math.exp(-view.squash * 9) * Math.cos(view.squash * 24) * 0.2 : 0;
    // a dash leans the cook forward and stretches them along the run
    const lean = cook.dash > 0 ? 0.25 : 0;
    view.rig.rotation.x += (lean - view.rig.rotation.x) * Math.min(1, dt * 20);
    const k = bounce + squish - chop;
    view.rig.scale.set(1 - k * 0.5, 1 + k, 1 - k * 0.5);
    view.rig.position.y = walking ? Math.abs(Math.sin(view.stride)) * 0.06 : 0;
    view.group.rotation.z = walking ? Math.sin(view.stride) * 0.05 : 0;
    view.feet.forEach((foot, side) => {
      foot.position.z = 0.04 + (walking ? Math.sin(view.stride + side * Math.PI) * 0.1 : 0);
      foot.position.y = 0.05 + (walking ? Math.max(0, Math.sin(view.stride + side * Math.PI)) * 0.05 : 0);
    });
    const carrying = cook.held !== null;
    view.hands.forEach((hand, side) => {
      const swing = cook.working ? Math.sin(t * 22 + side * Math.PI) * 0.1 : 0;
      const walkSwing = walking && !carrying ? Math.sin(view.stride + side * Math.PI) * 0.08 : 0;
      hand.position.set(side === 0 ? -0.27 : 0.27, carrying ? 0.62 : 0.5 + swing, carrying || cook.working ? 0.34 : 0.16 + walkSwing);
    });
    view.blink -= dt;

    if (view.blink < -0.12) view.blink = 2 + ((cookIndex * 1.7 + t) % 2.5);
    view.eyes.scale.y = view.blink < 0 ? 0.15 : 1;
    const key = itemKey(cook.held);

    if (key !== view.key) {
      view.held.clear();

      if (cook.held !== null) view.held.add(itemModel(cook.held));
      view.key = key;
      view.squash = 0;
      setBubble(view.bubble, cook.held, BUBBLE);
    }

    // facing away from the camera the body would hide the item, so the cook lifts it up
    const away = Math.max(0, -Math.cos(view.yaw));
    view.held.position.set(0, 0.66 + away * 0.42, 0.4 - away * 0.08);
    view.held.scale.setScalar(1.35 * popScale(view.squash));
    view.held.getWorldPosition(held);
    view.bubble.position.set(held.x, held.y + 0.42, held.z);
    const front = facingTile(cook);
    const station = w.stations.get(front.y * w.width + front.x);
    const glow = 0.32 + Math.sin(t * 6) * 0.08;
    view.focus.visible = station !== undefined && station.type !== "bin";
    view.focusBin.visible = station?.type === "bin";
    view.focus.position.set(front.x + 0.5, TOP - 0.06, front.y + 0.5);
    view.focusBin.position.set(front.x + 0.5, 0.8, front.y + 0.5);

    for (const m of [view.focus.material, view.focusBin.material]) {
      if (m instanceof THREE.MeshBasicMaterial) m.opacity = glow;
    }
  }

  function render(w: World, width: number, height: number, timeMs: number): void {
    if (width !== lastW || height !== lastH) {
      renderer.setSize(width, height, false);
      fitCamera(width, height);
      lastW = width;
      lastH = height;
    }

    const t = timeMs / 1000;
    const raw = lastT < 0 ? 1 / 60 : Math.max(0, t - lastT);
    const dt = Math.min(0.05, raw);
    lastT = t;
    frameAvg += (Math.min(raw, 0.25) - frameAvg) * 0.1;
    frames += 1;
    // ignore the first two seconds: shader compiles and texture uploads make them slow anyway
    slowFor = frames > 120 && frameAvg > 1 / 36 ? slowFor + raw : 0;

    if (slowFor > 1.2 && quality < 3) lowerQuality();
    const worked = new Set<number>();

    for (const cook of w.cooks) {
      if (!cook.working) continue;
      const front = facingTile(cook);
      worked.add(front.y * w.width + front.x);
    }

    for (const view of stations) {
      syncStation(view, {
        camera, fx, t, dt, worked: worked.has(view.station.y * w.width + view.station.x),
      });
    }

    for (let i = 0; i < w.cooks.length; i++) syncCook(w, i, dt, t);
    syncEvents(w);
    syncCustomers(w, dt, t);
    animateStreet(outside.birds, t);
    fx.update(dt);
    renderer.render(scene, camera);
  }

  // warm up before the game loop starts: compile every shader, upload the textures and
  // draw the shadow map once, so the first real frames are not the slow ones
  for (const view of cooks) view.focus.visible = true;
  render(world, canvas.clientWidth || 1280, canvas.clientHeight || 720, 0);

  for (const view of cooks) view.focus.visible = false;
  lastT = -1;

  return {
    render,
    dispose: () => {
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}

/** What a station sync needs from the frame. */
interface Frame {
  readonly camera: THREE.Camera;
  readonly fx: Fx;
  readonly t: number;
  readonly dt: number;
  /** A cook is chopping or shaving at this station right now. */
  readonly worked: boolean;
}

const spot = new THREE.Vector3();

const spray = new THREE.Vector3();

/** True when the station's work just finished: chopped veg, bread toasted. */
function finished(item: Item | null): boolean {
  if (item === null) return false;

  if (item.kind === "veg") return isChopped(item);

  return item.kind === "base" && item.toast >= TOAST_DONE;
}

function every(view: StationView, rate: number, dt: number): number {
  view.emitAcc += rate * dt;
  const n = Math.floor(view.emitAcc);
  view.emitAcc -= n;

  return n;
}

/** Rebuilds the plates and tray portions a station keeps when their count changes; the sink's scrub bar. */
function syncStock(view: StationView, frame: Frame): void {
  const { station, centre } = view;
  let key = "";

  if (station.type === "tray") key = `${station.veg}:${station.portions}`;
  else if (station.type === "rack" || station.type === "return") key = String(station.plates);
  else if (station.type === "sink") key = `${station.dirty}:${station.clean}`;

  if (key === view.stockKey) {
    if (station.type === "sink" && station.scrub > 0) {
      showBar(view.bar, station.scrub / WASH_TICKS, "#5fb8f0");

      if (frame.worked) {
        const n = every(view, 10, frame.dt);

        if (n > 0) frame.fx.emit("foam", spot.set(centre.x - 0.1, TOP + 0.1, centre.z), n);
      }
    }

    return;
  }

  view.stockKey = key;
  view.stock.clear();

  if (station.type === "tray") {
    view.stock.add(trayStock(station.veg, station.portions));
    view.bubble.position.set(centre.x, TOP + 0.5, centre.z);
    setBubble(view.bubble, station.veg === null ? null : { kind: "veg", veg: station.veg, chop: CHOP_TICKS }, BUBBLE);
  } else if (station.type === "rack" || station.type === "return") {
    const stack = plateStack(station.plates, station.type === "return");
    stack.position.y = TOP + 0.02;
    view.stock.add(stack);
  } else if (station.type === "sink") {
    const dirty = plateStack(Math.min(station.dirty, 5), true);
    dirty.position.set(-0.1, TOP - 0.01, 0);
    const clean = plateStack(Math.min(station.clean, 5), false);
    clean.position.set(0.32, TOP + 0.02, 0.05);
    clean.scale.setScalar(0.8);
    view.stock.add(dirty, clean);
    view.bubble.position.set(centre.x, TOP + 0.5, centre.z);
    setBubble(view.bubble, station.dirty > 0 ? { kind: "plate", dirty: true, food: null } : null, BUBBLE);
  }

  frame.fx.emit("pop", spot.set(centre.x, TOP + 0.15, centre.z), 4);
}

function syncStation(view: StationView, frame: Frame): void {
  const { station, bar, centre } = view;
  const { fx, t, dt } = frame;
  const key = itemKey(station.item);

  if (key !== view.key) {
    view.slot.clear();

    if (station.item !== null) {
      view.slot.add(itemModel(station.item));
      fx.emit("pop", spot.set(centre.x, TOP + 0.1, centre.z), 6);
    }

    view.key = key;
    view.pop = 0;
    view.bubble.position.set(centre.x, TOP + (station.type === "toaster" ? 0.62 : 0.5), centre.z);
    setBubble(view.bubble, station.item, BUBBLE);
  }

  syncStock(view, frame);
  view.pop += dt;
  view.slot.scale.setScalar(ITEM_SCALE * popScale(view.pop));
  const done = finished(station.item);

  if (done && !view.done && (station.type === "board" || station.type === "toaster")) view.tickAge = 0;
  view.done = done;
  bar.group.visible = false;
  bar.group.quaternion.copy(frame.camera.quaternion);
  let warn = false;

  if (station.type === "board") {
    const { knife } = view.parts;
    const item = station.item;

    if (item?.kind === "veg" && item.chop > 0 && !isChopped(item)) showBar(bar, item.chop / CHOP_TICKS, "#5fd068");

    if (frame.worked && item?.kind === "veg" && !isChopped(item)) {
      knife.position.set(0.02, TOP + 0.1 + Math.abs(Math.sin(t * 22)) * 0.14, 0.02);
      knife.rotation.z = Math.sin(t * 22) * 0.25;
      const n = every(view, 14, dt);

      if (n > 0) fx.emit("bits", spot.set(centre.x, TOP + 0.15, centre.z), n, BIT_COLOR.get(item.veg));
    } else {
      knife.position.set(0.14, TOP + 0.08, -0.2);
      knife.rotation.z = 0;
    }
  }

  if (station.type === "toaster") {
    const item = station.item;
    const toast = item?.kind === "base" ? item.toast : 0;
    const { lid, lamp } = view.parts;
    const open = item === null;
    lid.rotation.x += ((open ? -1.15 : -0.1) - lid.rotation.x) * Math.min(1, dt * 12);

    if (toast > 0 && toast < TOAST_DONE) {
      showBar(bar, toast / TOAST_DONE, "#5fd068");
      lamp?.emissive.set("#ff9a1a");
      const n = every(view, 7, dt);

      if (n > 0) fx.emit("steam", spot.set(centre.x + (Math.sin(t * 9) * 0.3), TOP + 0.3, centre.z + 0.1), n);
    } else if (toast >= TOAST_DONE && toast < TOAST_BURNT) {
      const over = (toast - TOAST_DONE) / (TOAST_BURNT - TOAST_DONE);
      showBar(bar, over, "#e94f37");
      lamp?.emissive.set(Math.sin(t * 10) > 0 ? "#3cff4a" : "#1a6020");
      warn = true;
      const n = every(view, 4 + over * 10, dt);

      if (n > 0) fx.emit(over > 0.6 ? "smoke" : "steam", spot.set(centre.x + (Math.sin(t * 7) * 0.3), TOP + 0.3, centre.z + 0.1), n);
    } else if (toast >= TOAST_BURNT) {
      lamp?.emissive.set("#ff1a1a");
      const n = every(view, 5, dt);

      if (n > 0) fx.emit("smoke", spot.set(centre.x, TOP + 0.3, centre.z), n);
    } else {
      lamp?.emissive.set("#000000");
    }
  }

  if (station.type === "spit") {
    const { spit } = station;
    // the side facing the heat turns toward the heater at the back (-z)
    const { cone, sides, glow, heat } = view.parts;
    cone.rotation.y = Math.PI - spit.angle * (Math.PI / 2);
    sides.forEach((m, side) => m?.color.set(meatColor(spit.sides[side] ?? 0)));
    const flicker = 0.85 + Math.sin(t * 7) * 0.12 + Math.sin(t * 23) * 0.05;

    if (glow !== null) glow.emissiveIntensity = flicker;

    if (heat !== null) heat.intensity = 2.2 * flicker;
    view.bubble.position.set(centre.x, TOP + 1.55, centre.z + 0.1);
    spitBubble(view.bubble, spit.sides, BUBBLE * 1.3);
    const hottest = Math.max(...spit.sides);
    warn = hottest >= BURNT - 0.2;

    if (spit.shave > 0) showBar(bar, spit.shave / SHAVE_TICKS, "#ffd166");

    if (frame.worked) {
      const n = every(view, 18, dt);

      if (n > 0) {
        spot.set(centre.x, TOP + 0.5 + Math.sin(t * 13) * 0.25, centre.z + 0.4);
        fx.emit("bits", spot, n, "#a95f2c");
        fx.emit("sparks", spot, 1);
      }
    } else if (spit.sides.some((s) => s >= BURNT)) {
      const n = every(view, 4, dt);

      if (n > 0) fx.emit("smoke", spot.set(centre.x, TOP + 1.2, centre.z), n);
    } else if (spit.sides.some((s) => s >= COOKED)) {
      // the odd drip of fat sizzling into the tray
      const n = every(view, 1.5, dt);

      if (n > 0) fx.emit("sparks", spot.set(centre.x + Math.sin(t) * 0.25, TOP + 0.12, centre.z + 0.2), n, "#ffb347");
    }

    // a finished portion: the shave counter falls back after being nearly full
    if (spit.shave === 0 && view.shave >= SHAVE_TICKS - 3) view.tickAge = 0;
    view.shave = spit.shave;
  }

  if (station.fire > 0) {
    warn = true;
    const n = every(view, 30, dt);

    if (n > 0) {
      spot.set(centre.x + Math.sin(t * 17) * 0.25, TOP + 0.15, centre.z + Math.cos(t * 13) * 0.2);
      fx.emit("flame", spot, n);

      if (Math.sin(t * 5) > 0.6) fx.emit("smoke", spot.set(centre.x, TOP + 0.9, centre.z), 1);
    }

    if (station.douse > 0) showBar(bar, station.douse / DOUSE_TICKS, "#5fb8f0");
  }

  view.tickAge += dt;
  view.tick.visible = view.tickAge < 0.9;
  view.tick.scale.setScalar(0.38 * popScale(view.tickAge) * (view.tickAge > 0.7 ? 1 - (view.tickAge - 0.7) / 0.2 : 1));
  // the warning flashes faster as the burn comes closer, with a red pulse on the slab
  const flash = Math.sin(t * 14) > -0.2;
  view.warning.visible = warn && flash;
  view.warning.scale.setScalar(0.42 + Math.abs(Math.sin(t * 7)) * 0.08);
  view.danger.visible = warn;

  if (warn && view.danger.material instanceof THREE.MeshBasicMaterial) view.danger.material.opacity = 0.25 + Math.abs(Math.sin(t * 7)) * 0.35;
}
