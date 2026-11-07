/**
 * Billboards drawn over the kitchen so the state reads at a glance: ingredient bubbles over
 * every item, pill progress bars over stations, a green tick when work finishes and a
 * flashing warning when something is about to burn. All are sprites or camera-facing quads
 * that ignore depth, so walls and cooks never hide them.
 */
import * as THREE from "three";
import type { Item } from "../../../features/kitchen/public.ts";
import { BURNT, COOKED, ICONS, isBaked, isBurntBase, isChopped } from "../../../features/kitchen/public.ts";
import { canvasTexture, drawIcon, geo } from "./parts.ts";


const DISC = 72;

const PER_ROW = 3;

const spriteMaterials = new Map<string, THREE.SpriteMaterial>();

/** What a bubble shows: icons in white discs and the colour of their rims. */
interface BubbleContent {
  readonly icons: readonly string[];
  readonly rim: string;
}

const RIM = { plain: "#ffffff", done: "#5fd068", burnt: "#3a2418" } as const;

/** The bubble of an item: its base or ingredient first, then one disc per filling. */
function bubbleContent(item: Item): BubbleContent {
  switch (item.kind) {
    case "veg":
      return { icons: [ICONS[item.veg]], rim: isChopped(item) ? RIM.done : RIM.plain };
    case "meat":
      return { icons: [item.burnt ? "💀" : ICONS.meat], rim: item.burnt ? RIM.burnt : RIM.done };
    case "base": {
      const icons = [ICONS[item.base], ...item.fillings.map((f) => ICONS[f])];

      if (isBurntBase(item)) return { icons, rim: RIM.burnt };

      return { icons, rim: isBaked(item) ? RIM.done : RIM.plain };
    }

    case "plate": {
      if (item.dirty) return { icons: ["🍽️", "🧽"], rim: RIM.burnt };

      if (item.food === null) return { icons: ["🍽️"], rim: RIM.plain };
      const inner = bubbleContent(item.food);

      return { icons: ["🍽️", ...inner.icons], rim: inner.rim };
    }

    case "extinguisher":
      return { icons: ["🧯"], rim: RIM.plain };
  }
}

function spriteMaterial(key: string, map: THREE.Texture): THREE.SpriteMaterial {
  let m = spriteMaterials.get(key);

  if (m === undefined) {
    m = new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
    spriteMaterials.set(key, m);
  }

  return m;
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number, rim: string): void {
  g.fillStyle = "rgba(40,20,10,0.35)";
  g.beginPath();
  g.arc(x, y + 3, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = rim;
  g.stroke();
}

function bubbleTexture(content: BubbleContent): THREE.Texture {
  const rows = Math.ceil(content.icons.length / PER_ROW);

  return canvasTexture(`bubble|${content.icons.join("")}|${content.rim}`, PER_ROW * DISC, rows * DISC, (g) => {
    content.icons.forEach((icon, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, content.icons.length - row * PER_ROW);
      const col = i % PER_ROW;
      const x = (PER_ROW * DISC) / 2 + (col - (inRow - 1) / 2) * DISC;
      const y = row * DISC + DISC / 2;
      disc(g, x, y - 2, DISC / 2 - 6, content.rim);
      drawIcon(g, icon, x, y - 2, 50);
    });
  });
}

/** A sprite that shows an item's ingredient bubble; `setBubble` swaps its picture. */
export function bubbleSprite(): THREE.Sprite {
  const s = new THREE.Sprite();
  s.renderOrder = 20;
  s.visible = false;

  return s;
}

/** Points a bubble sprite at the picture for `item` (hidden for none). Size is world units per disc. */
export function setBubble(sprite: THREE.Sprite, item: Item | null, size: number): void {
  if (item === null) {
    sprite.visible = false;

    return;
  }

  const content = bubbleContent(item);
  const texture = bubbleTexture(content);
  sprite.material = spriteMaterial(texture.uuid, texture);
  const rows = Math.ceil(content.icons.length / PER_ROW);
  sprite.scale.set(PER_ROW * size, rows * size, 1);
  sprite.center.set(0.5, 0);
  sprite.visible = true;
}

