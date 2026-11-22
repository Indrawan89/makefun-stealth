// Canvas painting for Shadow Vault: the museum floor, crates and walls, the thief,
// the guards with their glowing vision cones, loot, the exit and every screen.
// All art is drawn from shapes and colour; there are no image assets.
import { GRID_WIDTH, GRID_HEIGHT, TILE } from './level.js';
import { VIEW_RANGE, VIEW_HALF_ANGLE, GUARD_CHASE } from './guard.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

const PALETTE = {
  floorA: '#2a2438',
  floorB: '#241f30',
  wall: '#4a3f5e',
  wallTop: '#6b5a86',
  crate: '#7a5a34',
  crateEdge: '#a67c44',
  gold: '#f5c542',
  exit: '#3ddc84',
  player: '#e8e6f0',
  guard: '#ff5d5d',
  cone: 'rgba(255, 220, 120, 0.20)',
  coneHot: 'rgba(255, 90, 90, 0.30)',
};

function drawTileFloor(ctx, level) {
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const cell = level.tiles[y][x];
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (cell === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x * TILE, y * TILE, TILE, 5);
      } else if (cell === 'K') {
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = PALETTE.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x * TILE + 3, y * TILE + 3);
        ctx.lineTo(x * TILE + TILE - 3, y * TILE + TILE - 3);
        ctx.stroke();
      }
    }
  }
}

function drawHallNames(ctx, level) {
  ctx.font = 'bold 15px Georgia, serif';
  ctx.textAlign = 'center';
  for (const hall of level.halls) {
    const cx = ((hall.x0 + hall.x1 + 1) / 2) * TILE;
    const cy = (hall.y0 + 0.9) * TILE;
    const width = ctx.measureText(hall.name).width + 16;
    ctx.fillStyle = 'rgba(10, 8, 18, 0.55)';
    ctx.fillRect(cx - width / 2, cy - 16, width, 22);
    ctx.fillStyle = 'rgba(232, 230, 240, 0.75)';
    ctx.fillText(hall.name, cx, cy);
  }
}

// The vision cone, clipped by walls: cast a fan of rays and stop each one at the
// first wall or crate, so the cone never shines through solid cover.
function conePolygon(level, guard) {
  const rays = 28;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - VIEW_HALF_ANGLE + (2 * VIEW_HALF_ANGLE * i) / rays;
    let reach = VIEW_RANGE;
    for (let d = 8; d < VIEW_RANGE; d += 8) {
      const px = guard.x + Math.cos(angle) * d;
      const py = guard.y + Math.sin(angle) * d;
      const tileX = Math.floor(px / TILE);
      const tileY = Math.floor(py / TILE);
      if (tileX < 0 || tileY < 0 || tileX >= GRID_WIDTH || tileY >= GRID_HEIGHT) {
        reach = d;
        break;
      }
      if (level.tiles[tileY][tileX] === '#' || level.tiles[tileY][tileX] === 'K') {
        reach = d;
        break;
      }
    }
    points.push({ x: guard.x + Math.cos(angle) * reach, y: guard.y + Math.sin(angle) * reach });
  }
  return points;
}

