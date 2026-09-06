import type { Language } from '../i18n/language';

type PlaceLinkTarget = { id: number; lat: number; lng: number; title: string };

export const buildMarkerShareUrl = (
  baseUrl: string,
  marker: Pick<PlaceLinkTarget, 'id'>,
  language: Language,
) => {
  const query = new URLSearchParams({
    markerId: String(marker.id),
    lang: language,
  });
  return `${baseUrl.replace(/\/+$/, '')}/maps?${query.toString()}`;
};

export const buildDirectionsUrls = (
  marker: PlaceLinkTarget,
  platform: string,
): string[] => {
  const coordinates = `${marker.lat},${marker.lng}`;
  const name = encodeURIComponent(marker.title);
  return platform === 'ios'
    ? [`https://maps.apple.com/?daddr=${coordinates}&q=${name}`]
    : [
        `geo:${coordinates}?q=${coordinates}(${name})`,
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          coordinates,
        )}`,
      ];
};
