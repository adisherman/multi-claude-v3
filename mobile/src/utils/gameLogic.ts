// Pure game logic for 2048

import { Tile, Direction } from '../types/game';
import { BOARD_SIZE, GRID_SIZE } from './constants';

// Generate unique ID for tiles
let tileIdCounter = 0;
export const generateTileId = (): string => {
  tileIdCounter++;
  return `tile-${tileIdCounter}`;
};

// Initialize board with 2 random tiles
export const initializeBoard = (): Tile[] => {
  const tiles: Tile[] = [];

  // Add first tile
  const pos1 = Math.floor(Math.random() * GRID_SIZE);
  tiles.push({
    id: generateTileId(),
    value: Math.random() < 0.9 ? 2 : 4,
    position: pos1,
  });

  // Add second tile
  let pos2 = Math.floor(Math.random() * GRID_SIZE);
  while (pos2 === pos1) {
    pos2 = Math.floor(Math.random() * GRID_SIZE);
  }
  tiles.push({
    id: generateTileId(),
    value: Math.random() < 0.9 ? 2 : 4,
    position: pos2,
  });

  return tiles;
};

// Get empty positions on the board
export const getEmptyPositions = (tiles: Tile[]): number[] => {
  const occupied = new Set(tiles.map(t => t.position));
  const empty: number[] = [];

  for (let i = 0; i < GRID_SIZE; i++) {
    if (!occupied.has(i)) {
      empty.push(i);
    }
  }

  return empty;
};

// Add a random tile to the board
export const addRandomTile = (tiles: Tile[]): Tile[] => {
  const empty = getEmptyPositions(tiles);

  if (empty.length === 0) {
    return tiles;
  }

  const randomIndex = Math.floor(Math.random() * empty.length);
  const position = empty[randomIndex];

  const newTile: Tile = {
    id: generateTileId(),
    value: Math.random() < 0.9 ? 2 : 4,
    position,
  };

  return [...tiles, newTile];
};

// Convert 1D position to 2D coordinates
const positionTo2D = (position: number): [number, number] => {
  const row = Math.floor(position / BOARD_SIZE);
  const col = position % BOARD_SIZE;
  return [row, col];
};

// Convert 2D coordinates to 1D position
const position1D = (row: number, col: number): number => {
  return row * BOARD_SIZE + col;
};

// Get tile at specific position
const getTileAtPosition = (tiles: Tile[], position: number): Tile | undefined => {
  return tiles.find(t => t.position === position);
};

// Slide and merge a row of tiles to the left
const slideAndMergeRow = (row: Tile[]): { tiles: Tile[], scoreGained: number } => {
  if (row.length === 0) {
    return { tiles: [], scoreGained: 0 };
  }

  // Sort by position (left to right for this row)
  const sorted = [...row].sort((a, b) => {
    const [, colA] = positionTo2D(a.position);
    const [, colB] = positionTo2D(b.position);
    return colA - colB;
  });

  const merged: Tile[] = [];
  let scoreGained = 0;
  let skipNext = false;

  for (let i = 0; i < sorted.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const current = sorted[i];
    const next = sorted[i + 1];

    // Check if can merge with next tile
    if (next && current.value === next.value) {
      const [row] = positionTo2D(current.position);
      const newPosition = position1D(row, merged.length);

      merged.push({
        id: generateTileId(),
        value: current.value * 2,
        position: newPosition,
      });

      scoreGained += current.value * 2;
      skipNext = true;
    } else {
      const [row] = positionTo2D(current.position);
      const newPosition = position1D(row, merged.length);

      merged.push({
        ...current,
        position: newPosition,
      });
    }
  }

  return { tiles: merged, scoreGained };
};

// Move tiles in a specific direction
export const move = (tiles: Tile[], direction: Direction): { tiles: Tile[], score: number, moved: boolean } => {
  // Group tiles by rows or columns depending on direction
  const groups: Tile[][] = [];

  for (let i = 0; i < BOARD_SIZE; i++) {
    groups.push([]);
  }

  tiles.forEach(tile => {
    const [row, col] = positionTo2D(tile.position);

    switch (direction) {
      case 'left':
      case 'right':
        groups[row].push(tile);
        break;
      case 'up':
      case 'down':
        groups[col].push(tile);
        break;
    }
  });

  // Process each group
  const newTiles: Tile[] = [];
  let totalScore = 0;

  for (let i = 0; i < BOARD_SIZE; i++) {
    let group = groups[i];

    // For right/down, reverse the group
    if (direction === 'right' || direction === 'down') {
      group = group.map(tile => {
        const [row, col] = positionTo2D(tile.position);

        if (direction === 'right') {
          return { ...tile, position: position1D(row, BOARD_SIZE - 1 - col) };
        } else {
          return { ...tile, position: position1D(BOARD_SIZE - 1 - row, col) };
        }
      });
    }

    const { tiles: processedTiles, scoreGained } = slideAndMergeRow(group);
    totalScore += scoreGained;

    // Convert back to original direction
    const finalTiles = processedTiles.map(tile => {
      const [row, col] = positionTo2D(tile.position);

      if (direction === 'right') {
        return { ...tile, position: position1D(row, BOARD_SIZE - 1 - col) };
      } else if (direction === 'down') {
        return { ...tile, position: position1D(BOARD_SIZE - 1 - row, col) };
      } else if (direction === 'up' || direction === 'down') {
        return { ...tile, position: position1D(col, row) };
      }

      return tile;
    });

    newTiles.push(...finalTiles);
  }

  // Check if board state changed
  const moved = !tilesEqual(tiles, newTiles);

  return { tiles: newTiles, score: totalScore, moved };
};

// Check if two tile arrays are equal
const tilesEqual = (tiles1: Tile[], tiles2: Tile[]): boolean => {
  if (tiles1.length !== tiles2.length) {
    return false;
  }

  const positions1 = tiles1.map(t => `${t.position}-${t.value}`).sort();
  const positions2 = tiles2.map(t => `${t.position}-${t.value}`).sort();

  return positions1.join(',') === positions2.join(',');
};

// Check if any moves are possible
export const canMove = (tiles: Tile[]): boolean => {
  // Check if there are empty cells
  if (tiles.length < GRID_SIZE) {
    return true;
  }

  // Check if any adjacent tiles can be merged
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const currentPos = position1D(row, col);
      const currentTile = getTileAtPosition(tiles, currentPos);

      if (!currentTile) continue;

      // Check right neighbor
      if (col < BOARD_SIZE - 1) {
        const rightPos = position1D(row, col + 1);
        const rightTile = getTileAtPosition(tiles, rightPos);
        if (rightTile && rightTile.value === currentTile.value) {
          return true;
        }
      }

      // Check bottom neighbor
      if (row < BOARD_SIZE - 1) {
        const bottomPos = position1D(row + 1, col);
        const bottomTile = getTileAtPosition(tiles, bottomPos);
        if (bottomTile && bottomTile.value === currentTile.value) {
          return true;
        }
      }
    }
  }

  return false;
};

// Check if player has won (reached 2048)
export const hasWon = (tiles: Tile[]): boolean => {
  return tiles.some(tile => tile.value >= 2048);
};
