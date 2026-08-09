import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'zh' | 'en';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  tr: (zh: string, en: string) => string;
};

export const LANGUAGE_STORAGE_KEY = 'lycoris.language.v1';

const getNativeLocale = (): string => {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) return resolved;
  } catch {
    // Fall through to the native settings exposed by React Native.
  }

  const settings = NativeModules.SettingsManager?.settings;
  if (Platform.OS === 'ios') {
    return settings?.AppleLocale ?? settings?.AppleLanguages?.[0] ?? '';
  }
  return NativeModules.I18nManager?.localeIdentifier ?? '';
};

export const languageFromLocale = (locale: string): AppLanguage =>
  /^zh(?:[-_]|$)/i.test(locale.trim()) ? 'zh' : 'en';

export const detectSystemLanguage = (): AppLanguage =>
  languageFromLocale(getNativeLocale());

let runtimeLanguage: AppLanguage = detectSystemLanguage();

export const getRuntimeLanguage = (): AppLanguage => runtimeLanguage;

export const getAcceptLanguage = (): string =>
  runtimeLanguage === 'zh' ? 'zh-CN,zh;q=0.9,en;q=0.7' : 'en,en-US;q=0.9';

export const trForLanguage = (
  language: AppLanguage,
  zh: string,
  en: string,
): string => (language === 'zh' ? zh : en);

export const tr = (zh: string, en: string): string =>
  trForLanguage(runtimeLanguage, zh, en);

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(runtimeLanguage);
  const [hydrated, setHydrated] = useState(false);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    runtimeLanguage = nextLanguage;
    setLanguageState(nextLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // A storage failure must not prevent an in-session language change.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then(stored => {
        if (!alive || (stored !== 'zh' && stored !== 'en')) return;
        runtimeLanguage = stored;
        setLanguageState(stored);
      })
      .catch(() => {
        // Keep the system-locale default when storage is unavailable.
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const translate = useCallback(
    (zh: string, en: string) => trForLanguage(language, zh, en),
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, tr: translate }),
    [language, setLanguage, translate],
  );

  if (!hydrated) return null;

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within <LanguageProvider>');
  }
  return context;
};
