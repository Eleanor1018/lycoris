import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import {
  getLanguageSnapshot,
  localizeMarkerPath,
  readSystemLanguage,
  refreshSystemLanguage,
  resolveSystemLanguage,
  restoreLanguagePreference,
  setLanguagePreference,
} from '../src/i18n/language';
import { translate } from '../src/i18n/messages';

afterEach(async () => {
  jest.restoreAllMocks();
  await setLanguagePreference('zh');
});

test.each([
  ['en-US', 'en'],
  ['EN_gb', 'en'],
  ['en', 'en'],
  ['zh-Hant-HK', 'zh'],
  ['fr-FR', 'zh'],
  ['en-?', 'zh'],
  ['', 'zh'],
  [null, 'zh'],
  [42, 'zh'],
])('system locale %p resolves to %s', (locale, expected) => {
  expect(resolveSystemLanguage(locale)).toBe(expected);
});

test('Android system locale follows native configuration but a manual preference stays fixed', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const previous = NativeModules.I18nManager;
  try {
    NativeModules.I18nManager = { localeIdentifier: 'en-US' };
    await setLanguagePreference('system');
    expect(getLanguageSnapshot()).toEqual({
      language: 'en',
      preference: 'system',
    });
    await setLanguagePreference('zh');
    refreshSystemLanguage();
    expect(getLanguageSnapshot()).toEqual({ language: 'zh', preference: 'zh' });
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      '@lycoris/language/v1',
      'zh',
    );
  } finally {
    NativeModules.I18nManager = previous;
  }
});

test('iOS reads the preferred language and falls back to Chinese for malformed native values', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const previous = NativeModules.SettingsManager;
  try {
    NativeModules.SettingsManager = {
      settings: { AppleLanguages: ['en-GB', 'zh-Hans'] },
    };
    expect(readSystemLanguage()).toBe('en');
    NativeModules.SettingsManager = {
      getConstants: () => {
        throw new Error('unavailable');
      },
    };
    expect(readSystemLanguage()).toBe('zh');
  } finally {
    NativeModules.SettingsManager = previous;
  }
});

test('a delayed persisted preference cannot overwrite a newer manual selection', async () => {
  let resolveRead!: (value: string | null) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(
    new Promise(resolve => {
      resolveRead = resolve;
    }),
  );
  const restore = restoreLanguagePreference();
  await setLanguagePreference('en');
  resolveRead('zh');
  await restore;
  expect(getLanguageSnapshot()).toEqual({ language: 'en', preference: 'en' });
});

test('iOS native constants reflect a changed system preference without overriding a manual language', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const previous = NativeModules.SettingsManager;
  let locale = 'en-US';
  try {
    NativeModules.SettingsManager = {
      getConstants: () => ({ settings: { AppleLanguages: [locale] } }),
    };
    await setLanguagePreference('system');
    expect(getLanguageSnapshot().language).toBe('en');
    locale = 'zh-Hans';
    refreshSystemLanguage();
    expect(getLanguageSnapshot()).toEqual({
      language: 'zh',
      preference: 'system',
    });
    await setLanguagePreference('en');
    refreshSystemLanguage();
    expect(getLanguageSnapshot()).toEqual({ language: 'en', preference: 'en' });
  } finally {
    NativeModules.SettingsManager = previous;
  }
});

test('marker URLs replace the language without corrupting encoded search terms or unrelated paths', () => {
  expect(
    localizeMarkerPath('/api/markers/search?q=A%26B%3D1&lang=zh', 'en'),
  ).toBe('/api/markers/search?q=A%26B%3D1&lang=en');
  expect(localizeMarkerPath('/api/markers/me/created', 'en')).toBe(
    '/api/markers/me/created?lang=en',
  );
  expect(localizeMarkerPath('/api/me', 'en')).toBe('/api/me');
  expect(translate('贡献语言：{language}', { language: 'English' }, 'en')).toBe(
    'Contribution language: English',
  );
});
