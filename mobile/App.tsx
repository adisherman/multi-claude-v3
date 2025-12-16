import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Header } from './src/components/Header';
import { GameBoard } from './src/components/GameBoard';
import { useGame2048 } from './src/hooks/useGame2048';
import { COLORS } from './src/utils/constants';

export default function App() {
  const { state, handleMove, resetGame } = useGame2048();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Header
          score={state.score}
          bestScore={state.bestScore}
          onNewGame={resetGame}
        />
        <GameBoard state={state} onMove={handleMove} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
