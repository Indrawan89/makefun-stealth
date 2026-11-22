// The museum: a 34 x 17 tile map with three halls, cover crates, loot and an exit.
// 'P' player start, 'E' exit, 'L' loot, 'G' guard post, 'K' crate (blocks sight
// and movement), '#' wall, '.' open floor. Doors join the halls.
export const GRID_WIDTH = 34;
export const GRID_HEIGHT = 17;
export const TILE = 34;

export const HALLS = [
  { name: 'Gallery of Whispers', x0: 1, y0: 1, x1: 10, y1: 15 },
  { name: 'Hall of Kings', x0: 12, y0: 1, x1: 21, y1: 15 },
  { name: 'The Vault', x0: 23, y0: 1, x1: 32, y1: 15 },
];

const ROWS = [
  '##################################',
  '#....K.....#.....K....#.....K....#',
  '#..L.......#....L.....#....L.....#',
  '#....K..K..#..K....K..#..K....K..#',
  '#..........#..........#..........#',
  '#..G....P..#....G.....#....G.....#',
  '#..........#..........#..........#',
  '###.####.###.####.###.####.#######',
  '#..........#..........#..........#',
  '#..K....K..#..K....K..#..K....K..#',
  '#....L.....#....L.....#....L.....#',
  '#..........#..........#....K.....#',
  '#..G.......#....G.....#..G..E....#',
  '#.....K....#......K...#....K.....#',
  '#..........#..........#..........#',
  '#..........#..........#..........#',
  '##################################',
];

export function buildLevel() {
  const tiles = ROWS.map((row) => row.split(''));
  const loot = [];
  const guards = [];
  let playerStart = { x: 5, y: 5 };
  let exit = { x: 28, y: 12 };
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const cell = tiles[y][x];
      if (cell === 'L') {
        loot.push({ x, y, taken: false, id: loot.length });
        tiles[y][x] = '.';
      } else if (cell === 'P') {
        playerStart = { x, y };
        tiles[y][x] = '.';
      } else if (cell === 'E') {
        exit = { x, y };
        tiles[y][x] = '.';
      } else if (cell === 'G') {
        guards.push({ x, y });
        tiles[y][x] = '.';
      }
    }
  }
  return { tiles, loot, guards, playerStart, exit, halls: HALLS };
}

export function isWall(level, x, y) {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return true;
  return level.tiles[y][x] === '#' || level.tiles[y][x] === 'K';
}

export function blocksSight(level, x, y) {
  return isWall(level, x, y);
}

export function hallAt(x, y) {
  for (const hall of HALLS) {
    if (x >= hall.x0 && x <= hall.x1 && y >= hall.y0 && y <= hall.y1) return hall.name;
  }
  return 'Museum';
}

// Pixel centre of a tile.
export function tileCentre(tile) {
  return { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
}
