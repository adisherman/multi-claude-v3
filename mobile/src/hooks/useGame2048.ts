// Game state management hook using useReducer

import { useReducer, useCallback, useEffect } from 'react';
import { GameState, GameAction, Direction } from '../types/game';
import { initializeBoard, addRandomTile, move, canMove, hasWon } from '../utils/gameLogic';

// Initial game state
const initialGameState: GameState = {
  tiles: initializeBoard(),
  score: 0,
  bestScore: 0,
  isGameOver: false,
  hasWon: false,
};

// Game reducer
const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'MOVE': {
      if (state.isGameOver) {
        return state;
      }

      const { tiles: newTiles, score: scoreGained, moved } = move(state.tiles, action.direction);

      if (!moved) {
        return state;
      }

      // Add random tile after move
      const tilesWithNew = addRandomTile(newTiles);
      const newScore = state.score + scoreGained;
      const isGameOver = !canMove(tilesWithNew);
      const won = hasWon(tilesWithNew);

      return {
        ...state,
        tiles: tilesWithNew,
        score: newScore,
        bestScore: Math.max(state.bestScore, newScore),
        isGameOver,
        hasWon: state.hasWon || won,
      };
    }

    case 'RESET': {
      return {
        tiles: initializeBoard(),
        score: 0,
        bestScore: state.bestScore,
        isGameOver: false,
        hasWon: false,
      };
    }

    case 'UPDATE_BEST_SCORE': {
      return {
        ...state,
        bestScore: Math.max(state.bestScore, state.score),
      };
    }

    default:
      return state;
  }
};

// Custom hook for game state management
export const useGame2048 = () => {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  // Handle move in a specific direction
  const handleMove = useCallback((direction: Direction) => {
    dispatch({ type: 'MOVE', direction });
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Update best score when component unmounts or score changes
  useEffect(() => {
    if (state.score > state.bestScore) {
      dispatch({ type: 'UPDATE_BEST_SCORE' });
    }
  }, [state.score, state.bestScore]);

  return {
    state,
    handleMove,
    resetGame,
  };
};
