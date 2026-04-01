import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { initDb } from '../db/database';

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  return (
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
  );
}
