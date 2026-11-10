/**
 * What makes the kitchen a döner shop and not just a kitchen: the backlit menu boards over the back wall, the
 * napkins, chili and tip jar on the ledge of the pass, and the drinks fridge by the door. All of it stands still, so
 * the scene bakes it into the kitchen.
 */
import * as THREE from "three";
import type { Recipe } from "../../../features/orders/public.ts";
import type { World } from "../world.ts";
import { ball, box, canvasTexture, cyl, drawIcon, hash, mat, rbox, steel } from "./parts.ts";

/** One lit tile of the menu board. */
interface Offer {
  readonly icon: string;
  readonly name: string;
  readonly price: string;
}

/** What every shop sells besides its dishes; they fill the board after the level's menu. */
const SIDES: readonly Offer[] = [
  { icon: "🍟", name: "Pommes", price: "3,50" },
  { icon: "🥛", name: "Ayran", price: "2,00" },
  { icon: "🥤", name: "Cola", price: "2,50" },
  { icon: "🍯", name: "Baklava", price: "3,00" },
];

/** Stations too tall to hang a board behind. */
const TALL = new Set(["spit", "toaster"]);

/** What a dish costs on the board: its points as euros, pastries a third of that. */
function priceOf(recipe: Recipe): string {
  const euros = recipe.base === "dough" ? recipe.points / 12 : recipe.points / 5 + 1.5;

  return (Math.round(euros * 2) / 2).toFixed(2).replace(".", ",");
}

/** A backlit photo tile: the dish, its name and a red price tag. */
function offerMap(offer: Offer): THREE.Texture {
  return canvasTexture(`offer|${offer.name}|${offer.price}`, 256, 216, (g) => {
    g.fillStyle = "#1c1410";
    g.fillRect(0, 0, 256, 216);
    const glow = g.createRadialGradient(128, 70, 10, 128, 80, 170);
    glow.addColorStop(0, "#fff6dc");
    glow.addColorStop(1, "#f3c56a");
    g.fillStyle = glow;
    g.beginPath();
    g.roundRect(8, 8, 240, 200, 14);
    g.fill();
    drawIcon(g, offer.icon, 128, 74, 118);
    g.fillStyle = "#3a1c10";
    g.font = "800 30px Rubik, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(offer.name, 128, 150, 228);
    g.fillStyle = "#d4362b";
    g.beginPath();
    g.roundRect(72, 170, 112, 30, 15);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "800 24px Rubik, sans-serif";
    g.fillText(`${offer.price} €`, 128, 186);
  });
}

/**
 * The menu boards: one lit tile over each column of the back wall, nearest the pass first, showing the level's
 * dishes and then the sides. `wallTop` is the height of the wall they stand on.
 */
export function menuBoards(world: World, wallTop: number): THREE.Group {
  const g = new THREE.Group();
  const row = [...world.stations.values()].filter((s) => s.y === 0);
  const passes = row.flatMap((s) => (s.type === "pass" ? [s.x] : []));
  const near = (x: number) => Math.min(...(passes.length > 0 ? passes : [world.width / 2]).map((p) => Math.abs(p - x)));
  const offers: readonly Offer[] = [...world.orders.menu.map((r) => ({ icon: r.icon, name: r.name, price: priceOf(r) })), ...SIDES];

  const columns = row
    .flatMap((s) => (s.type !== "pass" && !TALL.has(s.type) && s.x > 0 && s.x < world.width - 1 ? [s.x] : []))
    .sort((a, b) => near(a) - near(b) || a - b)
    .slice(0, offers.length)
    .sort((a, b) => a - b);

  columns.forEach((x, i) => {
    const offer = offers[i];

    if (offer === undefined) return;
    const board = new THREE.Group();
    board.add(box(0.98, 0.84, 0.07, mat("#2a1d18"), 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 0.78), new THREE.MeshBasicMaterial({ map: offerMap(offer), toneMapped: false }));
    face.position.z = 0.04;
    board.add(face);
    board.position.set(x + 0.5, wallTop + 0.42, -0.16);
    board.rotation.x = -0.6;
    g.add(board);
  });

  return g;
}

/** A steel napkin dispenser with a napkin sticking out. */
function napkins(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.2, 0.16, 0.13, 0.02, steel("#c9ced4"), 0.08));
  const napkin = box(0.13, 0.05, 0.015, mat("#fbf8f0"), 0.18);
  napkin.rotation.z = 0.15;
  g.add(napkin);

  return g;
}

