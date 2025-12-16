// Game state management hook using useReducer

import { useReducer, useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, GameAction, Direction } from '../types/game';
import { initializeBoard, addRandomTile, move, canMove, hasWon } from '../utils/gameLogic';

// AsyncStorage key for best score
const BEST_SCORE_KEY = '@game2048_best_score';

// Maximum number of moves to keep in history
const MAX_HISTORY_LENGTH = 10;

// Extended state with history
interface GameStateWithHistory {
  current: GameState;
  history: GameState[];
}

// Initial game state
const initialGameState: GameState = {
  tiles: initializeBoard(),
  score: 0,
  bestScore: 0,
  isGameOver: false,
  hasWon: false,
};

const initialStateWithHistory: GameStateWithHistory = {
  current: initialGameState,
  history: [],
};

// Game reducer with history tracking
const gameReducer = (state: GameStateWithHistory, action: GameAction): GameStateWithHistory => {
  switch (action.type) {
    case 'MOVE': {
      if (state.current.isGameOver) {
        return state;
      }

      const { tiles: newTiles, score: scoreGained, moved } = move(state.current.tiles, action.direction);

      if (!moved) {
        return state;
      }

      // Add random tile after move
      const tilesWithNew = addRandomTile(newTiles);
      const newScore = state.current.score + scoreGained;
      const isGameOver = !canMove(tilesWithNew);
      const won = hasWon(tilesWithNew);

      const newGameState: GameState = {
        ...state.current,
        tiles: tilesWithNew,
        score: newScore,
        bestScore: Math.max(state.current.bestScore, newScore),
        isGameOver,
        hasWon: state.current.hasWon || won,
      };

      // Add current state to history before updating
      const newHistory = [state.current, ...state.history].slice(0, MAX_HISTORY_LENGTH);

      return {
        current: newGameState,
        history: newHistory,
      };
    }

    case 'UNDO': {
      if (state.history.length === 0) {
        return state;
      }

      // Pop the most recent state from history
      const [previousState, ...remainingHistory] = state.history;

      return {
        current: previousState,
        history: remainingHistory,
      };
    }

    case 'RESET': {
      const newGameState: GameState = {
        tiles: initializeBoard(),
        score: 0,
        bestScore: state.current.bestScore,
        isGameOver: false,
        hasWon: false,
      };

      return {
        current: newGameState,
        history: [],
      };
    }

    case 'UPDATE_BEST_SCORE': {
      return {
        ...state,
        current: {
          ...state.current,
          bestScore: Math.max(state.current.bestScore, state.current.score),
        },
      };
    }

    case 'SET_BEST_SCORE': {
      return {
        ...state,
        current: {
          ...state.current,
          bestScore: action.score,
        },
      };
    }

    default:
      return state;
  }
};

// Custom hook for game state management
export const useGame2048 = () => {
  const [state, dispatch] = useReducer(gameReducer, initialStateWithHistory);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load best score from AsyncStorage on mount
  useEffect(() => {
    const loadBestScore = async () => {
      try {
        const savedBestScore = await AsyncStorage.getItem(BEST_SCORE_KEY);
        if (savedBestScore !== null) {
          const score = parseInt(savedBestScore, 10);
          if (!isNaN(score)) {
            dispatch({ type: 'SET_BEST_SCORE', score });
          }
        }
      } catch (error) {
        console.error('Error loading best score:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadBestScore();
  }, []);

  // Save best score to AsyncStorage when it changes
  useEffect(() => {
    const saveBestScore = async () => {
      if (!isLoaded) return; // Don't save until initial load is complete

      try {
        await AsyncStorage.setItem(BEST_SCORE_KEY, state.current.bestScore.toString());
      } catch (error) {
        console.error('Error saving best score:', error);
      }
    };

    saveBestScore();
  }, [state.current.bestScore, isLoaded]);

  // Handle move in a specific direction
  const handleMove = useCallback((direction: Direction) => {
    dispatch({ type: 'MOVE', direction });
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Undo last move
  const undoMove = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  // Update best score when component unmounts or score changes
  useEffect(() => {
    if (state.current.score > state.current.bestScore) {
      dispatch({ type: 'UPDATE_BEST_SCORE' });
    }
  }, [state.current.score, state.current.bestScore]);

  return {
    state: state.current,
    handleMove,
    resetGame,
    undoMove,
    canUndo: state.history.length > 0,
  };
};
