import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

export type Language = 'zh' | 'en';
export type LanguagePreference = Language | 'system';
const STORAGE_KEY = '@lycoris/language/v1';

export const resolveSystemLanguage = (locale: unknown): Language => {
  if (typeof locale !== 'string') return 'zh';
  return /^en(?:[-_][a-z0-9]{2,8})*$/i.test(locale.trim()) ? 'en' : 'zh';
};

export const readSystemLanguage = (): Language => {
  try {
    if (Platform.OS === 'ios') {
      const manager = NativeModules.SettingsManager;
      const settings = manager?.getConstants?.()?.settings ?? manager?.settings;
      const locales = settings?.AppleLanguages;
      return resolveSystemLanguage(
        Array.isArray(locales) ? locales[0] : settings?.AppleLocale,
      );
    }
    const manager = NativeModules.I18nManager;
    return resolveSystemLanguage(
      manager?.getConstants?.()?.localeIdentifier ?? manager?.localeIdentifier,
    );
  } catch {
    return 'zh';
  }
};

let snapshot: { language: Language; preference: LanguagePreference } = {
  language: readSystemLanguage(),
  preference: 'system',
};
let revision = 0;
const listeners = new Set<() => void>();
export const getLanguageSnapshot = () => snapshot;
export const getCurrentLanguage = () => snapshot.language;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const applyPreference = (preference: LanguagePreference) => {
  const language = preference === 'system' ? readSystemLanguage() : preference;
  if (snapshot.preference === preference && snapshot.language === language)
    return;
  snapshot = { language, preference };
  listeners.forEach(listener => listener());
};

export const setLanguagePreference = async (preference: LanguagePreference) => {
  revision++;
  applyPreference(preference);
  await AsyncStorage.setItem(STORAGE_KEY, preference).catch(() => undefined);
};

export const restoreLanguagePreference = async () => {
  const startedAt = revision;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (revision !== startedAt) return;
    applyPreference(stored === 'en' || stored === 'zh' ? stored : 'system');
  } catch {
    if (revision === startedAt) applyPreference('system');
  }
};

export const refreshSystemLanguage = () => {
  if (snapshot.preference === 'system') applyPreference('system');
};

export const localizeMarkerPath = (
  path: string,
  language: Language,
): string => {
  const [pathname, query = ''] = path.split('?');
  if (!/^\/?api\/markers(?:\/|$)/.test(pathname)) return path;
  // Keep the query intact (including encoded keywords); replace only our locale key.
  const params = new URLSearchParams(
    query
      .split('&')
      .filter(part => !/^lang(?:=|$)/.test(part))
      .join('&'),
  );
  params.append('lang', language);
  return `${pathname}?${params.toString()}`;
};
