import { buildApiUrl } from '../config/runtime';
import {
  getCurrentLanguage,
  localizeMarkerPath,
  type Language,
} from '../i18n/language';
import { translate as t } from '../i18n/messages';
import {
  getSessionGeneration,
  notifySessionExpired,
  SESSION_EXPIRED_MESSAGE,
} from './session';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

const parseMaybeJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text || null;
};

const extractMessage = (raw: unknown, fallback: string): string => {
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (raw && typeof raw === 'object' && 'message' in raw) {
    const message = (raw as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

type RequestJsonInit = RequestInit & {
  timeoutMs?: number;
  language?: Language;
};

export const isAbortError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const requiresSession = (path: string, method = 'GET') => {
  const pathname = `/${path.replace(/^\/+/, '')}`
    .split(/[?#]/)[0]
    .replace(/\/+$/, '');
  if (/^\/api\/me(?:\/|$)/.test(pathname)) return true;
  if (/^\/api\/markers\/me(?:\/|$)/.test(pathname)) return true;
  return (
    ['POST', 'PATCH', 'DELETE'].includes(method.toUpperCase()) &&
    /^\/api\/markers(?:\/\d+(?:\/(?:image|favorite))?)?$/.test(pathname)
  );
};

export const requestJson = async <T>(
  path: string,
  init: RequestJsonInit = {},
): Promise<T> => {
  const {
    timeoutMs = 12000,
    language = getCurrentLanguage(),
    signal,
    ...requestInit
  } = init;
  const requestGeneration = getSessionGeneration();
  const headers = new Headers(requestInit.headers ?? {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  headers.set('Accept-Language', language);
  const isFormDataBody =
    typeof FormData !== 'undefined' && requestInit.body instanceof FormData;
  if (requestInit.body && !isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    if (controller.signal.aborted) {
      const error = new Error('Request cancelled');
      error.name = 'AbortError';
      throw error;
    }
    const localizedPath =
      (requestInit.method ?? 'GET').toUpperCase() === 'GET'
        ? localizeMarkerPath(path, language)
        : path;
    const response = await fetch(buildApiUrl(localizedPath), {
      ...requestInit,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    if (response.status === 401 && requiresSession(path, requestInit.method)) {
      notifySessionExpired(requestGeneration);
      throw new ApiError(401, t(SESSION_EXPIRED_MESSAGE, {}, language));
    }

    const raw = await parseMaybeJson(response);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        extractMessage(raw, `Request failed (${response.status})`),
      );
    }
    return raw as T;
  } catch (error) {
    if (isAbortError(error) && timedOut && !signal?.aborted) {
      throw new ApiError(
        408,
        t('请求超时（>{timeout}ms）', { timeout: timeoutMs }, language),
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
};
