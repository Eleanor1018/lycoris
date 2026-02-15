import {buildApiUrl} from '../config/runtime';

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
    const message = (raw as {message?: unknown}).message;
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
  const {timeoutMs = 12000, ...requestInit} = init;
  const headers = new Headers(requestInit.headers ?? {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
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
      (error as {name?: unknown}).name === 'AbortError'
    ) {
      throw new ApiError(408, `请求超时（>${timeoutMs}ms）`);
    }
    throw error;
  }
  clearTimeout(timeout);

  const raw = await parseMaybeJson(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(raw, `Request failed (${response.status})`),
    );
  }

  return raw as T;
};
