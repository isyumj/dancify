import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { initDb } from '../db/database';
import { loadPlayerSettings } from '../store/playerStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  useEffect(() => {
    initDb().then(() => loadPlayerSettings()).catch(console.error);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dancify' }} />
      <Stack.Screen name="player" options={{ title: '播放器', headerBackTitle: '返回' }} />
    </Stack>
    </GestureHandlerRootView>
  );
}
