/**
 * The 3D view of the shop (three.js): a steep camera over the kitchen diorama, warm sun with
 * soft shadows, the brick rim and the street, customers walking up to the pass, and the
 * overlays and particles that make every action read. It reads the world each frame and
 * never changes it.
 */
import * as THREE from "three";
import { THROW_TICKS, facingTile } from "../../../features/cooks/public.ts";
import type { Landing, Thrown } from "../../../features/cooks/public.ts";
import type { Station } from "../../../features/kitchen/public.ts";
import { BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, HEAT, MIX_TICKS, SHAVE_TICKS, WASH_TICKS, isChopped } from "../../../features/kitchen/public.ts";
import { tutorialTargets } from "../tutorial/tutorial.ts";
import { isPaired } from "../lineup.ts";
import { LOOKS } from "../looks.ts";
import type { Look } from "../looks.ts";
import type { World } from "../world.ts";
import { createFx } from "./fx.ts";
import type { Fx } from "./fx.ts";
import { GESTURES, IDLE_SECONDS, WIND_UP, easeOutCubic, handoffOf, restPose } from "./motion.ts";
import type { GestureKind, Pose } from "./motion.ts";
import { TOP, cookModel, customerModel, itemKey, itemModel, meatColor, plateStack, stationModel, trayStock } from "./models.ts";
import { bubbleSprite, nameTag, progressBar, setBubble, showBar, spitBubble, tickSprite, warningSprite } from "./overlays.ts";
import type { Bar } from "./overlays.ts";
import { bakeStatic, contactShadow, geo } from "./parts.ts";
import { animateStreet, street } from "./street.ts";

const TILT = THREE.MathUtils.degToRad(54);

const ITEM_SCALE = 1.55;

const BUBBLE = 0.36;

/** How close two cooks' centres come before they count as bumping; the walk keeps them PERSONAL_SPACE (0.7) apart. */
const BUMP_DISTANCE = 0.76;

/** Seconds the view holds still when a dish is served, so the moment lands. */
const HIT_STOP = 0.04;

/** How far the camera jolts on a serve, in world units; it settles within a quarter second. */
const SERVE_SHAKE = 0.16;

/** Seconds an item takes between a cook's hand and a station. */
const TRANSIT_SECONDS = 0.12;

/** How high the hand-off arc lifts at its middle. */
const TRANSIT_ARC = 0.22;

/** Parts the scene moves; everything else in the kitchen and street is baked. */
const ANIMATED: ReadonlySet<string> = new Set(["slot", "stock", "knife", "lid", "cone", "lamp", "glow", "heat", "bird", "whisk", "water"]);

/** Veg colours for the bits that fly off the board. */
const BIT_COLOR = new Map<string, string>([["lettuce", "#6fc23f"], ["tomato", "#e8392b"], ["onion", "#c886b5"]]);

/** The animated pieces of a station model, looked up once. */
interface StationParts {
  readonly knife: THREE.Object3D;
  readonly whisk: THREE.Object3D;
  readonly lid: THREE.Object3D;
  readonly cone: THREE.Object3D;
  readonly lamp: THREE.MeshStandardMaterial | null;
  readonly glow: THREE.MeshStandardMaterial | null;
  readonly sides: readonly (THREE.MeshStandardMaterial | null)[];
  readonly heat: THREE.PointLight | null;
  readonly water: THREE.Object3D;
  /** Where the sink's water rests when nobody scrubs. */
  readonly waterRest: number;
}

