import {TurboModuleRegistry, type TurboModule} from 'react-native';

export const SESSION_EXPIRED_MESSAGE = '登录已失效，请到“我的”重新登录。';
let sessionGeneration = 0;
const expiredListeners = new Set<() => void>();

export const getSessionGeneration = () => sessionGeneration;
export const advanceSessionGeneration = () => ++sessionGeneration;

export const subscribeSessionExpired = (listener: () => void) => {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
};

export const notifySessionExpired = (requestGeneration: number) => {
  // Late failures from an old login must not sign out a newer session. Advancing
  // here also collapses simultaneous 401 responses into one cleanup operation.
  if (requestGeneration !== sessionGeneration) return;
  advanceSessionGeneration();
  expiredListeners.forEach(listener => listener());
};

interface NativeNetworkingCookies extends TurboModule {
  clearCookies: (callback: (removed: boolean) => void) => void;
}

export const clearNativeSessionCookies = (): Promise<void> =>
  new Promise((resolve, reject) => {
    try {
      const networking = TurboModuleRegistry.getEnforcing<NativeNetworkingCookies>('Networking');
      networking.clearCookies(() => resolve());
    } catch (error) {
      reject(error);
    }
  });
