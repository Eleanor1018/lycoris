import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  AppState,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Text,
  type AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapScreen } from '../src/screens/MapScreen';
import { setLanguagePreference } from '../src/i18n/language';
import type { MapMarker } from '../src/types/marker';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  // Install the bridge before MapScreen captures NativeLocation at module load.
  native.NativeModules.NativeLocation = {
    getPermissionStatus: jest.fn(),
    getCurrentPosition: jest.fn(),
  };
  return native;
});
jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));

const nativeLocation = NativeModules.NativeLocation as {
  getPermissionStatus: jest.Mock;
  getCurrentPosition: jest.Mock;
};
const initialLocation = { latitude: 22.3, longitude: 114.2 };
const recoveredLocation = { latitude: 22.4, longitude: 114.3 };
const place: MapMarker = {
  id: 811,
  lat: 22.3,
  lng: 114.2,
  title: 'Previously nearby place',
  description: 'A local fixture',
  category: 'accessible_toilet',
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
const appStateListeners = new Set<(state: AppStateStatus) => void>();
let screen: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'ios');
  await AsyncStorage.clear();
  await setLanguagePreference('zh');
  nativeLocation.getPermissionStatus.mockReset().mockResolvedValue('precise');
  nativeLocation.getCurrentPosition
    .mockReset()
    .mockResolvedValue(initialLocation);
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  appStateListeners.clear();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((event, listener) => {
      if (event === 'change') appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    });
  jest.mocked(fetch).mockReset().mockResolvedValue(response([]));
  await ReactTestRenderer.act(async () => {
    screen = ReactTestRenderer.create(<MapScreen />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => screen?.unmount());
  screen = undefined;
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const press = async (label: string) => {
  await ReactTestRenderer.act(async () => {
    await screen!.root
      .findByProps({ accessibilityLabel: label })
      .props.onPress();
  });
};
const appState = async (state: AppStateStatus) => {
  await ReactTestRenderer.act(async () => {
    appStateListeners.forEach(listener => listener(state));
  });
};
const hasText = (value: string) =>
  screen!.root.findAllByType(Text).some(node => node.props.children === value);
const nearbyRequests = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).includes('/api/markers/nearby?'));
const dismissNearby = async () => {
  const modal = screen!.root
    .findAllByType(Modal)
    .find(node => node.props.visible);
  expect(modal).toBeDefined();
  await ReactTestRenderer.act(async () => modal!.props.onRequestClose());
};

test('revocation clears old nearby data, discards a late response and queries a new location after recovery', async () => {
  let respondLate: (value: Response) => void = () => {};
  let queryCompletion: Promise<void> | undefined;
  let nearbyCount = 0;
  const recoveredPlace = {
    ...place,
    id: 812,
    lat: 22.4,
    lng: 114.3,
    title: 'Newly nearby place',
  };
  const latePlace = { ...place, id: 813, title: 'Obsolete late nearby place' };
  jest.mocked(fetch).mockImplementation(url => {
    if (!String(url).includes('/api/markers/nearby?'))
      return Promise.resolve(response([]));
    nearbyCount++;
    if (nearbyCount === 2) {
      // Deliberately ignore AbortSignal: stale transport responses must still be ignored.
      return new Promise(resolve => {
        respondLate = resolve;
      });
    }
    return Promise.resolve(
      response([nearbyCount === 1 ? place : recoveredPlace]),
    );
  });
  await press('定位到当前位置');
  expect(nativeLocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  await press('查询附近点位');
  expect(hasText(place.title)).toBe(true);
  expect(String(nearbyRequests()[0][0])).toMatch(/[?&]lat=22\.3(?:&|$)/);
  await dismissNearby();
  await ReactTestRenderer.act(async () => {
    queryCompletion = screen!.root
      .findByProps({ accessibilityLabel: '查询附近点位' })
      .props.onPress();
  });
  expect(nearbyRequests()).toHaveLength(2);
  const pendingSignal = nearbyRequests()[1][1]?.signal;

  await appState('background');
  nativeLocation.getPermissionStatus.mockResolvedValue('blocked');
  await appState('active');
  expect(pendingSignal?.aborted).toBe(true);
  expect(Linking.openSettings).not.toHaveBeenCalled();
  expect(hasText(place.title)).toBe(false);
  await press('查询附近点位');
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  expect(nearbyRequests()).toHaveLength(2);
  await ReactTestRenderer.act(async () => {
    respondLate(response([latePlace]));
    await queryCompletion;
  });
  expect(hasText(latePlace.title)).toBe(false);
  expect(hasText(place.title)).toBe(false);

  await appState('background');
  nativeLocation.getPermissionStatus.mockResolvedValue('approximate');
  nativeLocation.getCurrentPosition.mockResolvedValue(recoveredLocation);
  await appState('active');
  await press('查询附近点位');
  expect(nativeLocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(nearbyRequests()).toHaveLength(3);
  const recoveredQuery = String(nearbyRequests()[2][0]);
  expect(recoveredQuery).toMatch(/[?&]lat=22\.4(?:&|$)/);
  expect(recoveredQuery).toMatch(/[?&]lng=114\.3(?:&|$)/);
  expect(hasText(recoveredPlace.title)).toBe(true);
  expect(hasText(latePlace.title)).toBe(false);
});

test('an authorization read failure clears cached coordinates and waits for a new native position', async () => {
  await press('定位到当前位置');
  nativeLocation.getPermissionStatus.mockRejectedValue(
    new Error('Permission status unavailable'),
  );
  await press('查询附近点位');
  expect(nearbyRequests()).toHaveLength(0);
  nativeLocation.getPermissionStatus.mockResolvedValue('precise');
  nativeLocation.getCurrentPosition.mockResolvedValue(recoveredLocation);
  await press('查询附近点位');
  expect(nativeLocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(nearbyRequests()).toHaveLength(1);
  expect(String(nearbyRequests()[0][0])).toMatch(/[?&]lat=22\.4(?:&|$)/);
});

test.each(['定位到当前位置', '查询附近点位'])(
  'a blocked iOS %s request opens settings without requesting coordinates',
  async label => {
    nativeLocation.getPermissionStatus.mockResolvedValue('blocked');
    await press(label);
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(nativeLocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(nearbyRequests()).toHaveLength(0);
  },
);

test('notDetermined authorization lets the native location request present its first-use prompt', async () => {
  nativeLocation.getPermissionStatus.mockResolvedValue('notDetermined');
  await press('定位到当前位置');
  expect(nativeLocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(Linking.openSettings).not.toHaveBeenCalled();
});
