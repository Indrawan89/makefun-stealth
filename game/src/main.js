// Shadow Vault: boot, the one game loop, input, and the rules that join the pieces.
// The thief moves in fixed 1/60 s steps; guards think in guard.js; paint lives in
// render.js. ?seed=N fixes the deal; ?shot=start|play|alert|win stages a scene.
import { createSeededRandom } from './rng.js';
import { GRID_WIDTH, GRID_HEIGHT, TILE, buildLevel, isWall, tileCentre, hallAt } from './level.js';
import { createGuard, patrolWaypoints, updateGuard, GUARD_CHASE } from './guard.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_CAUGHT } from './render.js';
import { createSoundBank } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const PLAYER_SPEED = 150;
const SNEAK_SPEED = 78;
const LOOT_POINTS = 100;
const GHOST_BONUS = 500;
const COIN_HEAR_RADIUS = TILE * 4;
const START_COINS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sounds = createSoundBank();
const renderer = createRenderer(canvas);

function freshState() {
  const level = buildLevel();
  const start = tileCentre(level.playerStart);
  // The seed deals each guard a starting facing and a first pause, so the same
  // seed always opens the same museum and a different seed shuffles the patrols.
  const rng = createSeededRandom(seed);
  const guards = level.guards.map((spawn, i) => {
    const guard = createGuard(spawn, patrolWaypoints(level, spawn), i);
    guard.facing = rng.range(0, Math.PI * 2);
    guard.waitTimer = rng.range(0, 1.5);
    return guard;
  });
  return {
    level,
    screen: SCREEN_TITLE,
    player: { x: start.x, y: start.y, facing: 0, sneaking: false, moving: false },
    guards,
    coins: START_COINS,
    coinsThrown: [],
    lootTaken: 0,
    lootTotal: level.loot.length,
    score: 0,
    elapsed: 0,
    ghost: true,
    exitOpen: false,
    hall: hallAt(level.playerStart.x, level.playerStart.y),
    message: '',
    messageTimer: 0,
    caught: false,
    stepCount: 0,
  };
}

let state = freshState();

const keys = new Set();

function steer(dx, dy, sneak = false) {
  keys.clear();
  if (dx > 8) keys.add('d');
  else if (dx < -8) keys.add('a');
  if (dy > 8) keys.add('s');
  else if (dy < -8) keys.add('w');
  if (sneak) keys.add('shift');
}

function teleportTile(tx, ty) {
  const centre = tileCentre({ x: tx, y: ty });
  state.player.x = centre.x;
  state.player.y = centre.y;
}

function setMessage(text, seconds = 2.5) {
  state.message = text;
  state.messageTimer = seconds;
}

function movePlayer(dt) {
  const player = state.player;
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  player.sneaking = keys.has('shift');
  player.moving = dx !== 0 || dy !== 0;
  if (!player.moving) return;
  const length = Math.hypot(dx, dy);
  const speed = player.sneaking ? SNEAK_SPEED : PLAYER_SPEED;
  const nx = player.x + (dx / length) * speed * dt;
  const ny = player.y + (dy / length) * speed * dt;
  player.facing = Math.atan2(dy, dx);
  // Slide along walls: try each axis on its own.
  if (!hitsWall(nx, player.y)) player.x = nx;
  if (!hitsWall(player.x, ny)) player.y = ny;
  state.hall = hallAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
}

function hitsWall(px, py) {
  const radius = 11;
  const corners = [
    [px - radius, py - radius],
    [px + radius, py - radius],
    [px - radius, py + radius],
    [px + radius, py + radius],
  ];
  return corners.some(([cx, cy]) => isWall(state.level, Math.floor(cx / TILE), Math.floor(cy / TILE)));
}

function throwCoinAt(px, py) {
  if (state.screen !== SCREEN_PLAY || state.coins <= 0) return false;
  const tileX = Math.floor(px / TILE);
  const tileY = Math.floor(py / TILE);
  if (tileX < 0 || tileY < 0 || tileX >= GRID_WIDTH || tileY >= GRID_HEIGHT) return false;
  if (isWall(state.level, tileX, tileY)) return false;
  state.coins -= 1;
  const centre = tileCentre({ x: tileX, y: tileY });
  state.coinsThrown.push({ x: centre.x, y: centre.y, radius: COIN_HEAR_RADIUS, tile: { x: tileX, y: tileY }, ttl: 1.6 });
  sounds.coin();
  for (const guard of state.guards) {
    if (Math.hypot(guard.x - centre.x, guard.y - centre.y) <= COIN_HEAR_RADIUS) {
      guard.heardCoin = { x: tileX, y: tileY };
    }
  }
  setMessage('Coin tossed — a guard heard it!');
  return true;
}

