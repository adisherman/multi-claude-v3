// Individual tile component (memoized for performance)

import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { TILE_COLORS, TILE_TEXT_COLORS, TILE_SIZE, TILE_MARGIN, BOARD_SIZE } from '../utils/constants';

interface TileProps {
  value: number;
  position: number;
}

const getTileStyle = (value: number) => ({
  backgroundColor: TILE_COLORS[value] || '#3c3a32',
});

const getTextStyle = (value: number) => ({
  color: TILE_TEXT_COLORS[value] || '#f9f6f2',
  fontSize: value >= 1000 ? 28 : value >= 100 ? 35 : 45,
  fontWeight: 'bold' as 'bold',
});

const getTilePosition = (position: number) => {
  const row = Math.floor(position / BOARD_SIZE);
  const col = position % BOARD_SIZE;

  return {
    top: row * (TILE_SIZE + TILE_MARGIN),
    left: col * (TILE_SIZE + TILE_MARGIN),
  };
};

export const Tile = React.memo(({ value, position }: TileProps) => {
  const isMounted = useRef(false);
  const prevPositionRef = useRef<number>(position);
  const basePositionRef = useRef(getTilePosition(position));

  // Initialize animated values for transforms (start at 0 offset)
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // On mount, animate scale for new tile
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [scaleAnim]);

  // Animate position when it changes
  useEffect(() => {
    if (isMounted.current && prevPositionRef.current !== position) {
      const oldPos = getTilePosition(prevPositionRef.current);
      const newPos = getTilePosition(position);

      // Calculate the translation delta
      const deltaX = newPos.left - oldPos.left;
      const deltaY = newPos.top - oldPos.top;

      // Start from current position offset
      const currentOffset = {
        x: basePositionRef.current.left - oldPos.left,
        y: basePositionRef.current.top - oldPos.top,
      };

      // Set starting point
      translateXAnim.setValue(currentOffset.x);
      translateYAnim.setValue(currentOffset.y);

      // Animate to new position offset
      Animated.parallel([
        Animated.timing(translateXAnim, {
          toValue: currentOffset.x + deltaX,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: currentOffset.y + deltaY,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // After animation, update base position and reset transforms
        basePositionRef.current = newPos;
        translateXAnim.setValue(0);
        translateYAnim.setValue(0);
      });
    }

    prevPositionRef.current = position;
  }, [position, translateXAnim, translateYAnim]);

  return (
    <Animated.View
      style={[
        styles.tile,
        getTileStyle(value),
        {
          top: basePositionRef.current.top,
          left: basePositionRef.current.left,
          transform: [
            { translateX: translateXAnim },
            { translateY: translateYAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Text style={[styles.tileText, getTextStyle(value)]}>{value}</Text>
    </Animated.View>
  );
});

Tile.displayName = 'Tile';

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tileText: {
    textAlign: 'center',
  },
});
