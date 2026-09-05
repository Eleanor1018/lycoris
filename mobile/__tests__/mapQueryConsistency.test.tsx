import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Platform, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapScreen } from '../src/screens/MapScreen';
import { setLanguagePreference } from '../src/i18n/language';
import type { MapMarker } from '../src/types/marker';

const mockInjectJavaScript = jest.fn<void, [string]>();
let mockWebViewMounts = 0;
let mockUser: { publicId: string; username: string } | null = null;

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, isLoggedIn: mockUser !== null }),
}));

// Two available providers let us exercise a real WebView remount through the
// existing settings UI. These URLs never load in this native-view test double.
jest.mock('../src/config/runtime', () => ({
  ...jest.requireActual('../src/config/runtime'),
  THUNDERFOREST_API_KEY: 'unit-test-map-key',
  TIANDITU_API_KEY: '',
}));

jest.mock('react-native-webview', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const WebView = ReactModule.forwardRef((props: object, ref: unknown) => {
    ReactModule.useImperativeHandle(
      ref,
      () => ({ injectJavaScript: mockInjectJavaScript }),
      [],
    );
    ReactModule.useEffect(() => {
      mockWebViewMounts += 1;
    }, []);
    return ReactModule.createElement(View, {
      ...props,
      testID: 'map-webview',
    });
  });
  return { WebView, default: WebView };
});

const destination: MapMarker = {
  id: 71,
  lat: 22.3,
  lng: 114.2,
  title: 'Destination outside the old viewport',
  description: 'Details from the chosen result',
  category: 'accessible_toilet',
  isPublic: true,
  isActive: true,
  contentLanguage: 'zh',
  sourceLanguage: 'zh',
};
const localMarker: MapMarker = {
  ...destination,
  id: 72,
  lat: 39.91,
  lng: 116.4,
  title: 'Place inside the current viewport',
  description: 'Initial detail',
};
const oldView = {
  type: 'moveend',
  latitude: 39.91,
  longitude: 116.4,
  zoom: 13,
  south: 39.8,
  north: 40,
  west: 116.3,
  east: 116.5,
};
const destinationView = {
  type: 'moveend',
  latitude: destination.lat,
  longitude: destination.lng,
  zoom: 15,
  south: 22.29,
  north: 22.31,
  west: 114.19,
  east: 114.21,
};
const response = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  } as Response);

type PendingViewport = {
  url: string;
  settled: boolean;
  respond: (markers: MapMarker[]) => void;
};
let viewports: PendingViewport[];
let screen: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'ios');
  await AsyncStorage.clear();
  await setLanguagePreference('zh');
  mockUser = { publicId: 'member-1', username: 'member' };
  mockWebViewMounts = 0;
  mockInjectJavaScript.mockClear();
  viewports = [];
  jest
    .mocked(fetch)
    .mockReset()
    .mockImplementation((url, _init) => {
      const path = String(url);
      if (path.includes('/api/markers/viewport?')) {
        // Deliberately ignore AbortSignal: a late transport/cache response must
        // still be unable to replace a newer user selection.
        return new Promise(resolve => {
          const pending: PendingViewport = {
            url: path,
            settled: false,
            respond: markers => {
              pending.settled = true;
              resolve(response(markers));
            },
          };
          viewports.push(pending);
        });
      }
      if (/\/api\/markers\/(search|nearby)\?/.test(path)) {
        return Promise.resolve(response([{ ...destination }]));
      }
      if (/\/api\/markers\/71(?:\?|$)/.test(path)) {
        return Promise.resolve(response({ ...destination }));
      }
      return Promise.resolve(response([]));
    });
  await ReactTestRenderer.act(async () => {
    screen = ReactTestRenderer.create(<MapScreen />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => screen?.unmount());
  screen = undefined;
  await setLanguagePreference('zh');
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const flushQueries = async () => {
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(350);
  });
};
const sendMapMessage = async (message: object) => {
  await ReactTestRenderer.act(async () => {
    screen!.root.findByProps({ testID: 'map-webview' }).props.onMessage({
      nativeEvent: { data: JSON.stringify(message) },
    });
  });
};
const moveMap = async (view: typeof oldView) => {
  await sendMapMessage(view);
  await flushQueries();
};
const press = async (props: Record<string, unknown>) => {
  await ReactTestRenderer.act(async () => {
    await screen!.root.findByProps(props).props.onPress();
  });
};
const textOf = (children: unknown): string => {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  return Array.isArray(children) ? children.map(textOf).join('') : '';
};
const pressText = async (label: string | RegExp) => {
  const button = screen!.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node =>
      node.findAllByType(Text).some(textNode => {
        const text = textOf(textNode.props.children);
        return typeof label === 'string' ? text === label : label.test(text);
      }),
    );
  expect(button).toBeDefined();
  await ReactTestRenderer.act(async () => {
    await button!.props.onPress();
  });
};
const hasDetails = () =>
  screen!.root.findAll(
    node =>
      node.props.accessibilityLabel === '导航' ||
      node.props.accessibilityLabel === 'Directions',
  ).length > 0;
const hasText = (text: string) =>
  screen!.root
    .findAllByType(Text)
    .some(node => textOf(node.props.children) === text);
const renderCalls = () =>
  mockInjectJavaScript.mock.calls
    .map(([script]) => script)
    .filter(script => script.includes('__rnRenderMarkers('));
