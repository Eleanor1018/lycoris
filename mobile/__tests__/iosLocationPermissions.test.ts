import { NativeModules } from 'react-native';
import { getIOSLocationAccess } from '../src/lib/iosLocationPermissions';

const originalNativeLocation = NativeModules.NativeLocation;

afterEach(() => {
  NativeModules.NativeLocation = originalNativeLocation;
});

test.each([
  'precise',
  'approximate',
  'notDetermined',
  'blocked',
  'unavailable',
])(
  'reads the iOS native authorization status %s without requesting location',
  async status => {
    const getCurrentPosition = jest.fn();
    const getPermissionStatus = jest.fn().mockResolvedValue(status);
    NativeModules.NativeLocation = { getPermissionStatus, getCurrentPosition };
    await expect(getIOSLocationAccess()).resolves.toBe(status);
    expect(getPermissionStatus).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  },
);

test.each([null, undefined, 'authorized', 42])(
  'treats the unknown native permission value %p as unavailable',
  async status => {
    NativeModules.NativeLocation = {
      getPermissionStatus: jest.fn().mockResolvedValue(status),
    };
    await expect(getIOSLocationAccess()).resolves.toBe('unavailable');
  },
);

test.each([undefined, { getCurrentPosition: jest.fn() }])(
  'keeps old native builds without a permission method usable',
  async nativeModule => {
    NativeModules.NativeLocation = nativeModule;
    await expect(getIOSLocationAccess()).resolves.toBe('notDetermined');
  },
);

test('propagates a failed authorization read so the screen can clear stale location', async () => {
  const error = new Error('Native authorization unavailable');
  NativeModules.NativeLocation = {
    getPermissionStatus: jest.fn().mockRejectedValue(error),
  };
  await expect(getIOSLocationAccess()).rejects.toBe(error);
});
