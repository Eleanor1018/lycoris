import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Image,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Icon } from 'react-native-paper';
import { SafeAreaView as ScreensSafeAreaView } from 'react-native-screens/experimental';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import {
  buildApiUrl,
  THUNDERFOREST_API_KEY,
  TIANDITU_API_KEY,
  WEB_BASE_URL,
  toBackendAssetUrl,
} from '../config/runtime';
import { ApiError, requestJson } from '../lib/http';
import {
  appendUploadImageToFormData,
  pickUploadImage,
  type LocalUploadImage,
} from '../lib/imageUpload';
import {
  getAcceptLanguage,
  tr as runtimeTr,
  useLanguage,
} from '../i18n/LanguageProvider';
import { colors } from '../theme/colors';
import type { MapMarker, MarkerCategory } from '../types/marker';

type OwnerFilter = 'all' | 'mine' | 'fav';
export type NearbyCategory =
  | 'accessible_toilet'
  | 'friendly_clinic'
  | 'baby_room';
type TileProvider = 'osm' | 'tf_atlas' | 'tianditu_vec';
type NearbyResult = MapMarker & { distanceMeters: number };
type MapFocusRequest = {
  markerId: number;
  lat?: number;
  lng?: number;
  title?: string;
  requestId: number;
};

type LatLngZoom = {
  latitude: number;
  longitude: number;
  zoom: number;
};

type ViewportBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  wrapsAntimeridian: boolean;
  wholeWorld: boolean;
};

type WebMapMessage =
  | { type: 'mapReady' }
  | { type: 'mapPress'; latitude?: number; longitude?: number }
  | { type: 'markerPress'; id: number }
  | {
      type: 'moveend';
      latitude: number;
      longitude: number;
      zoom: number;
      south?: number;
      north?: number;
      west?: number;
      east?: number;
    }
  | { type: 'userLocation'; latitude: number; longitude: number }
  | { type: 'geoError'; message?: string }
  | { type: 'leafletLoadFailed'; message?: string };

type DraftMarker = {
  clientRequestId: string;
  lat: number;
  lng: number;
  category: MarkerCategory;
  title: string;
  description: string;
  isPublic: boolean;
  openStartHour: string;
  openStartMinute: string;
  openEndHour: string;
  openEndMinute: string;
};

type NativeLocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  provider?: string;
};

type NativeLocationModule = {
  getCurrentPosition: (options?: {
    timeoutMs?: number;
    maxAgeMs?: number;
  }) => Promise<NativeLocationPayload>;
};

const nativeLocationModule = (NativeModules.NativeLocation ??
  null) as NativeLocationModule | null;
const supportsNativeLocation =
  Platform.OS === 'android' || Platform.OS === 'ios';

const INITIAL_VIEW: LatLngZoom = {
  latitude: 39.9042,
  longitude: 116.4074,
  zoom: 11,
};

const MAP_VIEWPORT_STORAGE_KEY = '@lycoris/mapViewport/v1';
const MAP_TILE_PROVIDER_STORAGE_KEY = '@lycoris/mapTileProvider/v1';
const MAP_ADD_MODE_HINT_SEEN_KEY = '@lycoris/mapAddModeHintSeen/v1';

const supportedCategories: MarkerCategory[] = [
  'accessible_toilet',
  'friendly_clinic',
  'baby_room',
  'self_definition',
];

export const nearbyCategories: NearbyCategory[] = [
  'accessible_toilet',
  'friendly_clinic',
  'baby_room',
];

export const nearbyCategoryLabel: Record<NearbyCategory, string> = {
  accessible_toilet: 'Accessible Restroom',
  friendly_clinic: 'Trans-Friendly Clinic',
  baby_room: 'Nursing Room',
};

const nearbyCategoryIcon: Record<NearbyCategory, string> = {
  accessible_toilet: 'human-male-female',
  friendly_clinic: 'hospital-box-outline',
  baby_room: 'baby-carriage',
};

const categoryColor: Record<MarkerCategory, string> = {
  accessible_toilet: '#1e88e5',
  friendly_clinic: '#43a047',
  baby_room: '#fb8c00',
  self_definition: '#f0bf2f',
};

const createClientRequestId = () =>
  `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const hasThunderforestKey = THUNDERFOREST_API_KEY.length > 0;
const hasTiandituKey = TIANDITU_API_KEY.length > 0;
const initialTileProvider: TileProvider = hasTiandituKey
  ? 'tianditu_vec'
  : hasThunderforestKey
  ? 'tf_atlas'
  : 'osm';

const tileProviderConfig: Record<
  TileProvider,
  { label: string; url: string; labelUrl?: string }
> = {
  osm: {
    label: 'OSM',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  tf_atlas: {
    label: 'TF Atlas',
    url: `https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=${THUNDERFOREST_API_KEY}`,
  },
  tianditu_vec: {
    label: 'Tianditu · Vector',
    url: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
    labelUrl: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
  },
};

const normalizeCategory = (value: unknown): MarkerCategory => {
  if (
    value === 'accessible_toilet' ||
    value === 'friendly_clinic' ||
    value === 'baby_room' ||
    value === 'self_definition'
  ) {
    return value;
  }
  return 'self_definition';
};

const coerceMarkerArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const boxed = raw as Record<string, unknown>;
    if (Array.isArray(boxed.content)) return boxed.content;
    if (Array.isArray(boxed.items)) return boxed.items;
    if (Array.isArray(boxed.data)) return boxed.data;
  }
  return [];
};

const normalizeMarkers = (raw: unknown): MapMarker[] => {
  const rawList = coerceMarkerArray(raw);
  const result: MapMarker[] = [];
  rawList.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const marker = item as Partial<MapMarker>;
    const id = Number(marker.id);
    const lat = Number(marker.lat);
    const lng = Number(marker.lng);
    if (
      !Number.isFinite(id) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return;
    }
    result.push({
      id,
      lat,
      lng,
      category: normalizeCategory(marker.category),
      title: marker.title?.trim() || runtimeTr('未命名点位', 'Untitled Place'),
      description: marker.description ?? '',
      isPublic: marker.isPublic ?? true,
      isActive: marker.isActive ?? true,
      openTimeStart: marker.openTimeStart ?? null,
      openTimeEnd: marker.openTimeEnd ?? null,
      markImage: marker.markImage ?? null,
      username: marker.username ?? '',
      userPublicId: marker.userPublicId ?? null,
    });
  });
  return result;
};

const normalizeSingleMarker = (raw: unknown): MapMarker | null => {
  const list = normalizeMarkers([raw]);
  return list[0] ?? null;
};

const isValidHHMM = (value: string): boolean => {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hRaw, mRaw] = value.split(':');
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  return (
    Number.isFinite(hour) &&
    Number.isFinite(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
};

const splitHHMM = (value?: string | null): { hour: string; minute: string } => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return { hour: '', minute: '' };
  const [hour, minute] = value.split(':');
  return { hour, minute };
};

const composeHHMM = (hour: string, minute: string): string => {
  if (!hour || !minute) return '';
  return `${hour}:${minute}`;
};

const parseFavoriteIds = (raw: unknown): Set<number> => {
  if (!Array.isArray(raw)) return new Set();
  const parsed = raw
    .map(v => Number(v))
    .filter(v => Number.isFinite(v))
    .map(v => Number(v));
  return new Set(parsed);
};

const formatOpenTime = (marker: MapMarker) => {
  if (!marker.openTimeStart || !marker.openTimeEnd) {
    return runtimeTr('全天可用', 'Available all day');
  }
  return `${marker.openTimeStart} - ${marker.openTimeEnd}`;
};

const getMarkerPinColor = (marker: MapMarker) => {
  if (!marker.isActive) return '#9e9e9e';
  return categoryColor[marker.category] ?? categoryColor.self_definition;
};

const haversineMeters = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 6371000 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

const clampLat = (value: number) => Math.max(-90, Math.min(90, value));

const normalizeLng = (value: number) => {
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  return Math.max(-180, Math.min(180, normalized));
};

const isValidTileProvider = (value: unknown): value is TileProvider =>
  value === 'osm' || value === 'tf_atlas' || value === 'tianditu_vec';

const parseStoredViewport = (raw: string | null): LatLngZoom | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LatLngZoom>;
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    const zoom = Number(parsed.zoom);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const safeZoom = Number.isFinite(zoom)
      ? Math.max(3, Math.min(20, zoom))
      : 11;
    return {
      latitude: clampLat(latitude),
      longitude: normalizeLng(longitude),
      zoom: safeZoom,
    };
  } catch {
    return null;
  }
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  const btoaFn = (
    globalThis as typeof globalThis & { btoa?: (value: string) => string }
  ).btoa;
  if (typeof btoaFn !== 'function') {
    throw new Error('btoa is not available');
  }
  return btoaFn(binary);
};

const normalizeImageContentType = (value: string | null): string => {
  if (!value) return 'image/jpeg';
  const cleaned = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return cleaned.startsWith('image/') ? cleaned : 'image/jpeg';
};

const fetchImageAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept-Language': getAcceptLanguage() },
  });
  if (!response.ok) {
    throw new Error(`avatar fetch failed (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  if (!buffer || buffer.byteLength <= 0) {
    throw new Error('avatar fetch returned empty body');
  }
  const contentType = normalizeImageContentType(
    response.headers.get('content-type'),
  );
  const base64 = bytesToBase64(new Uint8Array(buffer));
  return `data:${contentType};base64,${base64}`;
};