const respondTo = async (requests: PendingViewport[], markers: MapMarker[]) => {
  await ReactTestRenderer.act(async () => {
    requests.forEach(request => request.respond(markers));
  });
};
const respondToRemaining = async (markers: MapMarker[]) => {
  const pending = viewports.filter(request => !request.settled);
  expect(pending.length).toBeGreaterThan(0);
  await respondTo(pending, markers);
};
const selectDestination = async (source: 'search' | 'nearby') => {
  if (source === 'search') {
    await press({ testID: 'marker-search-button' });
    await ReactTestRenderer.act(async () => {
      screen!.root
        .findByProps({ testID: 'marker-search-input' })
        .props.onChangeText('destination');
    });
    await flushQueries();
    await press({ testID: `marker-search-result-${destination.id}` });
  } else {
    // The map can show a distant city while Nearby uses the device location.
    await sendMapMessage({
      type: 'userLocation',
      latitude: destination.lat,
      longitude: destination.lng,
    });
    await press({ accessibilityLabel: '查询附近点位' });
    await pressText(destination.title);
  }
  await flushQueries();
  expect(hasDetails()).toBe(true);
};

test.each(['search', 'nearby'] as const)(
  '%s selection survives a late old viewport, then uses updated destination details',
  async source => {
    await moveMap(oldView);
    expect(viewports.length).toBeGreaterThan(0);
    await selectDestination(source);
    const oldRequests = viewports.filter(request => !request.settled);
    await respondTo(oldRequests, []);
    expect(hasDetails()).toBe(true);
    expect(hasText(destination.description!)).toBe(true);

    await moveMap(destinationView);
    await respondToRemaining([
      {
        ...destination,
        description: 'Updated details from the destination viewport',
      },
    ]);
    expect(hasDetails()).toBe(true);
    expect(hasText('Updated details from the destination viewport')).toBe(true);
  },
);

test('a completed destination viewport that no longer includes the point can clear its details', async () => {
  await moveMap(oldView);
  await selectDestination('search');
  await respondToRemaining([]);
  expect(hasDetails()).toBe(true);
  await moveMap(destinationView);
  await respondToRemaining([]);
  expect(hasDetails()).toBe(false);
});

test.each(['language', 'account', 'category', 'map background'] as const)(
  'clearing selection through %s is not undone by a later destination response',
  async reason => {
    await moveMap(oldView);
    await selectDestination('search');
    if (reason === 'language') {
      await ReactTestRenderer.act(async () => {
        await setLanguagePreference('en');
      });
    } else if (reason === 'account') {
      mockUser = { publicId: 'member-2', username: 'another-member' };
      await ReactTestRenderer.act(async () => {
        screen!.update(<MapScreen />);
      });
    } else if (reason === 'category') {
      await pressText(/^筛选点位/);
      await pressText('无障碍卫生间');
    } else {
      await sendMapMessage({
        type: 'mapPress',
        latitude: 22.31,
        longitude: 114.21,
      });
    }
    expect(hasDetails()).toBe(false);
    await moveMap(destinationView);
    await respondToRemaining([{ ...destination }]);
    expect(hasDetails()).toBe(false);
  },
);

test('map readiness sends current markers only once, including a repeated ready message from the same WebView', async () => {
  await moveMap(oldView);
  await respondToRemaining([{ ...localMarker }]);
  mockInjectJavaScript.mockClear();
  await sendMapMessage({ type: 'mapReady' });
  expect(renderCalls()).toHaveLength(1);
  expect(renderCalls()[0]).toContain(localMarker.title);
  await sendMapMessage({ type: 'mapReady' });
  expect(renderCalls()).toHaveLength(1);
});

test('new response objects update detail text without resending identical pins; changed pin fields still send', async () => {
  await moveMap(oldView);
  await respondToRemaining([{ ...localMarker }]);
  await sendMapMessage({ type: 'mapReady' });
  await sendMapMessage({ type: 'markerPress', id: localMarker.id });
  mockInjectJavaScript.mockClear();

  await moveMap({ ...oldView, south: 39.79 });
  await respondToRemaining([
    { ...localMarker, description: 'New non-pin detail' },
  ]);
  expect(hasText('New non-pin detail')).toBe(true);
  expect(renderCalls()).toHaveLength(0);

  await moveMap({ ...oldView, south: 39.78 });
  await respondToRemaining([
    { ...localMarker, title: 'Renamed place', isActive: false },
  ]);
  expect(renderCalls()).toHaveLength(1);
  expect(renderCalls()[0]).toContain('Renamed place');
});

test('changing map provider rebuilds the WebView and sends the retained pins once after its ready message', async () => {
  await moveMap(oldView);
  await respondToRemaining([{ ...localMarker }]);
  await sendMapMessage({ type: 'mapReady' });
  const previousMounts = mockWebViewMounts;
  await press({ accessibilityLabel: '地图设置' });
  mockInjectJavaScript.mockClear();
  await pressText('OSM');
  expect(mockWebViewMounts).toBe(previousMounts + 1);
  expect(renderCalls()).toHaveLength(0);

  await sendMapMessage({ type: 'mapReady' });
  expect(renderCalls()).toHaveLength(1);
  expect(renderCalls()[0]).toContain(localMarker.title);
});

test('reloading the same WebView document sends retained pins again after load-start and map-ready', async () => {
  await moveMap(oldView);
  await respondToRemaining([{ ...localMarker }]);
  await sendMapMessage({ type: 'mapReady' });
  const previousMounts = mockWebViewMounts;
  mockInjectJavaScript.mockClear();
  const webView = screen!.root.findByProps({ testID: 'map-webview' });
  expect(typeof webView.props.onLoadStart).toBe('function');
  await ReactTestRenderer.act(async () => {
    webView.props.onLoadStart({ nativeEvent: { url: 'about:blank' } });
  });
  expect(mockWebViewMounts).toBe(previousMounts);
  expect(renderCalls()).toHaveLength(0);
  await sendMapMessage({ type: 'mapReady' });
  expect(renderCalls()).toHaveLength(1);
  expect(renderCalls()[0]).toContain(localMarker.title);
});
