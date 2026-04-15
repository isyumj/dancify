import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import zh from './locales/zh.json';
import en from './locales/en.json';

export const LANG_KEY = 'user-language';
export type AppLanguage = 'zh' | 'en';

// Initialise synchronously with a sensible default so the engine is ready
// before any component renders, then switch to the persisted / detected
// language asynchronously (happens before the first frame in practice).
i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Async detection: AsyncStorage → expo-localization → fallback 'en'
(async () => {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    if (stored === 'zh' || stored === 'en') {
      i18n.changeLanguage(stored);
      return;
    }
    const code = Localization.getLocales()[0]?.languageCode ?? '';
    i18n.changeLanguage(code.startsWith('zh') ? 'zh' : 'en');
  } catch {
    // keep default 'en'
  }
})();

/** Switch language and persist the choice. */
export async function changeLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
