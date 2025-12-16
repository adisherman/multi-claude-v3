// Type definitions for 2048 game

export interface Tile {
  id: string;
  value: number;
  position: number; // 0-15 for 4x4 grid
}

export interface GameState {
  tiles: Tile[];
  score: number;
  bestScore: number;
  isGameOver: boolean;
  hasWon: boolean;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'SPAWN_TILE' }
  | { type: 'RESET' }
  | { type: 'UPDATE_BEST_SCORE' }
  | { type: 'SET_BEST_SCORE'; score: number }
  | { type: 'UNDO' };
