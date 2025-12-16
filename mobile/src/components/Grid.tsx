// Grid component - displays the game board with tiles

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tile } from './Tile';
import { Tile as TileType } from '../types/game';
import { BOARD_SIZE, TILE_SIZE, TILE_MARGIN, BOARD_PADDING, COLORS } from '../utils/constants';

interface GridProps {
  tiles: TileType[];
}

export const Grid: React.FC<GridProps> = ({ tiles }) => {
  // Create empty cell grid for background
  const emptyCells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i);

  return (
    <View style={styles.gridContainer}>
      {/* Background empty cells */}
      {emptyCells.map(index => (
        <View key={`empty-${index}`} style={styles.emptyCell} />
      ))}

      {/* Actual tiles */}
      <View style={styles.tilesContainer}>
        {tiles.map(tile => (
          <Tile key={tile.id} value={tile.value} position={tile.position} />
        ))}
      </View>
    </View>
  );
};

const boardDimension = BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_MARGIN + 2 * BOARD_PADDING;

const styles = StyleSheet.create({
  gridContainer: {
    width: boardDimension,
    height: boardDimension,
    backgroundColor: COLORS.board,
    borderRadius: 6,
    padding: BOARD_PADDING,
    position: 'relative',
  },
  emptyCell: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: COLORS.emptyCell,
    borderRadius: 4,
    marginRight: TILE_MARGIN,
    marginBottom: TILE_MARGIN,
    opacity: 0.35,
  },
  tilesContainer: {
    position: 'absolute',
    top: BOARD_PADDING,
    left: BOARD_PADDING,
    right: BOARD_PADDING,
    bottom: BOARD_PADDING,
  },
});
