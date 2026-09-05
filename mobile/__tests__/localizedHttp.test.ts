import { ApiError, requestJson } from '../src/lib/http';

const response = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  } as Response);
const fetchMock = jest.mocked(fetch);

beforeEach(() => fetchMock.mockReset());
afterEach(() => jest.useRealTimers());

test('GET point language is in the URL and header; auth requests keep their endpoint', async () => {
  fetchMock.mockResolvedValue(response([]));
  await requestJson('/api/markers/viewport?minLat=1', { language: 'en' });
  expect(fetchMock.mock.calls[0][0]).toMatch(
    /\/api\/markers\/viewport\?minLat=1&lang=en$/,
  );
  expect(
    (fetchMock.mock.calls[0][1]?.headers as Headers).get('Accept-Language'),
  ).toBe('en');
  await requestJson('/api/login', {
    method: 'POST',
    body: '{}',
    language: 'en',
  });
  expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/login$/);
});

test('caller cancellation reaches fetch and stays AbortError instead of a timeout notice', async () => {
  let fetchSignal!: AbortSignal;
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        fetchSignal = init!.signal!;
        fetchSignal.addEventListener('abort', () => {
          const error = new Error('cancelled');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
  const controller = new AbortController();
  const pending = requestJson('/api/markers/search?q=old', {
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchSignal.aborted).toBe(true);
});

test('a pre-cancelled request does not call fetch', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    requestJson('/api/markers/search?q=old', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('an actual timeout still raises a localized 408', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => {
          const error = new Error('timed out');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
  const pending = requestJson('/api/markers/search?q=slow', {
    timeoutMs: 30,
    language: 'en',
  }).catch(error => error);
  jest.advanceTimersByTime(30);
  expect(await pending).toEqual(new ApiError(408, 'Request timed out (>30 ms).'));
});
