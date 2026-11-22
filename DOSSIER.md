# Shadow Vault — dossier

## The game

Shadow Vault is an original top-down stealth game. You are a thief in a museum
at night. The museum has three halls — the Gallery of Whispers, the Hall of
Kings, and The Vault — laid out on a 34×17 tile grid, joined by doorways and
broken up by crates you can hide behind. Six artefacts are scattered across the
halls; steal them all and the exit unlocks. Reach it unseen and you are gone.

## How to play

- **Move:** WASD or arrow keys.
- **Sneak:** hold Shift — slower, quieter, and guards spot you more slowly.
- **Distract:** click anywhere to throw a coin (you carry five). Guards inside
  earshot leave their patrol to investigate the clink.
- **Restart:** R after a win or a capture. **Mute:** M.

## The guards

Six guards walk fixed patrol loops, one per hall, with glowing vision cones
drawn on the floor. Their AI runs through five states:

1. **Patrol** — walking the loop, pausing at each waypoint to look around.
2. **Suspicion** — a glimpse of you makes a guard stop and stare; suspicion
   climbs while you are in the cone and falls when you break away.
3. **Chase** — at full suspicion the guard runs at you. Touching you ends the
   run: caught.
4. **Search** — lose a chasing guard and it sweeps the area where it last saw
   you, then gives up and returns to patrol.
5. **Investigate** — a thrown coin pulls nearby guards to the tile it landed on.

Vision is a cone with a ray-cast line of sight: walls and crates block it, so
cover you can read at a glance. The cone drawn on the floor is clipped by the
same walls — it is ray-cast in 28 slices, so it never shines through solid
cover. Pathfinding is breadth-first search on the tile grid.

## Verified in a headless browser

The game was play-tested in headless Chromium (8/8 checks): the page loads with
no JavaScript errors, the thief moves, all six guards patrol, a vision cone
raises suspicion to a full chase and the chase ends in a capture, a thrown coin
pulls a guard to investigate, and collecting all six artefacts plus the exit
wins the game (Ghost, 1698 points). Running `main.ts` twice into two different
output directories writes byte-identical `dossier.json` files (sha256
`c14f6c40c843f03ca12257fb358ea3c407fb716d89fc5027e952d0a616a19342`).

## Scoring

Each artefact is worth 100 points. Finishing adds a time bonus (faster is
better), and a **Ghost bonus of +500** if no guard ever spotted you at all.
The HUD shows loot, coins, time, score, the hall you are in, and one alarm
meter — the highest suspicion of any guard.

A perfect run scores 600 (loot) + 500 (Ghost) + up to 600 (time bonus, shrinking
2 points a second): 1700 at best, and the staged win screenshot shows 1698 —
six artefacts, Ghost, and a 2-second escape. A run that is spotted but escapes
keeps the loot and time points and loses only the Ghost bonus, so a near miss
still counts: the detection system always gives you a chance to recover.

## Look and sound

All art is drawn from shapes and colour on a 2D canvas: no image files, no
copied characters or levels. All sound is synthesised with WebAudio — soft
footsteps, coin clinks, pickup chimes, a rising alarm, and a low ambient hum.
There are no network requests and no files outside `game/`.

## Determinism and screenshots

`?seed=N` fixes the deal (guard starting facings and pauses), so the same seed
always opens the same museum. `?shot=start|play|alert|win&seed=1` stages the
four screenshot scenes by playing the real rules forward: title, a 24-second
steered play, a walk into a vision cone until the chase starts, and a full
loot-and-escape run. The screenshots in `screenshots/` are renders of the
game's own code in a headless browser.

## Build notes

- `game/src/level.js` — the museum map, halls, loot, guard posts.
- `game/src/guard.js` — BFS pathfinding, vision cone, guard state machine.
- `game/src/render.js` — canvas painting: floor, cones, guards, thief, HUD.
- `game/src/audio.js` — WebAudio sound bank, synthesised on the spot.
- `game/src/rng.js` — seeded random (mulberry32-style).
- `game/src/shots.js` — screenshot scene staging.
- `game/src/main.js` — boot, input, the fixed-step loop, win/lose rules.
- `main.ts` — copies `game/` and `screenshots/` to the output directory and
  writes `dossier.json` via the vendored `vendor/makefun-game.ts`.
- `serve.ts` — a tiny static server for local play (`node serve.ts`).
