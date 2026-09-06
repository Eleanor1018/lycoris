import { NativeModules } from 'react-native';

export type IOSLocationAccess =
  | 'precise'
  | 'approximate'
  | 'notDetermined'
  | 'blocked'
  | 'unavailable';

// Read the current authorization without opening a permission dialog. Core
// Location requests when-in-use authorization when it first needs a position.
export const getIOSLocationAccess = async (): Promise<IOSLocationAccess> => {
  const getPermissionStatus = NativeModules.NativeLocation?.getPermissionStatus;
  // Keep WebView geolocation usable with an older native development build.
  if (typeof getPermissionStatus !== 'function') return 'notDetermined';
  const status: unknown = await getPermissionStatus();
  switch (status) {
    case 'precise':
    case 'approximate':
    case 'notDetermined':
    case 'blocked':
    case 'unavailable':
      return status;
    default:
      return 'unavailable';
  }
};
