/**
 * Which world the kitchen stands in. Each level picks a backdrop from a small table; the
 * kitchen itself (floor, rim, storefront) is the same everywhere and comes from `shopShell`.
 */
import type * as THREE from "three";
import type { LevelId } from "../levels.ts";
import type { World } from "../world.ts";
import { harbor } from "./harbor.ts";
import { street } from "./street.ts";

/** The world around one kitchen: what never moves, what does, and the colour of the haze. */
export interface Backdrop {
  /** Baked into a few meshes with the kitchen. */
  readonly still: THREE.Group;
  /** Added to the scene as is and moved by `animate`. */
  readonly live: THREE.Group;
  /** Background and fog: the far world fades into it. */
  readonly sky: string;
  readonly animate: (t: number) => void;
}

const BACKDROPS = { street, harbor } as const satisfies Record<string, (world: World) => Backdrop>;

/** A backdrop builder's name. */
export type Scenery = keyof typeof BACKDROPS;

/** Levels that do not stand on the street. */
const SCENERY: Partial<Record<LevelId, Scenery>> = { hafen: "harbor" };

function isScenery(name: string): name is Scenery {
  return Object.hasOwn(BACKDROPS, name);
}

/** The backdrop a level stands in; `override` (the `?scenery=` debug param) wins when it names one. */
export function sceneryOf(level: LevelId, override: string | null): Scenery {
  if (override !== null && isScenery(override)) return override;

  return SCENERY[level] ?? "street";
}

/** Builds a backdrop for a world. */
export function backdrop(world: World, scenery: Scenery): Backdrop {
  return BACKDROPS[scenery](world);
}