const buildLeafletHtml = (provider: TileProvider, initView: LatLngZoom) => {
  const tileDefs = JSON.stringify(tileProviderConfig);
  const init = JSON.stringify(initView);
  const currentProvider = JSON.stringify(provider);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f6f6f6; }
    .leaflet-control-zoom { display: none !important; }
    .leaflet-container { font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      function post(payload) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      if (!window.L) {
        post({ type: 'leafletLoadFailed', message: 'Leaflet script missing' });
        return;
      }

      var TILE_DEFS = ${tileDefs};
      var INIT = ${init};
      var PROVIDER = ${currentProvider};

      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        worldCopyJump: true,
      }).setView([INIT.latitude, INIT.longitude], INIT.zoom || 11);

      var markerLayer = L.layerGroup().addTo(map);
      var activeBaseLayer = null;
      var activeLabelLayer = null;
      var userLocationMarker = null;
      var userAvatarUrl = '';

      function escapeAttr(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      function getMarkerIcon(color) {
        var safeColor = (typeof color === 'string' && color) ? color : '#1e88e5';
        return L.divIcon({
          className: '',
          html:
            '<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M14 1C7.9 1 3 5.9 3 12c0 9.4 9.2 20.7 10.5 22.3.3.4.9.4 1.2 0C15.8 32.7 25 21.4 25 12 25 5.9 20.1 1 14 1z" fill="' + safeColor + '" stroke="#fff" stroke-width="2"/>' +
              '<circle cx="14" cy="12" r="4.5" fill="#fff"/>' +
            '</svg>',
          iconSize: [28, 40],
          iconAnchor: [14, 38],
          popupAnchor: [0, -32],
        });
      }

      function getUserLocationIcon(avatarUrl) {
        var hasAvatar = typeof avatarUrl === 'string' && avatarUrl.trim().length > 0;
        var safeAvatarUrl = hasAvatar ? escapeAttr(avatarUrl.trim()) : '';
        var fallbackSvg =
          '<circle cx="20" cy="20" r="14.7" fill="#fff" />' +
          '<circle cx="20" cy="15.2" r="4.1" fill="none" stroke="#5a3850" stroke-width="1.8" />' +
          '<path d="M13.3 25c1.6-2.8 4-4.1 6.7-4.1 2.7 0 5.1 1.3 6.7 4.1" fill="none" stroke="#5a3850" stroke-width="1.8" stroke-linecap="round" />';
        var avatarLayer = hasAvatar
          ? fallbackSvg +
            '<image href="' +
            safeAvatarUrl +
            '" xlink:href="' +
            safeAvatarUrl +
            '" x="4.4" y="4.4" width="31.2" height="31.2" clip-path="url(#ly-user-avatar-clip)" preserveAspectRatio="xMidYMid slice" />'
          : fallbackSvg;

        return L.divIcon({
          className: '',
          html:
            '<svg width="56" height="56" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="filter: drop-shadow(0 8px 14px rgba(90,56,80,0.28));">' +
              '<defs>' +
                '<clipPath id="ly-user-avatar-clip">' +
                  '<circle cx="20" cy="20" r="15.6" />' +
                '</clipPath>' +
              '</defs>' +
              '<circle cx="20" cy="20" r="16.8" fill="none" stroke="#5a3850" stroke-width="1.2" opacity="0.42">' +
                '<animate attributeName="r" values="16.8;20.8;16.8" dur="1.9s" repeatCount="indefinite" />' +
                '<animate attributeName="opacity" values="0.42;0;0.42" dur="1.9s" repeatCount="indefinite" />' +
              '</circle>' +
              avatarLayer +
              '<circle cx="20" cy="20" r="15.6" fill="none" stroke="#5a3850" stroke-width="2" />' +
              '<circle cx="20" cy="37.2" r="2.2" fill="#5a3850" opacity="0.88" />' +
            '</svg>',
          iconSize: [56, 56],
          iconAnchor: [28, 28],
          popupAnchor: [0, -28],
        });
      }

      function setUserLocation(lat, lng, avatarUrl) {
        var safeLat = Number(lat);
        var safeLng = Number(lng);
        if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return;
        if (typeof avatarUrl === 'string') userAvatarUrl = avatarUrl.trim();

        var icon = getUserLocationIcon(userAvatarUrl);
        if (userLocationMarker) {
          userLocationMarker.setLatLng([safeLat, safeLng]);
          userLocationMarker.setIcon(icon);
          return;
        }

        userLocationMarker = L.marker([safeLat, safeLng], {
          icon: icon,
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        });
        userLocationMarker.addTo(map);
      }

      function clearUserLocation() {
        if (!userLocationMarker) return;
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
      }

      function applyTileProvider(next) {
        if (activeBaseLayer) {
          map.removeLayer(activeBaseLayer);
          activeBaseLayer = null;
        }
        if (activeLabelLayer) {
          map.removeLayer(activeLabelLayer);
          activeLabelLayer = null;
        }

        var cfg = TILE_DEFS[next] || TILE_DEFS.osm;
        activeBaseLayer = L.tileLayer(cfg.url, {
          maxZoom: 20,
        }).addTo(map);

        if (cfg.labelUrl) {
          activeLabelLayer = L.tileLayer(cfg.labelUrl, {
            maxZoom: 20,
          }).addTo(map);
        }
      }

      function renderMarkers(markers) {
        markerLayer.clearLayers();
        if (!Array.isArray(markers)) return;

        markers.forEach(function (m) {
          var lat = Number(m.lat);
          var lng = Number(m.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          var color = typeof m.color === 'string' && m.color ? m.color : '#1e88e5';
          var marker = L.marker([lat, lng], {
            icon: getMarkerIcon(color),
          });
          marker.on('click', function (evt) {
            if (evt) {
              L.DomEvent.stopPropagation(evt);
            }
            post({ type: 'markerPress', id: Number(m.id) });
          });
          markerLayer.addLayer(marker);
        });
      }

      window.__rnRenderMarkers = function (markers) {
        renderMarkers(markers || []);
      };

      window.__rnSetView = function (lat, lng, zoom) {
        var safeLat = Number(lat);
        var safeLng = Number(lng);
        if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return;
        safeLng = ((safeLng + 180) % 360 + 360) % 360 - 180;
        var z = Number(zoom);
        map.setView([safeLat, safeLng], Number.isFinite(z) ? z : map.getZoom(), {
          animate: true,
        });
      };

      window.__rnSetUserLocation = function (lat, lng, avatarUrl) {
        setUserLocation(lat, lng, avatarUrl);
      };

      window.__rnClearUserLocation = function () {
        clearUserLocation();
      };

      map.on('click', function (e) {
        var lat = e && e.latlng ? Number(e.latlng.lat) : NaN;
        var lng = e && e.latlng ? Number(e.latlng.lng) : NaN;
        post({
          type: 'mapPress',
          latitude: Number.isFinite(lat) ? lat : undefined,
          longitude: Number.isFinite(lng) ? lng : undefined,
        });
      });

      function emitMoveend() {
        var c = map.getCenter();
        var bounds = map.getBounds();
        post({
          type: 'moveend',
          latitude: c.lat,
          longitude: c.lng,
          zoom: map.getZoom(),
          south: bounds.getSouth(),
          north: bounds.getNorth(),
          west: bounds.getWest(),
          east: bounds.getEast(),
        });
      }

      map.on('moveend', emitMoveend);

      applyTileProvider(PROVIDER);
      emitMoveend();
      post({ type: 'mapReady' });

      if (navigator.geolocation && navigator.geolocation.watchPosition) {
        navigator.geolocation.watchPosition(
          function (pos) {
            setUserLocation(pos.coords.latitude, pos.coords.longitude, userAvatarUrl);
            post({
              type: 'userLocation',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          function (err) {
            post({ type: 'geoError', message: err && err.message ? err.message : 'geolocation failed' });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }
    })();
  </script>
</body>
</html>`;
};

type MapScreenProps = {
  focusRequest?: MapFocusRequest | null;
  isActive?: boolean;
};

export function MapScreen({ focusRequest, isActive = true }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const { language, tr } = useLanguage();
  const localizedCategoryLabel = useMemo<Record<MarkerCategory, string>>(
    () => ({
      accessible_toilet: tr('无障碍卫生间', 'Accessible Restroom'),
      friendly_clinic: tr('友好医疗机构', 'Trans-Friendly Clinic'),
      baby_room: tr('母婴室', 'Nursing Room'),
      self_definition: tr('自定义', 'Custom'),
    }),
    [tr],
  );
  const localizedNearbyCategoryLabel = useMemo<Record<NearbyCategory, string>>(
    () => ({
      accessible_toilet: tr('无障碍卫生间', 'Accessible Restroom'),
      friendly_clinic: tr('友好医疗机构', 'Trans-Friendly Clinic'),
      baby_room: tr('母婴室', 'Nursing Room'),
    }),
    [tr],
  );

  const webViewRef = useRef<WebView>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeFixHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const addModeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const appStateRef = useRef(AppState.currentState);
  const nativeLocateInFlightRef = useRef(false);
  const nativeFallbackCooldownRef = useRef(0);
  const mapViewportRef = useRef<LatLngZoom>(INITIAL_VIEW);
  const restoredViewportRef = useRef<LatLngZoom | null>(null);
  const startupCameraAppliedRef = useRef(false);
  const markerQuerySeqRef = useRef(0);
  const avatarResolveSeqRef = useRef(0);
  const markerImageUrlRef = useRef<Map<number, string>>(new Map());
  const hasLoadedMarkersRef = useRef(false);
  const handledFocusRequestRef = useRef<number | null>(null);
  const pendingFocusMarkerIdRef = useRef<number | null>(null);
  const addModeHintBootstrappedRef = useRef(false);
  const savingDraftRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [timeFixHint, setTimeFixHint] = useState('');
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [draft, setDraft] = useState<DraftMarker | null>(null);
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftImageFile, setDraftImageFile] = useState<LocalUploadImage | null>(
    null,
  );
  const [draftImageBusy, setDraftImageBusy] = useState(false);
  const [draftImageHint, setDraftImageHint] = useState('');
  const [draftImageError, setDraftImageError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [canDeleteDraft, setCanDeleteDraft] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMarker, setDeletingMarker] = useState(false);

  const [visibleCats, setVisibleCats] = useState<
    Record<MarkerCategory, boolean>
  >({
    accessible_toilet: true,
    friendly_clinic: true,
    baby_room: true,
    self_definition: true,
  });
  const [legendOpen, setLegendOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [tileProvider, setTileProvider] =
    useState<TileProvider>(initialTileProvider);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nearbyPanelOpen, setNearbyPanelOpen] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [nearbyIds, setNearbyIds] = useState<Set<number>>(new Set());
  const [nearbyResults, setNearbyResults] = useState<NearbyResult[]>([]);
  const [nearbyCategory, setNearbyCategory] =
    useState<NearbyCategory>('accessible_toilet');
  const [nearbyRadius, setNearbyRadius] = useState<number>(1000);
  const [nearbyRadiusInput, setNearbyRadiusInput] = useState<string>('1000');
  const [nearbyRadiusError, setNearbyRadiusError] = useState('');

  const [locationPermissionGranted, setLocationPermissionGranted] = useState(
    Platform.OS !== 'android',
  );
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapViewport, setMapViewport] = useState<LatLngZoom>(INITIAL_VIEW);
  const [mapBounds, setMapBounds] = useState<ViewportBounds | null>(null);
  const [mapInitView, setMapInitView] = useState<LatLngZoom>(INITIAL_VIEW);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [mapAvatarSource, setMapAvatarSource] = useState('');
  const [missingImageMarkerIds, setMissingImageMarkerIds] = useState<
    Set<number>
  >(new Set());
  const [showAddModeHint, setShowAddModeHint] = useState(false);

  const topOffset = insets.top + 12;
  const bottomOffset =
    Platform.OS === 'ios' ? 10 : Math.max(14, insets.bottom + 10);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice('');
      noticeTimerRef.current = null;
    }, 2600);
  }, []);

  const showTimeFixHint = useCallback((text: string) => {
    setTimeFixHint(text);
    if (timeFixHintTimerRef.current) clearTimeout(timeFixHintTimerRef.current);
    timeFixHintTimerRef.current = setTimeout(() => {
      setTimeFixHint('');
      timeFixHintTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    setError('');
    setNotice('');
    setTimeFixHint('');
    setDraftImageHint('');
    setDraftImageError('');
    setNearbyRadiusError('');
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    if (timeFixHintTimerRef.current) {
      clearTimeout(timeFixHintTimerRef.current);
      timeFixHintTimerRef.current = null;
    }
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedViewportRaw, savedTileProviderRaw] = await Promise.all([
          AsyncStorage.getItem(MAP_VIEWPORT_STORAGE_KEY),
          AsyncStorage.getItem(MAP_TILE_PROVIDER_STORAGE_KEY),
        ]);

        if (cancelled) return;

        const savedViewport = parseStoredViewport(savedViewportRaw);
        if (savedViewport) {
          restoredViewportRef.current = savedViewport;
          mapViewportRef.current = savedViewport;
          setMapViewport(savedViewport);
          setMapInitView(savedViewport);
        }

        if (isValidTileProvider(savedTileProviderRaw)) {
          setTileProvider(savedTileProviderRaw);
        }
      } finally {
        if (!cancelled) setSessionRestored(true);
      }
    })().catch(() => {
      if (!cancelled) setSessionRestored(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const requestNativeCurrentLocation = useCallback(
    async ({
      recenter = false,
      silent = false,
    }: {
      recenter?: boolean;
      silent?: boolean;
    } = {}): Promise<boolean> => {
      if (!supportsNativeLocation) return false;
      if (!locationPermissionGranted) return false;
      if (
        !nativeLocationModule ||
        typeof nativeLocationModule.getCurrentPosition !== 'function'
      ) {
        return false;
      }
      if (nativeLocateInFlightRef.current) return false;

      nativeLocateInFlightRef.current = true;
      try {
        const payload = await nativeLocationModule.getCurrentPosition({
          timeoutMs: 8000,
          maxAgeMs: 60000,
        });
        const latitude = Number(payload?.latitude);
        const longitude = Number(payload?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error(
            tr(
              '原生定位返回坐标无效。',
              'Native location returned invalid coordinates.',
            ),
          );
        }

        setUserLocation({ latitude, longitude });
        if (recenter) {
          webViewRef.current?.injectJavaScript(
            `window.__rnSetView(${latitude}, ${longitude}, 15);\ntrue;`,
          );
        }

        if (!silent) {
          const provider =
            typeof payload.provider === 'string' && payload.provider.trim()
              ? payload.provider
              : 'native';
          showNotice(
            tr(
              `已使用原生定位（${provider}）。`,
              `Using native location (${provider}).`,
            ),
          );
        }
        return true;
      } catch (err) {
        const nativeCode =
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          typeof (err as { code?: unknown }).code === 'string'
            ? (err as { code: string }).code
            : '';
        if (nativeCode === 'LOCATION_PERMISSION_DENIED') {
          setLocationPermissionGranted(false);
        }
        if (!silent) {
          const knownMessage: Record<string, string> = {
            LOCATION_BUSY: tr(
              '已有定位请求正在进行。',
              'A location request is already in progress.',
            ),
            LOCATION_SERVICE_UNAVAILABLE: tr(
              '无法访问定位服务。',
              'Unable to access location services.',
            ),
            LOCATION_PERMISSION_DENIED: tr(
              '未授予定位权限。',
              'Location permission was not granted.',
            ),
            LOCATION_PROVIDER_DISABLED: tr(
              '定位服务已关闭。',
              'Location services are turned off.',
            ),
            LOCATION_TIMEOUT: tr(
              '定位请求超时，请重试。',
              'Location request timed out. Please try again.',
            ),
            LOCATION_UNAVAILABLE: tr(
              '无法获取当前位置。',
              'Unable to get your current location.',
            ),
            LOCATION_INTERNAL_ERROR: tr(
              '原生定位请求失败。',
              'Native location request failed.',
            ),
          };
          const message =
            knownMessage[nativeCode] ||
            tr(
              '定位失败，请稍后重试。',
              'Could not determine your location. Please try again.',
            );
          showNotice(
            tr(
              `原生定位失败：${message}`,
              `Native location failed: ${message}`,
            ),
          );
        }
        return false;
      } finally {
        nativeLocateInFlightRef.current = false;
      }
    },
    [locationPermissionGranted, showNotice, tr],
  );

  const openDraftMenu = useCallback((nextDraft: DraftMarker) => {
    setCategorySelectOpen(false);
    setTimeFixHint('');
    setDraftImageFile(null);
    setDraftImageHint('');
    setDraftImageError('');
    setDraftImageBusy(false);
    if (timeFixHintTimerRef.current) {
      clearTimeout(timeFixHintTimerRef.current);
      timeFixHintTimerRef.current = null;
    }
    setDraft(nextDraft);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (timeFixHintTimerRef.current)
        clearTimeout(timeFixHintTimerRef.current);
      if (addModeHintTimerRef.current)
        clearTimeout(addModeHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isActive || !mapReady || !sessionRestored) return;
    if (addModeHintBootstrappedRef.current) return;
    addModeHintBootstrappedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const seen = await AsyncStorage.getItem(MAP_ADD_MODE_HINT_SEEN_KEY);
        if (cancelled || seen === '1') return;
        setShowAddModeHint(true);
        await AsyncStorage.setItem(MAP_ADD_MODE_HINT_SEEN_KEY, '1');
      } catch {
        if (!cancelled) setShowAddModeHint(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, mapReady, sessionRestored]);

  useEffect(() => {
    if (!showAddModeHint) return;
    if (addModeHintTimerRef.current) clearTimeout(addModeHintTimerRef.current);
    addModeHintTimerRef.current = setTimeout(() => {
      setShowAddModeHint(false);
      addModeHintTimerRef.current = null;
    }, 6000);
    return () => {
      if (addModeHintTimerRef.current) {
        clearTimeout(addModeHintTimerRef.current);
        addModeHintTimerRef.current = null;
      }
    };
  }, [showAddModeHint]);

  const syncLocationPermission = useCallback(
    async (requestIfMissing: boolean): Promise<boolean> => {
      if (Platform.OS !== 'android') {
        setLocationPermissionGranted(true);
        return true;
      }
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted) {
          setLocationPermissionGranted(true);
          return true;
        }

        if (!requestIfMissing) {
          setLocationPermissionGranted(false);
          return false;
        }

        const asked = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: tr('定位权限', 'Location Permission'),
            message: tr(
              '用于查询附近点位与快速定位当前位置。',
              'Lycoris uses your location to find nearby places and quickly center the map.',
            ),
            buttonPositive: tr('允许', 'Allow'),
            buttonNegative: tr('拒绝', 'Not Now'),
          },
        );
        const ok = asked === PermissionsAndroid.RESULTS.GRANTED;
        setLocationPermissionGranted(ok);
        if (!ok)
          showNotice(
            tr(
              '定位权限未开启，附近查询不可用。',
              'Location permission is off, so nearby search is unavailable.',
            ),
          );
        return ok;
      } catch {
        setLocationPermissionGranted(false);
        return false;
      }
    },
    [showNotice, tr],
  );

  const requestWebViewCurrentLocation = useCallback(() => {
    if (!mapReady) return;
    webViewRef.current?.injectJavaScript(`(function(){
      if (!window.ReactNativeWebView || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        function(pos){
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'userLocation',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          }));
        },
        function(err){
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'geoError',
            message: err && err.message ? err.message : 'geolocation failed'
          }));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    })();
    true;`);
  }, [mapReady]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    syncLocationPermission(true).catch(() => {});
  }, [syncLocationPermission]);

  useEffect(() => {
    if (!isActive) return;
    if (Platform.OS === 'android') {
      syncLocationPermission(false)
        .then(ok => {
          if (ok) requestWebViewCurrentLocation();
        })
        .catch(() => {});
      return;
    }
    requestWebViewCurrentLocation();
  }, [isActive, requestWebViewCurrentLocation, syncLocationPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (!isActive) return;
      if (
        (prev === 'inactive' || prev === 'background') &&
        nextState === 'active'
      ) {
        if (Platform.OS === 'android') {
          syncLocationPermission(false)
            .then(ok => {
              if (ok) requestWebViewCurrentLocation();
            })
            .catch(() => {});
        } else {
          requestWebViewCurrentLocation();
        }
      }
    });
    return () => {
      sub.remove();
    };
  }, [isActive, requestWebViewCurrentLocation, syncLocationPermission]);

  useEffect(() => {
    if (!isActive || !locationPermissionGranted) return;
    requestWebViewCurrentLocation();
  }, [
    isActive,
    locationPermissionGranted,
    mapReady,
    requestWebViewCurrentLocation,
  ]);

  useEffect(() => {
    if (!isActive || !locationPermissionGranted || userLocation) return;
    const timer = setTimeout(() => {
      requestNativeCurrentLocation({ silent: true }).catch(() => {});
    }, 1800);
    return () => clearTimeout(timer);
  }, [
    isActive,
    locationPermissionGranted,
    requestNativeCurrentLocation,
    userLocation,
  ]);

  const selectedVisibleCategories = useMemo(
    () => supportedCategories.filter(key => visibleCats[key]),
    [visibleCats],
  );

  const loadMarkersInViewport = useCallback(
    async (bounds: ViewportBounds, categories: MarkerCategory[]) => {
      if (categories.length === 0) {
        setMarkers([]);
        setError('');
        if (!hasLoadedMarkersRef.current) {
          hasLoadedMarkersRef.current = true;
          setLoading(false);
        }
        return;
      }

      const seq = ++markerQuerySeqRef.current;
      const isFirstLoad = !hasLoadedMarkersRef.current;
      if (isFirstLoad) setLoading(true);
      if (__DEV__) {
        console.log('[MapViewport] request', {
          seq,
          bounds,
          categories,
        });
      }

      const fetchViewportSegment = async (minLng: number, maxLng: number) => {
        const params = new URLSearchParams({
          minLat: String(bounds.minLat),
          maxLat: String(bounds.maxLat),
          minLng: String(minLng),
          maxLng: String(maxLng),
          categories: categories.join(','),
        });
        return requestJson<unknown>(
          `/api/markers/viewport?${params.toString()}`,
        );
      };

      try {
        let mergedMarkers: MapMarker[];
        if (bounds.wholeWorld) {
          const payload = await fetchViewportSegment(-180, 180);
          mergedMarkers = normalizeMarkers(payload);
        } else if (
          !bounds.wrapsAntimeridian &&
          bounds.minLng <= bounds.maxLng
        ) {
          const payload = await fetchViewportSegment(
            bounds.minLng,
            bounds.maxLng,
          );
          mergedMarkers = normalizeMarkers(payload);
        } else {
          const [leftPayload, rightPayload] = await Promise.all([
            fetchViewportSegment(bounds.minLng, 180),
            fetchViewportSegment(-180, bounds.maxLng),
          ]);
          const mergedById = new Map<number, MapMarker>();
          [
            ...normalizeMarkers(leftPayload),
            ...normalizeMarkers(rightPayload),
          ].forEach(marker => {
            mergedById.set(marker.id, marker);
          });
          mergedMarkers = Array.from(mergedById.values());
        }

        if (seq !== markerQuerySeqRef.current) return;
        if (__DEV__) {
          console.log('[MapViewport] success', {
            seq,
            markerCount: mergedMarkers.length,
          });
        }
        setMarkers(mergedMarkers);
        setError('');
      } catch (e) {
        if (seq !== markerQuerySeqRef.current) return;
        if (__DEV__) {
          console.log('[MapViewport] failed', {
            seq,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        const message =
          e instanceof Error
            ? e.message
            : tr('加载点位失败。', 'Could not load places.');
        setError(message);
      } finally {
        if (seq === markerQuerySeqRef.current && !hasLoadedMarkersRef.current) {
          hasLoadedMarkersRef.current = true;
          setLoading(false);
        }
      }
    },
    [tr],
  );

  const reloadMarkersInCurrentViewport = useCallback(async () => {
    if (!mapBounds) return;
    await loadMarkersInViewport(mapBounds, selectedVisibleCategories);
  }, [loadMarkersInViewport, mapBounds, selectedVisibleCategories]);

  const loadFavorites = useCallback(async () => {
    if (!isLoggedIn) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const payload = await requestJson<unknown>('/api/markers/me/favorites');
      setFavoriteIds(parseFavoriteIds(payload));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setFavoriteIds(new Set());
        return;
      }
      setFavoriteIds(new Set());
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!mapBounds) return;
    loadMarkersInViewport(mapBounds, selectedVisibleCategories).catch(() => {});
  }, [loadMarkersInViewport, mapBounds, selectedVisibleCategories]);

  useEffect(() => {
    loadFavorites().catch(() => {});
  }, [loadFavorites]);

  useEffect(() => {
    if (!isLoggedIn && addMode) setAddMode(false);
    if (!isLoggedIn && draft) {
      setDraft(null);
      setEditingId(null);
      setCanDeleteDraft(true);
      setDeleteConfirmOpen(false);
    }
  }, [addMode, draft, isLoggedIn]);

  const filteredMarkers = useMemo(() => {
    return markers.filter(marker => {
      if (!visibleCats[marker.category]) return false;
      if (nearbyOnly && !nearbyIds.has(marker.id)) return false;
      if (ownerFilter === 'mine') {
        if (!user?.publicId || marker.userPublicId !== user.publicId)
          return false;
      }
      if (ownerFilter === 'fav') {
        if (!favoriteIds.has(marker.id)) return false;
      }
      return true;
    });
  }, [
    markers,
    visibleCats,
    nearbyOnly,
    nearbyIds,
    ownerFilter,
    user?.publicId,
    favoriteIds,
  ]);

  useEffect(() => {
    if (selectedMarkerId == null) return;
    const exists = filteredMarkers.some(
      marker => marker.id === selectedMarkerId,
    );
    if (!exists) setSelectedMarkerId(null);
  }, [filteredMarkers, selectedMarkerId]);

  useEffect(() => {
    const pendingMarkerId = pendingFocusMarkerIdRef.current;
    if (pendingMarkerId == null) return;
    const found = filteredMarkers.find(marker => marker.id === pendingMarkerId);
    if (!found) return;
    setSelectedMarkerId(found.id);
    pendingFocusMarkerIdRef.current = null;
  }, [filteredMarkers]);

  const selectedMarker = useMemo(
    () =>
      filteredMarkers.find(marker => marker.id === selectedMarkerId) ?? null,
    [filteredMarkers, selectedMarkerId],
  );
  const selectedMarkerImageUri = useMemo(() => {
    if (!selectedMarker?.markImage) return '';
    const resolved = toBackendAssetUrl(selectedMarker.markImage);
    return resolved ?? selectedMarker.markImage ?? '';
  }, [selectedMarker?.markImage]);

  useEffect(() => {
    const currentMap = new Map<number, string>();
    for (const marker of markers) {
      if (marker.markImage) {
        currentMap.set(marker.id, marker.markImage);
      }
    }

    setMissingImageMarkerIds(prev => {
      const next = new Set(prev);
      for (const markerId of prev) {
        const latestUrl = currentMap.get(markerId);
        const previousUrl = markerImageUrlRef.current.get(markerId);
        if (!latestUrl || previousUrl !== latestUrl) {
          next.delete(markerId);
        }
      }
      return next;
    });

    markerImageUrlRef.current = currentMap;
  }, [markers]);

  const webMarkers = useMemo(
    () =>
      filteredMarkers.map(marker => ({
        id: marker.id,
        lat: marker.lat,
        lng: marker.lng,
        color: getMarkerPinColor(marker),
      })),
    [filteredMarkers],
  );

  useEffect(() => {
    if (!isLoggedIn || !user?.publicId) {
      setMapAvatarSource('');
      return;
    }

    const seq = avatarResolveSeqRef.current + 1;
    avatarResolveSeqRef.current = seq;
    let cancelled = false;

    const publicId = encodeURIComponent(String(user.publicId));
    const resolveUrlCandidates = () => {
      const candidates: string[] = [];
      const direct = toBackendAssetUrl(user.avatarUrl);
      if (direct) candidates.push(direct);
      candidates.push(buildApiUrl(`/api/users/${publicId}/avatar`));
      return Array.from(new Set(candidates));
    };
    const candidates = resolveUrlCandidates();
    const isInsecureHttp = candidates.some(candidate =>
      /^http:\/\//i.test(candidate),
    );

    (async () => {
      if (__DEV__) {
        console.log('[MapAvatar] source url candidates:', candidates);
      }

      for (const candidate of candidates) {
        const withBuster = `${candidate}${
          candidate.includes('?') ? '&' : '?'
        }v=${Date.now()}`;
        try {
          const dataUrl = await fetchImageAsDataUrl(withBuster);
          if (cancelled || avatarResolveSeqRef.current !== seq) return;
          setMapAvatarSource(dataUrl);
          if (__DEV__) {
            console.log('[MapAvatar] using data-url avatar source');
          }
          return;
        } catch (e) {
          if (!__DEV__) continue;
          const message = e instanceof Error ? e.message : String(e);
          console.log('[MapAvatar] data-url conversion failed:', message);
        }
      }

      if (cancelled || avatarResolveSeqRef.current !== seq) return;
      const fallback = `${candidates[0]}${
        candidates[0].includes('?') ? '&' : '?'
      }v=${Date.now()}`;
      setMapAvatarSource(fallback);
      if (__DEV__) {
        console.log(
          `[MapAvatar] all data-url attempts failed${
            isInsecureHttp ? ' (insecure-http)' : ''
          }, fallback to direct url`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.publicId, user?.avatarUrl]);

  const activeTileProvider = useMemo<TileProvider>(() => {
    if (tileProvider === 'tf_atlas' && !hasThunderforestKey) return 'osm';
    if (tileProvider === 'tianditu_vec' && !hasTiandituKey) return 'osm';
    return tileProvider;
  }, [tileProvider]);

  useEffect(() => {
    mapViewportRef.current = mapViewport;
  }, [mapViewport]);

  useEffect(() => {
    if (!sessionRestored) return;
    const timer = setTimeout(() => {
      const payload: LatLngZoom = {
        latitude: clampLat(mapViewport.latitude),
        longitude: normalizeLng(mapViewport.longitude),
        zoom: Math.max(3, Math.min(20, mapViewport.zoom)),
      };
      AsyncStorage.setItem(
        MAP_VIEWPORT_STORAGE_KEY,
        JSON.stringify(payload),
      ).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [
    mapViewport.latitude,
    mapViewport.longitude,
    mapViewport.zoom,
    sessionRestored,
  ]);

  useEffect(() => {
    if (!sessionRestored) return;
    AsyncStorage.setItem(MAP_TILE_PROVIDER_STORAGE_KEY, tileProvider).catch(
      () => {},
    );
  }, [sessionRestored, tileProvider]);

  useEffect(() => {
    // Preserve the current viewport when the provider changes.
    setMapInitView(mapViewportRef.current);
    setMapReady(false);
  }, [activeTileProvider]);

  const leafletHtml = useMemo(
    () => buildLeafletHtml(activeTileProvider, mapInitView),
    [activeTileProvider, mapInitView],
  );

  const injectJs = useCallback((script: string) => {
    webViewRef.current?.injectJavaScript(`${script}\ntrue;`);
  }, []);

  const applyStartupCamera = useCallback(
    (target: LatLngZoom) => {
      if (startupCameraAppliedRef.current) return;
      startupCameraAppliedRef.current = true;
      injectJs(
        `window.__rnSetView(${target.latitude}, ${target.longitude}, ${target.zoom});`,
      );
    },
    [injectJs],
  );

  useEffect(() => {
    if (!isActive || !mapReady || !sessionRestored) return;
    if (startupCameraAppliedRef.current) return;
    if (!userLocation) return;
    applyStartupCamera({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      zoom: 15,
    });
  }, [applyStartupCamera, isActive, mapReady, sessionRestored, userLocation]);

  useEffect(() => {
    if (!isActive || !mapReady || !sessionRestored) return;
    if (startupCameraAppliedRef.current) return;
    if (userLocation) return;
    const timer = setTimeout(() => {
      if (startupCameraAppliedRef.current) return;
      const fallback = restoredViewportRef.current ?? INITIAL_VIEW;
      applyStartupCamera(fallback);
    }, 1800);
    return () => clearTimeout(timer);
  }, [applyStartupCamera, isActive, mapReady, sessionRestored, userLocation]);

  useEffect(() => {
    if (!mapReady) return;
    const payload = JSON.stringify(webMarkers);
    if (__DEV__) {
      console.log('[MapViewport] renderMarkers', {
        markerCount: webMarkers.length,
      });
    }
    injectJs(`window.__rnRenderMarkers(${payload});`);
  }, [injectJs, mapReady, webMarkers]);

  useEffect(() => {
    if (!mapReady) return;
    if (!userLocation) {
      injectJs(
        'window.__rnClearUserLocation && window.__rnClearUserLocation();',
      );
      return;
    }
    const avatar = JSON.stringify(mapAvatarSource);
    injectJs(
      `window.__rnSetUserLocation(${userLocation.latitude}, ${userLocation.longitude}, ${avatar});`,
    );
  }, [injectJs, mapAvatarSource, mapReady, userLocation]);

  useEffect(() => {
    if (!focusRequest || !mapReady) return;
    if (handledFocusRequestRef.current === focusRequest.requestId) return;
    handledFocusRequestRef.current = focusRequest.requestId;

    setOwnerFilter('all');
    setNearbyOnly(false);
    setLegendOpen(false);
    setSettingsOpen(false);
    setNearbyPanelOpen(false);
    setVisibleCats({
      accessible_toilet: true,
      friendly_clinic: true,
      baby_room: true,
      self_definition: true,
    });

    const markerId = Number(focusRequest.markerId);
    if (!Number.isFinite(markerId)) return;

    const currentMarker =
      markers.find(marker => marker.id === markerId) || null;
    if (currentMarker) {
      setSelectedMarkerId(currentMarker.id);
      pendingFocusMarkerIdRef.current = null;
    } else {
      pendingFocusMarkerIdRef.current = markerId;
    }

    const latCandidate =
      typeof focusRequest.lat === 'number'
        ? focusRequest.lat
        : currentMarker?.lat;
    const lngCandidate =
      typeof focusRequest.lng === 'number'
        ? focusRequest.lng
        : currentMarker?.lng;
    if (Number.isFinite(latCandidate) && Number.isFinite(lngCandidate)) {
      injectJs(`window.__rnSetView(${latCandidate}, ${lngCandidate}, 15);`);
    }

    const focusTitle =
      focusRequest.title || currentMarker?.title || String(markerId);
    showNotice(
      tr(`已定位到点位：${focusTitle}`, `Centered on place: ${focusTitle}`),
    );
  }, [focusRequest, injectJs, mapReady, markers, showNotice, tr]);

  const openDraftAt = useCallback(
    (lat: number, lng: number) => {
      openDraftMenu({
        clientRequestId: createClientRequestId(),
        lat,
        lng,
        category: 'accessible_toilet',
        title: '',
        description: '',
        isPublic: true,
        openStartHour: '',
        openStartMinute: '',
        openEndHour: '',
        openEndMinute: '',
      });
      setEditingId(null);
      setCanDeleteDraft(true);
      setDeleteConfirmOpen(false);
      setAddMode(false);
      showNotice(
        tr(
          '已选择位置，请填写点位信息。',
          'Location selected. Add the place details.',
        ),
      );
    },
    [openDraftMenu, showNotice, tr],
  );

  const openEditDraft = useCallback(
    (marker: MapMarker) => {
      if (!isLoggedIn) {
        showNotice(
          tr('请先登录再编辑点位。', 'Log in before editing a place.'),
        );
        return;
      }
      const start = splitHHMM(marker.openTimeStart);
      const end = splitHHMM(marker.openTimeEnd);
      openDraftMenu({
        clientRequestId: '',
        lat: marker.lat,
        lng: marker.lng,
        category: marker.category,
        title: marker.title,
        description: marker.description ?? '',
        isPublic: marker.isPublic,
        openStartHour: start.hour,
        openStartMinute: start.minute,
        openEndHour: end.hour,
        openEndMinute: end.minute,
      });
      setEditingId(marker.id);
      setCanDeleteDraft(
        user?.publicId != null && marker.userPublicId === user.publicId,
      );
      setDeleteConfirmOpen(false);
      setAddMode(false);
      showNotice(tr('已进入编辑模式。', 'Editing mode is active.'));
    },
    [isLoggedIn, openDraftMenu, showNotice, tr, user?.publicId],
  );

  const handleMapPress = useCallback(
    (latitude?: number, longitude?: number) => {
      if (
        addMode &&
        isLoggedIn &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        openDraftAt(Number(latitude), Number(longitude));
      }

      if (settingsOpen) setSettingsOpen(false);
      if (nearbyPanelOpen) setNearbyPanelOpen(false);
      if (legendOpen) setLegendOpen(false);
      if (categorySelectOpen) setCategorySelectOpen(false);
      if (selectedMarkerId != null) setSelectedMarkerId(null);
    },
    [
      addMode,
      categorySelectOpen,
      isLoggedIn,
      legendOpen,
      nearbyPanelOpen,
      openDraftAt,
      selectedMarkerId,
      settingsOpen,
    ],
  );

  const handleWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg: WebMapMessage | null = null;
      try {
        msg = JSON.parse(event.nativeEvent.data) as WebMapMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

      if (msg.type === 'mapReady') {
        setMapReady(true);
        setError('');
        const payload = JSON.stringify(webMarkers);
        injectJs(`window.__rnRenderMarkers(${payload});`);
        return;
      }

      if (msg.type === 'mapPress') {
        const lat = Number(msg.latitude);
        const lng = Number(msg.longitude);
        handleMapPress(
          Number.isFinite(lat) ? lat : undefined,
          Number.isFinite(lng) ? lng : undefined,
        );
        return;
      }

      if (msg.type === 'markerPress') {
        const markerId = Number(msg.id);
        if (Number.isFinite(markerId)) setSelectedMarkerId(markerId);
        return;
      }

      if (msg.type === 'moveend') {
        const lat = Number(msg.latitude);
        const lng = Number(msg.longitude);
        const zoom = Number(msg.zoom);
        const south = Number(msg.south);
        const north = Number(msg.north);
        const west = Number(msg.west);
        const east = Number(msg.east);
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Number.isFinite(zoom)
        ) {
          setMapViewport({ latitude: lat, longitude: normalizeLng(lng), zoom });
        }
        if (
          Number.isFinite(south) &&
          Number.isFinite(north) &&
          Number.isFinite(west) &&
          Number.isFinite(east)
        ) {
          const minLat = clampLat(Math.min(south, north));
          const maxLat = clampLat(Math.max(south, north));
          const lngSpan = Math.abs(east - west);
          if (Number.isFinite(lngSpan) && lngSpan >= 359.999) {
            setMapBounds({
              minLat,
              maxLat,
              minLng: -180,
              maxLng: 180,
              wrapsAntimeridian: false,
              wholeWorld: true,
            });
          } else {
            const minLng = normalizeLng(west);
            const maxLng = normalizeLng(east);
            const wrapsAntimeridian = minLng > maxLng;
            setMapBounds({
              minLat,
              maxLat,
              minLng,
              maxLng,
              wrapsAntimeridian,
              wholeWorld: false,
            });
          }
        }
        return;
      }

      if (msg.type === 'userLocation') {
        const lat = Number(msg.latitude);
        const lng = Number(msg.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setUserLocation({ latitude: lat, longitude: lng });
        }
        return;
      }

      if (msg.type === 'geoError') {
        if (locationPermissionGranted) {
          const detail =
            typeof msg.message === 'string' ? msg.message.trim() : '';
          const now = Date.now();
          if (now - nativeFallbackCooldownRef.current < 1800) return;
          nativeFallbackCooldownRef.current = now;
          requestNativeCurrentLocation({ silent: true })
            .then(ok => {
              if (ok) {
                return;
              }
              if (/secure origins?/i.test(detail)) {
                showNotice(
                  tr(
                    '当前地图源不是安全来源，定位失败。已切换安全地图源并重试。',
                    'Location failed because the current map source is not secure. Switched to a secure source and trying again.',
                  ),
                );
              } else {
                showNotice(
                  tr(
                    '定位失败，你仍可继续浏览地图。',
                    'Could not determine your location. You can continue browsing the map.',
                  ),
                );
              }
            })
            .catch(() => {
              showNotice(
                tr(
                  '定位失败，你仍可继续浏览地图。',
                  'Could not determine your location. You can continue browsing the map.',
                ),
              );
            });
        }
        return;
      }

      if (msg.type === 'leafletLoadFailed') {
        setError(
          tr(
            '地图加载失败，请检查网络后重试。',
            'Could not load the map. Check your connection and try again.',
          ),
        );
      }
    },
    [
      handleMapPress,
      injectJs,
      locationPermissionGranted,
      requestNativeCurrentLocation,
      showNotice,
      tr,
      webMarkers,
    ],
  );

  const focusMarker = useCallback(
    (marker: MapMarker) => {
      setSelectedMarkerId(marker.id);
      injectJs(`window.__rnSetView(${marker.lat}, ${marker.lng}, 15);`);
    },
    [injectJs],
  );

  const recenterToUserLocation = useCallback(async () => {
    if (!locationPermissionGranted) {
      showNotice(
        tr('请先开启定位权限。', 'Turn on location permission first.'),
      );
      return;
    }

    if (!userLocation) {
      const ok = await requestNativeCurrentLocation({
        recenter: true,
        silent: true,
      });
      if (!ok) {
        showNotice(
          tr(
            '暂时无法获取当前位置，请稍后重试。',
            'Your location is temporarily unavailable. Please try again.',
          ),
        );
      }
      return;
    }

    injectJs(
      `window.__rnSetView(${userLocation.latitude}, ${userLocation.longitude}, 15);`,
    );
  }, [
    injectJs,
    locationPermissionGranted,
    requestNativeCurrentLocation,
    showNotice,
    tr,
    userLocation,
  ]);

  const openWebMap = useCallback(
    async (marker?: MapMarker) => {
      let url = `${WEB_BASE_URL}/maps`;
      if (marker) {
        const title = encodeURIComponent(marker.title);
        url += `?markerId=${marker.id}&lat=${marker.lat}&lng=${marker.lng}&title=${title}`;
      }
      try {
        await Linking.openURL(url);
      } catch {
        showNotice(tr('无法打开网页地图。', 'Could not open the web map.'));
      }
    },
    [showNotice, tr],
  );

  const resetDraftState = useCallback(() => {
    setCategorySelectOpen(false);
    setTimeFixHint('');
    setDraftImageFile(null);
    setDraftImageHint('');
    setDraftImageError('');
    setDraftImageBusy(false);
    if (timeFixHintTimerRef.current) {
      clearTimeout(timeFixHintTimerRef.current);
      timeFixHintTimerRef.current = null;
    }
    setDraft(null);
    setEditingId(null);
    setCanDeleteDraft(true);
    setDeleteConfirmOpen(false);
  }, []);

  const pickDraftImage = useCallback(async () => {
    if (!draft || savingDraft || draftImageBusy) return;
    setDraftImageBusy(true);
    setDraftImageError('');
    const result = await pickUploadImage({ mode: 'marker' });
    setDraftImageBusy(false);

    if (result.cancelled) return;
    if (!result.file) {
      setDraftImageFile(null);
      setDraftImageHint('');
      setDraftImageError(result.error);
      return;
    }

    setDraftImageFile(result.file);
    setDraftImageHint(result.hint);
    setDraftImageError('');
  }, [draft, draftImageBusy, savingDraft]);

  const closeDraft = useCallback(() => {
    if (savingDraft || deletingMarker) return;
    resetDraftState();
  }, [deletingMarker, resetDraftState, savingDraft]);

  const handleAddButtonPress = useCallback(() => {
    setShowAddModeHint(false);
    if (!isLoggedIn) {
      showNotice(tr('请先登录再添加点位。', 'Log in before adding a place.'));
      return;
    }

    setAddMode(prev => {
      if (prev) {
        const center = mapViewportRef.current;
        openDraftAt(center.latitude, center.longitude);
        return false;
      }
      const next = !prev;
      if (next) {
        setDraft(null);
        setEditingId(null);
        setCanDeleteDraft(true);
        setDeleteConfirmOpen(false);
        setSelectedMarkerId(null);
        setLegendOpen(false);
        showNotice(
          tr(
            '已开启新增点位模式：点击地图选择位置；再次点击加号则使用地图中心。',
            'Add-place mode is on. Tap the map to choose a location, or tap the plus button again to use the map center.',
          ),
        );
      } else {
        showNotice(tr('已关闭新增点位模式。', 'Add-place mode is off.'));
      }
      return next;
    });
  }, [isLoggedIn, openDraftAt, showNotice, tr]);

  const setDraftTimePart = useCallback(
    (
      key:
        | 'openStartHour'
        | 'openStartMinute'
        | 'openEndHour'
        | 'openEndMinute',
      value: string,
    ) => {
      const digits = value.replace(/\D/g, '').slice(0, 2);
      setTimeFixHint('');
      setDraft(prev => (prev ? { ...prev, [key]: digits } : prev));
    },
    [],
  );

  const normalizeDraftTimePartOnBlur = useCallback(
    (
      key:
        | 'openStartHour'
        | 'openStartMinute'
        | 'openEndHour'
        | 'openEndMinute',
    ) => {
      setDraft(prev => {
        if (!prev) return prev;
        const current = prev[key];
        if (!current) return prev;

        const parsed = Number(current);
        if (!Number.isFinite(parsed)) return prev;

        const isHour = key === 'openStartHour' || key === 'openEndHour';
        const max = isHour ? 23 : 59;
        const unit = isHour ? tr('小时', 'Hour') : tr('分钟', 'Minute');
        const clamped = Math.max(0, Math.min(max, Math.trunc(parsed)));
        const normalized = String(clamped).padStart(2, '0');

        if (parsed > max) {
          showTimeFixHint(
            tr(
              `${unit}超出有效范围，已调整为 ${normalized}。`,
              `${unit} was outside the valid range and was changed to ${normalized}.`,
            ),
          );
        }

        if (normalized === current) return prev;
        return { ...prev, [key]: normalized };
      });
    },
    [showTimeFixHint, tr],
  );

  const saveDraft = useCallback(async () => {
    if (!draft || savingDraftRef.current) return;
    if (!isLoggedIn) {
      showNotice(tr('请先登录再添加点位。', 'Log in before adding a place.'));
      resetDraftState();
      return;
    }

    const title = draft.title.trim();
    const hasStartHour = Boolean(draft.openStartHour);
    const hasStartMinute = Boolean(draft.openStartMinute);
    const hasEndHour = Boolean(draft.openEndHour);
    const hasEndMinute = Boolean(draft.openEndMinute);

    if (hasStartHour !== hasStartMinute) {
      showNotice(
        tr(
          '开始时间的小时和分钟需同时填写。',
          'Choose both an hour and minute for the start time.',
        ),
      );
      return;
    }

    if (hasEndHour !== hasEndMinute) {
      showNotice(
        tr(
          '结束时间的小时和分钟需同时填写。',
          'Choose both an hour and minute for the end time.',
        ),
      );
      return;
    }

    const start = composeHHMM(draft.openStartHour, draft.openStartMinute);
    const end = composeHHMM(draft.openEndHour, draft.openEndMinute);

    if (!title) {
      showNotice(
        tr(
          '请填写标题（例如：A 地铁口无障碍卫生间）。',
          'Add a title (for example, Accessible Restroom at Metro Exit A).',
        ),
      );
      return;
    }

    if (Boolean(start) !== Boolean(end)) {
      showNotice(
        tr(
          '开始与结束时间需同时填写，或全部留空。',
          'Enter both start and end times, or leave both blank.',
        ),
      );
      return;
    }

    if (start && !isValidHHMM(start)) {
      showNotice(
        tr(
          '开始时间格式无效，请使用 HH:MM。',
          'The start time is invalid. Use HH:MM.',
        ),
      );
      return;
    }
    if (end && !isValidHHMM(end)) {
      showNotice(
        tr(
          '结束时间格式无效，请使用 HH:MM。',
          'The end time is invalid. Use HH:MM.',
        ),
      );
      return;
    }

    savingDraftRef.current = true;
    setSavingDraft(true);
    try {
      let payload = editingId
        ? await requestJson<unknown>(`/api/markers/${editingId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              category: draft.category,
              title,
              description: draft.description.trim(),
              isPublic: draft.isPublic,
              openTimeStart: start || '',
              openTimeEnd: end || '',
            }),
          })
        : await requestJson<unknown>('/api/markers', {
            method: 'POST',
            body: JSON.stringify({
              clientRequestId: draft.clientRequestId,
              lat: draft.lat,
              lng: draft.lng,
              category: draft.category,
              title,
              description: draft.description.trim(),
              isPublic: draft.isPublic,
              openTimeStart: start || '',
              openTimeEnd: end || '',
              markImage: null,
            }),
          });

      let created = normalizeSingleMarker(payload);
      if (!created) {
        throw new Error(
          tr(
            '点位已保存，但返回数据格式异常。',
            'The place was saved, but the response format was invalid.',
          ),
        );
      }

      let imageUploadError = '';
      if (draftImageFile) {
        try {
          const form = new FormData();
          appendUploadImageToFormData(form, 'file', draftImageFile);
          payload = await requestJson<unknown>(
            `/api/markers/${created.id}/image`,
            {
              method: 'POST',
              body: form,
              timeoutMs: 30000,
            },
          );
          const withImage = normalizeSingleMarker(payload);
          if (withImage) created = withImage;
        } catch (e) {
          imageUploadError =
            e instanceof Error && e.message
              ? e.message
              : tr('图片上传失败。', 'Image upload failed.');
        }
      }

      setMarkers(prev => [
        created,
        ...prev.filter(marker => marker.id !== created.id),
      ]);
      setSelectedMarkerId(created.id);
      resetDraftState();
      if (imageUploadError) {
        showNotice(
          tr(
            `点位已保存，但图片上传失败（${imageUploadError}）。你可以稍后编辑点位并重新上传。`,
            `The place was saved, but the image upload failed (${imageUploadError}). You can edit the place and upload it later.`,
          ),
        );
      } else {
        showNotice(
          editingId
            ? tr('修改已保存。', 'Changes saved.')
            : tr(
                '已提交审核，通过后将在地图显示。',
                'Submitted for review. The place will appear after approval.',
              ),
        );
      }
      injectJs(`window.__rnSetView(${created.lat}, ${created.lng}, 15);`);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : tr('保存点位失败。', 'Could not save the place.');
      showNotice(message);
    } finally {
      savingDraftRef.current = false;
      setSavingDraft(false);
    }
  }, [
    draft,
    draftImageFile,
    editingId,
    injectJs,
    isLoggedIn,
    resetDraftState,
    showNotice,
    tr,
  ]);

  const confirmDeleteDraft = useCallback(async () => {
    if (!editingId || deletingMarker) return;
    setDeletingMarker(true);
    try {
      await requestJson<unknown>(`/api/markers/${editingId}`, {
        method: 'DELETE',
      });
      resetDraftState();
      setSelectedMarkerId(null);
      await reloadMarkersInCurrentViewport();
      await loadFavorites();
      showNotice(tr('点位已删除。', 'Place deleted.'));
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : tr('删除点位失败。', 'Could not delete the place.');
      showNotice(message);
    } finally {
      setDeletingMarker(false);
    }
  }, [
    deletingMarker,
    editingId,
    loadFavorites,
    reloadMarkersInCurrentViewport,
    resetDraftState,
    showNotice,
    tr,
  ]);

  const toggleCategory = useCallback((key: MarkerCategory) => {
    setVisibleCats(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setAllCategoriesVisible = useCallback((visible: boolean) => {
    setVisibleCats({
      accessible_toilet: visible,
      friendly_clinic: visible,
      baby_room: visible,
      self_definition: visible,
    });
  }, []);

  const clearNearbyFilter = useCallback(() => {
    setNearbyOnly(false);
    setNearbyPanelOpen(false);
  }, []);

  const searchNearby = useCallback(async () => {
    if (!userLocation) {
      showNotice(
        tr(
          '请先允许定位权限再查询附近点位。',
          'Allow location access before searching nearby.',
        ),
      );
      return;
    }
    setNearbyLoading(true);
    const params = new URLSearchParams({
      lat: String(userLocation.latitude),
      lng: String(userLocation.longitude),
      radius: String(nearbyRadius),
      category: nearbyCategory,
    });

    try {
      const payload = await requestJson<unknown>(
        `/api/markers/nearby?${params.toString()}`,
      );
      const list = normalizeMarkers(payload);
      const results = list
        .map(marker => ({
          ...marker,
          distanceMeters: haversineMeters(
            userLocation.latitude,
            userLocation.longitude,
            marker.lat,
            marker.lng,
          ),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      setMarkers(prev => {
        const merged = new Map<number, MapMarker>();
        prev.forEach(marker => merged.set(marker.id, marker));
        results.forEach(marker => merged.set(marker.id, marker));
        return Array.from(merged.values());
      });

      setNearbyResults(results);
      setNearbyIds(new Set(results.map(marker => marker.id)));
      setNearbyOnly(true);
      setNearbyPanelOpen(results.length > 0);

      if (results.length === 0) {
        showNotice(
          tr(
            `${nearbyRadius} 米内没有找到${localizedNearbyCategoryLabel[nearbyCategory]}。`,
            `No ${localizedNearbyCategoryLabel[
              nearbyCategory
            ].toLowerCase()} locations were found within ${nearbyRadius} m.`,
          ),
        );
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : tr('附近查询失败。', 'Nearby search failed.');
      showNotice(message);
    } finally {
      setNearbyLoading(false);
    }
  }, [
    localizedNearbyCategoryLabel,
    nearbyCategory,
    nearbyRadius,
    showNotice,
    tr,
    userLocation,
  ]);

  const applyNearbyRadiusInput = useCallback(() => {
    const parsed = Number(nearbyRadiusInput.trim());
    if (!Number.isFinite(parsed)) {
      setNearbyRadiusError(
        tr('请输入 0 到 10,000 的数字。', 'Enter a number from 0 to 10,000.'),
      );
      return;
    }
    const safe = Math.max(0, Math.min(10000, Math.round(parsed)));
    if (safe !== parsed) {
      setNearbyRadiusError(
        tr(
          '范围应为 0–10,000 米，已自动调整。',
          'Range must be 0–10,000 m and has been adjusted.',
        ),
      );
    } else {
      setNearbyRadiusError('');
    }
    setNearbyRadius(safe);
    setNearbyRadiusInput(String(safe));
  }, [nearbyRadiusInput, tr]);

  const toggleFavorite = useCallback(
    async (markerId: number) => {
      if (!isLoggedIn) {
        showNotice(
          tr('请先登录再收藏点位。', 'Log in before adding favorites.'),
        );
        return;
      }
      const isFav = favoriteIds.has(markerId);
      try {
        await requestJson<unknown>(`/api/markers/${markerId}/favorite`, {
          method: isFav ? 'DELETE' : 'POST',
        });
        await loadFavorites();
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : tr('更新收藏失败。', 'Could not update favorites.');
        showNotice(message);
      }
    },
    [favoriteIds, isLoggedIn, loadFavorites, showNotice, tr],
  );

  return (
    <View style={styles.page}>
      <WebView
        ref={webViewRef}
        key={`leaflet-${activeTileProvider}`}
        originWhitelist={['*']}
        source={{ html: leafletHtml, baseUrl: WEB_BASE_URL }}
        onMessage={handleWebMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webLoadingOverlay}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>
              {tr('地图加载中...', 'Loading map...')}
            </Text>
          </View>
        )}
      />

      <Pressable
        style={[
          styles.addFab,
          addMode && styles.addFabActive,
          { top: topOffset },
        ]}
        onPress={handleAddButtonPress}
        accessibilityRole="button"
        accessibilityState={{ selected: addMode }}
        accessibilityLabel={
          addMode
            ? tr('退出新增点位模式', 'Exit add-place mode')
            : tr('添加新点位', 'Add a new place')
        }
      >
        <Icon
          source={
            addMode ? 'map-marker-check-outline' : 'map-marker-plus-outline'
          }
          size={21}
          color={addMode ? '#3b2a14' : colors.primary}
        />
      </Pressable>

      {showAddModeHint ? (
        <Pressable
          style={[styles.addModeHintBubble, { top: topOffset + 56 }]}
          onPress={() => setShowAddModeHint(false)}
          accessibilityRole="button"
          accessibilityLabel={tr('关闭新增点位提示', 'Dismiss add-place tip')}
        >
          <View style={styles.addModeHintArrow} />
          <Text style={styles.addModeHintText}>
            {tr(
              '点击左上角按钮添加点位',
              'Tap the button in the upper-left corner to add a place',
            )}
          </Text>
          <Icon source="close" size={14} color="#8b7a9b" />
        </Pressable>
      ) : null}

      <View
        style={[
          styles.legendWrap,
          legendOpen ? styles.legendWrapOpen : styles.legendWrapClosed,
          { top: topOffset },
        ]}
      >
        <Pressable
          style={[styles.legendToggle, legendOpen && styles.legendToggleOpen]}
          onPress={() => setLegendOpen(v => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: legendOpen }}
          accessibilityLabel={
            legendOpen
              ? tr('收起点位筛选', 'Collapse place filters')
              : tr('展开点位筛选', 'Expand place filters')
          }
        >
          <Text style={styles.legendToggleText}>
            {tr('筛选点位', 'Filter Places')} {legendOpen ? '▲' : '▼'}
          </Text>
        </Pressable>

        {legendOpen ? (
          <View style={styles.legendBody}>
            <View style={styles.legendTopRow}>
              <Text style={styles.legendTitle}>{tr('图例', 'Legend')}</Text>
              <View style={styles.legendQuickRow}>
                <Pressable
                  style={styles.legendQuickBtn}
                  onPress={() => setAllCategoriesVisible(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.legendQuickBtnText}>
                    {tr('全选', 'Select All')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.legendQuickBtn}
                  onPress={() => setAllCategoriesVisible(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.legendQuickBtnText}>
                    {tr('清空', 'Clear All')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.ownerFilterRow}>
              {(['all', 'mine', 'fav'] as OwnerFilter[]).map(key => {
                const active = ownerFilter === key;
                const disabled = !isLoggedIn && key !== 'all';
                const text =
                  key === 'all'
                    ? tr('全部', 'All')
                    : key === 'mine'
                    ? tr('我创建的', 'Created by Me')
                    : tr('我的收藏', 'Favorites');
                return (
                  <Pressable
                    key={`owner-${key}`}
                    style={[
                      styles.ownerFilterChip,
                      active && styles.ownerFilterChipActive,
                      disabled && styles.ownerFilterChipDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => setOwnerFilter(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled }}
                  >
                    <Text
                      style={[
                        styles.ownerFilterText,
                        active && styles.ownerFilterTextActive,
                      ]}
                    >
                      {text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {supportedCategories.map(key => (
              <Pressable
                key={`category-${key}`}
                style={styles.categoryRow}
                onPress={() => toggleCategory(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: visibleCats[key] }}
                accessibilityLabel={localizedCategoryLabel[key]}
              >
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: categoryColor[key] },
                    ]}
                  />
                  <Text style={styles.categoryText}>
                    {localizedCategoryLabel[key]}
                  </Text>
                </View>
                <Icon
                  source={
                    visibleCats[key]
                      ? 'check-circle-outline'
                      : 'checkbox-blank-circle-outline'
                  }
                  size={20}
                  color={
                    visibleCats[key]
                      ? categoryColor[key]
                      : 'rgba(116, 73, 136, 0.45)'
                  }
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <ScreensSafeAreaView
        edges={{ bottom: Platform.OS === 'ios' }}
        pointerEvents="box-none"
        style={styles.mapBottomOverlay}
      >
        <View style={[styles.bottomLeftStack, { bottom: bottomOffset }]}>
          {nearbyOnly ? (
            <Pressable style={styles.exitNearbyBtn} onPress={clearNearbyFilter}>
              <Text style={styles.exitNearbyText}>
                {tr('清除附近筛选', 'Clear Nearby Filter')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.circleFab}
            onPress={recenterToUserLocation}
            accessibilityRole="button"
            accessibilityLabel={tr('返回我的位置', 'Return to my location')}
          >
            <Icon source="crosshairs-gps" size={21} color={colors.primary} />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.nearbyFab,
            {
              bottom: bottomOffset,
              backgroundColor: categoryColor[nearbyCategory],
              shadowColor: categoryColor[nearbyCategory],
            },
          ]}
          disabled={nearbyLoading}
          onPress={searchNearby}
          accessibilityRole="button"
          accessibilityState={{ disabled: nearbyLoading, busy: nearbyLoading }}
          accessibilityLabel={tr(
            `查找附近${localizedNearbyCategoryLabel[nearbyCategory]}`,
            `Find nearby ${localizedNearbyCategoryLabel[nearbyCategory]}`,
          )}
        >
          <Icon
            source={nearbyCategoryIcon[nearbyCategory]}
            size={18}
            color={colors.onPrimary}
          />
          <Text
            style={styles.nearbyFabText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {nearbyLoading
              ? tr('搜索中...', 'Searching...')
              : tr(
                  `附近${localizedNearbyCategoryLabel[nearbyCategory]}`,
                  `Nearby ${localizedNearbyCategoryLabel[nearbyCategory]}`,
                )}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.circleFab,
            styles.settingsFab,
            { bottom: bottomOffset },
          ]}
          onPress={() => setSettingsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={tr('打开地图设置', 'Open map settings')}
        >
          <Icon source="tune-variant" size={21} color={colors.primary} />
        </Pressable>

        {selectedMarker ? (
          <View style={[styles.markerCard, { bottom: bottomOffset + 66 }]}>
            <View style={styles.markerCardHeader}>
              <Text style={styles.markerTitle} numberOfLines={2}>
                {selectedMarker.title}
              </Text>
              <View
                style={[
                  styles.markerCategoryTag,
                  { backgroundColor: `${getMarkerPinColor(selectedMarker)}20` },
                ]}
              >
                <Text style={styles.markerCategoryTagText}>
                  {localizedCategoryLabel[selectedMarker.category]}
                </Text>
              </View>
            </View>
            <Text style={styles.markerMeta}>
              {tr('开放时间：', 'Hours: ')}
              {formatOpenTime(selectedMarker)}
            </Text>
            {!selectedMarker.isActive ? (
              <Text style={styles.markerInactive}>
                {tr('当前不可用', 'Currently unavailable')}
              </Text>
            ) : null}
            {selectedMarker.markImage &&
            selectedMarkerImageUri &&
            !missingImageMarkerIds.has(selectedMarker.id) ? (
              <Image
                source={{ uri: selectedMarkerImageUri }}
                style={styles.markerImage}
                resizeMode="cover"
                onError={() => {
                  if (__DEV__) {
                    console.log('[MarkerImage] load failed', {
                      markerId: selectedMarker.id,
                      markImage: selectedMarker.markImage,
                      imageUri: selectedMarkerImageUri,
                    });
                  }
                  setMissingImageMarkerIds(prev => {
                    const next = new Set(prev);
                    next.add(selectedMarker.id);
                    return next;
                  });
                }}
              />
            ) : null}
            {selectedMarker.description ? (
              <Text style={styles.markerDescription} numberOfLines={3}>
                {selectedMarker.description}
              </Text>
            ) : null}
            <Text style={styles.markerMeta}>
              {tr('坐标：', 'Coordinates: ')}
              {selectedMarker.lat.toFixed(6)}, {selectedMarker.lng.toFixed(6)}
            </Text>

            <View style={styles.markerActions}>
              {isLoggedIn ? (
                <Pressable
                  style={styles.markerActionBtn}
                  onPress={() => openEditDraft(selectedMarker)}
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    `编辑 ${selectedMarker.title}`,
                    `Edit ${selectedMarker.title}`,
                  )}
                >
                  <Icon
                    source="pencil-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.markerActionText}>
                    {tr('编辑', 'Edit')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.markerActionBtn}
                onPress={() => toggleFavorite(selectedMarker.id)}
                accessibilityRole="button"
                accessibilityState={{
                  selected: favoriteIds.has(selectedMarker.id),
                }}
                accessibilityLabel={
                  favoriteIds.has(selectedMarker.id)
                    ? tr(
                        `取消收藏 ${selectedMarker.title}`,
                        `Remove ${selectedMarker.title} from favorites`,
                      )
                    : tr(
                        `收藏 ${selectedMarker.title}`,
                        `Add ${selectedMarker.title} to favorites`,
                      )
                }
              >
                <Icon
                  source={
                    favoriteIds.has(selectedMarker.id) ? 'star' : 'star-outline'
                  }
                  size={18}
                  color={
                    favoriteIds.has(selectedMarker.id) ? '#f6c344' : '#8b7a9c'
                  }
                />
                <Text style={styles.markerActionText}>
                  {favoriteIds.has(selectedMarker.id)
                    ? tr('已收藏', 'Favorited')
                    : tr('收藏', 'Favorite')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.markerActionBtn}
                onPress={() => openWebMap(selectedMarker)}
                accessibilityRole="link"
                accessibilityLabel={tr(
                  `在网页查看 ${selectedMarker.title}`,
                  `View ${selectedMarker.title} on the web`,
                )}
              >
                <Icon source="open-in-new" size={18} color={colors.primary} />
                <Text style={styles.markerActionText}>
                  {tr('网页查看', 'View on Web')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScreensSafeAreaView>

      {loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>
            {tr('点位加载中...', 'Loading places...')}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.noticeCard, { top: topOffset + 52 }]}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {notice ? (
        <View
          style={[styles.noticeCard, { top: topOffset + (error ? 94 : 52) }]}
        >
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {draft ? (
        <View style={styles.draftOverlay}>
          <View style={styles.modalBackdrop} />
          <View style={styles.draftDialogCard}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {editingId
                    ? tr('编辑点位', 'Edit Place')
                    : tr('添加点位', 'Add Place')}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
                </Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={closeDraft}
                disabled={savingDraft || deletingMarker || draftImageBusy}
                accessibilityRole="button"
                accessibilityLabel={tr('关闭点位编辑器', 'Close place editor')}
              >
                <Icon source="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.draftDialogScroll}
              contentContainerStyle={styles.draftScrollContent}
            >
              <Text style={styles.sheetSectionTitle}>
                {tr('分类', 'Category')}
              </Text>
              <Pressable
                style={[
                  styles.selectTrigger,
                  categorySelectOpen && styles.selectTriggerOpen,
                ]}
                onPress={() => {
                  setCategorySelectOpen(v => !v);
                }}
                disabled={savingDraft || deletingMarker || draftImageBusy}
                accessibilityRole="button"
                accessibilityState={{
                  expanded: categorySelectOpen,
                  disabled: savingDraft || deletingMarker || draftImageBusy,
                }}
                accessibilityLabel={tr('选择点位分类', 'Choose place category')}
              >
                <View style={styles.selectTriggerLeft}>
                  <View
                    style={[
                      styles.selectCategoryDot,
                      { backgroundColor: categoryColor[draft.category] },
                    ]}
                  />
                  <Text style={styles.selectTriggerText}>
                    {localizedCategoryLabel[draft.category]}
                  </Text>
                </View>
                <Icon
                  source={categorySelectOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.primary}
                />
              </Pressable>

              {categorySelectOpen ? (
                <View style={styles.selectMenu}>
                  {supportedCategories.map(key => {
                    const active = draft.category === key;
                    return (
                      <Pressable
                        key={`draft-cat-${key}`}
                        style={[
                          styles.selectOptionRow,
                          active && styles.selectOptionRowActive,
                        ]}
                        onPress={() => {
                          setDraft(prev =>
                            prev ? { ...prev, category: key } : prev,
                          );
                          setCategorySelectOpen(false);
                        }}
                        disabled={
                          savingDraft || deletingMarker || draftImageBusy
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={styles.selectTriggerLeft}>
                          <View
                            style={[
                              styles.selectCategoryDot,
                              { backgroundColor: categoryColor[key] },
                            ]}
                          />
                          <Text
                            style={[
                              styles.selectOptionText,
                              active && styles.selectOptionTextActive,
                            ]}
                          >
                            {localizedCategoryLabel[key]}
                          </Text>
                        </View>
                        {active ? (
                          <Icon
                            source="check"
                            size={16}
                            color={colors.primary}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.sheetSectionTitle}>
                {tr('标题', 'Title')}
              </Text>
              <TextInput
                style={styles.formInput}
                value={draft.title}
                onChangeText={value =>
                  setDraft(prev => (prev ? { ...prev, title: value } : prev))
                }
                placeholder={tr(
                  '例如：A 地铁口无障碍卫生间',
                  'For example, Accessible Restroom at Metro Exit A',
                )}
                placeholderTextColor="#9b8cab"
                maxLength={80}
                accessibilityLabel={tr('点位标题', 'Place title')}
                editable={!savingDraft && !deletingMarker && !draftImageBusy}
              />

              <Text style={styles.sheetSectionTitle}>
                {tr('描述', 'Description')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.formMultiline]}
                value={draft.description}
                onChangeText={value =>
                  setDraft(prev =>
                    prev ? { ...prev, description: value } : prev,
                  )
                }
                placeholder={tr(
                  '例如：入口位置、夜间关闭时间',
                  'For example, entrance location and evening closing time',
                )}
                placeholderTextColor="#9b8cab"
                multiline
                textAlignVertical="top"
                maxLength={800}
                accessibilityLabel={tr('点位描述', 'Place description')}
                editable={!savingDraft && !deletingMarker && !draftImageBusy}
              />

              <Text style={styles.sheetSectionTitle}>
                {tr('图片（可选）', 'Image (Optional)')}
              </Text>
              <View style={styles.uploadRow}>
                <Pressable
                  style={styles.uploadPickBtn}
                  onPress={pickDraftImage}
                  disabled={savingDraft || draftImageBusy}
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    '选择点位图片',
                    'Choose a place image',
                  )}
                >
                  <Text style={styles.uploadPickBtnText}>
                    {draftImageBusy
                      ? tr('处理中...', 'Processing...')
                      : tr('选择图片', 'Choose Image')}
                  </Text>
                </Pressable>
                {draftImageFile ? (
                  <Pressable
                    style={styles.uploadClearBtn}
                    onPress={() => {
                      setDraftImageFile(null);
                      setDraftImageHint('');
                      setDraftImageError('');
                    }}
                    disabled={savingDraft || draftImageBusy}
                    accessibilityRole="button"
                    accessibilityLabel={tr(
                      '清除已选图片',
                      'Clear selected image',
                    )}
                  >
                    <Text style={styles.uploadClearBtnText}>
                      {tr('清除', 'Clear')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {draftImageHint ? (
                <Text style={styles.uploadHintText}>{draftImageHint}</Text>
              ) : null}
              {draftImageError ? (
                <Text style={styles.uploadErrorText}>{draftImageError}</Text>
              ) : null}
              {draftImageFile ? (
                <Text style={styles.uploadPickedText}>
                  {tr('已选择：', 'Selected: ')}
                  {draftImageFile.name}
                </Text>
              ) : null}

              <View style={styles.draftSwitchRow}>
                <Text style={styles.draftSwitchLabel}>
                  {tr('公开分享', 'Share Publicly')}
                </Text>
                <Switch
                  value={draft.isPublic}
                  onValueChange={value =>
                    setDraft(prev =>
                      prev ? { ...prev, isPublic: value } : prev,
                    )
                  }
                  trackColor={{ false: '#d7ced5', true: '#d0bcff' }}
                  thumbColor={draft.isPublic ? '#5a3850' : '#fff'}
                  accessibilityLabel={tr(
                    '公开分享点位',
                    'Share place publicly',
                  )}
                  disabled={savingDraft || deletingMarker || draftImageBusy}
                />
              </View>

              <Text style={styles.sheetSectionTitle}>
                {tr('开放时间', 'Hours')}
              </Text>
              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>{tr('开始', 'Start')}</Text>
                <View style={styles.timeSelectRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openStartHour}
                    onChangeText={value =>
                      setDraftTimePart('openStartHour', value)
                    }
                    onBlur={() => normalizeDraftTimePartOnBlur('openStartHour')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#9b8cab"
                    editable={
                      !savingDraft && !deletingMarker && !draftImageBusy
                    }
                  />
                  <Text style={styles.timeSelectSeparator}>:</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openStartMinute}
                    onChangeText={value =>
                      setDraftTimePart('openStartMinute', value)
                    }
                    onBlur={() =>
                      normalizeDraftTimePartOnBlur('openStartMinute')
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#9b8cab"
                    editable={
                      !savingDraft && !deletingMarker && !draftImageBusy
                    }
                  />
                </View>
              </View>

              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>{tr('结束', 'End')}</Text>
                <View style={styles.timeSelectRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openEndHour}
                    onChangeText={value =>
                      setDraftTimePart('openEndHour', value)
                    }
                    onBlur={() => normalizeDraftTimePartOnBlur('openEndHour')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#9b8cab"
                    editable={
                      !savingDraft && !deletingMarker && !draftImageBusy
                    }
                  />
                  <Text style={styles.timeSelectSeparator}>:</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openEndMinute}
                    onChangeText={value =>
                      setDraftTimePart('openEndMinute', value)
                    }
                    onBlur={() => normalizeDraftTimePartOnBlur('openEndMinute')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#9b8cab"
                    editable={
                      !savingDraft && !deletingMarker && !draftImageBusy
                    }
                  />
                </View>
              </View>
              <Text style={styles.formHint}>
                {tr(
                  '开始和结束时间都留空时表示全天可用。时间采用 HH:MM，超出有效范围的数值会自动调整。',
                  'Leave both blank for all-day availability. Times use HH:MM and values outside the valid range are adjusted automatically.',
                )}
              </Text>
              {timeFixHint ? (
                <Text style={styles.timeFixHintText}>{timeFixHint}</Text>
              ) : null}

              <View style={styles.draftActions}>
                <Pressable
                  style={styles.draftCancelBtn}
                  onPress={closeDraft}
                  disabled={savingDraft || deletingMarker || draftImageBusy}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftCancelBtnText}>
                    {tr('取消', 'Cancel')}
                  </Text>
                </Pressable>
                {editingId && canDeleteDraft ? (
                  <Pressable
                    style={styles.draftDeleteBtn}
                    onPress={() => setDeleteConfirmOpen(true)}
                    disabled={savingDraft || deletingMarker || draftImageBusy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.draftDeleteBtnText}>
                      {tr('删除', 'Delete')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    styles.draftSaveBtn,
                    savingDraft && styles.draftSaveBtnDisabled,
                  ]}
                  onPress={saveDraft}
                  disabled={savingDraft || deletingMarker || draftImageBusy}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: savingDraft || deletingMarker || draftImageBusy,
                    busy: savingDraft,
                  }}
                >
                  {savingDraft ? (
                    <>
                      <ActivityIndicator size="small" color="#5a3850" />
                      <Text style={styles.draftSaveBtnText}>
                        {tr('保存中…', 'Saving…')}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.draftSaveBtnText}>
                      {editingId
                        ? tr('保存修改', 'Save Changes')
                        : tr('保存', 'Save')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      <Modal
        visible={deleteConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingMarker) setDeleteConfirmOpen(false);
        }}
      >
        <View style={styles.modalCenterWrap}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!deletingMarker) setDeleteConfirmOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('取消删除点位', 'Cancel place deletion')}
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {tr('删除这个点位？', 'Delete this place?')}
            </Text>
            <Text style={styles.confirmDesc}>
              {tr('此操作无法撤销。', 'This action cannot be undone.')}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setDeleteConfirmOpen(false)}
                disabled={deletingMarker}
                accessibilityRole="button"
              >
                <Text style={styles.confirmCancelBtnText}>
                  {tr('取消', 'Cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmDeleteBtn,
                  deletingMarker && styles.confirmDeleteBtnDisabled,
                ]}
                onPress={confirmDeleteDraft}
                disabled={deletingMarker}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: deletingMarker,
                  busy: deletingMarker,
                }}
              >
                {deletingMarker ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>
                    {tr('删除点位', 'Delete Place')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSettingsOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={tr('关闭地图设置', 'Close map settings')}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {tr('地图设置', 'Map Settings')}
              </Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setSettingsOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={tr('关闭地图设置', 'Close map settings')}
              >
                <Icon source="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.settingsScroll}
              contentContainerStyle={[
                styles.settingsContent,
                { paddingBottom: Math.max(22, insets.bottom + 12) },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetSectionTitle}>
                {tr('地图源', 'Map Source')}
              </Text>
              <View style={styles.sheetChipRow}>
                {(['osm', 'tf_atlas', 'tianditu_vec'] as TileProvider[]).map(
                  key => {
                    const active = tileProvider === key;
                    const disabled =
                      (key === 'tf_atlas' && !hasThunderforestKey) ||
                      (key === 'tianditu_vec' && !hasTiandituKey);
                    return (
                      <Pressable
                        key={`tile-provider-${key}`}
                        style={[
                          styles.sheetChip,
                          active && styles.sheetChipActive,
                          disabled && styles.sheetChipDisabled,
                        ]}
                        disabled={disabled}
                        onPress={() => setTileProvider(key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled }}
                      >
                        <Text
                          style={[
                            styles.sheetChipText,
                            active && styles.sheetChipTextActive,
                          ]}
                        >
                          {key === 'tianditu_vec'
                            ? tr('天地图·矢量', 'Tianditu · Vector')
                            : tileProviderConfig[key].label}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
              {!hasThunderforestKey || !hasTiandituKey ? (
                <Text style={styles.sheetHintText}>
                  {tr(
                    `未配置密钥的地图源已自动禁用：${
                      !hasThunderforestKey && !hasTiandituKey
                        ? 'TF Atlas、天地图'
                        : !hasThunderforestKey
                        ? 'TF Atlas'
                        : '天地图'
                    }`,
                    `Sources without API keys are disabled automatically: ${
                      !hasThunderforestKey && !hasTiandituKey
                        ? 'TF Atlas and Tianditu'
                        : !hasThunderforestKey
                        ? 'TF Atlas'
                        : 'Tianditu'
                    }`,
                  )}
                </Text>
              ) : null}
              <Text style={styles.sheetHintText}>
                {tr(
                  'App 不使用 Google Maps SDK。',
                  'The app does not use the Google Maps SDK.',
                )}
              </Text>

              <Text style={styles.sheetSectionTitle}>
                {tr('附近点位类型', 'Nearby Category')}
              </Text>
              <View style={styles.sheetChipRow}>
                {nearbyCategories.map(key => {
                  const active = nearbyCategory === key;
                  return (
                    <Pressable
                      key={`nearby-type-${key}`}
                      style={[
                        styles.sheetChip,
                        active && styles.sheetChipActive,
                      ]}
                      onPress={() => setNearbyCategory(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.sheetChipText,
                          active && styles.sheetChipTextActive,
                        ]}
                      >
                        {localizedNearbyCategoryLabel[key]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sheetSectionTitle}>
                {tr('附近查询半径', 'Nearby Search Radius')}
              </Text>
              <View style={styles.sheetChipRow}>
                {[500, 1000, 2500].map(radius => {
                  const active = nearbyRadius === radius;
                  return (
                    <Pressable
                      key={`radius-${radius}`}
                      style={[
                        styles.sheetChip,
                        active && styles.sheetChipActive,
                      ]}
                      onPress={() => {
                        setNearbyRadius(radius);
                        setNearbyRadiusInput(String(radius));
                        setNearbyRadiusError('');
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.sheetChipText,
                          active && styles.sheetChipTextActive,
                        ]}
                      >
                        {radius}m
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.radiusInputRow}>
                <TextInput
                  style={styles.radiusInput}
                  value={nearbyRadiusInput}
                  keyboardType="number-pad"
                  onChangeText={value => {
                    setNearbyRadiusInput(value);
                    if (nearbyRadiusError) setNearbyRadiusError('');
                  }}
                  onBlur={applyNearbyRadiusInput}
                  placeholder="0 - 10000"
                  placeholderTextColor="#9b8cab"
                  accessibilityLabel={tr(
                    '附近查询半径（米）',
                    'Nearby search radius in meters',
                  )}
                />
                <Pressable
                  style={styles.radiusApplyBtn}
                  onPress={applyNearbyRadiusInput}
                  accessibilityRole="button"
                >
                  <Text style={styles.radiusApplyBtnText}>
                    {tr('应用', 'Apply')}
                  </Text>
                </Pressable>
              </View>
              {nearbyRadiusError ? (
                <Text style={styles.radiusErrorText}>{nearbyRadiusError}</Text>
              ) : (
                <Text style={styles.radiusHintText}>
                  {tr(
                    '请输入 0 到 10,000 米的半径，超出范围会自动调整。',
                    'Enter a radius from 0 to 10,000 m. Values outside that range are adjusted automatically.',
                  )}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={nearbyPanelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNearbyPanelOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setNearbyPanelOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={tr('关闭附近结果', 'Close nearby results')}
          />
          <View style={[styles.sheet, styles.nearbySheet]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {tr(
                    `附近${localizedNearbyCategoryLabel[nearbyCategory]} · ${nearbyRadius} 米`,
                    `Nearby ${localizedNearbyCategoryLabel[nearbyCategory]} · ${nearbyRadius} m`,
                  )}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {tr(
                    `${nearbyResults.length} 个结果 · 点击后在地图上显示`,
                    `${nearbyResults.length} ${
                      nearbyResults.length === 1 ? 'result' : 'results'
                    } · Tap one to show it on the map`,
                  )}
                </Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={() => setNearbyPanelOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={tr('关闭附近结果', 'Close nearby results')}
              >
                <Icon source="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.nearbyList}
              contentContainerStyle={styles.nearbyListContent}
            >
              {nearbyResults.length === 0 ? (
                <View style={styles.nearbyEmptyWrap}>
                  <Text style={styles.nearbyEmptyText}>
                    {tr(
                      '暂无结果，请尝试扩大半径或选择其他类型。',
                      'No results. Try a larger radius or another category.',
                    )}
                  </Text>
                </View>
              ) : null}
              {nearbyResults.map(marker => (
                <Pressable
                  key={`nearby-${marker.id}`}
                  style={styles.nearbyCard}
                  onPress={() => {
                    focusMarker(marker);
                    setNearbyPanelOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tr(
                    `在地图上显示 ${marker.title}`,
                    `Show ${marker.title} on the map`,
                  )}
                >
                  <View style={styles.nearbyCardHeader}>
                    <Text style={styles.nearbyCardTitle} numberOfLines={1}>
                      {marker.title}
                    </Text>
                    <View style={styles.nearbyDistanceBadge}>
                      <Text style={styles.nearbyDistanceText}>
                        {Math.round(marker.distanceMeters)} m
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.nearbyCardMeta}>
                    {localizedCategoryLabel[marker.category]} ·{' '}
                    {formatOpenTime(marker)}
                  </Text>
                  {marker.description ? (
                    <Text style={styles.nearbyCardDesc} numberOfLines={2}>
                      {marker.description}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  mapBottomOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  webLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,235,255,0.96)',
    gap: 8,
  },
  addFab: {
    position: 'absolute',
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d0bcff',
    borderWidth: 1,
    borderColor: 'rgba(90, 56, 80, 0.14)',
    shadowColor: '#5a3850',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  addFabActive: {
    backgroundColor: '#f2a93b',
    shadowColor: '#d9912a',
    shadowOpacity: 0.35,
  },
  legendWrap: {
    position: 'absolute',
    right: 14,
    borderWidth: 1,
    borderColor: 'rgba(90, 56, 80, 0.13)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#5a3850',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
    overflow: 'hidden',
  },
  legendWrapClosed: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  legendWrapOpen: {
    width: 240,
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  legendToggle: {
    alignSelf: 'flex-start',
    minHeight: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  legendToggleOpen: {
    alignSelf: 'flex-end',
  },
  legendToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  legendBody: {
    marginTop: 6,
    gap: 9,
  },
  legendTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legendQuickRow: {
    flexDirection: 'row',
    gap: 4,
  },
  legendQuickBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  legendQuickBtnText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    borderRadius: 999,
  },
  ownerFilterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'nowrap',
  },
  ownerFilterChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(90, 56, 80, 0.24)',
    paddingHorizontal: 6,
    minHeight: 36,
    paddingVertical: 7,
    borderRadius: 18,
  },
  ownerFilterChipActive: {
    backgroundColor: '#d0bcff',
    borderColor: 'rgba(90, 56, 80, 0.18)',
  },
  ownerFilterChipDisabled: {
    opacity: 0.4,
  },
  ownerFilterText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  ownerFilterTextActive: {
    color: '#5a3850',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    minHeight: 44,
    borderColor: 'rgba(90, 56, 80, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(252, 221, 236, 0.2)',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  categoryDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bottomLeftStack: {
    position: 'absolute',
    left: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  exitNearbyBtn: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.28)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  exitNearbyText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  circleFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#d0bcff',
    borderWidth: 1,
    borderColor: 'rgba(90, 56, 80, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5a3850',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  settingsFab: {
    position: 'absolute',
    right: 16,
  },
  nearbyFab: {
    position: 'absolute',
    left: 72,
    right: 72,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#2b5d8f',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  nearbyFabText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  markerCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(221, 165, 196, 0.36)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    padding: 16,
    gap: 7,
    shadowColor: '#5a3850',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  markerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  markerTitle: {
    flex: 1,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  markerCategoryTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  markerCategoryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  markerMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  markerInactive: {
    color: '#8a5a00',
    fontSize: 12,
    fontWeight: '700',
  },
  markerDescription: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  markerImage: {
    marginTop: 4,
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.16)',
    backgroundColor: '#f4eef8',
  },
  markerActions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  markerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    paddingHorizontal: 10,
    minHeight: 38,
    justifyContent: 'center',
    paddingVertical: 7,
  },
  markerActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 245, 251, 0.22)',
    gap: 8,
  },
  loadingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  refreshHint: {
    position: 'absolute',
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    minHeight: 36,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.14)',
  },
  refreshHintText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  noticeCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.16)',
  },
  noticeText: {
    color: '#5f4a72',
    fontSize: 13,
    lineHeight: 18,
  },
  addModeHintBubble: {
    position: 'absolute',
    left: 16,
    maxWidth: 250,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.2)',
    shadowColor: 'rgba(73, 43, 92, 0.34)',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addModeHintArrow: {
    position: 'absolute',
    top: -6,
    left: 18,
    width: 12,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.2)',
    transform: [{ rotate: '45deg' }],
  },
  addModeHintText: {
    flex: 1,
    color: '#5f4a72',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  draftOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  modalCenterWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 56, 80, 0.22)',
  },
  sheet: {
    maxHeight: '76%',
    minHeight: '36%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#fffafd',
    borderTopWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.12)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 12,
    shadowColor: '#5a3850',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -9 },
    elevation: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 44,
    height: 44,
    marginTop: -8,
    marginRight: -8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(208, 188, 255, 0.18)',
  },
  sheetTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  settingsScroll: {
    flexShrink: 1,
    minHeight: 1,
  },
  settingsContent: {
    gap: 12,
    paddingTop: 2,
  },
  sheetSectionTitle: {
    marginTop: 2,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  sheetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.28)',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sheetChipActive: {
    backgroundColor: '#d0bcff',
    borderColor: 'rgba(90, 56, 80, 0.2)',
  },
  sheetChipDisabled: {
    opacity: 0.42,
  },
  sheetChipText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  sheetChipTextActive: {
    color: '#5a3850',
  },
  sheetHintText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: -2,
  },
  selectTrigger: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectTriggerOpen: {
    borderColor: '#d0bcff',
    backgroundColor: 'rgba(208, 188, 255, 0.18)',
  },
  selectTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectCategoryDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  selectTriggerText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  selectMenu: {
    marginTop: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.2)',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  selectOptionRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(122, 75, 143, 0.16)',
  },
  selectOptionRowActive: {
    backgroundColor: 'rgba(208, 188, 255, 0.28)',
  },
  selectOptionText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  timeGroup: {
    marginTop: 2,
    gap: 6,
  },
  timeGroupLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  timeSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeSelectSeparator: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  draftDialogCard: {
    width: '100%',
    height: '82%',
    maxHeight: 680,
    minHeight: 420,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(236, 167, 206, 0.56)',
    backgroundColor: '#fffafd',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 12,
    shadowColor: '#5a3850',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  draftDialogScroll: {
    flex: 1,
    minHeight: 1,
  },
  draftScrollContent: {
    paddingBottom: 12,
    gap: 10,
  },
  formInput: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontSize: 16,
  },
  formMultiline: {
    height: 108,
    paddingTop: 10,
    paddingBottom: 10,
  },
  uploadRow: {
    marginTop: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadPickBtn: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#d0bcff',
  },
  uploadPickBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadClearBtn: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  uploadClearBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadHintText: {
    marginTop: -2,
    color: '#3c8b4f',
    fontSize: 12,
  },
  uploadErrorText: {
    marginTop: -2,
    color: colors.danger,
    fontSize: 12,
  },
  uploadPickedText: {
    marginTop: -2,
    color: colors.textSecondary,
    fontSize: 12,
  },
  draftSwitchRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  draftSwitchLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  draftTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  draftTimeInput: {
    flex: 1,
  },
  formHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: -2,
  },
  timeFixHintText: {
    color: 'rgba(95, 74, 114, 0.78)',
    fontSize: 12,
    marginTop: -4,
  },
  draftActions: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  draftCancelBtn: {
    height: 44,
    minWidth: 76,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.32)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCancelBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  draftDeleteBtn: {
    height: 44,
    minWidth: 76,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(193, 85, 88, 0.45)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftDeleteBtnText: {
    color: '#b44d4d',
    fontSize: 13,
    fontWeight: '700',
  },
  draftSaveBtn: {
    height: 44,
    minWidth: 84,
    borderRadius: 999,
    backgroundColor: '#d0bcff',
    borderWidth: 1,
    borderColor: 'rgba(90, 56, 80, 0.2)',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  draftSaveBtnDisabled: {
    opacity: 0.7,
  },
  draftSaveBtnText: {
    color: '#5a3850',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.18)',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    shadowColor: '#3b2248',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  confirmDesc: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  confirmActions: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmCancelBtn: {
    height: 42,
    minWidth: 72,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.32)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmDeleteBtn: {
    height: 42,
    minWidth: 84,
    borderRadius: 999,
    backgroundColor: '#b44d4d',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnDisabled: {
    opacity: 0.74,
  },
  confirmDeleteBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  radiusInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radiusInput: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 16,
  },
  radiusApplyBtn: {
    minWidth: 64,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  radiusApplyBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  radiusHintText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  radiusErrorText: {
    color: '#b44d4d',
    fontSize: 12,
  },
  nearbyList: {
    flex: 1,
    minHeight: 160,
  },
  nearbyListContent: {
    paddingBottom: 12,
    gap: 10,
  },
  nearbySheet: {
    height: '52%',
    minHeight: 280,
  },
  nearbyEmptyWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.16)',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  nearbyEmptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  nearbyCard: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.14)',
    backgroundColor: '#fff',
    padding: 13,
    gap: 5,
  },
  nearbyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nearbyCardTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  nearbyDistanceBadge: {
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nearbyDistanceText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  nearbyCardMeta: {
    color: '#6d5b7b',
    fontSize: 12,
  },
  nearbyCardDesc: {
    color: '#44395d',
    fontSize: 12,
    lineHeight: 17,
  },
});
