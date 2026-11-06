# Döner Rush

Two-player co-op döner-shop cooking game. Read README.md for layout, controls and the test layers. Tooling and architecture are copied from `~/Projects/games/effect-factory`; when in doubt, follow how that project does it.

## Checks

- `pnpm check`: typecheck, oxlint fitness rules, Vitest, knip. Run it before calling anything done. `npx oxlint --fix` fixes the blank-line rule.
- `pnpm e2e`: Playwright + Gherkin features in `e2e/features/`.
- Prove a change in the running game: `pnpm dev`, open `/play?scenario=<name>`, drive it with `window.__game` through `agent-browser`, and look at a screenshot.

## Rules

- New feature directory: register it in `tools/oxlint/factory-architecture/policy.ts` first. Cross-feature imports go through `public.ts` (sim) or `client.ts` (UI).
- Simulation stays deterministic: randomness from `world.rng` via `game/core/rng.ts`, time in ticks.
- New starting state for a test or a bug: add a scenario to `src/game/runtime/testing/scenarios.ts`.
- Recipes, timings and the floor plan are data (`orders/prototypes.ts`, `kitchen/prototypes.ts`, `SHOP` in `runtime/world.ts`).
