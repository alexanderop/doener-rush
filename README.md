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

| | Walk | Dash | Pick up / put down / combine / serve | Throw | Hold: chop, shave, wash, spray |
| --- | --- | --- | --- | --- | --- |
| Cook 1 | WASD | Space | E | F | Q |
| Cook 2 | Arrows | Right Shift | / | ' | . |

Throw sends a vegetable (whole or chopped) or fresh bread straight ahead, up to six tiles. A cook with empty hands catches it; a station that would take it put down keeps it (a counter, board, toaster, tray, the bin, or a döner waiting on a counter); anything else drops it and it is lost. Plates, döner, meat and the extinguisher stay in hand. The rule is the `THROWABLE` table in `kitchen/prototypes.ts`.

Playing alone, tick "Zwei Köche steuern" on the home page (or open `/play?humans=1&swap=1`): you drive two cooks and switch with R (Enter for player 2's keys). A cook you leave while holding Q at the board, the sink or a fire keeps working until it is done. A solo shift runs at a calmer pace: customers come further apart, wait longer, and the stars need fewer points (`PACES` in `orders/prototypes.ts`, picked by how many cooks act at once).

The home page also sets the house rules: presets Leicht, Normal and Schwer, or each one on its own under "Einstellungen anpassen": food burns, fire, washing up, customer patience, how many customers come, and the shift length (2–5 minutes). In the URL: `burn`, `fire`, `dishes` (0/1), `patience`, `rush` (0–2), `minutes` (2–5); the rules live in `src/game/runtime/rules.ts`.

Empty cook slots are bots. Pick one or two players on the keyboard and up to four cooks on the home page, or open `/play?humans=1&bots=2` (`humans` 0–2, `bots` fill the rest up to four). A bot cook wears a "BOT" tag.

## How a döner gets made

1. Bread from the crate onto the contact grill (4 s; burns at 14 s, catches fire at 20 s).
2. Shave meat off the spit. Only the side facing the heat cooks; a side left too long burns, then the spit catches fire.
3. Chop veg on a board, then stock the prep trays: each holds 3 portions of one vegetable. Holding a döner at a tray adds a portion.
4. Sauce from the bottles.
5. Put it on a clean plate from the rack and hand it over the pass. The plate comes back dirty to the return hatch 7 s later; wash it at the sink.
6. Fire spreads to the neighbouring stations every 6 s. Grab the extinguisher and hold work at the fire for 1.2 s.

## Tutorial

`/tutorial` (or "Tutorial" on the home page) walks one player through the whole kitchen in 22 steps: walking, dashing, chopping, trays, toasting, plates, the spit, sauce, serving, washing up and fire. A card names the step, the keys and why it works that way; a yellow arrow points at the station to use. The kitchen is calm: nothing burns, the customer waits forever, fire does not spread.

The lessons are a table in `src/game/runtime/tutorial/lessons.ts`. Each one checks the world to decide it is done, so any order of actions works. Losing the döner on the way goes back to the bread step.

## Layout

| Path | Role |
| --- | --- |
| `src/game/core/` | Tick rate, directions, seeded random numbers. No dependencies |
| `src/features/kitchen/` | Items (veg, meat, the döner being built, plates, the extinguisher) and stations: crates, board, toaster, spit, sauces, prep trays, plate rack, return hatch, sink, counters, bin. `interact`, `work`, `stepStation`, fire and `spreadFire` |
| `src/features/orders/` | The menu, the customer queue with patience, serving with points and tips, the ticket rail UI |
| `src/features/cooks/` | Walking and dashing with collision against stations and each other, the tile in front |
| `src/features/bots/` | AI cooks for empty slots. `decide` is a priority table (fire, spit, döner, plates, veg, washing up) asked every tick from a read-only `Sight`; `think` walks the bot there (breadth-first path, dash, stepping aside) and turns the plan into an `Intent` |
| `src/game/runtime/lineup.ts` | The `Lineup`: one `Driver` per cook, a keyboard binding or a bot |
| `src/game/runtime/world.ts` | The shop floor plan (ASCII) and the `World` |
| `src/game/runtime/step.ts` | One tick in fixed order: cooks, stations, orders. HUD snapshot |
| `src/game/runtime/useGameCanvas.ts` | Keyboard, fixed 60 Hz loop, 3D render, snapshot to `snapshotAtom`, dev `window.__game` |
| `src/game/runtime/gl/` | The 3D view (three.js): low-poly models built from primitives in `models.ts`, camera, lights, storefront and sync from the world in `scene.ts` |
| `src/game/runtime/tutorial/` | The tutorial: lesson table, calm-kitchen rules, the view the HUD card and 3D arrow read |
| `src/game/runtime/testing/` | Scenarios (`?scenario=` in the browser, Vitest, e2e) and a breadth-first walking driver for scripted cooks |
| `src/app/` | HUD (top bar, toasts, end-of-shift card) and pages |

Feature boundaries are enforced by the `factory-architecture` oxlint plugin; the dependency graph is in `tools/oxlint/factory-architecture/policy.ts` (`orders → kitchen`, `cooks → kitchen`, `bots → kitchen, cooks, orders`). Simulation modules are plain TypeScript: no Effect, React, DOM, `Math.random` or `Date`.

## Testing

| Layer | Where | What it proves |
| --- | --- | --- |
| Examples | `src/**/*.test.ts` | Chop, toast, burn, spit cooking and shaving, sauce, serve rules, walking and collision, a scripted cook making a Döner Pur from scratch, bots running whole shifts (`runtime/bots.test.ts`) |
| Properties | `src/game/runtime/step.test.ts` | Random two-player input never puts a cook inside a station, and replays the same round |
| Browser | `pnpm e2e` | Real keyboard input and HUD: walking, dashing, serving at the pass, putting out a fire, the end-of-shift card. Runs one worker: headless WebGL renders on the CPU |
| Lint rules | `tools/oxlint/**/*.test.ts` | The architecture and coding standard rules themselves |

### Driving the game as an agent

1. `pnpm dev`, then open `http://localhost:3000/play?scenario=<name>&seed=<n>` (scenarios: `shift`, `ready-classic`, `burning-spit`, `kitchen-fire`, `dirty-dishes`, `prep-line`, `catch`, `last-seconds`).
2. In the console or with `agent-browser eval`: `__game.step(ticks, [intent1, intent2])` runs ticks with intents `{ dx, dy, interact, work, dash, throw }`, `__game.snapshot()` returns what the HUD shows, `__game.world()` the live state.
