import { ApiError, requestJson } from '../src/lib/http';
import {
  createMarkerRequestId,
  MarkerImageUploadError,
  submitMarkerWithImage,
  type MarkerSubmissionCheckpoint,
} from '../src/lib/markerSubmission';
import type { MapMarker } from '../src/types/marker';

jest.mock('../src/lib/http', () => ({
  ...jest.requireActual('../src/lib/http'),
  requestJson: jest.fn(),
}));
const request = jest.mocked(requestJson);
const marker: MapMarker = {
  id: 71,
  lat: 22.3,
  lng: 114.2,
  category: 'accessible_toilet',
  title: '测试点位',
  description: '',
  isPublic: true,
  isActive: true,
  username: 'tester',
  userPublicId: 'test-user',
};
const fields = {
  category: marker.category,
  title: marker.title,
  description: '',
  isPublic: true,
  openTimeStart: '',
  openTimeEnd: '',
};
const image = {
  uri: 'file:///photo.jpg',
  name: 'photo.jpg',
  type: 'image/jpeg',
  size: 10,
};

const newSubmission = (editingId: number | null = null) => {
  let checkpoint: MarkerSubmissionCheckpoint | null = null;
  const clientRequestId = createMarkerRequestId();
  return (overrides: Partial<typeof fields> = {}) =>
    submitMarkerWithImage({
      clientRequestId,
      editingId,
      coordinates: { lat: marker.lat, lng: marker.lng },
      fields: { ...fields, ...overrides },
      image,
      checkpoint,
      normalizeMarker: raw => raw as MapMarker,
      onMarkerSaved: saved => {
        checkpoint = saved;
      },
    });
};

beforeEach(() => request.mockReset());

test('an expired upload session retains the authentication error instead of suggesting another upload', async () => {
  const unauthorized = new ApiError(401, '登录已失效，请重新登录');
  request.mockResolvedValueOnce(marker).mockRejectedValueOnce(unauthorized);
  await expect(newSubmission()()).rejects.toBe(unauthorized);
});

test('a failed photo retries only the photo on the original created marker', async () => {
  request
    .mockResolvedValueOnce(marker)
    .mockRejectedValueOnce(new Error('offline'));
  const save = newSubmission();
  await expect(save()).rejects.toBeInstanceOf(MarkerImageUploadError);
  request.mockResolvedValueOnce(marker);
  await expect(save()).resolves.toEqual(marker);
  expect(request.mock.calls.map(([path]) => path)).toEqual([
    '/api/markers',
    '/api/markers/71/image',
    '/api/markers/71/image',
  ]);
});

test('a lost create response reuses the idempotency key, while a new draft gets another', async () => {
  const save = newSubmission();
  request.mockRejectedValueOnce(new Error('response timed out'));
  await expect(save()).rejects.toThrow('response timed out');
  request.mockResolvedValue(marker);
  await save();
  await newSubmission()();
  const createBodies = request.mock.calls
    .filter(([path]) => path === '/api/markers')
    .map(([, init]) => JSON.parse(String(init?.body)));
  expect(createBodies).toHaveLength(3);
  expect(createBodies[0].clientRequestId).toEqual(
    createBodies[1].clientRequestId,
  );
  expect(createBodies[0].clientRequestId).not.toEqual(
    createBodies[2].clientRequestId,
  );
  expect(createBodies[0].clientRequestId.length).toBeLessThanOrEqual(64);
});

test('retrying a photo after an edit does not duplicate the edit proposal', async () => {
  const save = newSubmission(71);
  request
    .mockResolvedValueOnce(marker)
    .mockRejectedValueOnce(new Error('offline'));
  await expect(save()).rejects.toBeInstanceOf(MarkerImageUploadError);
  request.mockResolvedValueOnce(marker);
  await save();
  expect(
    request.mock.calls.map(([path, init]) => [path, init?.method]),
  ).toEqual([
    ['/api/markers/71', 'PATCH'],
    ['/api/markers/71/image', 'POST'],
    ['/api/markers/71/image', 'POST'],
  ]);
});

test('changes made after a failed photo are patched to the saved marker before retrying', async () => {
  const save = newSubmission();
  request
    .mockResolvedValueOnce(marker)
    .mockRejectedValueOnce(new Error('offline'));
  await expect(save()).rejects.toBeInstanceOf(MarkerImageUploadError);
  request.mockResolvedValue(marker);
  await save({ title: '修正后的标题' });
  expect(request.mock.calls[2][0]).toBe('/api/markers/71');
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  expect(JSON.parse(String(request.mock.calls[2][1]?.body)).title).toBe(
    '修正后的标题',
  );
  expect(
    request.mock.calls.filter(([path]) => path === '/api/markers'),
  ).toHaveLength(1);
});
