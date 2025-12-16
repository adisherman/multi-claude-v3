// Main game board with gesture handling

import React, { useRef } from 'react';
import { View, Text, PanResponder, StyleSheet, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { Grid } from './Grid';
import { GameState, Direction } from '../types/game';
import { SWIPE_THRESHOLD } from '../utils/constants';

interface GameBoardProps {
  state: GameState;
  onMove: (direction: Direction) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ state, onMove }) => {

  // Gesture handler for swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { dx, dy } = gestureState;

        // Determine swipe direction
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            const direction: Direction = dx > 0 ? 'right' : 'left';
            onMove(direction);
          }
        } else {
          // Vertical swipe
          if (Math.abs(dy) > SWIPE_THRESHOLD) {
            const direction: Direction = dy > 0 ? 'down' : 'up';
            onMove(direction);
          }
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Grid tiles={state.tiles} />

      {/* Game Over Overlay */}
      {state.isGameOver && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverText}>Game Over!</Text>
            <Text style={styles.gameOverSubtext}>
              {state.hasWon ? 'You Win!' : 'No more moves'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginVertical: 20,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(238, 228, 218, 0.73)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  gameOverBox: {
    backgroundColor: '#776e65',
    padding: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#f9f6f2',
    marginBottom: 10,
  },
  gameOverSubtext: {
    fontSize: 20,
    color: '#f9f6f2',
  },
});
