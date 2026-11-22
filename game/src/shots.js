// Screenshot scenes behind ?shot=start|play|alert|win. Every scene is staged by
// playing the real rules forward from a fresh world: the play scene steers the
// thief toward the nearest artefact with the same pathfinding the guards use,
// the alert scene walks the thief into a guard's vision cone until the chase
// starts, and the win scene pockets every artefact and walks out the exit.
// startGame() replaces the state object, so every scene reads the live state
// through helpers.getState() after starting, never the object it was handed.
import { TILE, tileCentre } from './level.js';
import { findPath, GUARD_CHASE } from './guard.js';
import { SCREEN_TITLE } from './render.js';

const SAMPLE = 1 / 60;

function nearestLoot(state) {
  let best = null;
  let bestDistance = Infinity;
  for (const item of state.level.loot) {
    if (item.taken) continue;
    const distance = Math.hypot(state.player.x - tileCentre(item).x, state.player.y - tileCentre(item).y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = item;
    }
  }
  return best;
}

function steerToward(state, helpers, targetTile, sneak = false) {
  const from = { x: Math.floor(state.player.x / TILE), y: Math.floor(state.player.y / TILE) };
  const path = findPath(state.level, from, targetTile);
  const next = path.length > 1 ? path[1] : targetTile;
  const centre = tileCentre(next);
  const dx = centre.x - state.player.x;
  const dy = centre.y - state.player.y;
  helpers.steer(dx, dy, sneak);
}

function playScene(helpers, seconds) {
  helpers.startGame();
  const state = helpers.getState();
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    // A chasing or suspicious guard nearby: run away from it, sneaking when close.
    let threat = null;
    let threatDistance = Infinity;
    for (const guard of state.guards) {
      const distance = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
      const dangerous = guard.state === GUARD_CHASE || (guard.suspicion > 25 && distance < 170);
      if (dangerous && distance < threatDistance) {
        threat = guard;
        threatDistance = distance;
      }
    }
    if (threat) {
      helpers.steer(state.player.x - threat.x, state.player.y - threat.y, threatDistance < 120);
    } else {
      // Otherwise creep toward the nearest artefact, sneaking when a guard is close.
      const loot = nearestLoot(state);
      const nearGuard = state.guards.some((g) => Math.hypot(g.x - state.player.x, g.y - state.player.y) < 150);
      if (loot) steerToward(state, helpers, loot, nearGuard);
      else helpers.steer(0, 0);
    }
    helpers.stepWorld(SAMPLE);
    if (state.screen !== 'play') break;
  }
  helpers.steer(0, 0);
}

function alertScene(helpers) {
  helpers.startGame();
  const state = helpers.getState();
  const guard = state.guards[0];
  // Stand two tiles ahead of the first guard, squarely inside its vision cone.
  for (let i = 0; i < 60 * 12; i += 1) {
    const aheadX = Math.floor((guard.x + Math.cos(guard.facing) * TILE * 2) / TILE);
    const aheadY = Math.floor((guard.y + Math.sin(guard.facing) * TILE * 2) / TILE);
    if (i % 30 === 0) helpers.teleportTile(aheadX, aheadY);
    helpers.stepWorld(SAMPLE);
    if (state.guards.some((g) => g.state === GUARD_CHASE)) break;
    if (state.screen !== 'play') break;
  }
}

function winScene(helpers) {
  helpers.startGame();
  const state = helpers.getState();
  for (const item of [...state.level.loot]) {
    helpers.teleportTile(item.x, item.y);
    for (let i = 0; i < 10; i += 1) helpers.stepWorld(SAMPLE);
    if (state.screen !== 'play') return;
  }
  helpers.teleportTile(state.level.exit.x, state.level.exit.y);
  for (let i = 0; i < 10; i += 1) helpers.stepWorld(SAMPLE);
}

export function stageShot(state, shot, helpers) {
  if (shot === 'start') {
    state.screen = SCREEN_TITLE;
  } else if (shot === 'play') {
    playScene(helpers, 24);
  } else if (shot === 'alert') {
    alertScene(helpers);
  } else if (shot === 'win') {
    winScene(helpers);
  }
}