function collectLoot() {
  for (const item of state.level.loot) {
    if (item.taken) continue;
    const centre = tileCentre(item);
    if (Math.hypot(state.player.x - centre.x, state.player.y - centre.y) < TILE * 0.6) {
      item.taken = true;
      state.lootTaken += 1;
      state.score += LOOT_POINTS;
      sounds.pickup();
      if (state.lootTaken === state.lootTotal) {
        state.exitOpen = true;
        setMessage('All artefacts stolen — the exit is open!');
      } else {
        setMessage(`Artefact ${state.lootTaken}/${state.lootTotal} pocketed (+${LOOT_POINTS})`);
      }
    }
  }
}

function checkExit() {
  if (!state.exitOpen) return;
  const centre = tileCentre(state.level.exit);
  if (Math.hypot(state.player.x - centre.x, state.player.y - centre.y) < TILE * 0.6) {
    state.screen = SCREEN_WIN;
    const timeBonus = Math.max(0, 600 - Math.floor(state.elapsed) * 2);
    state.score += timeBonus;
    if (state.ghost) state.score += GHOST_BONUS;
    sounds.win();
    sounds.stopHum();
    status.textContent = `You escaped with a score of ${state.score}.`;
  }
}

function stepWorld(dt) {
  if (state.screen !== SCREEN_PLAY) return;
  state.elapsed += dt;
  state.stepCount += 1;
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = '';
  }
  movePlayer(dt);
  collectLoot();
  checkExit();
  if (state.screen !== SCREEN_PLAY) return;
  const events = [];
  for (const guard of state.guards) {
    const result = updateGuard(state.level, guard, state.player, dt, events);
    if (guard.state === GUARD_CHASE) state.ghost = false;
    if (result === 'caught') {
      state.screen = SCREEN_CAUGHT;
      state.caught = true;
      sounds.caught();
      sounds.stopHum();
      status.textContent = 'Caught by a guard.';
      return;
    }
  }
  for (const event of events) {
    if (event.type === 'spotted') {
      state.ghost = false;
      sounds.spotted();
      setMessage('A guard saw something…');
    } else if (event.type === 'chase') {
      sounds.alarm();
      setMessage('ALARM — run!');
    } else if (event.type === 'investigate') {
      setMessage('A guard is checking a noise…');
    }
  }
  for (const coin of state.coinsThrown) coin.ttl -= dt;
  state.coinsThrown = state.coinsThrown.filter((coin) => coin.ttl > 0);
  // Footstep ticks, quieter while sneaking; a soft tap while a guard searches.
  if (state.player.moving && state.stepCount % 24 === 0) sounds.step(state.player.sneaking);
  if (state.stepCount % 60 === 0 && state.guards.some((g) => g.state === 'search')) sounds.searchTick();
}

function startGame() {
  state = freshState();
  state.screen = SCREEN_PLAY;
  sounds.unlock();
  sounds.startHum();
  status.textContent = 'Steal every artefact, then reach the exit unseen.';
}

function restart() {
  startGame();
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'm') {
    sounds.toggle();
    return;
  }
  if (key === 'r' && (state.screen === SCREEN_WIN || state.screen === SCREEN_CAUGHT)) {
    restart();
    return;
  }
  if (key === 'enter' && state.screen === SCREEN_TITLE) {
    startGame();
    return;
  }
  if (key === ' ' && state.screen === SCREEN_TITLE) {
    startGame();
    return;
  }
  keys.add(key);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener('click', (event) => {
  sounds.unlock();
  if (state.screen === SCREEN_TITLE) {
    startGame();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
  throwCoinAt(px, py);
});

// Test and screenshot hooks: drive the real rules from outside the page.
window.__vault = {
  get state() {
    return state;
  },
  get seed() {
    return seed;
  },
  start: startGame,
  restart,
  step(dt) {
    stepWorld(dt ?? STEP);
  },
  setKeys(list) {
    keys.clear();
    for (const key of list) keys.add(key.toLowerCase());
  },
  throwCoinAt,
  teleport(x, y) {
    state.player.x = x;
    state.player.y = y;
  },
  teleportTile,
  steer,
  guardStates() {
    return state.guards.map((g) => ({ id: g.id, state: g.state, suspicion: Math.round(g.suspicion), x: Math.round(g.x), y: Math.round(g.y) }));
  },
};

if (shot) {
  stageShot(state, shot, { stepWorld, throwCoinAt, startGame, steer, teleportTile, getState: () => state, STEP });
  renderer.draw(state);
  window.__shotReady = true;
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const frameSeconds = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += frameSeconds;
    while (accumulator >= STEP) {
      stepWorld(STEP);
      accumulator -= STEP;
    }
    renderer.draw(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