/** A shaker of chili flakes. */
function shaker(): THREE.Group {
  const g = new THREE.Group();
  const jar = cyl(0.045, 0.05, 0.13, mat("#c8321f", "#000000", 0.3), 10);
  jar.position.y = 0.065;
  g.add(jar);
  const lid = cyl(0.048, 0.048, 0.03, steel("#d8dde2"), 10);
  lid.position.y = 0.145;
  g.add(lid);

  return g;
}

/** A glass tip jar with a few coins in it. */
function tipJar(): THREE.Group {
  const g = new THREE.Group();
  const glass = cyl(0.075, 0.065, 0.17, mat("#dff1f4", "#000000", 0.1), 12);
  glass.position.y = 0.085;
  g.add(glass);
  const coins = cyl(0.058, 0.058, 0.06, mat("#e8c547", "#3a2a00", 0.3), 12);
  coins.position.y = 0.04;
  g.add(coins);
  const slip = box(0.1, 0.07, 0.005, mat("#fbf8f0"), 0.1);
  slip.position.z = 0.072;
  g.add(slip);

  return g;
}

/** A stack of foil sheets for wrapping. */
function foil(): THREE.Mesh {
  return rbox(0.2, 0.05, 0.2, 0.01, steel("#e4e8ec"), 0.025);
}

/** The small things on the customers' ledge of each pass, at `ledge` height and `z` across the wall. */
export function ledgeClutter(world: World, ledge: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const passes = [...world.stations.values()].flatMap((s) => (s.type === "pass" ? [s.x] : [])).sort((a, b) => a - b);
  const first = passes[0];
  const last = passes.at(-1);

  if (first === undefined || last === undefined) return g;

  const spots: readonly (readonly [THREE.Object3D, number])[] = [
    [napkins(), first + 0.16], [shaker(), first + 0.36], [foil(), last + 0.62], [tipJar(), last + 0.86],
  ];

  for (const [thing, x] of spots) {
    thing.position.set(x, ledge, z);
    thing.rotation.y = (hash(x, 7) - 0.5) * 0.5;
    g.add(thing);
  }

  return g;
}

const CANS = ["#e94f37", "#f7f1e6", "#3f88c5", "#f6ae2d", "#44bba4", "#2b2b2b"];

/** A drinks fridge with a lit glass door: four shelves of cans and bottles under a red sign. Faces +z. */
export function drinksFridge(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.9, 1.85, 0.68, 0.04, mat("#d4362b", "#000000", 0.45), 0.925));
  const inside = box(0.76, 1.42, 0.02, mat("#f4fbff", "#cfe9ff", 0.4), 0.84);
  inside.position.z = 0.345;
  inside.castShadow = false;
  g.add(inside);

  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 0.2 + shelf * 0.35;
    const board = box(0.76, 0.02, 0.12, steel("#c3c8ce"), y);
    board.position.z = 0.4;
    g.add(board);

    for (let i = 0; i < 6; i++) {
      const tall = shelf === 3 ? 0.24 : 0.16;
      const can = cyl(shelf === 3 ? 0.04 : 0.05, 0.05, tall, mat(CANS[(i + shelf * 2) % CANS.length] ?? "#e94f37", "#000000", 0.3), 8);
      can.position.set(-0.3 + i * 0.12, y + 0.01 + tall / 2, 0.41);
      g.add(can);
    }
  }

  const glass = box(0.8, 1.46, 0.02, new THREE.MeshStandardMaterial({ color: "#cfe8f2", transparent: true, opacity: 0.22, roughness: 0.05 }), 0.84);
  glass.position.z = 0.47;
  glass.castShadow = false;
  g.add(glass);
  const handle = box(0.03, 0.5, 0.03, steel("#e4e8ec"), 0.9);
  handle.position.set(0.36, 0.9, 0.49);
  g.add(handle);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.2), new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTexture("fridge-sign", 256, 64, (c) => {
      c.fillStyle = "#fff6dc";
      c.fillRect(0, 0, 256, 64);
      c.fillStyle = "#d4362b";
      c.font = "900 38px Rubik, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("GETRÄNKE", 128, 34);
    }),
  }));

  sign.position.set(0, 1.7, 0.35);
  g.add(sign);
  const knob = ball(0.03, steel(), 6);
  knob.position.set(0.36, 1.2, 0.49);
  g.add(knob);
  g.position.set(x, 0, z);

  return g;
}
