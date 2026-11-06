import type { Tile } from "../../../game/core/grid.ts";

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Shortest walk over free tiles (breadth-first) from `from` to the first tile where `goal`
 * holds, both ends included. Null when no goal tile can be reached.
 */
export function findPath(
  width: number,
  height: number,
  blocked: (x: number, y: number) => boolean,
  from: Tile,
  goal: (x: number, y: number) => boolean,
): Tile[] | null {
  const key = (x: number, y: number) => y * width + x;
  const prev = new Map<number, number>([[key(from.x, from.y), -1]]);
  const queue = [key(from.x, from.y)];

  for (let head = 0; head < queue.length; head++) {
    const k = queue[head] ?? 0;
    const x = k % width;
    const y = Math.floor(k / width);

    if (goal(x, y)) {
      const path: Tile[] = [];

      for (let c = k; c !== -1; c = prev.get(c) ?? -1) path.unshift({ x: c % width, y: Math.floor(c / width) });

      return path;
    }

    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      const n = key(nx, ny);

      if (nx >= 0 && ny >= 0 && nx < width && ny < height && !blocked(nx, ny) && !prev.has(n)) {
        prev.set(n, k);
        queue.push(n);
      }
    }
  }

  return null;
}

/** Walking distance in tiles from `from` to every reachable free tile, keyed `y * width + x`. */
export function stepsFrom(width: number, height: number, blocked: (x: number, y: number) => boolean, from: Tile): Map<number, number> {
  const steps = new Map<number, number>([[from.y * width + from.x, 0]]);
  const queue = [from];

  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head] ?? from;
    const d = steps.get(tile.y * width + tile.x) ?? 0;

    for (const [dx, dy] of STEPS) {
      const x = tile.x + dx;
      const y = tile.y + dy;

      if (x >= 0 && y >= 0 && x < width && y < height && !blocked(x, y) && !steps.has(y * width + x)) {
        steps.set(y * width + x, d + 1);
        queue.push({ x, y });
      }
    }
  }

  return steps;
}

/** True when two tiles share an edge: a cook on one can face and reach the other. */
export function isNextTo(a: Tile, b: Tile): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}