function partsOf(group: THREE.Group): StationParts {
  const heat = group.getObjectByName("heat");
  const water = named(group, "water");

  return {
    knife: named(group, "knife"),
    whisk: named(group, "whisk"),
    lid: named(group, "lid"),
    cone: named(group, "cone"),
    lamp: standardOf(group, "lamp"),
    glow: standardOf(group, "glow"),
    sides: [0, 1, 2, 3].map((side) => standardOf(group, `side${side}`)),
    heat: heat instanceof THREE.PointLight ? heat : null,
    water,
    waterRest: water.position.y,
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
  /** Phase of the heater's done lamp, which blinks faster toward the burn. */
  blink: number;
  /** Items on their way here from a hand; the slot stays hidden until the last one lands. */
  incoming: number;
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
  /** The "DU" tag of a cook in a swap pair, shown while the player moves it; null otherwise. */
  readonly you: THREE.Sprite | null;
  key: string;
  yaw: number;
  lastX: number;
  lastY: number;
  stride: number;
  walking: boolean;
  squash: number;
  dust: number;
  blink: number;
  /** Items on their way here from a station; the hand stays empty until the last one lands. */
  incoming: number;
  /** The gesture playing over the walk and work, if any. */
  gesture: { kind: GestureKind; age: number } | null;
  /** Seconds since the cook last walked, worked or changed what it holds. */
  still: number;
  /** Fidgets played so far, to alternate between them. */
  fidgets: number;
  /** Close enough to another cook to have bumped this frame. */
  touching: boolean;
  /** The forward lean of walking, dashing and working, eased; gestures add to it. */
  lean: number;
}

/** An item on its short arc between a cook's hand and a station; the end it flies to hides its real item until it lands. */
interface Transit {
  readonly model: THREE.Object3D;
  readonly from: THREE.Vector3;
  readonly to: { readonly kind: "station"; readonly view: StationView } | { readonly kind: "hand"; readonly view: CookView };
  age: number;
}

interface CustomerView {
  readonly group: THREE.Group;
  readonly rig: THREE.Object3D;
  readonly arms: readonly THREE.Object3D[];
  target: THREE.Vector3;
  leaving: "no" | "happy" | "angry";
  age: number;
  /** Patience left, 1 when they just arrived; 1 while leaving. */
  patience: number;
  emitAcc: number;
}

/** How a waiting customer feels, by the patience left: calm, hands on hips, then stamping and fuming. */
function moodOf(patience: number): "calm" | "cross" | "fuming" {
  if (patience > 0.5) return "calm";

  return patience > 0.25 ? "cross" : "fuming";
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

/** Most stations the tutorial points at at once. */
const ARROWS = 4;

/** A fat yellow arrow with a dark rim that bobs over the station the tutorial wants next, with a glow on its slab. */
function tutorialArrow(): THREE.Group {
  const group = new THREE.Group();

  const tip = new THREE.Mesh(
    geo("arrow-tip", () => new THREE.ConeGeometry(0.3, 0.42, 4).rotateX(Math.PI).rotateY(Math.PI / 4)),
    new THREE.MeshBasicMaterial({ color: "#ffd23f", toneMapped: false }),
  );

  const shaft = new THREE.Mesh(
    geo("arrow-shaft", () => new THREE.BoxGeometry(0.2, 0.32, 0.2)),
    new THREE.MeshBasicMaterial({ color: "#ffd23f", toneMapped: false }),
  );

  shaft.position.y = 0.36;
  const rim = new THREE.MeshBasicMaterial({ color: "#2a1a10", side: THREE.BackSide });
  const tipRim = new THREE.Mesh(tip.geometry, rim);
  tipRim.scale.setScalar(1.22);
  const shaftRim = new THREE.Mesh(shaft.geometry, rim);
  shaftRim.scale.setScalar(1.3);
  shaftRim.position.y = shaft.position.y;
  const arrow = new THREE.Group();
  arrow.name = "arrow";
  arrow.add(tip, shaft, tipRim, shaftRim);
  arrow.renderOrder = 900;
  const glow = slabGlow("#ffd23f", false);
  glow.name = "glow";
  glow.visible = true;
  arrow.scale.setScalar(1.35);
  group.add(arrow, glow);
  group.visible = false;

  return group;
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

/** Sets up three.js on a canvas for one world, cook `i` dressed in `looks[i]`. */
export function createShopView(canvas: HTMLCanvasElement, world: World, looks: readonly Look[]): ShopView {
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
  // one light lends its flicker to the fire; it stays in the scene at zero so lighting shaders never recompile
  const fireLight = new THREE.PointLight("#ff7a2a", 0, 3.6, 1.6);
  scene.add(fireLight);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cameraHome = new THREE.Vector3();
  let freeze = 0;
  let shake = 0;
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
      key: "", pop: 9, tickAge: 9, done: false, shave: 0, emitAcc: 0, blink: 0, incoming: 0,
    });
  }

  scene.add(bakeStatic(still, ANIMATED));

  const arrows = Array.from({ length: ARROWS }, () => {
    const arrow = tutorialArrow();
    scene.add(arrow);

    return arrow;
  });

  const cooks: CookView[] = world.cooks.map((cook, i) => {
    const look = looks[i] ?? LOOKS[0];
    const color = look.body;
    const group = cookModel(look);
    group.scale.setScalar(1.22);
    const shadow = contactShadow(0.36, 0.5);
    group.add(shadow);
    const focus = slabGlow("#ffd23f", false);
    const focusBin = slabGlow("#ffd23f", true);
    const bubble = bubbleSprite();
    scene.add(group, focus, focusBin, bubble);

    const driver = world.drivers[i];

    if (driver?.kind === "bot") {
      const tag = nameTag(color, "BOT");
      tag.position.y = 1.62;
      group.add(tag);
    }

    const you = isPaired(world.drivers, i) ? nameTag(color, "DU") : null;

    if (you !== null) {
      you.position.y = 1.62;
      group.add(you);
    }

    return {
      group, focus, focusBin, bubble, you,
      rig: named(group, "rig"), held: named(group, "held"), eyes: named(group, "eyes"),
      hands: [named(group, "handL"), named(group, "handR")], feet: [named(group, "footL"), named(group, "footR")],
      key: "", yaw: 0, lastX: cook.x, lastY: cook.y, stride: 0, walking: false, squash: 9, dust: 0, blink: 2 + i, incoming: 0,
      gesture: null, still: 0, fidgets: 0, touching: false, lean: 0,
    };
  });

  const passes = stations.flatMap((v) => (v.station.type === "pass" ? [v] : []));
  const stationAt = new Map(stations.map((v) => [v.station.y * world.width + v.station.x, v]));
  const transits: Transit[] = [];
  const transitTo = new THREE.Vector3();
  const customers = new Map<number, CustomerView>();
  const seen = new WeakSet<object>();
  /** Each throw in the air; it waits in the thrower's hand through the wind-up, then catches up with its real flight. */
  const flights = new Map<Thrown, { readonly item: THREE.Group; readonly shadow: THREE.Mesh; readonly hand: THREE.Vector3; age: number }>();
  const pose: Pose = { lean: 0, tilt: 0, turn: 0, stretch: 0, lift: 0 };
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
      new THREE.Vector3(-0.1, 0, h + 0.2), new THREE.Vector3(w + 0.1, 0, h + 0.2),
      new THREE.Vector3(-0.1, 1, -1.2), new THREE.Vector3(w + 0.1, 1, -1.2),
      new THREE.Vector3(w / 2, 1.45, -2.55),
    ];

    const cx = w / 2;
    const cz = h / 2 - 0.3;
    let distance = 6;

    while (distance < 60 && !fits(cx, cz, distance, points)) distance += 0.2;
    cameraHome.copy(camera.position);
    const pass = passes[0];

    // the HUD flies a served customer's coins from here to the score
    if (pass !== undefined) {
      at.copy(pass.centre).project(camera);
      canvas.parentElement?.style.setProperty("--pass-x", `${((at.x + 1) / 2) * width}px`);
      canvas.parentElement?.style.setProperty("--pass-y", `${((1 - at.y) / 2) * height}px`);
    }
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
        view = {
          group, rig: named(group, "rig"), arms: [named(group, "armL"), named(group, "armR")], target: slotOf(i), leaving: "no", age: 0, patience: 1, emitAcc: 0,
        };
        customers.set(order.id, view);
      }

      view.target = slotOf(i);
      view.patience = order.ticksLeft / Math.max(1, order.patience);
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

      const cheering = view.leaving === "happy" && view.age < 0.9;
      const jump = cheering ? Math.abs(Math.sin(view.age * 10)) * 0.35 : 0;
      const mood = view.leaving === "no" ? moodOf(view.patience) : "calm";
      const bob = moving ? Math.abs(Math.sin(t * 12 + id)) * 0.06 : Math.sin(t * 2 + id) * 0.01;
      // a fuming customer stamps from foot to foot and steam puffs off their head
      const stamp = mood === "fuming" && !moving ? Math.abs(Math.sin(t * 9 + id)) * 0.07 : 0;
      view.rig.position.y = bob + jump + stamp;
      view.rig.rotation.z = mood === "fuming" ? Math.sin(t * 9 + id) * 0.09 : 0;
      view.arms.forEach((arm, side) => {
        const out = side === 0 ? -1 : 1;

        if (cheering) {
          arm.position.set(out * 0.27, 0.86, 0);
          arm.rotation.z = out * (0.3 + Math.sin(view.age * 20) * 0.15);
        } else {
          arm.position.set(out * 0.25, 0.55, 0);
          arm.rotation.z = out * (mood === "calm" ? 0.2 : 0.75);
        }
      });

      if (mood === "fuming") {
        view.emitAcc += dt * (view.patience < 0.12 ? 6 : 3);
        const n = Math.floor(view.emitAcc);
        view.emitAcc -= n;

        if (n > 0) fx.emit(view.patience < 0.12 ? "smoke" : "steam", at.set(pos.x, 1.45, pos.z), n);
      }

      const s = 1 + (moving ? Math.sin(t * 24 + id) * 0.04 : 0);
      view.rig.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

      if (view.leaving !== "no" && !moving) {
        scene.remove(view.group);
        customers.delete(id);
      }
    }
  }

  /** Ingredients in the air on an arc, tumbling end over end, with a shadow on the floor below; a puff where each flight ends. */
  function syncThrown(w: World, dt: number): void {
    for (const thrown of w.thrown) {
      let view = flights.get(thrown);

      if (view === undefined) {
        const item = new THREE.Group();
        item.add(itemModel(thrown.item));
        item.scale.setScalar(1.6);
        const thrower = cooks[w.cooks.findIndex((c) => c.id === thrown.by)];
        const hand = thrower === undefined ? new THREE.Vector3(thrown.x, 0.85, thrown.y) : thrower.held.getWorldPosition(new THREE.Vector3());
        view = { item, shadow: contactShadow(0.2, 0.35), hand, age: 0 };
        scene.add(view.item, view.shadow);
        flights.set(thrown, view);
      }

      view.age += dt;
      const p = thrown.flown / THROW_TICKS;
      const spin = thrown.flown * 0.45;
      view.item.position.set(thrown.x, 0.85 + Math.sin(Math.PI * p) * 0.8 - p * 0.5, thrown.y);
      view.item.position.lerpVectors(view.hand, view.item.position, easeOutCubic((view.age - WIND_UP) / 0.08));
      view.item.rotation.set(thrown.dir.dy * spin, spin * 0.3, -thrown.dir.dx * spin);
      view.shadow.position.set(thrown.x, 0.02, thrown.y);
    }

    for (const [thrown, view] of flights) {
      if (w.thrown.includes(thrown)) continue;
      scene.remove(view.item, view.shadow);
      flights.delete(thrown);
    }

    for (const entry of w.landings) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      puff(w, entry.landing);
    }
  }

  function puff(w: World, landing: Landing): void {
    const onStation = w.stations.has(Math.floor(landing.y) * w.width + Math.floor(landing.x));
    at.set(landing.x, onStation ? TOP + 0.15 : 0.1, landing.y);
    const color = landing.item.kind === "veg" ? BIT_COLOR.get(landing.item.veg) : "#e8c27a";

    if (landing.how === "caught") {
      at.y = 1.0;
      fx.emit("pop", at, 6);
    } else if (landing.how === "landed") {
      fx.emit("pop", at, 6);
      fx.emit("dust", at, 4);
    } else {
      fx.emit("dust", at, 12);
      fx.emit("bits", at, 10, color);
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

        if (!calm) {
          freeze = HIT_STOP;
          shake = SERVE_SHAKE;
        }
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
    // a dash leans the cook forward along the run; work leans it over the station, nodding with each stroke
    const lean = cook.dash > 0 ? 0.25 : cook.working ? 0.18 + chop : 0;
    view.lean += (lean - view.lean) * Math.min(1, dt * 20);
    view.still = walking || cook.working || cook.dash > 0 ? 0 : view.still + dt;

    if (view.still > IDLE_SECONDS && view.gesture === null) {
      view.gesture = { kind: view.fidgets % 2 === 0 ? "look" : "stretch", age: 0 };
      view.fidgets += 1;
      view.still = 0;
    }

    restPose(pose);

    if (view.gesture !== null) {
      const gesture = GESTURES[view.gesture.kind];
      view.gesture.age += dt;
      gesture.pose(view.gesture.age, pose);

      if (view.gesture.age >= gesture.seconds) view.gesture = null;
    }

    view.rig.rotation.set(view.lean + pose.lean, pose.turn, pose.tilt);
    // standing idle, the cook breathes
    const breath = walking || cook.working ? 0 : Math.sin(t * 2.4 + cookIndex) * 0.018;
    const k = bounce + squish - chop + breath + pose.stretch;
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
      const lift = carrying ? 0 : pose.lift * 0.4;
      hand.position.set(side === 0 ? -0.27 - lift * 0.2 : 0.27 + lift * 0.2, carrying ? 0.62 : 0.5 + swing + lift, carrying || cook.working ? 0.34 : 0.16 + walkSwing);
    });
    view.blink -= dt;

    if (view.blink < -0.12) view.blink = 2 + ((cookIndex * 1.7 + t) % 2.5);
    view.eyes.scale.y = view.blink < 0 ? 0.15 : 1;
    const key = itemKey(cook.held);
    const front = facingTile(cook);
    const station = w.stations.get(front.y * w.width + front.x);

    if (key !== view.key) {
      const target = stationAt.get(front.y * w.width + front.x);

      const move = handoffOf({
        heldBefore: view.key !== "",
        heldAfter: cook.held !== null,
        threw: w.thrown.some((t) => t.by === cook.id && !flights.has(t)),
        caught: w.landings.some((e) => !seen.has(e) && e.landing.how === "caught" && Math.hypot(e.landing.x - cook.x, e.landing.y - cook.y) < 1),
        facesStation: target !== undefined,
      });

      const old = view.held.children[0];
      view.still = 0;

      if (w.thrown.some((t) => t.by === cook.id && !flights.has(t))) view.gesture = { kind: "throw", age: 0 };

      if (move === "drop" && old !== undefined && target !== undefined) {
        launch(old, view.held.getWorldPosition(at), { kind: "station", view: target });
      }

      view.held.clear();

      if (cook.held !== null) view.held.add(itemModel(cook.held));

      if (move === "take" && cook.held !== null && target !== undefined) {
        launch(itemModel(cook.held), target.slot.getWorldPosition(at), { kind: "hand", view });
      }

      view.key = key;
      view.squash = 0;
      setBubble(view.bubble, cook.held, BUBBLE);
    }

    view.held.visible = view.incoming === 0;

    // facing away from the camera the body would hide the item, so the cook lifts it up
    const away = Math.max(0, -Math.cos(view.yaw));
    view.held.position.set(0, 0.66 + away * 0.42, 0.4 - away * 0.08);
    view.held.scale.setScalar(1.35 * popScale(view.squash));
    view.held.getWorldPosition(held);
    view.bubble.position.set(held.x, held.y + 0.42, held.z);
    const glow = 0.32 + Math.sin(t * 6) * 0.08;
    const driver = w.drivers[cookIndex];
    const active = view.you === null || (driver?.kind === "keys" && w.control[driver.binding] === cookIndex);

    if (view.you !== null) view.you.visible = active;
    // a parked cook of a swap pair shows no focus, so the one the player moves stands out
    view.focus.visible = active && station !== undefined && station.type !== "bin";
    view.focusBin.visible = active && station?.type === "bin";
    view.focus.position.set(front.x + 0.5, TOP - 0.06, front.y + 0.5);
    view.focusBin.position.set(front.x + 0.5, 0.8, front.y + 0.5);

    for (const m of [view.focus.material, view.focusBin.material]) {
      if (m instanceof THREE.MeshBasicMaterial) m.opacity = glow;
    }
  }

  /** Two cooks that come within touching distance while one of them moves both wobble, once per touch. */
  function syncBumps(w: World): void {
    for (let i = 0; i < cooks.length; i++) {
      const view = cooks[i];
      const a = w.cooks[i];

      if (view === undefined || a === undefined) continue;
      let touching = false;

      for (let j = 0; j < w.cooks.length; j++) {
        const b = w.cooks[j];

        if (j === i || b === undefined) continue;
        const moving = view.walking || cooks[j]?.walking === true || a.dash > 0 || b.dash > 0;

        if (moving && Math.hypot(a.x - b.x, a.y - b.y) < BUMP_DISTANCE) touching = true;
      }

      if (touching && !view.touching && view.gesture?.kind !== "throw") view.gesture = { kind: "bump", age: 0 };
      view.touching = touching;
    }
  }

  function launch(model: THREE.Object3D, from: THREE.Vector3, to: Transit["to"]): void {
    model.position.copy(from);
    scene.add(model);
    to.view.incoming += 1;
    transits.push({ model, from: from.clone(), to, age: 0 });
  }

  /** Moves every hand-off along its arc; a landing shows the real item with a squish. */
  function syncTransits(dt: number): void {
    for (let i = transits.length - 1; i >= 0; i--) {
      const transit = transits[i];

      if (transit === undefined) continue;
      transit.age += dt;
      const p = Math.min(1, transit.age / TRANSIT_SECONDS);
      const { to, model } = transit;

      if (to.kind === "station") to.view.slot.getWorldPosition(transitTo);
      else to.view.held.getWorldPosition(transitTo);
      model.position.lerpVectors(transit.from, transitTo, easeOutCubic(p));
      model.position.y += Math.sin(Math.PI * p) * TRANSIT_ARC;
      model.scale.setScalar(ITEM_SCALE * (1 + Math.sin(Math.PI * p) * 0.12));

      if (p < 1) continue;
      scene.remove(model);
      transits.splice(i, 1);
      to.view.incoming -= 1;
      fx.emit("pop", transitTo, 4);

      if (to.kind === "station") to.view.pop = 0;
      else to.view.squash = 0;
    }
  }

  function syncArrows(w: World, t: number): void {
    const targets = tutorialTargets(w);
    arrows.forEach((group, i) => {
      const target = targets[i];
      group.visible = target !== undefined;

      if (target === undefined) return;
      const lift = target.type === "spit" ? 2.1 : 1.15;
      group.position.set(target.x + 0.5, TOP, target.y + 0.5);
      const arrow = named(group, "arrow");
      arrow.position.y = lift + Math.abs(Math.sin(t * 4)) * 0.22;
      arrow.rotation.y = t * 1.5;
      const glow = named(group, "glow");
      glow.position.y = -0.06;

      if (glow instanceof THREE.Mesh && glow.material instanceof THREE.MeshBasicMaterial) glow.material.opacity = 0.3 + Math.sin(t * 6) * 0.15;
    });
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

    // hit-stop: the view holds its last pose; the world keeps ticking and the next frame catches up
    if (freeze > 0) {
      freeze -= raw;
      renderer.render(scene, camera);

      return;
    }

    const worked = new Set<number>();

    for (const cook of w.cooks) {
      if (!cook.working) continue;
      const front = facingTile(cook);
      worked.add(front.y * w.width + front.x);
    }

    syncBumps(w);

    // cooks first: a hand-off they start hides the station's new item before it is drawn
    for (let i = 0; i < w.cooks.length; i++) syncCook(w, i, dt, t);

    for (const view of stations) {
      syncStation(view, {
        camera, fx, t, dt, worked: worked.has(view.station.y * w.width + view.station.x),
      });
    }

    syncTransits(dt);
    syncThrown(w, dt);
    syncEvents(w);
    syncArrows(w, t);
    syncCustomers(w, dt, t);
    animateStreet(outside.birds, t);
    syncFireLight(t);
    shakeCamera(t, dt);
    fx.update(dt);
    renderer.render(scene, camera);
  }

  /** The fire light sits on the first burning station and flickers; slow machines go without it, like the spit's heat. */
  function syncFireLight(t: number): void {
    let burning: StationView | undefined;

    for (const view of stations) {
      if (view.station.fire > 0) {
        burning = view;
        break;
      }
    }

    if (burning === undefined || quality >= 2) {
      fireLight.intensity = 0;

      return;
    }

    fireLight.position.set(burning.centre.x, TOP + 0.6, burning.centre.z + 0.2);
    fireLight.intensity = 5 * (0.75 + Math.sin(t * 31) * 0.1 + Math.sin(t * 17.3) * 0.08 + Math.random() * 0.12);
  }

  function shakeCamera(t: number, dt: number): void {
    if (shake < 0.002) {
      camera.position.copy(cameraHome);

      return;
    }

    camera.position.set(cameraHome.x + Math.sin(t * 71) * shake, cameraHome.y + Math.sin(t * 53 + 1) * shake * 0.6, cameraHome.z + Math.sin(t * 61 + 2) * shake * 0.5);
    shake *= Math.exp(-dt * 16);
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

/** True when the station's work is done: chopped on the board, toasted or baked on the heat, kneaded in the mixer. */
function finished(station: Station): boolean {
  const item = station.item;

  if (station.type === "board") return item?.kind === "veg" && isChopped(item);

  if (station.type === "toaster") return item?.kind === "base" && item.toast >= HEAT[item.base].done;

  return station.type === "mixer" && item?.kind === "base";
}

/**
 * How each heater moves: the lid angle open and shut (the grill lid hinges at the back and lifts, the oven door
 * hinges at the bottom and folds down), and the height its steam leaves at, under the lid or through the roof.
 */
const HEATER_LOOK = {
  grill: { open: -1.15, shut: -0.1, vent: TOP + 0.3 },
  oven: { open: 1.35, shut: 0, vent: TOP + 0.6 },
} as const;

/** How high above the worktop a station's item bubble floats: over the oven and the mixer head, not inside them. */
function bubbleLift(station: Station): number {
  if (station.type === "mixer") return 0.95;

  if (station.type === "toaster") return station.look === "oven" ? 0.78 : 0.62;

  return 0.5;
}

function every(view: StationView, rate: number, dt: number): number {
  view.emitAcc += rate * dt;
  const n = Math.floor(view.emitAcc);
  view.emitAcc -= n;

  return n;
}

/** Rebuilds the plates and tray portions a station keeps when their count changes. */
function syncStock(view: StationView, frame: Frame): void {
  const { station, centre } = view;
  let key = "";

  if (station.type === "tray") key = `${station.veg}:${station.portions}`;
  else if (station.type === "rack" || station.type === "return") key = String(station.plates);
  else if (station.type === "sink") key = `${station.dirty}:${station.clean}`;

  if (key === view.stockKey) return;
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

/** How one kind of station moves while it works; true when it should warn that something is about to burn. */
type Working = (view: StationView, frame: Frame) => boolean;

/** The knife chops up and down, the veg flattens under each cut and bits fly off. */
function workBoard(view: StationView, frame: Frame): boolean {
  const { station, bar, centre, parts } = view;
  const item = station.item;
  const { knife } = parts;

  if (station.type !== "board" || item?.kind !== "veg" || isChopped(item)) {
    knife.position.set(0.14, TOP + 0.08, -0.2);
    knife.rotation.z = 0;

    return false;
  }

  if (item.chop > 0) showBar(bar, item.chop / CHOP_TICKS, "#5fd068");

  if (!frame.worked) {
    knife.position.set(0.14, TOP + 0.08, -0.2);
    knife.rotation.z = 0;

    return false;
  }

  const swing = Math.sin(frame.t * 22);
  // the blade comes down at the near edge of the veg, where the camera sees it
  knife.position.set(0.16, TOP + 0.12 + Math.abs(swing) * 0.3, 0.12);
  knife.rotation.z = swing * 0.35;
  const cut = (1 - Math.abs(swing)) ** 3;
  view.slot.scale.y *= 1 - cut * 0.22;
  view.slot.scale.x *= 1 + cut * 0.1;
  view.slot.scale.z *= 1 + cut * 0.1;
  const n = every(view, 14, frame.dt);

  if (n > 0) frame.fx.emit("bits", spot.set(centre.x, TOP + 0.15, centre.z), n, BIT_COLOR.get(item.veg));

  return false;
}

/** The whisk spins and wanders, the bowl rattles under it and flour dusts up. */
function workMixer(view: StationView, frame: Frame): boolean {
  const { station, bar, centre, parts } = view;
  const { whisk, lamp } = parts;
  const bowl = station.item?.kind === "bowl" ? station.item : null;
  const kneading = bowl !== null && bowl.knead > 0 && station.fire === 0;
  lamp?.emissive.set(kneading ? "#3cff4a" : "#000000");
  view.slot.rotation.z = kneading ? Math.sin(frame.t * 31) * 0.05 : 0;

  if (!kneading) return false;
  showBar(bar, bowl.knead / MIX_TICKS, "#5fd068");
  whisk.rotation.y += frame.dt * 18;
  whisk.position.x = Math.sin(frame.t * 9) * 0.03;
  const n = every(view, 6, frame.dt);

  if (n > 0) frame.fx.emit("dust", spot.set(centre.x + Math.sin(frame.t * 11) * 0.12, TOP + 0.3, centre.z + 0.05), n);

  return false;
}

/**
 * The grill sizzles under its lid and the oven window glows warmer as the bake goes on. Once done, the
 * lamp blinks, faster the closer the burn comes; burnt, it turns red and smokes.
 */
function workHeater(view: StationView, frame: Frame): boolean {
  const { station, bar, centre, parts } = view;

  if (station.type !== "toaster") return false;
  const { t, dt, fx } = frame;
  const item = station.item;
  const toast = item?.kind === "base" ? item.toast : 0;
  const { done, burnt } = HEAT[item?.kind === "base" ? item.base : "bread"];
  const { lid, lamp } = parts;
  const { open, shut, vent } = HEATER_LOOK[station.look];
  const oven = station.look === "oven";
  lid.rotation.x += ((item === null ? open : shut) - lid.rotation.x) * Math.min(1, dt * 12);

  if (toast > 0 && toast < done) {
    const p = toast / done;
    showBar(bar, p, "#5fd068");
    lamp?.emissive.set("#ff9a1a");

    if (lamp !== null) lamp.emissiveIntensity = oven ? 0.4 + p * 0.9 + Math.sin(t * 3) * 0.15 : 1;

    if (!oven) lid.rotation.x += Math.sin(t * 41) * 0.012;
    const n = every(view, 7, dt);

    if (n > 0) fx.emit("steam", spot.set(centre.x + Math.sin(t * 9) * 0.3, vent, centre.z + 0.1), n);

    return false;
  }

  if (toast >= done && toast < burnt) {
    const over = (toast - done) / (burnt - done);
    showBar(bar, over, "#e94f37");
    view.blink = (view.blink + dt * (2 + over * 9)) % 1;
    lamp?.emissive.set(view.blink < 0.5 ? "#3cff4a" : "#1a6020");

    if (lamp !== null) lamp.emissiveIntensity = oven ? 1.3 : 1;

    if (!oven) lid.rotation.x += Math.sin(t * 47) * 0.02 * over;
    const n = every(view, 4 + over * 10, dt);

    if (n > 0) fx.emit(over > 0.6 ? "smoke" : "steam", spot.set(centre.x + Math.sin(t * 7) * 0.3, vent, centre.z + 0.1), n);

    return true;
  }

  if (toast >= burnt) {
    lamp?.emissive.set("#ff1a1a");
    const n = every(view, 5, dt);

    if (n > 0) fx.emit("smoke", spot.set(centre.x, vent, centre.z), n);

    return false;
  }

  lamp?.emissive.set("#000000");

  return false;
}

/** The cone turns, its burners flicker and fat drips sizzling into the tray; shaving throws meat and sparks. */
function workSpit(view: StationView, frame: Frame): boolean {
  const { station, bar, centre, parts } = view;

  if (station.type !== "spit") return false;
  const { t, dt, fx } = frame;
  const { spit } = station;
  // the side facing the heat turns toward the heater at the back (-z)
  const { cone, sides, glow, heat } = parts;
  cone.rotation.y = Math.PI - spit.angle * (Math.PI / 2);
  sides.forEach((m, side) => m?.color.set(meatColor(spit.sides[side] ?? 0)));
  const flicker = 0.85 + Math.sin(t * 7) * 0.12 + Math.sin(t * 23) * 0.05;

  if (glow !== null) glow.emissiveIntensity = flicker;

  if (heat !== null) heat.intensity = 2.2 * flicker;
  view.bubble.position.set(centre.x, TOP + 1.55, centre.z + 0.1);
  spitBubble(view.bubble, spit.sides, BUBBLE * 1.3);
  const warn = Math.max(...spit.sides) >= BURNT - 0.2;

  if (spit.shave > 0) showBar(bar, spit.shave / SHAVE_TICKS, "#ffd166");

  // a finished portion: the shave counter falls back after being nearly full
  if (spit.shave === 0 && view.shave >= SHAVE_TICKS - 3) view.tickAge = 0;
  view.shave = spit.shave;

  if (frame.worked) {
    const n = every(view, 18, dt);

    if (n > 0) {
      spot.set(centre.x, TOP + 0.5 + Math.sin(t * 13) * 0.25, centre.z + 0.4);
      fx.emit("bits", spot, n, "#a95f2c");
      fx.emit("sparks", spot, 1);
    }

    return warn;
  }

  if (spit.sides.some((s) => s >= BURNT)) {
    const n = every(view, 4, dt);

    if (n > 0) fx.emit("smoke", spot.set(centre.x, TOP + 1.2, centre.z), n);

    return warn;
  }

  const n = every(view, spit.sides.some((s) => s >= COOKED) ? 5 : 2, dt);

  if (n > 0) {
    // drips run off the camera side of the cone, so they read in front of it
    spot.set(centre.x + Math.sin(t * 2.3) * 0.2, TOP + 0.3, centre.z + 0.42);
    fx.emit("drip", spot, n);
    spot.y = TOP + 0.06;
    fx.emit("sparks", spot, 1, "#ffb347");
  }

  return warn;
}

/** Water sloshes in the basin while a cook scrubs, with foam and splashes. */
function workSink(view: StationView, frame: Frame): boolean {
  const { station, bar, centre, parts } = view;
  const { water, waterRest } = parts;

  if (station.type !== "sink") return false;
  const { t, dt } = frame;
  const scrubbing = station.scrub > 0 && frame.worked;
  const slosh = scrubbing ? 1 : 0;
  water.rotation.z += (Math.sin(t * 9) * 0.07 * slosh - water.rotation.z) * Math.min(1, dt * 10);
  water.rotation.x += (Math.cos(t * 7) * 0.06 * slosh - water.rotation.x) * Math.min(1, dt * 10);
  water.position.y = waterRest + Math.sin(t * 14) * 0.012 * slosh;

  if (station.scrub > 0) showBar(bar, station.scrub / WASH_TICKS, "#5fb8f0");

  if (!scrubbing) return false;
  const n = every(view, 14, dt);

  if (n > 0) {
    spot.set(centre.x - 0.1, TOP + 0.1, centre.z);
    frame.fx.emit("foam", spot, Math.ceil(n / 2));
    frame.fx.emit("splash", spot, n);
  }

  return false;
}

/** Each station type that moves while it works, and how. */
const WORKING = new Map<Station["type"], Working>([
  ["board", workBoard],
  ["mixer", workMixer],
  ["toaster", workHeater],
  ["spit", workSpit],
  ["sink", workSink],
]);

function syncStation(view: StationView, frame: Frame): void {
  const { station, bar, centre } = view;
  const { fx, t, dt } = frame;
  const key = itemKey(station.item);

  if (key !== view.key) {
    view.slot.clear();

    if (station.item !== null) {
      view.slot.add(itemModel(station.item));

      if (view.incoming === 0) fx.emit("pop", spot.set(centre.x, TOP + 0.1, centre.z), 6);
    }

    view.key = key;
    view.pop = 0;
    view.bubble.position.set(centre.x, TOP + bubbleLift(station), centre.z);
    setBubble(view.bubble, station.item, BUBBLE);
  }

  syncStock(view, frame);
  view.slot.visible = view.incoming === 0;
  view.pop += dt;
  view.slot.scale.setScalar(ITEM_SCALE * popScale(view.pop));
  const done = finished(station);

  if (done && !view.done) view.tickAge = 0;
  view.done = done;
  bar.group.visible = false;
  bar.group.quaternion.copy(frame.camera.quaternion);
  let warn = WORKING.get(station.type)?.(view, frame) ?? false;

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
