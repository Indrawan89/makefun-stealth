// Guard brains: patrol waypoints, BFS pathfinding on the tile grid, a vision cone
// checked with a line-of-sight ray, and the patrol -> suspicion -> chase -> search
// -> investigate state machine. Nothing here knows about the canvas.
import { GRID_WIDTH, GRID_HEIGHT, TILE, isWall, tileCentre } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicion';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_INVESTIGATE = 'investigate';

export const VIEW_RANGE = TILE * 5.2;
export const VIEW_HALF_ANGLE = 0.62;
export const SUSPICION_RATE = 55;
export const SUSPICION_DECAY = 14;

// Breadth-first search on the grid; returns a list of tile steps from start to goal.
export function findPath(level, start, goal) {
  const key = (x, y) => y * GRID_WIDTH + x;
  const seen = new Map();
  const queue = [{ x: start.x, y: start.y }];
  seen.set(key(start.x, start.y), null);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = seen.get(key(node.x, node.y));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_WIDTH || ny >= GRID_HEIGHT) continue;
      if (isWall(level, nx, ny)) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.set(key(nx, ny), current);
      queue.push({ x: nx, y: ny });
    }
  }
  return [];
}

// Step along a ray; true when no wall or crate stands between the two points.
export function hasLineOfSight(level, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i < steps; i += 1) {
    const px = from.x + (dx * i) / steps;
    const py = from.y + (dy * i) / steps;
    if (isWall(level, Math.floor(px / TILE), Math.floor(py / TILE))) return false;
  }
  return true;
}

// Is the player inside this guard's vision cone, with a clear line of sight?
export function canSeePlayer(level, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > VIEW_RANGE) return false;
  if (distance < TILE * 0.7) return hasLineOfSight(level, guard, player);
  const angleToPlayer = Math.atan2(dy, dx);
  let diff = angleToPlayer - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > VIEW_HALF_ANGLE) return false;
  return hasLineOfSight(level, guard, player);
}

function guardSpeed(guard) {
  if (guard.state === GUARD_CHASE) return 118;
  if (guard.state === GUARD_INVESTIGATE) return 96;
  if (guard.state === GUARD_SEARCH) return 82;
  return 62;
}

export function createGuard(spawn, waypoints, index) {
  const start = tileCentre(spawn);
  return {
    id: index,
    x: start.x,
    y: start.y,
    facing: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    waypointIndex: 0,
    waypoints,
    path: [],
    pathIndex: 0,
    waitTimer: 0,
    searchTimer: 0,
    investigateTarget: null,
    lastSeen: null,
    seenPlayer: false,
    heardCoin: false,
  };
}

// Waypoints: a loop around the guard's own hall, through the door gaps.
export function patrolWaypoints(level, spawn) {
  const hall = spawn.x < 11 ? 0 : spawn.x < 22 ? 1 : 2;
  const loops = [
    [{ x: 2, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 10 }, { x: 9, y: 10 }, { x: 9, y: 14 }, { x: 2, y: 14 }],
    [{ x: 13, y: 2 }, { x: 20, y: 2 }, { x: 20, y: 5 }, { x: 13, y: 5 }, { x: 13, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 14 }, { x: 13, y: 14 }],
    [{ x: 24, y: 2 }, { x: 31, y: 2 }, { x: 31, y: 5 }, { x: 24, y: 5 }, { x: 24, y: 10 }, { x: 31, y: 10 }, { x: 31, y: 14 }, { x: 24, y: 14 }],
  ];
  const loop = loops[hall];
  const start = loop.reduce((best, point) => {
    const d = Math.hypot(point.x - spawn.x, point.y - spawn.y);
    const bd = Math.hypot(best.x - spawn.x, best.y - spawn.y);
    return d < bd ? point : best;
  }, loop[0]);
  const startIndex = loop.indexOf(start);
  return loop.slice(startIndex).concat(loop.slice(0, startIndex));
}

