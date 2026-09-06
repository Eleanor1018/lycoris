import {
  buildDirectionsUrls,
  buildMarkerShareUrl,
} from '../src/lib/markerLinks';

const marker = {
  id: 17,
  lat: 22.3,
  lng: 114.2,
  title: '医院 & Clinic / <入口>',
};

test('share links contain only the point ID and language so the web app resolves details with its permissions', () => {
  const url = buildMarkerShareUrl('https://lycoris.example/', marker, 'en');
  expect(url).toBe(
    'https://lycoris.example/maps?markerId=17&lang=en',
  );
  expect(url).not.toContain('title=');
  expect(url).not.toContain('lat=');
  expect(url).not.toContain('lng=');
});

test('directions encode only destination coordinates and name with an Android web fallback', () => {
  const urls = buildDirectionsUrls(marker, 'android');
  expect(urls).toEqual([
    `geo:22.3,114.2?q=22.3,114.2(${encodeURIComponent(marker.title)})`,
    'https://www.google.com/maps/dir/?api=1&destination=22.3%2C114.2',
  ]);
  expect(buildDirectionsUrls(marker, 'ios')).toEqual([
    `https://maps.apple.com/?daddr=22.3,114.2&q=${encodeURIComponent(
      marker.title,
    )}`,
  ]);
});
