/**
 * The canal of a harbour kitchen: rippling water on every water and bridge tile, a stone lip where it meets the
 * floor, and a plank deck on each bridge tile. The decks follow the world's bridge schedule: they wobble under a
 * flashing sign before they sink, slide under the water, bubble before they come back, and rise out of it.
 */
import * as THREE from "three";
import { seconds } from "../../core/grid.ts";
import { BRIDGE_WARNING, isClosing, isOpening } from "../bridge.ts";
import type { Bridges } from "../bridge.ts";
import type { World } from "../world.ts";
import { isBridge } from "../world.ts";
import type { Fx } from "./fx.ts";
import { warningSprite } from "./overlays.ts";
import { box, canvasTexture, geo, mapped, mat, woodMap } from "./parts.ts";

/** Ticks a deck takes to slide under the water or come back up. */
const MOVE_TICKS = seconds(0.5);

/** How far under its resting height a sunk deck lies. */
const SUNK = 0.16;

/** Height of the water surface: just over the floor plane. */
const SURFACE = 0.014;

/** The canal of one kitchen; `sync` moves the decks to where the world's bridges are. */
export interface Canal {
  readonly group: THREE.Group;
  readonly sync: (world: World, t: number, fx: Fx) => void;
}

interface Deck {
  readonly group: THREE.Group;
  readonly x: number;
  readonly y: number;
  /** True when the bridge is walked across in x, so the deck rocks about the x axis. */
  readonly alongX: boolean;
}

