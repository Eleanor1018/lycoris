import { launchImageLibrary } from 'react-native-image-picker';
import { pickUploadImage } from '../src/lib/imageUpload';

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