function drawCone(ctx, level, guard) {
  const hot = guard.state === GUARD_CHASE;
  const points = conePolygon(level, guard);
  ctx.fillStyle = hot ? PALETTE.coneHot : PALETTE.cone;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hot ? 'rgba(255, 90, 90, 0.55)' : 'rgba(255, 220, 120, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLoot(ctx, loot) {
  for (const item of loot) {
    if (item.taken) continue;
    const cx = (item.x + 0.5) * TILE;
    const cy = (item.y + 0.5) * TILE;
    const pulse = 1 + 0.12 * Math.sin(Date.now() / 280 + item.id);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawExit(ctx, exit, open) {
  const cx = (exit.x + 0.5) * TILE;
  const cy = (exit.y + 0.5) * TILE;
  ctx.save();
  ctx.strokeStyle = open ? PALETTE.exit : 'rgba(120, 120, 120, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 14, cy - 14, 28, 28);
  ctx.fillStyle = open ? 'rgba(61, 220, 132, 0.25)' : 'rgba(120, 120, 120, 0.15)';
  ctx.fillRect(cx - 14, cy - 14, 28, 28);
  ctx.fillStyle = open ? PALETTE.exit : '#999';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', cx, cy + 4);
  ctx.restore();
}

function drawGuard(ctx, guard) {
  ctx.save();
  ctx.translate(guard.x, guard.y);
  ctx.fillStyle = '#2b1212';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1c22';
  ctx.beginPath();
  ctx.arc(Math.cos(guard.facing) * 5, Math.sin(guard.facing) * 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (guard.suspicion > 1) {
    const w = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(guard.x - w / 2, guard.y - 26, w, 6);
    ctx.fillStyle = guard.suspicion >= 100 ? '#ff4444' : '#ffd34d';
    ctx.fillRect(guard.x - w / 2, guard.y - 26, (w * guard.suspicion) / 100, 6);
  }
  if (guard.state === 'investigate') {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', guard.x, guard.y - 30);
  }
}

function drawPlayer(ctx, player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  ctx.fillStyle = '#14101f';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2f55';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-4, -6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(180, 220, 255, 0.8)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('sneaking', player.x, player.y - 18);
  }
}

function drawCoin(ctx, coin) {
  const pulse = 1 + 0.2 * Math.sin(Date.now() / 120);
  ctx.save();
  ctx.translate(coin.x, coin.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 211, 77, 0.5)';
  ctx.beginPath();
  ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawOverlay(ctx, width, height, lines, accent) {
  ctx.fillStyle = 'rgba(10, 8, 18, 0.78)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  let y = height / 2 - lines.length * 22;
  for (const line of lines) {
    ctx.fillStyle = line.color || '#e8e6f0';
    ctx.font = line.big ? 'bold 44px Georgia, serif' : '18px Georgia, serif';
    if (line.big) ctx.fillStyle = accent || '#f5c542';
    ctx.fillText(line.text, width / 2, y);
    y += line.big ? 62 : 32;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const width = GRID_WIDTH * TILE;
  const height = GRID_HEIGHT * TILE + 96;
  canvas.width = width;
  canvas.height = height;

  function drawHud(state) {
    const top = GRID_HEIGHT * TILE;
    ctx.fillStyle = '#14101f';
    ctx.fillRect(0, top, width, 96);
    ctx.fillStyle = '#e8e6f0';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    const lootText = `Loot ${state.lootTaken} / ${state.lootTotal}`;
    const coinText = `Coins ${state.coins}`;
    const timeText = `Time ${Math.floor(state.elapsed)}s`;
    ctx.fillText(lootText, 16, top + 28);
    ctx.fillText(coinText, 150, top + 28);
    ctx.fillText(timeText, 260, top + 28);
    ctx.fillText(`Score ${state.score}`, 380, top + 28);
    ctx.fillText(state.hall, 520, top + 28);
    // Highest suspicion across guards, as one alarm meter.
    const alarm = Math.max(0, ...state.guards.map((g) => g.suspicion));
    ctx.fillStyle = '#333';
    ctx.fillRect(16, top + 48, 300, 14);
    ctx.fillStyle = alarm >= 100 ? '#ff4444' : alarm >= 25 ? '#ffd34d' : '#3ddc84';
    ctx.fillRect(16, top + 48, (300 * alarm) / 100, 14);
    ctx.fillStyle = '#e8e6f0';
    ctx.font = '14px sans-serif';
    ctx.fillText(alarm >= 100 ? 'ALARM! Run!' : alarm >= 25 ? 'Suspicion rising…' : 'Unseen', 330, top + 61);
    ctx.fillStyle = '#9a94ad';
    ctx.fillText('WASD / arrows move · Shift sneak · Click throws a coin · R restart · M mute', 16, top + 86);
    if (state.message) {
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(state.message, 700, top + 61);
    }
  }

  return {
    width,
    height,
    draw(state) {
      ctx.clearRect(0, 0, width, height);
      drawTileFloor(ctx, state.level);
      drawHallNames(ctx, state.level);
      for (const guard of state.guards) drawCone(ctx, state.level, guard);
      drawLoot(ctx, state.level.loot);
      drawExit(ctx, state.level.exit, state.exitOpen);
      for (const coin of state.coinsThrown) drawCoin(ctx, coin);
      for (const guard of state.guards) drawGuard(ctx, guard);
      drawPlayer(ctx, state.player);
      ctx.restore();
      drawHud(state);
      if (state.screen === SCREEN_TITLE) {
        drawOverlay(ctx, width, height, [
          { text: 'SHADOW VAULT', big: true },
          { text: 'A night thief in the museum — steal every artefact, reach the exit unseen.', color: '#cfc9e0' },
          { text: 'WASD / arrows to move · Shift to sneak · Click to throw a coin', color: '#cfc9e0' },
          { text: 'Ghost bonus +500 if no guard ever spots you.', color: '#f5c542' },
          { text: 'Press Enter or click to begin', color: '#ffffff' },
        ]);
      } else if (state.screen === SCREEN_WIN) {
        drawOverlay(ctx, width, height, [
          { text: 'CLEAN GETAWAY!', big: true },
          { text: `Score ${state.score} · Loot ${state.lootTaken}/${state.lootTotal} · Time ${Math.floor(state.elapsed)}s`, color: '#e8e6f0' },
          { text: state.ghost ? 'GHOST — never seen once! +500' : 'Seen, but escaped.', color: '#3ddc84' },
          { text: 'Press R to play again', color: '#ffffff' },
        ], '#3ddc84');
      } else if (state.screen === SCREEN_CAUGHT) {
        drawOverlay(ctx, width, height, [
          { text: 'CAUGHT!', big: true },
          { text: `The guards found you with ${state.lootTaken} of ${state.lootTotal} artefacts.`, color: '#e8e6f0' },
          { text: `Score ${state.score}`, color: '#e8e6f0' },
          { text: 'Press R to try again', color: '#ffffff' },
        ], '#ff5d5d');
      }
    },
  };
}
