/**
 * Birds that circle over the corners of every backdrop, beating their wings now and then.
 * View only; where a bird is follows from the view clock.
 */
import * as THREE from "three";
import { ball, box, hash, mat } from "./parts.ts";

/** A bird circles `centre` at `radius`; a negative `speed` turns the other way. */
interface Bird {
  readonly group: THREE.Group;
  readonly wings: readonly THREE.Object3D[];
  readonly centre: THREE.Vector3;
  readonly radius: number;
  readonly speed: number;
}

/** The birds over a backdrop; `animate` flies them. */
export interface Flock {
  readonly group: THREE.Group;
  readonly animate: (t: number) => void;
}

function birdModel(body: string, wing: string) {
  const g = new THREE.Group();
  const torso = ball(0.13, mat(body), 8);
  torso.scale.set(0.8, 0.7, 1.6);
  g.add(torso);
  const head = ball(0.08, mat(body), 8);
  head.position.set(0, 0.06, 0.2);
  g.add(head);

  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.08, 0.04, 0);
    const blade = box(0.5, 0.025, 0.18, mat(wing), 0);
    blade.position.x = side * 0.25;
    pivot.add(blade);
    g.add(pivot);

    return pivot;
  });

  return { group: g, wings };
}

/** Four birds, one circling each corner of a `width` by `height` kitchen, never over the cooking. */
export function flock(width: number, height: number, body: string, wing: string): Flock {
  const group = new THREE.Group();
  const corners = [[-5, -3], [width + 5, -2], [-4, height + 2], [width + 4, height + 3]] as const;

  const birds: Bird[] = corners.map(([x, z], i) => {
    const model = birdModel(body, wing);
    group.add(model.group);

    return { ...model, centre: new THREE.Vector3(x, 3.6 + i * 0.4, z), radius: 2 + hash(i, 2), speed: (i % 2 === 0 ? 1 : -1) * (0.45 + hash(i, 5) * 0.2) };
  });

  const animate = (t: number) => {
    birds.forEach((b, i) => {
      const a = t * b.speed + i * 1.7;
      b.group.position.set(b.centre.x + Math.cos(a) * b.radius, b.centre.y + Math.sin(a * 2) * 0.2, b.centre.z + Math.sin(a) * b.radius);
      b.group.rotation.y = (b.speed > 0 ? 0 : Math.PI) - a;
      b.group.rotation.z = b.speed > 0 ? 0.25 : -0.25;
      // a few beats, then a glide
      const flap = Math.sin(t * 2 + i) > 0.2 ? Math.sin(t * 14 + i) * 0.6 : 0.1;
      b.wings.forEach((wing, side) => {
        wing.rotation.z = side === 0 ? -flap : flap;
      });
    });
  };

  return { group, animate };
}
