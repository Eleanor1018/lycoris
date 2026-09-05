import { ApiError, requestJson } from './http';
import {
  appendUploadImageToFormData,
  type LocalUploadImage,
} from './imageUpload';
import type { MapMarker, MarkerCategory } from '../types/marker';

type MarkerFields = {
  category: MarkerCategory;
  title: string;
  description: string;
  isPublic: boolean;
  openTimeStart: string;
  openTimeEnd: string;
};

export type MarkerSubmissionCheckpoint = {
  marker: MapMarker;
  fieldsKey: string;
};

export const createMarkerRequestId = () =>
  `mobile-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random().toString(36).slice(2)}`;

export class MarkerImageUploadError extends Error {
  constructor() {
    super('点位信息已提交审核，但图片上传失败。再次保存可补传图片。');
    this.name = 'MarkerImageUploadError';
  }
}

// Save a checkpoint before uploading so a failed image never repeats a create or
// an unchanged edit proposal. A changed form is submitted against the saved ID.
export const submitMarkerWithImage = async ({
  clientRequestId,
  editingId,
  coordinates,
  fields,
  image,
  checkpoint,
  normalizeMarker,
  onMarkerSaved,
}: {
  clientRequestId: string;
  editingId: number | null;
  coordinates: { lat: number; lng: number };
  fields: MarkerFields;
  image: LocalUploadImage | null;
  checkpoint: MarkerSubmissionCheckpoint | null;
  normalizeMarker: (raw: unknown) => MapMarker | null;
  onMarkerSaved: (saved: MarkerSubmissionCheckpoint) => void;
}): Promise<MapMarker> => {
  const fieldsKey = JSON.stringify(fields);
  let saved = checkpoint;
  if (!saved || saved.fieldsKey !== fieldsKey) {
    const markerId = saved?.marker.id ?? editingId;
    const payload = await requestJson<unknown>(
      markerId == null ? '/api/markers' : `/api/markers/${markerId}`,
      {
        method: markerId == null ? 'POST' : 'PATCH',
        body: JSON.stringify(
          markerId == null
            ? { ...coordinates, ...fields, clientRequestId, markImage: null }
            : fields,
        ),
      },
    );
    const marker = normalizeMarker(payload);
    if (!marker) throw new Error('保存成功，但返回数据格式异常。请重试。');
    saved = { marker, fieldsKey };
    onMarkerSaved(saved);
  }

  if (!image) return saved.marker;
  const form = new FormData();
  appendUploadImageToFormData(form, 'file', image);
  try {
    const payload = await requestJson<unknown>(
      `/api/markers/${saved.marker.id}/image`,
      { method: 'POST', body: form, timeoutMs: 20000 },
    );
    return normalizeMarker(payload) ?? saved.marker;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    throw new MarkerImageUploadError();
  }
};
