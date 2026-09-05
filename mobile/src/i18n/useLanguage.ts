import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  getLanguageSnapshot,
  refreshSystemLanguage,
  restoreLanguagePreference,
  subscribeLanguage,
} from './language';

export const useLanguage = () =>
  useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageSnapshot,
  );

export const useInitializeLanguage = () => {
  useEffect(() => {
    restoreLanguagePreference().catch(() => undefined);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshSystemLanguage();
    });
    return () => subscription.remove();
  }, []);
};
