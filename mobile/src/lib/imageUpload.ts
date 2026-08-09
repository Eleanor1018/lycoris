import { launchImageLibrary } from 'react-native-image-picker';
import { tr } from '../i18n/LanguageProvider';

export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;

export type LocalUploadImage = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

export type PickUploadImageResult =
  | { cancelled: true; file: null }
  | { cancelled: false; file: null; error: string }
  | { cancelled: false; file: LocalUploadImage; hint: string };

type PickUploadImageOptions = {
  mode: 'avatar' | 'marker';
};

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

const extFromMime = (mime: string): string => {
  const normalized = mime.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic') return 'heic';
  if (normalized === 'image/heif') return 'heif';
  return 'jpg';
};

const looksLikeHeic = (file: { name: string; type: string }) =>
  /image\/hei(c|f)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

const normalizeUploadImage = (
  asset: {
    uri?: string;
    fileName?: string;
    type?: string;
    fileSize?: number;
  },
  fallbackPrefix: string,
): LocalUploadImage | null => {
  const uri = typeof asset.uri === 'string' ? asset.uri : '';
  if (!uri) return null;

  const type =
    typeof asset.type === 'string' && asset.type.startsWith('image/')
      ? asset.type
      : 'image/jpeg';
  const ext = extFromMime(type);
  const safeNameRaw =
    typeof asset.fileName === 'string' && asset.fileName.trim()
      ? asset.fileName.trim()
      : `${fallbackPrefix}-${Date.now()}.${ext}`;
  const hasExt = /\.[a-z0-9]+$/i.test(safeNameRaw);
  const name = hasExt ? safeNameRaw : `${safeNameRaw}.${ext}`;
  const size =
    typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize)
      ? Math.max(0, Math.floor(asset.fileSize))
      : 0;

  return { uri, name, type, size };
};

export const pickUploadImage = async (
  options: PickUploadImageOptions,
): Promise<PickUploadImageResult> => {
  try {
    const quality = options.mode === 'avatar' ? 0.8 : 0.9;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality,
      maxWidth: 2048,
      maxHeight: 2048,
      assetRepresentationMode: 'compatible',
      includeBase64: false,
    });

    if (result.didCancel) {
      return { cancelled: true, file: null };
    }
    if (result.errorCode) {
      return {
        cancelled: false,
        file: null,
        error: tr(
          '选择图片失败，请稍后重试。',
          'Could not select an image. Please try again.',
        ),
      };
    }

    const normalized = normalizeUploadImage(
      result.assets?.[0] ?? {},
      options.mode,
    );
    if (!normalized) {
      return {
        cancelled: false,
        file: null,
        error: tr('未获取到有效图片。', 'No valid image was selected.'),
      };
    }

    if (normalized.size > MAX_UPLOAD_IMAGE_BYTES) {
      return {
        cancelled: false,
        file: null,
        error: tr(
          `图片处理后仍超过 5MB（当前 ${formatMb(
            normalized.size,
          )}），请换一张更小的图片。`,
          `The processed image is still larger than 5 MB (currently ${formatMb(
            normalized.size,
          )}). Please choose a smaller image.`,
        ),
      };
    }

    if (options.mode === 'avatar' && looksLikeHeic(normalized)) {
      return {
        cancelled: false,
        file: null,
        error: tr(
          '当前头像仍是 HEIC 格式，地图中可能无法显示。请在相册中导出为 JPG/PNG 后再上传。',
          'This image is still in HEIC format and may not display on the map. Export it as JPG or PNG before uploading.',
        ),
      };
    }

    const hint =
      normalized.size > 0
        ? tr(
            `已处理图片：${normalized.name}（${formatMb(normalized.size)}）`,
            `Image processed: ${normalized.name} (${formatMb(
              normalized.size,
            )})`,
          )
        : tr(
            `已选择图片：${normalized.name}`,
            `Image selected: ${normalized.name}`,
          );
    return { cancelled: false, file: normalized, hint };
  } catch {
    return {
      cancelled: false,
      file: null,
      error: tr(
        '图片处理失败，请重试。',
        'Could not process the image. Please try again.',
      ),
    };
  }
};

export const appendUploadImageToFormData = (
  form: FormData,
  field: string,
  file: LocalUploadImage,
) => {
  form.append(field, {
    uri: file.uri,
    type: file.type,
    name: file.name,
  } as unknown as Blob);
};
