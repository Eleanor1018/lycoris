import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Linking, Platform, Share } from 'react-native';
import { MapScreen } from '../src/screens/MapScreen';
import { setLanguagePreference } from '../src/i18n/language';

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { publicId: 'member-1', username: 'member' },
    isLoggedIn: true,
  }),
}));

const marker = {
  id: 71,
  lat: 22.3,
  lng: 114.2,
  category: 'accessible_toilet',
  title: '原文点位',
  description: '入口在左侧',
  contentLanguage: 'zh',
  sourceLanguage: 'zh',
  isPublic: true,
  isActive: true,
};
const response = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  } as Response);
const fetchMock = jest.mocked(fetch);
let screen: ReactTestRenderer.ReactTestRenderer;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'ios');
  await setLanguagePreference('zh');
  fetchMock.mockReset().mockResolvedValue(response([]));
  await ReactTestRenderer.act(async () => {
    screen = ReactTestRenderer.create(<MapScreen />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => screen?.unmount());
  await setLanguagePreference('zh');
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const press = async (props: Record<string, unknown>) => {
  await ReactTestRenderer.act(async () => {
    await screen.root.findByProps(props).props.onPress();
  });
};
const query = async (value: string) => {
  await ReactTestRenderer.act(async () =>
    screen.root
      .findByProps({ testID: 'marker-search-input' })
      .props.onChangeText(value),
  );
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(250);
  });
};
const selectSearchResult = async () => {
  fetchMock.mockResolvedValue(response([marker]));
  await press({ testID: 'marker-search-button' });
  await query('clinic');
  await press({ testID: 'marker-search-result-71' });
};

test('new keywords and language cancel earlier searches and reject their late results', async () => {
  const pending: {
    url: string;
    signal: AbortSignal;
    resolve: (value: Response) => void;
  }[] = [];
  fetchMock.mockImplementation(
    (url, init) =>
      new Promise(resolve => {
        pending.push({ url: String(url), signal: init!.signal!, resolve });
      }),
  );
  await press({ testID: 'marker-search-button' });
  await query('old');
  await query('new');
  expect(pending[0].signal.aborted).toBe(true);
  await ReactTestRenderer.act(async () => {
    await setLanguagePreference('en');
  });
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(pending[1].signal.aborted).toBe(true);
  expect(pending.map(request => request.url.match(/q=.*$/)?.[0])).toEqual([
    'q=old&lang=zh',
    'q=new&lang=zh',
    'q=new&lang=en',
  ]);
  await ReactTestRenderer.act(async () => {
    pending[2].resolve(
      response([
        {
          ...marker,
          id: 3,
          title: 'Current English result',
          contentLanguage: 'en',
        },
      ]),
    );
    pending[1].resolve(
      response([{ ...marker, id: 2, title: 'Stale Chinese result' }]),
    );
    pending[0].resolve(
      response([{ ...marker, id: 1, title: 'Stale keyword result' }]),
    );
  });
  expect(
    screen.root.findAllByProps({ testID: 'marker-search-result-3' }),
  ).not.toHaveLength(0);
  expect(
    screen.root.findAllByProps({ testID: 'marker-search-result-2' }),
  ).toHaveLength(0);
  expect(
    screen.root.findAllByProps({ testID: 'marker-search-result-1' }),
  ).toHaveLength(0);
});

test('map settings switches the language and a selected result exposes translated native actions', async () => {
  await press({ accessibilityLabel: '地图设置' });
  await press({ testID: 'language-en' });
  expect(JSON.stringify(screen.toJSON())).toContain('Language');
  // Close settings through its backdrop-independent header button.
  const settingsModal = screen.root.findAll(
    node => node.props.visible === true && node.props.onRequestClose,
  )[0];
  await ReactTestRenderer.act(async () => settingsModal.props.onRequestClose());
  await selectSearchResult();
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Directions' }),
  ).not.toHaveLength(0);
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Share' }),
  ).not.toHaveLength(0);
});

