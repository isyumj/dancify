import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

const KEY_SESSION_COUNT = 'rating_session_count';
const KEY_HAS_PROMPTED = 'rating_has_prompted';
const PROMPT_THRESHOLD = 5;

// Fill in once the app is live on App Store
const APP_STORE_ID = '';

async function getSessionCount(): Promise<number> {
  const val = await AsyncStorage.getItem(KEY_SESSION_COUNT);
  return val ? parseInt(val, 10) : 0;
}

/** Call after each completed practice session. Shows native review dialog on the 5th session. */
export async function recordSessionAndMaybePrompt(): Promise<void> {
  const hasPrompted = await AsyncStorage.getItem(KEY_HAS_PROMPTED);
  if (hasPrompted === 'true') return;

  const count = await getSessionCount();
  const next = count + 1;
  await AsyncStorage.setItem(KEY_SESSION_COUNT, String(next));

  if (next >= PROMPT_THRESHOLD) {
    await AsyncStorage.setItem(KEY_HAS_PROMPTED, 'true');
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    }
  }
}

/** Opens App Store rating page directly. Used for the manual entry in profile. */
export function openAppStoreRatingPage(): void {
  const url =
    Platform.OS === 'ios'
      ? APP_STORE_ID
        ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
        : `itms-apps://itunes.apple.com/search?term=ReDance`
      : `market://details?id=com.isyumj.dancify`;
  Linking.openURL(url).catch(() => {});
}
