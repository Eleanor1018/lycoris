import { buildApiUrl } from '../config/runtime';
import { getAcceptLanguage, tr } from '../i18n/LanguageProvider';

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
};

export const requestJson = async <T>(
  path: string,
  init: RequestJsonInit = {},
): Promise<T> => {
  const { timeoutMs = 12000, ...requestInit } = init;
  const headers = new Headers(requestInit.headers ?? {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getAcceptLanguage());
  }
  const isFormDataBody =
    typeof FormData !== 'undefined' && requestInit.body instanceof FormData;
  if (requestInit.body && !isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...requestInit,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError'
    ) {
      throw new ApiError(
        408,
        tr(
          `请求超时（>${timeoutMs}ms）`,
          `Request timed out (>${timeoutMs} ms)`,
        ),
      );
    }
    throw new ApiError(
      0,
      tr(
        '无法连接服务器，请检查网络后重试。',
        'Could not connect to the server. Check your connection and try again.',
      ),
    );
  }
  clearTimeout(timeout);

  let raw: unknown;
  try {
    raw = await parseMaybeJson(response);
  } catch {
    throw new ApiError(
      response.status,
      tr(
        '服务器返回的数据无法读取，请稍后重试。',
        'The server returned unreadable data. Please try again later.',
      ),
    );
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(
        raw,
        tr(
          `请求失败（${response.status}）`,
          `Request failed (${response.status})`,
        ),
      ),
    );
  }

  return raw as T;
};
