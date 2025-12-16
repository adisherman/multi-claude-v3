// Game constants and configuration

export const BOARD_SIZE = 4;
export const GRID_SIZE = 4 * 4; // 16 tiles
export const TILE_SIZE = 70;
export const TILE_MARGIN = 8;
export const BOARD_PADDING = 10;

// Tile colors matching original 2048 game
export const TILE_COLORS: Record<number, string> = {
  2: '#eee4da',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
};

// Text colors for tiles
export const TILE_TEXT_COLORS: Record<number, string> = {
  2: '#776e65',
  4: '#776e65',
  8: '#f9f6f2',
  16: '#f9f6f2',
  32: '#f9f6f2',
  64: '#f9f6f2',
  128: '#f9f6f2',
  256: '#f9f6f2',
  512: '#f9f6f2',
  1024: '#f9f6f2',
  2048: '#f9f6f2',
};

export const ANIMATION_DURATION = 150;
export const SWIPE_THRESHOLD = 50;

// Game colors
export const COLORS = {
  background: '#faf8ef',
  board: '#bbada0',
  emptyCell: '#cdc1b4',
  text: '#776e65',
  lightText: '#f9f6f2',
  score: '#eee4da',
  button: '#8f7a66',
};
