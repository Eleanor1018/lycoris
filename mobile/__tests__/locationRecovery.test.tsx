import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { MapScreen } from '../src/screens/MapScreen';

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));

test.each(['定位到当前位置', '查询附近点位'])(
  '%s remains usable after denial and opens settings when permission is permanently blocked',
  async accessibilityLabel => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue({ [fine]: 'denied', [coarse]: 'denied' } as Awaited<
        ReturnType<typeof PermissionsAndroid.requestMultiple>
      >);
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue();
    let screen: ReactTestRenderer.ReactTestRenderer;
    try {
      await ReactTestRenderer.act(async () => {
        screen = ReactTestRenderer.create(<MapScreen />);
      });
      expect(openSettings).not.toHaveBeenCalled();
      request
        .mockClear()
        .mockResolvedValue({
          [fine]: 'never_ask_again',
          [coarse]: 'never_ask_again',
        } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
      await ReactTestRenderer.act(async () => {
        await screen!.root.findByProps({ accessibilityLabel }).props.onPress();
      });
      expect(request).toHaveBeenCalledWith([fine, coarse]);
      expect(openSettings).toHaveBeenCalledTimes(1);
    } finally {
      await ReactTestRenderer.act(async () => screen?.unmount());
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  },
);