function moveAlongPath(guard, dt) {
  if (guard.pathIndex >= guard.path.length) return true;
  const target = tileCentre(guard.path[guard.pathIndex]);
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const distance = Math.hypot(dx, dy);
  const speed = guardSpeed(guard);
  if (distance < 4) {
    guard.pathIndex += 1;
    return guard.pathIndex >= guard.path.length;
  }
  guard.facing = Math.atan2(dy, dx);
  guard.x += (dx / distance) * speed * dt;
  guard.y += (dy / distance) * speed * dt;
  return false;
}

function retarget(guard, level, tile) {
  const from = { x: Math.floor(guard.x / TILE), y: Math.floor(guard.y / TILE) };
  guard.path = findPath(level, from, tile);
  guard.pathIndex = 1;
}

// One fixed step of one guard's brain. Returns 'caught' when it touches the player.
export function updateGuard(level, guard, player, dt, events) {
  const sees = canSeePlayer(level, guard, player);
  const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
  if (sees) {
    const closeness = 1 - Math.min(1, distance / VIEW_RANGE);
    const rate = SUSPICION_RATE * (0.55 + closeness) * (player.sneaking ? 0.55 : 1);
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    if (!guard.seenPlayer && guard.suspicion > 25) {
      guard.seenPlayer = true;
      events.push({ type: 'spotted' });
    }
    if (guard.suspicion >= 100 && guard.state !== GUARD_CHASE) {
      guard.state = GUARD_CHASE;
      events.push({ type: 'chase', guard: guard.id });
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
    if (guard.state === GUARD_CHASE) {
      guard.state = GUARD_SEARCH;
      guard.searchTimer = 4;
      if (guard.lastSeen) retarget(guard, level, { x: Math.floor(guard.lastSeen.x / TILE), y: Math.floor(guard.lastSeen.y / TILE) });
    }
  }

  if (guard.heardCoin && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_INVESTIGATE;
    guard.investigateTarget = guard.heardCoin;
    retarget(guard, level, guard.heardCoin);
    guard.heardCoin = false;
    events.push({ type: 'investigate', guard: guard.id });
  }

  if (guard.state === GUARD_PATROL) {
    if (guard.waitTimer > 0) {
      guard.waitTimer -= dt;
      guard.facing += dt * 0.8;
    } else {
      if (guard.path.length === 0 || guard.pathIndex >= guard.path.length) {
        const next = guard.waypoints[guard.waypointIndex % guard.waypoints.length];
        guard.waypointIndex += 1;
        retarget(guard, level, next);
      }
      if (moveAlongPath(guard, dt)) {
        guard.path = [];
        guard.waitTimer = 1.2;
      }
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    // A half-seen thief makes the guard stop and stare toward the last glimpse.
    if (guard.lastSeen) guard.facing = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
    if (guard.suspicion <= 0) {
      guard.state = GUARD_PATROL;
      guard.path = [];
    }
  } else if (guard.state === GUARD_CHASE) {
    if (guard.lastSeen) retarget(guard, level, { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) });
    moveAlongPath(guard, dt);
    if (distance < TILE * 0.55) return 'caught';
  } else if (guard.state === GUARD_SEARCH) {
    if (guard.path.length > 0 && moveAlongPath(guard, dt)) {
      guard.path = [];
      guard.facing += dt * 1.6;
    }
    guard.searchTimer -= dt;
    if (guard.searchTimer <= 0) {
      guard.state = GUARD_PATROL;
      guard.path = [];
      events.push({ type: 'gave-up', guard: guard.id });
    }
  } else if (guard.state === GUARD_INVESTIGATE) {
    if (guard.path.length > 0 && moveAlongPath(guard, dt)) {
      guard.path = [];
      guard.waitTimer = 1.5;
      guard.state = GUARD_PATROL;
    }
  }
  if (guard.suspicion >= 25 && guard.suspicion < 100 && guard.state === GUARD_PATROL) {
    guard.state = GUARD_SUSPICIOUS;
  }
  return null;
}
