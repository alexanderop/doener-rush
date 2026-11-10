/**
 * The track of a kitchen's sliding counters: two steel rails along each run, a striped plate on the tile at either
 * end, where the wall opens and closes, and a sign that flashes over the open end before the counters shove into it.
 */
import * as THREE from "three";
import { isSliding, openGaps } from "../slide.ts";
import type { World } from "../world.ts";
import { warningSprite } from "./overlays.ts";
import { box, canvasTexture, geo, steel } from "./parts.ts";

/** The rails of one kitchen; `sync` flashes the signs for where the world's counters are in their schedule. */
export interface Rails {
  readonly group: THREE.Group;
  readonly sync: (world: World, t: number) => void;
}

/** Yellow and black warning stripes for the floor of a gap. */
function stripes(): THREE.Texture {
  return canvasTexture("slide-stripes", 64, 64, (g) => {
    g.fillStyle = "#f2b420";
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#1c2230";
    g.lineWidth = 9;

    for (let i = -64; i < 128; i += 22) {
      g.beginPath();
      g.moveTo(i, 64);
      g.lineTo(i + 64, 0);
      g.stroke();
    }
  });
}

/** Builds the rails of a world, or null when its kitchen has no sliding counters. */
export function createRails(world: World): Rails | null {
  const { slides } = world;

  if (slides === null) return null;
  const group = new THREE.Group();
  const plate = new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.8 });
  const tile = geo("slide-plate", () => new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2));

  for (const run of slides.runs) {
    const { home, away } = run.gaps;
    const alongX = run.dir.dx !== 0;
    const length = run.stations.length + 1;

    for (const side of [-0.3, 0.3]) {
      const rail = box(alongX ? length : 0.05, 0.03, alongX ? 0.05 : length, steel("#8a929c"), 0.015);
      rail.position.set((home.x + away.x) / 2 + 0.5 + (alongX ? 0 : side), 0, (home.y + away.y) / 2 + 0.5 + (alongX ? side : 0));
      group.add(rail);
    }

    for (const gap of [home, away]) {
      const floor = new THREE.Mesh(tile, plate);
      floor.position.set(gap.x + 0.5, 0.012, gap.y + 0.5);
      floor.receiveShadow = true;
      group.add(floor);
    }
  }

  const signs = slides.runs.map(() => {
    const sign = warningSprite();
    group.add(sign);

    return sign;
  });

  const sync = (w: World, t: number) => {
    if (w.slides === null) return;
    const warn = isSliding(w.slides.state);
    openGaps(w.slides).forEach((gap, i) => {
      const sign = signs[i];

      if (sign === undefined) return;
      sign.position.set(gap.x + 0.5, 2.1, gap.y + 0.5);
      sign.visible = warn && Math.sin(t * 14) > -0.2;
      sign.scale.setScalar(0.5 + Math.abs(Math.sin(t * 7)) * 0.1);
    });
  };

  return { group, sync };
}
