/** Feature ownership. Add a feature here before creating its directory. */
export const featureDependencies: ReadonlyMap<string, readonly string[]> = new Map([
  ["kitchen", []],
  ["orders", ["kitchen"]],
  ["cooks", ["kitchen"]],
]);

/** Pure modules use these names; browser code belongs in ui/, draw.ts or state.ts. */
export const simulationModules = new Set([
  "public", "model", "prototypes", "simulation", "selectors", "snapshot", "commands",
]);

/** Every dependency must exist and the declared graph must remain acyclic. */
export function policyProblems(dependencies: ReadonlyMap<string, readonly string[]>): string[] {
  const problems: string[] = [];
  const finished = new Set<string>();
  const active = new Set<string>();

  function visit(feature: string, path: readonly string[]): void {
    if (active.has(feature)) {
      problems.push(`Feature dependency cycle: ${[...path, feature].join(" -> ")}`);
      return;
    }

    if (finished.has(feature)) return;
    active.add(feature);
    for (const dependency of dependencies.get(feature) ?? []) {
      if (!dependencies.has(dependency)) {
        problems.push(`${feature} depends on unregistered feature ${dependency}`);
      } else {
        visit(dependency, [...path, feature]);
      }
    }

    active.delete(feature);
    finished.add(feature);
  }

  for (const feature of dependencies.keys()) visit(feature, []);
  return problems;
}
