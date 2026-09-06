import { PermissionsAndroid } from 'react-native';

export type AndroidLocationAccess =
  | 'precise'
  | 'approximate'
  | 'denied'
  | 'blocked';

export const getAndroidLocationAccess = async (
  requestIfMissing: boolean,
): Promise<AndroidLocationAccess> => {
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  const [hasFine, hasCoarse] = await Promise.all([
    PermissionsAndroid.check(fine),
    PermissionsAndroid.check(coarse),
  ]);
  if (hasFine) return 'precise';
  if (hasCoarse) return 'approximate';
  if (!requestIfMissing) return 'denied';

  // Android 12+ requires these permissions in the same runtime request.
  const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
  if (result[fine] === PermissionsAndroid.RESULTS.GRANTED) return 'precise';
  if (result[coarse] === PermissionsAndroid.RESULTS.GRANTED)
    return 'approximate';
  return [result[fine], result[coarse]].includes(
    PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  )
    ? 'blocked'
    : 'denied';
};
