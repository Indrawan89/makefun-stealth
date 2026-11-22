# Shadow Vault

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Indrawan89/makefun-stealth/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Indrawan89/makefun-stealth/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game: a night thief slips through a three-hall museum, pockets
six artefacts, and reaches the exit unseen. Guards patrol fixed routes with glowing
vision cones; get spotted and suspicion climbs, then they chase, search, and give
up — or catch you. Toss a coin to pull a guard away from your route. Finish without
ever being seen for the Ghost bonus (+500).

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD / arrow keys** — move
- **Shift** — sneak (slower, quieter, harder to spot)
- **Click** — throw a coin; nearby guards go to investigate the clink
- **R** — restart after a win or a capture
- **M** — mute

Steal all six artefacts to unlock the exit, then reach it. Your score is loot
points plus a time bonus, plus +500 if no guard ever spotted you.

## What is inside

- `game/` — the whole game as static files: `index.html`, `style.css`, and
  `src/` with one clear job per file (`level.js` the museum, `guard.js` the
  guard AI and vision, `render.js` the canvas painting, `audio.js` the
  synthesised sounds, `rng.js` the seeded random, `shots.js` the screenshot
  scenes, `main.js` the loop and the rules).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game: title, play, alert, win.
- `vendor/makefun-game.ts` — the kit's library, unchanged.

No network requests, no external assets: every sound is synthesised with
WebAudio and every picture is drawn from shapes and colour. `?seed=N` fixes the
deal, and `?shot=start|play|alert|win&seed=1` stages each screenshot scene.

## Screenshots

Four real renders of the game, in `screenshots/`:

1. `1-start.jpg` — the title screen over the museum.
2. `2-play.jpg` — sneaking through the Gallery of Whispers, a guard's suspicion
   already rising.
3. `3-alert.jpg` — a full chase: the red cone, a full alarm meter, "ALARM — run!".
4. `4-win.jpg` — the clean getaway: all six artefacts, Ghost bonus, 1698 points.

Each one is staged by `?shot=start|play|alert|win&seed=1`, which plays the real
rules forward to that moment — nothing is drawn by hand for the screenshots.

## Verified in a headless browser

The game was play-tested in headless Chromium (8/8 checks): the page loads with
no JavaScript errors, the thief moves, all six guards patrol, a vision cone
raises suspicion to a full chase and the chase ends in a capture, a thrown coin
pulls a guard to investigate, and collecting all six artefacts plus the exit
wins the game (Ghost, 1698 points). Running `main.ts` twice into two different
output directories writes byte-identical `dossier.json` files.