/** Soft wave lines on blue, tiling seamlessly, scrolled by the scene so the water flows. */
function waterMap(): THREE.Texture {
  const texture = canvasTexture("canal-water", 128, 128, (g) => {
    g.fillStyle = "#2f7fb4";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(190,230,255,0.55)";
    g.lineWidth = 4;
    g.lineCap = "round";

    for (let row = 0; row < 4; row++) {
      const y = 16 + row * 32;
      g.beginPath();

      for (let x = 0; x <= 128; x += 8) {
        const wave = Math.sin((x / 128) * Math.PI * 2 + row * 1.7) * 4;

        if (x === 0) g.moveTo(x, y + wave);
        else g.lineTo(x, y + wave);
      }

      g.stroke();
    }
  });

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

/** True on a tile water covers: open water, or under a bridge. */
function wet(world: World, x: number, y: number): boolean {
  return world.water.has(y * world.width + x) || isBridge(world, x, y);
}

/** A wooden footbridge on one tile: planks across the way, a beam along each side. */
function deck(alongX: boolean): THREE.Group {
  const g = new THREE.Group();
  const wood = woodMap();
  const run = new THREE.Group();
  run.rotation.y = alongX ? 0 : Math.PI / 2;
  g.add(run);

  for (let i = 0; i < 4; i++) {
    const plank = box(0.22, 0.06, 0.86, mapped(i % 2 === 0 ? "#a5713f" : "#97653a", wood), 0);
    plank.position.x = -0.37 + i * 0.245;
    plank.castShadow = true;
    plank.receiveShadow = true;
    run.add(plank);
  }

  for (const z of [-0.46, 0.46]) {
    const beam = box(1, 0.1, 0.07, mat("#6b4524"), 0);
    beam.position.z = z;
    run.add(beam);
  }

  return g;
}

/** How a deck sits: `drop` under its resting height, `rock` radians of sway. */
interface DeckPose {
  readonly drop: number;
  readonly rock: number;
}

/** Where a deck rests, sinks and rises for the bridges' state. */
function deckPose(bridges: Bridges, t: number): DeckPose {
  const { state, schedule } = bridges;

  if (state.state === "held") return { drop: 0, rock: Math.sin(t * 18) * 0.05 };

  if (state.state === "up") {
    const shake = state.left <= BRIDGE_WARNING ? 1 - state.left / BRIDGE_WARNING : 0;

    return { drop: 0, rock: Math.sin(t * 18) * 0.05 * shake };
  }

  const sinking = Math.min(1, (schedule.down - state.left) / MOVE_TICKS);
  const rising = Math.min(1, state.left / MOVE_TICKS);
  const under = Math.min(sinking, rising);

  return { drop: SUNK * under, rock: Math.sin(under * Math.PI) * 0.12 };
}

/** Builds the canal of a world, or null when its kitchen has no water. */
export function createCanal(world: World): Canal | null {
  const tiles: { x: number; y: number }[] = [];

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) if (wet(world, x, y)) tiles.push({ x, y });
  }

  if (tiles.length === 0) return null;
  const group = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ map: waterMap(), color: "#ffffff", roughness: 0.25, metalness: 0.05, emissive: "#0b2a44" });
  const plane = geo("canal-tile", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const stone = mat("#b9b2a6", "#000000", 0.9);

  for (const { x, y } of tiles) {
    const surface = new THREE.Mesh(plane, water);
    surface.position.set(x + 0.5, SURFACE, y + 0.5);
    surface.receiveShadow = true;
    group.add(surface);

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;

      if (wet(world, nx, ny) || world.stations.has(ny * world.width + nx) || nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      const lip = box(dx === 0 ? 1 : 0.08, 0.05, dx === 0 ? 0.08 : 1, stone, 0.025);
      lip.position.set(x + 0.5 + dx * 0.48, 0, y + 0.5 + dy * 0.48);
      group.add(lip);
    }
  }

  const decks: Deck[] = tiles.flatMap(({ x, y }) => {
    if (!isBridge(world, x, y)) return [];
    const alongX = !wet(world, x - 1, y) || !wet(world, x + 1, y) || isBridge(world, x - 1, y) || isBridge(world, x + 1, y);
    const g = deck(alongX);
    g.position.set(x + 0.5, 0, y + 0.5);
    group.add(g);

    return [{ group: g, x, y, alongX }];
  });

  // one sign over each bridge: over the first deck of a run, nudged to the middle of the run
  const signs = decks.flatMap((d) => {
    if (isBridge(world, d.alongX ? d.x - 1 : d.x, d.alongX ? d.y : d.y - 1)) return [];
    let length = 1;

    while (isBridge(world, d.alongX ? d.x + length : d.x, d.alongX ? d.y : d.y + length)) length += 1;
    const sign = warningSprite();
    sign.position.set(d.x + 0.5 + (d.alongX ? (length - 1) / 2 : 0), 0.9, d.y + 0.5 + (d.alongX ? 0 : (length - 1) / 2));
    group.add(sign);

    return [sign];
  });

  const spot = new THREE.Vector3();
  let wasUp = true;
  let lastFoam = 0;

  const sync = (w: World, t: number, fx: Fx) => {
    const map = water.map;

    if (map !== null) map.offset.set(t * 0.06, t * 0.025);
    const bridges = w.bridges;

    if (bridges === null) return;
    const pose = deckPose(bridges, t);

    for (const d of decks) {
      d.group.position.y = -pose.drop;

      if (d.alongX) d.group.rotation.x = pose.rock;
      else d.group.rotation.z = pose.rock;
    }

    const warn = isClosing(bridges.state) || isOpening(bridges.state);

    for (const sign of signs) {
      sign.visible = warn && Math.sin(t * 14) > -0.2;
      sign.scale.setScalar(0.42 + Math.abs(Math.sin(t * 7)) * 0.08);
    }

    const up = bridges.state.state !== "down";

    if (up !== wasUp) {
      for (const d of decks) fx.emit("splash", spot.set(d.x + 0.5, 0.1, d.y + 0.5), 10);
    }

    wasUp = up;

    if (isOpening(bridges.state) && t - lastFoam > 0.12) {
      lastFoam = t;

      for (const d of decks) fx.emit("foam", spot.set(d.x + 0.5 + Math.sin(t * 9 + d.x) * 0.3, 0.05, d.y + 0.5 + Math.cos(t * 7 + d.y) * 0.3), 1);
    }
  };

  return { group, sync };
}
