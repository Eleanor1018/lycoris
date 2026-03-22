import {NativeModules} from 'react-native';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const defaultDevBaseUrl = 'http://10.0.2.2:8080';
const defaultProdBaseUrl = 'https://api.lycoris.online';

type LyRuntimeGlobals = {
  LY_API_BASE_URL?: string;
  LY_THUNDERFOREST_API_KEY?: string;
  LY_TIANDITU_API_KEY?: string;
};

type LyNativeRuntimeConfig = Partial<LyRuntimeGlobals>;

const runtimeGlobals = globalThis as LyRuntimeGlobals;
const nativeRuntimeConfig = (NativeModules.RuntimeConfig ??
  {}) as LyNativeRuntimeConfig;

const pickConfigValue = (...candidates: Array<string | undefined>) => {
  for (const value of candidates) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return '';
};

const apiBaseOverride = pickConfigValue(
  runtimeGlobals.LY_API_BASE_URL,
  nativeRuntimeConfig.LY_API_BASE_URL,
);

export const API_BASE_URL = trimTrailingSlash(
  apiBaseOverride || (__DEV__ ? defaultDevBaseUrl : defaultProdBaseUrl),
);

export const WEB_BASE_URL = 'https://lycoris.online';
export const THUNDERFOREST_API_KEY = pickConfigValue(
  runtimeGlobals.LY_THUNDERFOREST_API_KEY,
  nativeRuntimeConfig.LY_THUNDERFOREST_API_KEY,
);
export const TIANDITU_API_KEY = pickConfigValue(
  runtimeGlobals.LY_TIANDITU_API_KEY,
  nativeRuntimeConfig.LY_TIANDITU_API_KEY,
);

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const isAbsoluteUrl = (value: string) =>
  /^(https?:)?\/\//i.test(value) ||
  value.startsWith('data:') ||
  value.startsWith('blob:');

export const toBackendAssetUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (isAbsoluteUrl(value)) return value;
  if (!API_BASE_URL) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
};
