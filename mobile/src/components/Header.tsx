// Header component with score and controls

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

interface HeaderProps {
  score: number;
  bestScore: number;
  onNewGame: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export const Header: React.FC<HeaderProps> = ({ score, bestScore, onNewGame, onUndo, canUndo }) => {
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text style={styles.title}>2048</Text>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.undoButton, !canUndo && styles.buttonDisabled]}
            onPress={onUndo}
            disabled={!canUndo}
          >
            <Text style={[styles.buttonText, !canUndo && styles.buttonTextDisabled]}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newGameButton} onPress={onNewGame}>
            <Text style={styles.buttonText}>New Game</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scoresContainer}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>

        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>BEST</Text>
          <Text style={styles.scoreValue}>{bestScore}</Text>
        </View>
      </View>

      <Text style={styles.instructions}>
        Swipe to move tiles. When two tiles with the same number touch, they merge into one!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 60,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  undoButton: {
    backgroundColor: COLORS.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  newGameButton: {
    backgroundColor: COLORS.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#d8d4d0',
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.lightText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextDisabled: {
    color: '#999',
  },
  scoresContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 15,
  },
  scoreBox: {
    backgroundColor: COLORS.score,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    opacity: 0.7,
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  instructions: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7,
  },
});
