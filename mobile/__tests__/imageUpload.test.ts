import { launchImageLibrary } from 'react-native-image-picker';
import {
  appendUploadImageToFormData,
  MAX_UPLOAD_IMAGE_BYTES,
  pickUploadImage,
} from '../src/lib/imageUpload';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
const pick = jest.mocked(launchImageLibrary);

test.each(['avatar', 'marker'] as const)(
  'a remaining HEIC %s is rejected with conversion instructions',
  async mode => {
    pick.mockResolvedValue({
      assets: [
        {
          uri: 'file:///image.heic',
          type: 'image/heic',
          fileName: 'image.heic',
          fileSize: 100,
        },
      ],
    });
    expect(await pickUploadImage({ mode })).toMatchObject({
      cancelled: false,
      file: null,
      error: expect.stringContaining('JPG/PNG'),
    });
  },
);

test('a picker-converted JPEG remains uploadable', async () => {
  pick.mockResolvedValue({
    assets: [
      {
        uri: 'file:///image.jpg',
        type: 'image/jpeg',
        fileName: 'image.jpg',
        fileSize: 100,
      },
    ],
  });
  expect(await pickUploadImage({ mode: 'marker' })).toMatchObject({
    cancelled: false,
    file: { type: 'image/jpeg', name: 'image.jpg' },
  });
});

test('iOS JPEG assets retain their encoded file URL for the native multipart uploader', async () => {
  const uri =
    'file:///var/mobile/Containers/Data/Application/test/tmp/my%20photo.jpg';
  pick.mockResolvedValue({
    assets: [{ uri, type: 'image/jpg', fileName: 'photo.jpg', fileSize: 1024 }],
  });
  const result = await pickUploadImage({ mode: 'avatar' });
  expect(result.file).toMatchObject({
    uri,
    type: 'image/jpg',
    name: 'photo.jpg',
  });
  const form = new FormData();
  const append = jest.spyOn(form, 'append');
  if (!result.file) throw new Error('Expected a picked image');
  appendUploadImageToFormData(form, 'image', result.file);
  expect(append).toHaveBeenCalledWith('image', {
    uri,
    type: 'image/jpg',
    name: 'photo.jpg',
  });
  expect(pick).toHaveBeenLastCalledWith(
    expect.objectContaining({
      assetRepresentationMode: 'compatible',
      selectionLimit: 1,
    }),
  );
});

test('cancelled and oversized picker responses never produce an upload file', async () => {
  pick.mockResolvedValueOnce({ didCancel: true });
  expect(await pickUploadImage({ mode: 'marker' })).toEqual({
    cancelled: true,
    file: null,
  });
  pick.mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///large.jpg',
        type: 'image/jpg',
        fileSize: MAX_UPLOAD_IMAGE_BYTES + 1,
      },
    ],
  });
  expect(await pickUploadImage({ mode: 'marker' })).toMatchObject({
    cancelled: false,
    file: null,
    error: expect.stringContaining('5MB'),
  });
});
