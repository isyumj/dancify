import { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { initDb } from '../db/database';
import { langReadyPromise } from '../i18n';
import '../i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { Analytics, initAnalytics } from '../utils/analytics';
import { getStoredConsent, storeConsent, ConsentState } from '../utils/privacyGate';
import PrivacyConsentScreen from '../components/PrivacyConsentScreen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(Ionicons.font);
  const [consent, setConsent] = useState<ConsentState | null | 'loading'>('loading');

  useEffect(() => {
    async function bootstrap() {
      await Promise.all([initDb().catch(console.error), langReadyPromise]);
      const stored = await getStoredConsent();
      if (stored === 'accepted') {
        initAnalytics();
        Analytics.appOpened();
      }
      setConsent(stored);
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (fontsLoaded && consent !== 'loading') SplashScreen.hideAsync();
  }, [fontsLoaded, consent]);

  if (!fontsLoaded || consent === 'loading') return null;

  if (consent === null) {
    const handleAccept = async () => {
      await storeConsent('accepted');
      initAnalytics();
      Analytics.appOpened();
      setConsent('accepted');
    };
    const handleDecline = async () => {
      await storeConsent('declined');
      setConsent('declined');
    };
    return <PrivacyConsentScreen onAccept={handleAccept} onDecline={handleDecline} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bgMain },
          headerTintColor: Colors.textPrimary,
          contentStyle: { backgroundColor: Colors.bgMain },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-preview" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
