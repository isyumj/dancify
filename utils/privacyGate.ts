import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@redance/privacy_consent_v1';

export type ConsentState = 'accepted' | 'declined';

export async function getStoredConsent(): Promise<ConsentState | null> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    if (val === 'accepted' || val === 'declined') return val;
    return null;
  } catch {
    return null;
  }
}

export async function storeConsent(state: ConsentState): Promise<void> {
  await AsyncStorage.setItem(KEY, state);
}
