# Döner Rush

A two-player couch co-op cooking game in the browser, set in a döner shop. Toast the bread, shave meat off the turning spit before a side burns, chop salad, add sauce and hand it over the pass before the customer leaves. A shift lasts three minutes.

Stack: TanStack Start (React 19) · Effect 4 + Effect Atom · Tailwind 4 + shadcn/ui · three.js. Same tooling as `effect-factory`.

```bash
pnpm dev          # http://localhost:3000/play
pnpm check        # typecheck + oxlint fitness rules + Vitest + knip
pnpm e2e          # Gherkin features with Playwright (starts pnpm dev itself)
pnpm storybook    # components in isolation; pnpm test:stories runs them as browser tests
```

## Controls

| | Walk | Dash | Pick up / put down / combine / serve | Hold: chop, shave, wash, spray |
| --- | --- | --- | --- | --- |
| Cook 1 | WASD | Space | E | Q |
| Cook 2 | Arrows | Right Shift | / | . |

## How a döner gets made

1. Bread from the crate onto the contact grill (4 s; burns at 14 s, catches fire at 20 s).
2. Shave meat off the spit. Only the side facing the heat cooks; a side left too long burns, then the spit catches fire.
3. Chop veg on a board, then stock the prep trays: each holds 3 portions of one vegetable. Holding a döner at a tray adds a portion.
4. Sauce from the bottles.
5. Put it on a clean plate from the rack and hand it over the pass. The plate comes back dirty to the return hatch 7 s later; wash it at the sink.
6. Fire spreads to the neighbouring stations every 6 s. Grab the extinguisher and hold work at the fire for 1.2 s.

## Layout

| Path | Role |
| --- | --- |
| `src/game/core/` | Tick rate, directions, seeded random numbers. No dependencies |
| `src/features/kitchen/` | Items (veg, meat, the döner being built, plates, the extinguisher) and stations: crates, board, toaster, spit, sauces, prep trays, plate rack, return hatch, sink, counters, bin. `interact`, `work`, `stepStation`, fire and `spreadFire` |
| `src/features/orders/` | The menu, the customer queue with patience, serving with points and tips, the ticket rail UI |
| `src/features/cooks/` | Walking and dashing with collision against stations and each other, the tile in front |
| `src/game/runtime/world.ts` | The shop floor plan (ASCII) and the `World` |
| `src/game/runtime/step.ts` | One tick in fixed order: cooks, stations, orders. HUD snapshot |
| `src/game/runtime/useGameCanvas.ts` | Keyboard, fixed 60 Hz loop, 3D render, snapshot to `snapshotAtom`, dev `window.__game` |
| `src/game/runtime/gl/` | The 3D view (three.js): low-poly models built from primitives in `models.ts`, camera, lights, storefront and sync from the world in `scene.ts` |
| `src/game/runtime/testing/` | Scenarios (`?scenario=` in the browser, Vitest, e2e) and a breadth-first walking driver for scripted cooks |
| `src/app/` | HUD (top bar, toasts, end-of-shift card) and pages |

Feature boundaries are enforced by the `factory-architecture` oxlint plugin; the dependency graph is in `tools/oxlint/factory-architecture/policy.ts` (`orders → kitchen`, `cooks → kitchen`). Simulation modules are plain TypeScript: no Effect, React, DOM, `Math.random` or `Date`.

## Testing

| Layer | Where | What it proves |
| --- | --- | --- |
| Examples | `src/**/*.test.ts` | Chop, toast, burn, spit cooking and shaving, sauce, serve rules, walking and collision, a scripted cook making a Döner Pur from scratch |
| Properties | `src/game/runtime/step.test.ts` | Random two-player input never puts a cook inside a station, and replays the same round |
| Browser | `pnpm e2e` | Real keyboard input and HUD: walking, dashing, serving at the pass, putting out a fire, the end-of-shift card. Runs one worker: headless WebGL renders on the CPU |
| Lint rules | `tools/oxlint/**/*.test.ts` | The architecture and coding standard rules themselves |

### Driving the game as an agent

1. `pnpm dev`, then open `http://localhost:3000/play?scenario=<name>&seed=<n>` (scenarios: `shift`, `ready-classic`, `burning-spit`, `kitchen-fire`, `dirty-dishes`, `prep-line`, `last-seconds`).
2. In the console or with `agent-browser eval`: `__game.step(ticks, [intent1, intent2])` runs ticks with intents `{ dx, dy, interact, work, dash }`, `__game.snapshot()` returns what the HUD shows, `__game.world()` the live state.
