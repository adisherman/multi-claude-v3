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
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const tilePosition = getTilePosition(position);

  return (
    <Animated.View
      style={[
        styles.tile,
        getTileStyle(value),
        tilePosition,
        {
          transform: [{ scale: scaleAnim }],
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
