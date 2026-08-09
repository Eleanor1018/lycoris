/**
 * @format
 */

import React from 'react';
import { Pressable, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import {
  LANGUAGE_STORAGE_KEY,
  LanguageProvider,
  languageFromLocale,
  useLanguage,
} from '../src/i18n/LanguageProvider';
import { createHeadingIdGenerator } from '../src/screens/DocsScreen';
import { ApiError, requestJson } from '../src/lib/http';
import {
  nearbyCategories,
  nearbyCategoryLabel,
} from '../src/screens/MapScreen';

function LanguageProbe() {
  const { language, setLanguage } = useLanguage();
  return (
    <Pressable
      testID="language-probe"
      onPress={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
    >
      <Text testID="language-value">{language}</Text>
    </Pressable>
  );
}

test('normalizes Chinese locales and defaults other locales to English', () => {
  expect(languageFromLocale('zh-Hans-CN')).toBe('zh');
  expect(languageFromLocale('zh_TW')).toBe('zh');
  expect(languageFromLocale('en-US')).toBe('en');
  expect(languageFromLocale('')).toBe('en');
});

test('creates stable heading ids for each Markdown render', () => {
  const firstEnglishRender = createHeadingIdGenerator();
  expect(firstEnglishRender('Safety first')).toBe('safety-first');
  expect(firstEnglishRender('Safety first')).toBe('safety-first-2');

  const chineseRender = createHeadingIdGenerator();
  expect(chineseRender('安全第一')).toBe('安全第一');

  const secondEnglishRender = createHeadingIdGenerator();
  expect(secondEnglishRender('Safety first')).toBe('safety-first');
});

test('restores, persists, and sends the selected language', async () => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh');
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );
  });

  expect(
    renderer?.root.findByProps({ testID: 'language-value' }).props.children,
  ).toBe('zh');

  (globalThis.fetch as jest.Mock).mockRejectedValueOnce(
    new TypeError('Network request failed'),
  );
  await expect(requestJson('/api/offline')).rejects.toMatchObject({
    status: 0,
    message: '无法连接服务器，请检查网络后重试。',
  });

  (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
    text: async () => '',
  });
  await requestJson('/api/test-language-zh');
  let requestInit = (globalThis.fetch as jest.Mock).mock.calls.at(-1)?.[1];
  expect(requestInit.headers.get('Accept-Language')).toContain('zh-CN');

  await ReactTestRenderer.act(async () => {
    await renderer?.root
      .findByProps({ testID: 'language-probe' })
      .props.onPress();
  });

  expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  expect(
    renderer?.root.findByProps({ testID: 'language-value' }).props.children,
  ).toBe('en');

  (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
    text: async () => '',
  });
  await requestJson('/api/test-language');
  requestInit = (globalThis.fetch as jest.Mock).mock.calls.at(-1)?.[1];
  expect(requestInit.headers.get('Accept-Language')).toContain('en');

  (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
    text: async () => '',
  });
  const invalidJsonRequest = requestJson('/api/invalid-json');
  await expect(invalidJsonRequest).rejects.toBeInstanceOf(ApiError);
  await expect(invalidJsonRequest).rejects.toMatchObject({
    status: 200,
    message: 'The server returned unreadable data. Please try again later.',
  });

  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
});

test('renders the app shell with the default map route', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer?.root.findByProps({ testID: 'map-webview' })).toBeTruthy();
  expect(nearbyCategories).toContain('baby_room');
  expect(nearbyCategoryLabel.accessible_toilet).toBe('Accessible Restroom');
  expect(nearbyCategoryLabel.friendly_clinic).toBe('Trans-Friendly Clinic');
  expect(nearbyCategoryLabel.baby_room).toBe('Nursing Room');
  expect(nearbyCategories).not.toContain('conversion_therapy');

  await ReactTestRenderer.act(() => {
    renderer?.root
      .findByProps({ accessibilityLabel: 'Open map settings' })
      .props.onPress();
  });
  expect(
    renderer?.root.findByProps({ accessibilityLabel: 'Select language' }).props
      .accessibilityValue,
  ).toEqual({ text: 'English' });

  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
});
