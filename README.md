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
| Gamepad | Left stick or d-pad | B | A | LB | X |

Throw sends a vegetable (whole or chopped) or fresh bread straight ahead, up to six tiles. A cook with empty hands catches it; a station that would take it put down keeps it (a counter, board, toaster, tray, the bin, or a döner waiting on a counter); anything else drops it and it is lost. Plates, döner, meat and the extinguisher stay in hand. The rule is the `THROWABLE` table in `kitchen/prototypes.ts`.

Gamepads work next to the keyboard: the first pad plugged in plays player 1's binding, the second player 2's, and either the keys or the pad moves that cook. Y or RB switches cooks in a swap pair (like R). Browsers only report a pad after one of its buttons is pressed; once they do, the pill under the kitchen shows pad buttons instead of keys. The button table is `PAD_BUTTONS` in `src/game/runtime/input/gamepad.ts`; the loop polls `navigator.getGamepads()` once a frame.

A shift opens with the recipe card, then counts "3, 2, 1, LOS!" before the kitchen moves; any key skips the card. M (or the speaker button) turns the sound off, and the choice is remembered.

Playing alone, tick "Zwei Köche steuern" on the home page (or open `/play?humans=1&swap=1`): you drive two cooks and switch with R (Enter for player 2's keys). A cook you leave while holding Q at the board, the sink or a fire keeps working until it is done. A solo shift runs at a calmer pace: customers come further apart, wait longer, and the stars need fewer points (`PACES` in `orders/prototypes.ts`, picked by how many cooks act at once).

The home page also sets the house rules: presets Leicht, Normal and Schwer, or each one on its own under "Einstellungen anpassen": food burns, fire, washing up, customer patience, how many customers come, and the shift length (2–5 minutes). In the URL: `burn`, `fire`, `dishes` (0/1), `patience`, `rush` (0–2), `minutes` (2–5); the rules live in `src/game/runtime/rules.ts`.

Empty cook slots are bots. Pick one or two players on the keyboard and up to four cooks on the home page, or open `/play?humans=1&bots=2` (`humans` 0–2, `bots` fill the rest up to four). A bot cook wears a "BOT" tag.

Each player picks a chef look on the home page with the arrows beside the picture: eight chefs, each with a colour, something on the head (toque, cap, bandana, beanie, paper hat, ponytail, bun) and maybe a moustache or glasses. Bots and the second cook of a swap pair take the next free looks in table order, so no two cooks look alike. The picks are remembered in `localStorage` (`doener-rush/looks/v1`) and go into the link as `look1` and `look2` (a look id such as `mehmet` or `jule`). The table is `LOOKS` in `src/game/runtime/looks.ts`; each headwear and accessory is a small builder in the `HEADWEAR` and `ACCESSORIES` tables of `gl/models.ts`.

## Levels and the save

The home page picks one of six kitchens. Each one opens once the kitchen before it has at least one star; the first is always open.

| # | Level | Id | What is new |
| --- | --- | --- | --- |
| 1 | Erster Tag | `erster-tag` | Small kitchen, only Döner Pur and Classic, calm customers |
| 2 | Der Imbiss | `imbiss` | The original shop with the whole menu |
| 3 | Durchreiche | `durchreiche` | A counter wall splits the kitchen: hand the döner across, the way around is long |
| 4 | Der Schlauch | `schlauch` | Long and narrow: the spit at the far end, the pass at the other |
| 5 | Großküche | `grosskueche` | Big kitchen, two grills, customers come faster |
| 6 | Backstube | `backstube` | The bakery: knead dough in the mixer, top it, bake it in two ovens. Franzbrötchen, Mohnbrötchen and Brezel |

The levels are data in `src/game/runtime/levels.ts`: the floor plan (its legend is the comment on `Level`; the bakery adds `M` flour and `Y` butter crates, `Q` mixer, `E` oven, and the toppings `z` cinnamon sugar, `m` poppy, `l` lye and salt), the menu customers order from, and a pace on top of the crew's (customer gaps, patience, star scores). `levels.test.ts` proves every plan is playable (four start tiles, every station its menu needs, all reachable) and that two bots score in a full shift on each.

In the URL: `/play?level=<id>`; without it a shift plays Der Imbiss, so old links keep working. `?scenario=` always uses Der Imbiss and is never saved.

The best score and stars per level live in `localStorage` under `doener-rush/progress/v1` (`src/game/persistence/progress.ts`, parsed with Effect Schema; a broken or blocked save is an empty one). The end card says "Neuer Rekord!" when a shift beats the best and offers "Nächstes Level". Every kitchen can be played from the start. Clear site data to reset the records.

## How a döner gets made

1. Bread from the crate onto the contact grill (4 s; burns at 14 s, catches fire at 20 s).
2. Shave meat off the spit. Only the side facing the heat cooks; a side left too long burns, then the spit catches fire.
3. Chop veg on a board, then stock the prep trays: each holds 3 portions of one vegetable. Holding a döner at a tray adds a portion.
4. Sauce from the bottles.
5. Put it on a clean plate from the rack and hand it over the pass. The plate comes back dirty to the return hatch 7 s later; wash it at the sink.
6. Fire spreads to the neighbouring stations every 6 s. Grab the extinguisher and hold work at the fire for 1.2 s.

## How a pastry gets made

The Backstube bakes instead of building döner. The steps are the same moves on new stations.

1. Empty hands at the flour or butter crate take a bowl with that good in it; the bowl at the other crate gets the second.
2. A full bowl goes into the mixer, which kneads it on its own for 5 s. The bowl turns into raw dough.
3. The topping decides the pastry: cinnamon sugar makes a Franzbrötchen, poppy a Mohnbrötchen, lye and salt a Brezel. Dough takes one topping, and only while it is raw.
4. Into the oven (8 s; burns at 20 s, catches fire at 26 s), then onto a clean plate and over the pass.

Every base has one row in `HEAT` (`kitchen/prototypes.ts`): when it is done, burnt and on fire, and whether it may be sold before it is done. `FAMILY` keeps döner fillings out of dough and toppings out of bread.

## Tutorial

`/tutorial` (or "Tutorial" on the home page) walks one player through the whole kitchen in 22 steps: walking, dashing, chopping, trays, toasting, plates, the spit, sauce, serving, washing up and fire. A card names the step, the keys and why it works that way; a yellow arrow points at the station to use. The kitchen is calm: nothing burns, the customer waits forever, fire does not spread.

The lessons are a table in `src/game/runtime/tutorial/lessons.ts`. Each one checks the world to decide it is done, so any order of actions works. Losing the döner on the way goes back to the bread step.

## Music

The music is rendered sample by sample in an AudioWorklet (`music/chip.worklet.ts` wraps `music/chip.ts`): Game Boy style chip voices (two pulses, a 4-bit wave, a 15-bit LFSR noise) over a stereo synthwave bed (saw bass, detuned pad, kick and snare, sidechain ducking under the kick, ping-pong delay, a small reverb). The page only posts small cues: the song it wants, the intensity, play and mute. The chip answers with its status at every bar line.

- **Songs** are hand-written pattern lines, one token per step (`C4`, `F#3`, `C4:47` for an arp chord of C, E and G, `-` to hold, `.` to rest; drums `k`, `s`, `h`, `o`), played bar by bar from an order list. Every song is 128 BPM. `music/songs.ts` holds one main theme in E Phrygian dominant in one version per kitchen (same lead, its own bass, pad, arp, counter-melody, drums and voice settings) and two DJ takes: "lift" for a busy kitchen and "peak" for the last thirty seconds, each with its own lead over the kitchen's backing. `music/score.ts` compiles the tokens once.
- **Intensity** (`intensity` in `cues.ts`: waiting customers, impatience, fire, the last thirty seconds) lets the stems in by layers: bass, pad and drums always, the arp from 0.25, the lead from 0.5, the counter-melody from 0.85.
- **The DJ** (`music/dj.ts`) runs on the worklet's bar clock with two decks. A plain song change crossfades over two bars from the next bar line. In a round it holds a song at least 16 bars, starts a mix only on an 8-bar phrase of the playing song and overlaps the decks for 4 bars while the stems trade decks on the swap bar. Two versions of one theme blend (both leads, arps and pads layered; bass and counter swap), two songs on one bar grid duet (both leads, the backing swaps), anything else keeps the outgoing lead over the incoming backing. `nextTake` in `cues.ts` asks for "lift" after ten busy seconds, back after ten calm ones, and "peak" in the last thirty seconds.

`pnpm music <level> <out.wav>` renders 60 bars (about two minutes) of a kitchen's music offline into a WAV (bed, arp, lead, the mix into lift, every layer, the duet into peak) and prints each stretch's loudness. In the browser, `__game.music()` reports whether the worklet loaded, the DJ state, the decks, the bar, the intensity, the layers and the output RMS.

## Layout

| Path | Role |
| --- | --- |
| `src/game/core/` | Tick rate, directions, seeded random numbers. No dependencies |
| `src/features/kitchen/` | Items (veg, meat, the döner or pastry being built, mixing bowls, plates, the extinguisher) and stations: crates, board, toaster (a grill or an oven), mixer, spit, sauces and toppings, prep trays, plate rack, return hatch, sink, counters, bin. `interact`, `work`, `stepStation`, fire and `spreadFire` |
| `src/features/orders/` | The menu, the customer queue with patience, serving with points and tips, the ticket rail UI |
| `src/features/cooks/` | Walking and dashing with collision against stations and each other, the tile in front |
| `src/features/bots/` | AI cooks for empty slots. `decide` is a priority table (fire, spit, döner and pastries, the mixer, plates, veg, washing up) asked every tick from a read-only `Sight`; `think` walks the bot there (breadth-first path, dash, stepping aside) and turns the plan into an `Intent` |
| `src/game/runtime/lineup.ts` | The `Lineup`: one `Driver` per cook, a keyboard binding or a bot |
| `src/game/runtime/looks.ts` | The chef looks and which cook wears which |
| `src/game/runtime/levels.ts` | The campaign: each level's floor plan (ASCII), menu and pace |
| `src/game/runtime/world.ts` | The `World`, built from a level |
| `src/game/persistence/progress.ts` | The save: best score and stars per level, which levels are open |
| `src/shared/storage.ts` | The one place that touches `localStorage`; never throws |
| `src/game/runtime/step.ts` | One tick in fixed order: cooks, stations, orders. HUD snapshot |
| `src/game/runtime/useGameCanvas.ts` | Keyboard, fixed 60 Hz loop, 3D render, snapshot to `snapshotAtom`, dev `window.__game`. Steps the world only once the `Start` machine (`start.ts`: recipe card, countdown, running) runs |
| `src/game/runtime/audio/` | Sound with no audio files: `cues.ts` turns two digests of the world into sounds, the music's intensity and the DJ take it asks for (pure, tested), `recipes.ts` holds every sound effect as data, `engine.ts` plays them with Web Audio after the first key or click |
| `src/game/runtime/audio/music/` | The music, synthesized live in an AudioWorklet (see Music below) |
| `src/game/runtime/gl/` | The 3D view (three.js): low-poly models built from primitives in `models.ts`, camera, lights and sync from the world in `scene.ts`. The world around the kitchen is a backdrop picked per level in `scenery.ts` (`SCENERY`, default the street in `street.ts`; `harbor.ts` stands the shop on a pier over the water). `?scenery=harbor` previews one on any level |
| `src/game/runtime/tutorial/` | The tutorial: lesson table, calm-kitchen rules, the view the HUD card and 3D arrow read |
| `src/game/runtime/testing/` | Scenarios (`?scenario=` in the browser, Vitest, e2e) and a breadth-first walking driver for scripted cooks |
| `src/app/` | HUD (top bar, toasts, end-of-shift card) and pages |

Feature boundaries are enforced by the `factory-architecture` oxlint plugin; the dependency graph is in `tools/oxlint/factory-architecture/policy.ts` (`orders → kitchen`, `cooks → kitchen`, `bots → kitchen, cooks, orders`). Simulation modules are plain TypeScript: no Effect, React, DOM, `Math.random` or `Date`.

## Testing

| Layer | Where | What it proves |
| --- | --- | --- |
| Examples | `src/**/*.test.ts` | Chop, toast, burn, spit cooking and shaving, sauce, serve rules, walking and collision, a scripted cook making a Döner Pur from scratch, bots running whole shifts and baking in the Backstube (`runtime/bots.test.ts`), every level playable (`runtime/levels.test.ts`), the save (`persistence/progress.test.ts`) |
| Properties | `src/game/runtime/step.test.ts` | Random two-player input never puts a cook inside a station, and replays the same round |
| Browser | `pnpm e2e` | Real keyboard input and HUD: walking, dashing, a stubbed gamepad walking, serving at the pass, putting out a fire, the end-of-shift card, a star on level 1 opening level 2, a star in the Großküche opening the Backstube. Runs one worker: headless WebGL renders on the CPU |
| Lint rules | `tools/oxlint/**/*.test.ts` | The architecture and coding standard rules themselves |

### Driving the game as an agent

1. `pnpm dev`, then open `http://localhost:3000/play?level=<id>&humans=0&bots=2` for a level, or `http://localhost:3000/play?scenario=<name>&seed=<n>` (scenarios: `shift`, `ready-classic`, `burning-spit`, `kitchen-fire`, `dirty-dishes`, `prep-line`, `catch`, `backstube`, `rush`, `last-seconds`). A named scenario skips the recipe card and the countdown; plain `/play` has them.
2. In the console or with `agent-browser eval`: `__game.step(ticks, [intent1, intent2])` runs ticks with intents `{ dx, dy, interact, work, dash, throw }`, `__game.snapshot()` returns what the HUD shows, `__game.world()` the live state, `__game.music()` what the music plays (after a key press unlocks audio).