/** The spit's state bubble: a meat disc above four dots, one per side, raw/cooked/burnt. */
export function spitBubble(sprite: THREE.Sprite, sides: readonly number[], size: number): void {
  const states = sides.map((level) => {
    if (level >= BURNT) return "b";

    return level >= COOKED ? "c" : "r";
  }).join("");

  const texture = canvasTexture(`spit-bubble|${states}`, 128, 128, (g) => {
    disc(g, 64, 46, 38, states.includes("c") ? RIM.done : RIM.plain);
    drawIcon(g, ICONS.meat, 64, 46, 54);
    const colour = new Map([["r", "#f2a7a0"], ["c", "#c26a2e"], ["b", "#2e1c14"]]);
    [...states].forEach((s, i) => {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(25 + i * 26, 108, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = colour.get(s) ?? "#f2a7a0";
      g.beginPath();
      g.arc(25 + i * 26, 108, 8, 0, Math.PI * 2);
      g.fill();
    });
  });

  sprite.material = spriteMaterial(texture.uuid, texture);
  sprite.scale.set(size, size, 1);
  sprite.center.set(0.5, 0);
  sprite.visible = true;
}

/** A sprite with a fixed picture: the green tick or the warning sign. */
function iconSprite(key: string, draw: (g: CanvasRenderingContext2D) => void): THREE.Sprite {
  const texture = canvasTexture(key, 128, 128, draw);
  const s = new THREE.Sprite(spriteMaterial(key, texture).clone());
  s.renderOrder = 22;
  s.visible = false;

  return s;
}

/** The green tick that pops over a station when its work is done. */
export function tickSprite(): THREE.Sprite {
  return iconSprite("tick", (g) => {
    g.fillStyle = "rgba(20,60,20,0.35)";
    g.beginPath();
    g.arc(64, 68, 54, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4cc35a";
    g.beginPath();
    g.arc(64, 62, 54, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = "#ffffff";
    g.stroke();
    g.lineWidth = 16;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(38, 64);
    g.lineTo(56, 82);
    g.lineTo(90, 44);
    g.stroke();
  });
}

/** The flashing "about to burn" sign. */
export function warningSprite(): THREE.Sprite {
  return iconSprite("warning", (g) => {
    g.lineJoin = "round";
    g.fillStyle = "#e5322b";
    g.strokeStyle = "#ffffff";
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(64, 10);
    g.lineTo(120, 112);
    g.lineTo(8, 112);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#ffffff";
    g.font = "900 72px Rubik, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("!", 64, 76);
  });
}

/** A short name tag in a cook's colour that floats over its head: "BOT" over a bot, "DU" over the cook a player moves now. */
export function nameTag(color: string, text: string): THREE.Sprite {
  const key = `name-tag|${color}|${text}`;

  const texture = canvasTexture(key, 160, 72, (g) => {
    g.fillStyle = "rgba(40,20,10,0.35)";
    g.beginPath();
    g.roundRect(6, 10, 148, 56, 28);
    g.fill();
    g.fillStyle = color;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(6, 6, 148, 54, 27);
    g.fill();
    g.stroke();
    g.fillStyle = "#ffffff";
    g.font = "900 38px Rubik, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 80, 35);
  });

  const s = new THREE.Sprite(spriteMaterial(key, texture));
  s.renderOrder = 19;
  s.scale.set(0.64, 0.29, 1);
  s.center.set(0.5, 0);

  return s;
}

/** A pill progress bar billboard. */
export interface Bar {
  readonly group: THREE.Group;
  readonly fill: THREE.Mesh;
  readonly fillMat: THREE.MeshBasicMaterial;
}

function pill(w: number, h: number): THREE.BufferGeometry {
  return geo(`pill|${w}|${h}`, () => {
    const r = h / 2;
    const p = new THREE.Shape();
    p.moveTo(-w / 2 + r, -r);
    p.lineTo(w / 2 - r, -r);
    p.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    p.lineTo(-w / 2 + r, r);
    p.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);

    return new THREE.ShapeGeometry(p, 10);
  });
}

const BAR_W = 0.62;

/** A rounded progress bar: white rim, dark track, coloured fill. Hidden until shown. */
export function progressBar(): Bar {
  const group = new THREE.Group();
  const flat = (color: string) => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false, transparent: true });
  const rim = new THREE.Mesh(pill(BAR_W + 0.1, 0.2), flat("#ffffff"));
  rim.renderOrder = 21;
  group.add(rim);
  const track = new THREE.Mesh(pill(BAR_W + 0.04, 0.14), flat("#3a2a20"));
  track.renderOrder = 22;
  group.add(track);
  const fillMat = flat("#5fd068");
  const fill = new THREE.Mesh(pill(BAR_W, 0.1), fillMat);
  fill.renderOrder = 23;
  group.add(fill);
  group.visible = false;

  return { group, fill, fillMat };
}

/** Shows a bar at a share from 0 to 1 in a colour. */
export function showBar(bar: Bar, share: number, color: string): void {
  const s = Math.max(0.02, Math.min(1, share));
  bar.group.visible = true;
  bar.fill.scale.x = s;
  bar.fill.position.x = -(BAR_W / 2) * (1 - s);
  bar.fillMat.color.set(color);
}