test('directions use coordinates while share and web map use the same ID-only link after a tap', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.dismissedAction });
  await ReactTestRenderer.act(async () => {
    await setLanguagePreference('en');
  });
  await selectSearchResult();
  expect(openURL).not.toHaveBeenCalled();
  expect(share).not.toHaveBeenCalled();
  await press({ accessibilityLabel: 'Directions' });
  expect(openURL.mock.calls[0][0]).toMatch(
    /^https:\/\/maps\.apple\.com\/\?daddr=22.3,114.2&q=/,
  );
  await press({ accessibilityLabel: 'Share' });
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      title: marker.title,
      url: expect.stringMatching(/\/maps\?markerId=71&lang=en$/),
    }),
  );
  await press({ accessibilityLabel: 'Web map' });
  expect(openURL).toHaveBeenLastCalledWith(share.mock.calls[0][0].url);
});

test('editing an untranslated point keeps the original as a reference and submits explicit English content', async () => {
  await ReactTestRenderer.act(async () => {
    await setLanguagePreference('en');
  });
  await selectSearchResult();
  await press({ testID: 'marker-edit-button' });
  expect(
    screen.root.findByProps({ testID: 'draft-title-input' }).props.value,
  ).toBe('');
  expect(
    screen.root.findByProps({ testID: 'draft-description-input' }).props.value,
  ).toBe('');
  expect(JSON.stringify(screen.toJSON())).toContain('Original text');
  await ReactTestRenderer.act(async () => {
    screen.root
      .findByProps({ testID: 'draft-title-input' })
      .props.onChangeText('Accessible toilet');
    screen.root
      .findByProps({ testID: 'draft-description-input' })
      .props.onChangeText('Entrance on the left');
  });
  fetchMock.mockResolvedValue(
    response({ ...marker, title: 'Accessible toilet', contentLanguage: 'en' }),
  );
  await press({ testID: 'draft-save-button' });
  const edit = fetchMock.mock.calls.find(
    ([, init]) => init?.method === 'PATCH',
  );
  expect(edit).toBeDefined();
  expect(JSON.parse(String(edit![1]?.body))).toMatchObject({
    language: 'en',
    title: 'Accessible toilet',
    description: 'Entrance on the left',
  });
  expect((edit![1]?.headers as Headers).get('Accept-Language')).toBe('en');
});

test('a language switch invalidates the viewport request and displays only the new localized point', async () => {
  const pending: { signal: AbortSignal; resolve: (value: Response) => void }[] =
    [];
  fetchMock.mockImplementation((url, init) => {
    if (!String(url).includes('/viewport?'))
      return Promise.resolve(response([]));
    return new Promise(resolve =>
      pending.push({ signal: init!.signal!, resolve }),
    );
  });
  const sendMapMessage = async (message: unknown) => {
    await ReactTestRenderer.act(async () =>
      screen.root
        .findByProps({ testID: 'map-webview' })
        .props.onMessage({ nativeEvent: { data: JSON.stringify(message) } }),
    );
  };
  await sendMapMessage({
    type: 'moveend',
    latitude: 22.3,
    longitude: 114.2,
    zoom: 12,
    south: 22,
    north: 23,
    west: 114,
    east: 115,
  });
  expect(pending).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    await setLanguagePreference('en');
  });
  expect(pending[0].signal.aborted).toBe(true);
  await ReactTestRenderer.act(async () => {
    pending[1].resolve(
      response([
        { ...marker, title: 'Localized viewport place', contentLanguage: 'en' },
      ]),
    );
    pending[0].resolve(
      response([{ ...marker, title: 'Stale viewport place' }]),
    );
  });
  await sendMapMessage({ type: 'markerPress', id: 71 });
  expect(JSON.stringify(screen.toJSON())).toContain('Localized viewport place');
  expect(JSON.stringify(screen.toJSON())).not.toContain('Stale viewport place');
});
