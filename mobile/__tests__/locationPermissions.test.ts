import { PermissionsAndroid } from 'react-native';
import { getAndroidLocationAccess } from '../src/lib/locationPermissions';

const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const check = jest.spyOn(PermissionsAndroid, 'check');
const requestMultiple = jest.spyOn(PermissionsAndroid, 'requestMultiple');
type PermissionResult = Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;

beforeEach(() => {
  check.mockReset().mockResolvedValue(false);
  requestMultiple.mockReset();
});

test('requests precise and approximate permissions together and accepts approximate access', async () => {
  requestMultiple.mockResolvedValue({
    [fine]: 'denied',
    [coarse]: 'granted',
  } as PermissionResult);
  await expect(getAndroidLocationAccess(true)).resolves.toBe('approximate');
  expect(requestMultiple).toHaveBeenCalledWith([fine, coarse]);
});

test('existing approximate permission works without requesting an upgrade', async () => {
  check.mockImplementation(async permission => permission === coarse);
  await expect(getAndroidLocationAccess(true)).resolves.toBe('approximate');
  expect(requestMultiple).not.toHaveBeenCalled();
});

test('a passive permission check never opens a permission dialog', async () => {
  await expect(getAndroidLocationAccess(false)).resolves.toBe('denied');
  expect(requestMultiple).not.toHaveBeenCalled();
});

test('distinguishes a retryable denial from a denial that needs system settings', async () => {
  requestMultiple.mockResolvedValueOnce({
    [fine]: 'denied',
    [coarse]: 'denied',
  } as PermissionResult);
  await expect(getAndroidLocationAccess(true)).resolves.toBe('denied');
  requestMultiple.mockResolvedValueOnce({
    [fine]: 'never_ask_again',
    [coarse]: 'never_ask_again',
  } as PermissionResult);
  await expect(getAndroidLocationAccess(true)).resolves.toBe('blocked');
});

test('existing precise access remains available', async () => {
  check.mockResolvedValue(true);
  await expect(getAndroidLocationAccess(false)).resolves.toBe('precise');
});
