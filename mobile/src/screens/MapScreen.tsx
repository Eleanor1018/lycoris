import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {WebView, type WebViewMessageEvent} from 'react-native-webview';
import {Icon} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '../auth/AuthProvider';
import {
  buildApiUrl,
  THUNDERFOREST_API_KEY,
  TIANDITU_API_KEY,
  WEB_BASE_URL,
  toBackendAssetUrl,
} from '../config/runtime';
import {ApiError, requestJson} from '../lib/http';
import {
  appendUploadImageToFormData,
  pickUploadImage,
  type LocalUploadImage,
} from '../lib/imageUpload';
import {colors} from '../theme/colors';
import type {MapMarker, MarkerCategory} from '../types/marker';

type OwnerFilter = 'all' | 'mine' | 'fav';
type NearbyCategory = 'accessible_toilet' | 'friendly_clinic';
type TileProvider = 'osm' | 'tf_atlas' | 'tianditu_vec';
type NearbyResult = MapMarker & {distanceMeters: number};
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
  | {type: 'mapReady'}
  | {type: 'mapPress'; latitude?: number; longitude?: number}
  | {type: 'markerPress'; id: number}
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
  | {type: 'userLocation'; latitude: number; longitude: number}
  | {type: 'geoError'; message?: string}
  | {type: 'leafletLoadFailed'; message?: string};

type DraftMarker = {
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
  getCurrentPosition: (options?: {timeoutMs?: number; maxAgeMs?: number}) => Promise<NativeLocationPayload>;
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
  'conversion_therapy',
  'self_definition',
];

const categoryLabel: Record<MarkerCategory, string> = {
  accessible_toilet: '无障碍卫生间',
  friendly_clinic: '友好医疗机构',
  conversion_therapy: '扭转机构/风险点位',
  self_definition: '自定义',
};

const nearbyCategoryLabel: Record<NearbyCategory, string> = {
  accessible_toilet: '无障碍卫生间',
  friendly_clinic: '友好医疗机构',
};

const categoryColor: Record<MarkerCategory, string> = {
  accessible_toilet: '#1e88e5',
  friendly_clinic: '#43a047',
  conversion_therapy: '#e53935',
  self_definition: '#f0bf2f',
};

const hasThunderforestKey = THUNDERFOREST_API_KEY.length > 0;
const hasTiandituKey = TIANDITU_API_KEY.length > 0;
const initialTileProvider: TileProvider = hasTiandituKey
  ? 'tianditu_vec'
  : hasThunderforestKey
    ? 'tf_atlas'
    : 'osm';

const tileProviderConfig: Record<
  TileProvider,
  {label: string; url: string; labelUrl?: string}
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
    label: '天地图·矢量',
    url: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
    labelUrl: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
  },
};

const normalizeCategory = (value: unknown): MarkerCategory => {
  if (
    value === 'accessible_toilet' ||
    value === 'friendly_clinic' ||
    value === 'conversion_therapy' ||
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
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }
    result.push({
      id,
      lat,
      lng,
      category: normalizeCategory(marker.category),
      title: marker.title?.trim() || '未命名点位',
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

const splitHHMM = (value?: string | null): {hour: string; minute: string} => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return {hour: '', minute: ''};
  const [hour, minute] = value.split(':');
  return {hour, minute};
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
  if (!marker.openTimeStart || !marker.openTimeEnd) return '全天可用';
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
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
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
    const safeZoom = Number.isFinite(zoom) ? Math.max(3, Math.min(20, zoom)) : 11;
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
    globalThis as typeof globalThis & {btoa?: (value: string) => string}
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
  const response = await fetch(url, {method: 'GET', credentials: 'include'});
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
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f6f2fb; }
    .leaflet-control-zoom { display: none !important; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
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
          '<circle cx="20" cy="15.2" r="4.1" fill="none" stroke="#7a4b8f" stroke-width="1.8" />' +
          '<path d="M13.3 25c1.6-2.8 4-4.1 6.7-4.1 2.7 0 5.1 1.3 6.7 4.1" fill="none" stroke="#7a4b8f" stroke-width="1.8" stroke-linecap="round" />';
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
            '<svg width="56" height="56" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="filter: drop-shadow(0 8px 14px rgba(122,75,143,0.34));">' +
              '<defs>' +
                '<clipPath id="ly-user-avatar-clip">' +
                  '<circle cx="20" cy="20" r="15.6" />' +
                '</clipPath>' +
              '</defs>' +
              '<circle cx="20" cy="20" r="16.8" fill="none" stroke="#7a4b8f" stroke-width="1.2" opacity="0.42">' +
                '<animate attributeName="r" values="16.8;20.8;16.8" dur="1.9s" repeatCount="indefinite" />' +
                '<animate attributeName="opacity" values="0.42;0;0.42" dur="1.9s" repeatCount="indefinite" />' +
              '</circle>' +
              avatarLayer +
              '<circle cx="20" cy="20" r="15.6" fill="none" stroke="#7a4b8f" stroke-width="2" />' +
              '<circle cx="20" cy="37.2" r="2.2" fill="#7a4b8f" opacity="0.88" />' +
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

export function MapScreen({focusRequest, isActive = true}: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const {user, isLoggedIn} = useAuth();

  const webViewRef = useRef<WebView>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeFixHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addModeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const [visibleCats, setVisibleCats] = useState<Record<MarkerCategory, boolean>>(
    {
      accessible_toilet: true,
      friendly_clinic: true,
      conversion_therapy: true,
      self_definition: true,
    },
  );
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
  const [userLocation, setUserLocation] = useState<
    {latitude: number; longitude: number} | null
  >(null);
  const [mapViewport, setMapViewport] = useState<LatLngZoom>(INITIAL_VIEW);
  const [mapBounds, setMapBounds] = useState<ViewportBounds | null>(null);
  const [mapInitView, setMapInitView] = useState<LatLngZoom>(INITIAL_VIEW);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [mapAvatarSource, setMapAvatarSource] = useState('');
  const [missingImageMarkerIds, setMissingImageMarkerIds] = useState<Set<number>>(
    new Set(),
  );
  const [showAddModeHint, setShowAddModeHint] = useState(false);

  const topOffset = insets.top + 12;
  const bottomOffset = Math.max(14, insets.bottom + 10);

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
          throw new Error('原生定位返回坐标无效');
        }

        setUserLocation({latitude, longitude});
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
          showNotice(`已使用原生定位（${provider}）。`);
        }
        return true;
      } catch (err) {
        const nativeCode =
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          typeof (err as {code?: unknown}).code === 'string'
            ? (err as {code: string}).code
            : '';
        if (nativeCode === 'LOCATION_PERMISSION_DENIED') {
          setLocationPermissionGranted(false);
        }
        if (!silent) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : '定位失败，请稍后重试。';
          showNotice(`原生定位失败：${message}`);
        }
        return false;
      } finally {
        nativeLocateInFlightRef.current = false;
      }
    },
    [locationPermissionGranted, showNotice],
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
      if (timeFixHintTimerRef.current) clearTimeout(timeFixHintTimerRef.current);
      if (addModeHintTimerRef.current) clearTimeout(addModeHintTimerRef.current);
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
            title: '定位权限',
            message: '用于查询附近点位与快速定位当前位置。',
            buttonPositive: '允许',
            buttonNegative: '拒绝',
          },
        );
        const ok = asked === PermissionsAndroid.RESULTS.GRANTED;
        setLocationPermissionGranted(ok);
        if (!ok) showNotice('定位权限未开启，附近查询功能不可用。');
        return ok;
      } catch {
        setLocationPermissionGranted(false);
        return false;
      }
    },
    [showNotice],
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
  }, [isActive, locationPermissionGranted, mapReady, requestWebViewCurrentLocation]);

  useEffect(() => {
    if (!isActive || !locationPermissionGranted || userLocation) return;
    const timer = setTimeout(() => {
      requestNativeCurrentLocation({silent: true}).catch(() => {});
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
        return requestJson<unknown>(`/api/markers/viewport?${params.toString()}`);
      };

      try {
        let mergedMarkers: MapMarker[];
        if (bounds.wholeWorld) {
          const payload = await fetchViewportSegment(-180, 180);
          mergedMarkers = normalizeMarkers(payload);
        } else if (!bounds.wrapsAntimeridian && bounds.minLng <= bounds.maxLng) {
          const payload = await fetchViewportSegment(bounds.minLng, bounds.maxLng);
          mergedMarkers = normalizeMarkers(payload);
        } else {
          const [leftPayload, rightPayload] = await Promise.all([
            fetchViewportSegment(bounds.minLng, 180),
            fetchViewportSegment(-180, bounds.maxLng),
          ]);
          const mergedById = new Map<number, MapMarker>();
          [...normalizeMarkers(leftPayload), ...normalizeMarkers(rightPayload)].forEach(
            marker => {
              mergedById.set(marker.id, marker);
            },
          );
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
        const message = e instanceof Error ? e.message : '加载点位失败';
        setError(message);
      } finally {
        if (seq === markerQuerySeqRef.current && !hasLoadedMarkersRef.current) {
          hasLoadedMarkersRef.current = true;
          setLoading(false);
        }
      }
    },
    [],
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
        if (!user?.publicId || marker.userPublicId !== user.publicId) return false;
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
    const exists = filteredMarkers.some(marker => marker.id === selectedMarkerId);
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
    () => filteredMarkers.find(marker => marker.id === selectedMarkerId) ?? null,
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
    const isInsecureHttp = candidates.some(candidate => /^http:\/\//i.test(candidate));

    (async () => {
      if (__DEV__) {
        console.log('[MapAvatar] source url candidates:', candidates);
      }

      for (const candidate of candidates) {
        const withBuster = `${candidate}${candidate.includes('?') ? '&' : '?'}v=${Date.now()}`;
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
      const fallback = `${candidates[0]}${candidates[0].includes('?') ? '&' : '?'}v=${Date.now()}`;
      setMapAvatarSource(fallback);
      if (__DEV__) {
        console.log(
          `[MapAvatar] all data-url attempts failed${isInsecureHttp ? ' (insecure-http)' : ''}, fallback to direct url`,
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
      AsyncStorage.setItem(MAP_VIEWPORT_STORAGE_KEY, JSON.stringify(payload)).catch(
        () => {},
      );
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
    // provider change时保留当前视角
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
  }, [
    applyStartupCamera,
    isActive,
    mapReady,
    sessionRestored,
    userLocation,
  ]);

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
      injectJs('window.__rnClearUserLocation && window.__rnClearUserLocation();');
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
      conversion_therapy: true,
      self_definition: true,
    });

    const markerId = Number(focusRequest.markerId);
    if (!Number.isFinite(markerId)) return;

    const currentMarker = markers.find(marker => marker.id === markerId) || null;
    if (currentMarker) {
      setSelectedMarkerId(currentMarker.id);
      pendingFocusMarkerIdRef.current = null;
    } else {
      pendingFocusMarkerIdRef.current = markerId;
    }

    const latCandidate =
      typeof focusRequest.lat === 'number' ? focusRequest.lat : currentMarker?.lat;
    const lngCandidate =
      typeof focusRequest.lng === 'number' ? focusRequest.lng : currentMarker?.lng;
    if (Number.isFinite(latCandidate) && Number.isFinite(lngCandidate)) {
      injectJs(`window.__rnSetView(${latCandidate}, ${lngCandidate}, 15);`);
    }

    showNotice(
      `已定位到点位：${focusRequest.title || currentMarker?.title || String(markerId)}`,
    );
  }, [focusRequest, injectJs, mapReady, markers, showNotice]);

  const openDraftAt = useCallback(
    (lat: number, lng: number) => {
      openDraftMenu({
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
      showNotice('已选择坐标，请完善点位信息。');
    },
    [openDraftMenu, showNotice],
  );

  const openEditDraft = useCallback(
    (marker: MapMarker) => {
      if (!isLoggedIn) {
        showNotice('请先登录后再编辑。');
        return;
      }
      const start = splitHHMM(marker.openTimeStart);
      const end = splitHHMM(marker.openTimeEnd);
      openDraftMenu({
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
      showNotice('已进入编辑模式。');
    },
    [isLoggedIn, openDraftMenu, showNotice, user?.publicId],
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
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(zoom)) {
          setMapViewport({latitude: lat, longitude: normalizeLng(lng), zoom});
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
          setUserLocation({latitude: lat, longitude: lng});
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
          requestNativeCurrentLocation({silent: true})
            .then(ok => {
              if (ok) {
                return;
              }
              if (/secure origins?/i.test(detail)) {
                showNotice('定位失败：当前地图页来源不安全，已切换为安全来源重试。');
              } else if (detail) {
                showNotice(`获取定位失败：${detail}`);
              } else {
                showNotice('获取定位失败，可继续浏览地图。');
              }
            })
            .catch(() => {
              if (detail) {
                showNotice(`获取定位失败：${detail}`);
              } else {
                showNotice('获取定位失败，可继续浏览地图。');
              }
            });
        }
        return;
      }

      if (msg.type === 'leafletLoadFailed') {
        setError('地图脚本加载失败。请检查网络后重试。');
      }
    },
    [
      handleMapPress,
      injectJs,
      locationPermissionGranted,
      requestNativeCurrentLocation,
      showNotice,
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
      showNotice('请先开启定位权限。');
      return;
    }

    if (!userLocation) {
      const ok = await requestNativeCurrentLocation({recenter: true, silent: true});
      if (!ok) {
        showNotice('暂时无法获取定位，请稍后重试。');
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
        showNotice('打开网页地图失败');
      }
    },
    [showNotice],
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
    const result = await pickUploadImage({mode: 'marker'});
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
      showNotice('请先登录后再标点。');
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
        showNotice('标点模式已开启，请点击地图选择位置；再点一次加号可直接用中心点。');
      } else {
        showNotice('已退出标点模式。');
      }
      return next;
    });
  }, [isLoggedIn, openDraftAt, showNotice]);

  const setDraftTimePart = useCallback(
    (
      key: 'openStartHour' | 'openStartMinute' | 'openEndHour' | 'openEndMinute',
      value: string,
    ) => {
      const digits = value.replace(/\D/g, '').slice(0, 2);
      setTimeFixHint('');
      setDraft(prev => (prev ? {...prev, [key]: digits} : prev));
    },
    [],
  );

  const normalizeDraftTimePartOnBlur = useCallback(
    (key: 'openStartHour' | 'openStartMinute' | 'openEndHour' | 'openEndMinute') => {
      setDraft(prev => {
        if (!prev) return prev;
        const current = prev[key];
        if (!current) return prev;

        const parsed = Number(current);
        if (!Number.isFinite(parsed)) return prev;

        const isHour = key === 'openStartHour' || key === 'openEndHour';
        const max = isHour ? 23 : 59;
        const unit = isHour ? '小时' : '分钟';
        const clamped = Math.max(0, Math.min(max, Math.trunc(parsed)));
        const normalized = String(clamped).padStart(2, '0');

        if (parsed > max) {
          showTimeFixHint(`${unit}超出范围，已自动修正为 ${normalized}。`);
        }

        if (normalized === current) return prev;
        return {...prev, [key]: normalized};
      });
    },
    [showTimeFixHint],
  );

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    if (!isLoggedIn) {
      showNotice('请先登录后再标点。');
      resetDraftState();
      return;
    }

    const title = draft.title.trim();
    const hasStartHour = Boolean(draft.openStartHour);
    const hasStartMinute = Boolean(draft.openStartMinute);
    const hasEndHour = Boolean(draft.openEndHour);
    const hasEndMinute = Boolean(draft.openEndMinute);

    if (hasStartHour !== hasStartMinute) {
      showNotice('开始时间请同时选择小时和分钟。');
      return;
    }

    if (hasEndHour !== hasEndMinute) {
      showNotice('结束时间请同时选择小时和分钟。');
      return;
    }

    const start = composeHHMM(draft.openStartHour, draft.openStartMinute);
    const end = composeHHMM(draft.openEndHour, draft.openEndMinute);

    if (!title) {
      showNotice('请填写标题（例如：地铁站 A 口无障碍卫生间）。');
      return;
    }

    if (Boolean(start) !== Boolean(end)) {
      showNotice('开始和结束时间需同时填写，或都留空。');
      return;
    }

    if (start && !isValidHHMM(start)) {
      showNotice('开始时间格式不正确，请使用 HH:MM。');
      return;
    }
    if (end && !isValidHHMM(end)) {
      showNotice('结束时间格式不正确，请使用 HH:MM。');
      return;
    }

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
        throw new Error('保存成功，但返回数据格式异常。');
      }

      if (draftImageFile) {
        const form = new FormData();
        appendUploadImageToFormData(form, 'file', draftImageFile);
        payload = await requestJson<unknown>(`/api/markers/${created.id}/image`, {
          method: 'POST',
          body: form,
          timeoutMs: 20000,
        });
        const withImage = normalizeSingleMarker(payload);
        if (withImage) created = withImage;
      }

      setMarkers(prev => [created, ...prev.filter(marker => marker.id !== created.id)]);
      setSelectedMarkerId(created.id);
      resetDraftState();
      showNotice('已提交管理员审核，将在审核通过后显示。');
      injectJs(`window.__rnSetView(${created.lat}, ${created.lng}, 15);`);
    } catch (e) {
      const message = e instanceof Error ? e.message : '保存失败';
      showNotice(message);
    } finally {
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
  ]);

  const confirmDeleteDraft = useCallback(async () => {
    if (!editingId || deletingMarker) return;
    setDeletingMarker(true);
    try {
      await requestJson<unknown>(`/api/markers/${editingId}`, {method: 'DELETE'});
      resetDraftState();
      setSelectedMarkerId(null);
      await reloadMarkersInCurrentViewport();
      await loadFavorites();
      showNotice('点位已删除。');
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除失败';
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
  ]);

  const toggleCategory = useCallback((key: MarkerCategory) => {
    setVisibleCats(prev => ({...prev, [key]: !prev[key]}));
  }, []);

  const setAllCategoriesVisible = useCallback((visible: boolean) => {
    setVisibleCats({
      accessible_toilet: visible,
      friendly_clinic: visible,
      conversion_therapy: visible,
      self_definition: visible,
    });
  }, []);

  const clearNearbyFilter = useCallback(() => {
    setNearbyOnly(false);
    setNearbyPanelOpen(false);
  }, []);

  const searchNearby = useCallback(async () => {
    if (!userLocation) {
      showNotice('请先允许定位，再查询附近点位。');
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
          `你附近 ${nearbyRadius}m 内暂无${nearbyCategoryLabel[nearbyCategory]}点位。`,
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '附近查询失败';
      showNotice(message);
    } finally {
      setNearbyLoading(false);
    }
  }, [nearbyCategory, nearbyRadius, showNotice, userLocation]);

  const applyNearbyRadiusInput = useCallback(() => {
    const parsed = Number(nearbyRadiusInput.trim());
    if (!Number.isFinite(parsed)) {
      setNearbyRadiusError('请输入数字（0-10000）');
      return;
    }
    const safe = Math.max(0, Math.min(10000, Math.round(parsed)));
    if (safe !== parsed) {
      setNearbyRadiusError('范围需在 0-10000m，已自动修正');
    } else {
      setNearbyRadiusError('');
    }
    setNearbyRadius(safe);
    setNearbyRadiusInput(String(safe));
  }, [nearbyRadiusInput]);

  const toggleFavorite = useCallback(
    async (markerId: number) => {
      if (!isLoggedIn) {
        showNotice('请先登录后再收藏。');
        return;
      }
      const isFav = favoriteIds.has(markerId);
      try {
        await requestJson<unknown>(`/api/markers/${markerId}/favorite`, {
          method: isFav ? 'DELETE' : 'POST',
        });
        await loadFavorites();
      } catch (e) {
        const message = e instanceof Error ? e.message : '收藏操作失败';
        showNotice(message);
      }
    },
    [favoriteIds, isLoggedIn, loadFavorites, showNotice],
  );

  return (
    <View style={styles.page}>
      <WebView
        ref={webViewRef}
        key={`leaflet-${activeTileProvider}`}
        originWhitelist={['*']}
        source={{html: leafletHtml, baseUrl: WEB_BASE_URL}}
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
            <Text style={styles.loadingText}>地图加载中...</Text>
          </View>
        )}
      />

      <Pressable
        style={[styles.addFab, addMode && styles.addFabActive, {top: topOffset}]}
        onPress={handleAddButtonPress}
      >
        <Icon
          source={addMode ? 'map-marker-check-outline' : 'map-marker-plus-outline'}
          size={21}
          color={addMode ? '#3b2a14' : '#fff'}
        />
      </Pressable>
      {showAddModeHint ? (
        <Pressable
          style={[styles.addModeHintBubble, {top: topOffset + 56}]}
          onPress={() => setShowAddModeHint(false)}
        >
          <View style={styles.addModeHintArrow} />
          <Text style={styles.addModeHintText}>
            点击左上角按钮以进入添加点位模式
          </Text>
          <Icon source="close" size={14} color="#8b7a9b" />
        </Pressable>
      ) : null}

      <View
        style={[
          styles.legendWrap,
          legendOpen ? styles.legendWrapOpen : styles.legendWrapClosed,
          {top: topOffset},
        ]}
      >
        <Pressable
          style={[styles.legendToggle, legendOpen && styles.legendToggleOpen]}
          onPress={() => setLegendOpen(v => !v)}
        >
          <Text style={styles.legendToggleText}>筛选点位 {legendOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {legendOpen ? (
          <View style={styles.legendBody}>
            <View style={styles.legendTopRow}>
              <Text style={styles.legendTitle}>图例</Text>
              <View style={styles.legendQuickRow}>
                <Pressable
                  style={styles.legendQuickBtn}
                  onPress={() => setAllCategoriesVisible(true)}
                >
                  <Text style={styles.legendQuickBtnText}>全选</Text>
                </Pressable>
                <Pressable
                  style={styles.legendQuickBtn}
                  onPress={() => setAllCategoriesVisible(false)}
                >
                  <Text style={styles.legendQuickBtnText}>全不选</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.ownerFilterRow}>
              {(['all', 'mine', 'fav'] as OwnerFilter[]).map(key => {
                const active = ownerFilter === key;
                const disabled = !isLoggedIn && key !== 'all';
                const text =
                  key === 'all' ? '全部' : key === 'mine' ? '我添加的' : '我收藏的';
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
              >
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.categoryDot,
                      {backgroundColor: categoryColor[key]},
                    ]}
                  />
                  <Text style={styles.categoryText}>{categoryLabel[key]}</Text>
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

      <View style={[styles.bottomLeftStack, {bottom: bottomOffset}]}> 
        {nearbyOnly ? (
          <Pressable style={styles.exitNearbyBtn} onPress={clearNearbyFilter}>
            <Text style={styles.exitNearbyText}>退出附近筛选</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.circleFab} onPress={recenterToUserLocation}>
          <Icon source="crosshairs-gps" size={21} color="#fff" />
        </Pressable>
      </View>

      <Pressable
        style={[
          styles.nearbyFab,
          {
            bottom: bottomOffset,
            backgroundColor:
              nearbyCategory === 'friendly_clinic'
                ? categoryColor.friendly_clinic
                : categoryColor.accessible_toilet,
          },
        ]}
        disabled={nearbyLoading}
        onPress={searchNearby}
      >
        <Icon
          source={
            nearbyCategory === 'friendly_clinic'
              ? 'hospital-box-outline'
              : 'human-male-female'
          }
          size={18}
          color="#fff"
        />
        <Text style={styles.nearbyFabText}>
          {nearbyLoading
            ? '查询中...'
            : nearbyCategory === 'friendly_clinic'
              ? '附近友好医疗机构'
              : '附近无障碍卫生间'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.circleFab, styles.settingsFab, {bottom: bottomOffset}]}
        onPress={() => setSettingsOpen(true)}
      >
        <Icon source="cog-outline" size={21} color="#fff" />
      </Pressable>

      {selectedMarker ? (
        <View style={[styles.markerCard, {bottom: bottomOffset + 66}]}> 
          <View style={styles.markerCardHeader}>
            <Text style={styles.markerTitle} numberOfLines={2}>
              {selectedMarker.title}
            </Text>
            <View
              style={[
                styles.markerCategoryTag,
                {backgroundColor: `${getMarkerPinColor(selectedMarker)}20`},
              ]}
            >
              <Text style={styles.markerCategoryTagText}>
                {categoryLabel[selectedMarker.category]}
              </Text>
            </View>
          </View>
          <Text style={styles.markerMeta}>开放时间：{formatOpenTime(selectedMarker)}</Text>
          {!selectedMarker.isActive ? (
            <Text style={styles.markerInactive}>当前不可用</Text>
          ) : null}
          {selectedMarker.markImage &&
          selectedMarkerImageUri &&
          !missingImageMarkerIds.has(selectedMarker.id) ? (
            <Image
              source={{uri: selectedMarkerImageUri}}
              style={styles.markerImage}
              resizeMode="cover"
              onError={() =>
                {
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
                }
              }
            />
          ) : null}
          {selectedMarker.description ? (
            <Text style={styles.markerDescription} numberOfLines={3}>
              {selectedMarker.description}
            </Text>
          ) : null}
          <Text style={styles.markerMeta}>
            坐标：{selectedMarker.lat.toFixed(6)}, {selectedMarker.lng.toFixed(6)}
          </Text>

          <View style={styles.markerActions}>
            {isLoggedIn ? (
              <Pressable
                style={styles.markerActionBtn}
                onPress={() => openEditDraft(selectedMarker)}
              >
                <Icon source="pencil-outline" size={18} color={colors.primary} />
                <Text style={styles.markerActionText}>编辑</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.markerActionBtn}
              onPress={() => toggleFavorite(selectedMarker.id)}
            >
              <Icon
                source={favoriteIds.has(selectedMarker.id) ? 'star' : 'star-outline'}
                size={18}
                color={favoriteIds.has(selectedMarker.id) ? '#f6c344' : '#8b7a9c'}
              />
              <Text style={styles.markerActionText}>
                {favoriteIds.has(selectedMarker.id) ? '已收藏' : '收藏'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.markerActionBtn}
              onPress={() => openWebMap(selectedMarker)}
            >
              <Icon source="open-in-new" size={18} color={colors.primary} />
              <Text style={styles.markerActionText}>网页查看</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>正在加载点位...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.noticeCard, {top: topOffset + 52}]}> 
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {notice ? (
        <View style={[styles.noticeCard, {top: topOffset + (error ? 94 : 52)}]}>
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
                  {editingId ? '编辑点位' : '新增点位'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
                </Text>
              </View>
              <Pressable
                onPress={closeDraft}
                disabled={savingDraft || deletingMarker || draftImageBusy}
              >
                <Icon source="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.draftDialogScroll}
              contentContainerStyle={styles.draftScrollContent}
            >
              <Text style={styles.sheetSectionTitle}>类别</Text>
              <Pressable
                style={[
                  styles.selectTrigger,
                  categorySelectOpen && styles.selectTriggerOpen,
                ]}
                onPress={() => {
                  setCategorySelectOpen(v => !v);
                }}
              >
                <View style={styles.selectTriggerLeft}>
                  <View
                    style={[
                      styles.selectCategoryDot,
                      {backgroundColor: categoryColor[draft.category]},
                    ]}
                  />
                  <Text style={styles.selectTriggerText}>
                    {categoryLabel[draft.category]}
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
                          setDraft(prev => (prev ? {...prev, category: key} : prev));
                          setCategorySelectOpen(false);
                        }}
                      >
                        <View style={styles.selectTriggerLeft}>
                          <View
                            style={[
                              styles.selectCategoryDot,
                              {backgroundColor: categoryColor[key]},
                            ]}
                          />
                          <Text
                            style={[
                              styles.selectOptionText,
                              active && styles.selectOptionTextActive,
                            ]}
                          >
                            {categoryLabel[key]}
                          </Text>
                        </View>
                        {active ? (
                          <Icon source="check" size={16} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.sheetSectionTitle}>标题</Text>
              <TextInput
                style={styles.formInput}
                value={draft.title}
                onChangeText={value =>
                  setDraft(prev => (prev ? {...prev, title: value} : prev))
                }
                placeholder="例如：地铁站A口无障碍卫生间"
                placeholderTextColor="#9b8cab"
                maxLength={80}
              />

              <Text style={styles.sheetSectionTitle}>描述</Text>
              <TextInput
                style={[styles.formInput, styles.formMultiline]}
                value={draft.description}
                onChangeText={value =>
                  setDraft(prev => (prev ? {...prev, description: value} : prev))
                }
                placeholder="例如：入口在XX旁边，晚上关闭时间..."
                placeholderTextColor="#9b8cab"
                multiline
                textAlignVertical="top"
                maxLength={800}
              />

              <Text style={styles.sheetSectionTitle}>图片（可选）</Text>
              <View style={styles.uploadRow}>
                <Pressable
                  style={styles.uploadPickBtn}
                  onPress={pickDraftImage}
                  disabled={savingDraft || draftImageBusy}>
                  <Text style={styles.uploadPickBtnText}>
                    {draftImageBusy ? '处理中...' : '选择图片'}
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
                    disabled={savingDraft || draftImageBusy}>
                    <Text style={styles.uploadClearBtnText}>清除</Text>
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
                  已选择：{draftImageFile.name}
                </Text>
              ) : null}

              <View style={styles.draftSwitchRow}>
                <Text style={styles.draftSwitchLabel}>公开共享</Text>
                <Switch
                  value={draft.isPublic}
                  onValueChange={value =>
                    setDraft(prev => (prev ? {...prev, isPublic: value} : prev))
                  }
                  trackColor={{false: '#cab9d8', true: '#b58cc9'}}
                  thumbColor={draft.isPublic ? '#744988' : '#fff'}
                />
              </View>

              <Text style={styles.sheetSectionTitle}>开放时间</Text>
              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>开始</Text>
                <View style={styles.timeSelectRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openStartHour}
                    onChangeText={value => setDraftTimePart('openStartHour', value)}
                    onBlur={() => normalizeDraftTimePartOnBlur('openStartHour')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#9b8cab"
                  />
                  <Text style={styles.timeSelectSeparator}>:</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openStartMinute}
                    onChangeText={value => setDraftTimePart('openStartMinute', value)}
                    onBlur={() => normalizeDraftTimePartOnBlur('openStartMinute')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#9b8cab"
                  />
                </View>
              </View>

              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>结束</Text>
                <View style={styles.timeSelectRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openEndHour}
                    onChangeText={value => setDraftTimePart('openEndHour', value)}
                    onBlur={() => normalizeDraftTimePartOnBlur('openEndHour')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#9b8cab"
                  />
                  <Text style={styles.timeSelectSeparator}>:</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={draft.openEndMinute}
                    onChangeText={value => setDraftTimePart('openEndMinute', value)}
                    onBlur={() => normalizeDraftTimePartOnBlur('openEndMinute')}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#9b8cab"
                  />
                </View>
              </View>
              <Text style={styles.formHint}>
                不设置表示全天可用；若设置时间请按 HH:MM 填写，超范围会自动修正。
              </Text>
              {timeFixHint ? (
                <Text style={styles.timeFixHintText}>{timeFixHint}</Text>
              ) : null}

              <View style={styles.draftActions}>
                <Pressable
                  style={styles.draftCancelBtn}
                  onPress={closeDraft}
                  disabled={savingDraft || deletingMarker || draftImageBusy}
                >
                  <Text style={styles.draftCancelBtnText}>取消</Text>
                </Pressable>
                {editingId && canDeleteDraft ? (
                  <Pressable
                    style={styles.draftDeleteBtn}
                    onPress={() => setDeleteConfirmOpen(true)}
                    disabled={savingDraft || deletingMarker || draftImageBusy}
                  >
                    <Text style={styles.draftDeleteBtnText}>删除</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    styles.draftSaveBtn,
                    savingDraft && styles.draftSaveBtnDisabled,
                  ]}
                  onPress={saveDraft}
                  disabled={savingDraft || draftImageBusy}
                >
                  {savingDraft ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.draftSaveBtnText}>
                      {editingId ? '保存修改' : '保存'}
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
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>确认删除点位？</Text>
            <Text style={styles.confirmDesc}>删除后将无法恢复。</Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setDeleteConfirmOpen(false)}
                disabled={deletingMarker}
              >
                <Text style={styles.confirmCancelBtnText}>取消</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmDeleteBtn,
                  deletingMarker && styles.confirmDeleteBtnDisabled,
                ]}
                onPress={confirmDeleteDraft}
                disabled={deletingMarker}
              >
                {deletingMarker ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>确认删除</Text>
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
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>地图设置</Text>
              <Pressable onPress={() => setSettingsOpen(false)}>
                <Icon source="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.sheetSectionTitle}>地图来源</Text>
            <View style={styles.sheetChipRow}>
              {(['osm', 'tf_atlas', 'tianditu_vec'] as TileProvider[]).map(key => {
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
                  >
                    <Text
                      style={[
                        styles.sheetChipText,
                        active && styles.sheetChipTextActive,
                      ]}
                    >
                      {tileProviderConfig[key].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!hasThunderforestKey || !hasTiandituKey ? (
              <Text style={styles.sheetHintText}>
                {`未配置的来源会自动禁用：${
                  !hasThunderforestKey && !hasTiandituKey
                    ? 'TF Atlas、天地图'
                    : !hasThunderforestKey
                      ? 'TF Atlas'
                      : '天地图'
                }`}
              </Text>
            ) : null}
            <Text style={styles.sheetHintText}>当前不依赖 Google 地图 SDK。</Text>

            <Text style={styles.sheetSectionTitle}>附近查询类型</Text>
            <View style={styles.sheetChipRow}>
              {(['accessible_toilet', 'friendly_clinic'] as NearbyCategory[]).map(
                key => {
                  const active = nearbyCategory === key;
                  return (
                    <Pressable
                      key={`nearby-type-${key}`}
                      style={[styles.sheetChip, active && styles.sheetChipActive]}
                      onPress={() => setNearbyCategory(key)}
                    >
                      <Text
                        style={[
                          styles.sheetChipText,
                          active && styles.sheetChipTextActive,
                        ]}
                      >
                        {nearbyCategoryLabel[key]}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <Text style={styles.sheetSectionTitle}>附近查询范围</Text>
            <View style={styles.sheetChipRow}>
              {[500, 1000, 2500].map(radius => {
                const active = nearbyRadius === radius;
                return (
                  <Pressable
                    key={`radius-${radius}`}
                    style={[styles.sheetChip, active && styles.sheetChipActive]}
                    onPress={() => {
                      setNearbyRadius(radius);
                      setNearbyRadiusInput(String(radius));
                      setNearbyRadiusError('');
                    }}
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
              />
              <Pressable style={styles.radiusApplyBtn} onPress={applyNearbyRadiusInput}>
                <Text style={styles.radiusApplyBtnText}>应用</Text>
              </Pressable>
            </View>
            {nearbyRadiusError ? (
              <Text style={styles.radiusErrorText}>{nearbyRadiusError}</Text>
            ) : (
              <Text style={styles.radiusHintText}>范围支持 0-10000m，超出会自动修正。</Text>
            )}
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
          />
          <View style={[styles.sheet, styles.nearbySheet]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  附近 {nearbyRadius}m {nearbyCategoryLabel[nearbyCategory]}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  共 {nearbyResults.length} 个结果，点击可在地图上定位
                </Text>
              </View>
              <Pressable onPress={() => setNearbyPanelOpen(false)}>
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
                    暂无结果，请尝试扩大范围或切换分类。
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
                    {categoryLabel[marker.category]} · {formatOpenTime(marker)}
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
  webLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,245,251,0.95)',
    gap: 8,
  },
  addFab: {
    position: 'absolute',
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: '#6f4384',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 7},
    elevation: 8,
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
    borderColor: 'rgba(122, 75, 143, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: 'rgba(73, 43, 92, 0.38)',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 7,
    overflow: 'hidden',
  },
  legendWrapClosed: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  legendWrapOpen: {
    width: 240,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  legendToggle: {
    alignSelf: 'flex-start',
    minHeight: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  legendToggleOpen: {
    alignSelf: 'flex-end',
  },
  legendToggleText: {
    color: '#744988',
    fontSize: 14,
    fontWeight: '700',
  },
  legendBody: {
    marginTop: 4,
    gap: 8,
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
    borderColor: 'rgba(116, 73, 136, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 18,
  },
  ownerFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    color: '#fff',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(116, 73, 136, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
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
    backgroundColor: '#fff',
    borderRadius: 12,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6f4384',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 7},
    elevation: 8,
  },
  settingsFab: {
    position: 'absolute',
    right: 16,
  },
  nearbyFab: {
    position: 'absolute',
    left: '50%',
    transform: [{translateX: -96}],
    minWidth: 192,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#2b5d8f',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  nearbyFabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  markerCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    padding: 12,
    gap: 5,
    shadowColor: 'rgba(73, 43, 92, 0.38)',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
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
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  markerCategoryTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markerCategoryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  markerMeta: {
    color: '#6d5b7b',
    fontSize: 12,
  },
  markerInactive: {
    color: '#8a5a00',
    fontSize: 12,
    fontWeight: '700',
  },
  markerDescription: {
    color: '#40365b',
    fontSize: 13,
    lineHeight: 18,
  },
  markerImage: {
    marginTop: 4,
    width: '100%',
    height: 180,
    borderRadius: 10,
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
    paddingVertical: 6,
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
    paddingVertical: 6,
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.2)',
    shadowColor: 'rgba(73, 43, 92, 0.34)',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
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
    transform: [{rotate: '45deg'}],
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
    backgroundColor: 'rgba(20, 14, 24, 0.32)',
  },
  sheet: {
    maxHeight: '76%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.12)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sheetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    color: '#fff',
  },
  sheetHintText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: -2,
  },
  selectTrigger: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectTriggerOpen: {
    borderColor: 'rgba(122, 75, 143, 0.52)',
    backgroundColor: 'rgba(122, 75, 143, 0.06)',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.2)',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  selectOptionRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(122, 75, 143, 0.16)',
  },
  selectOptionRowActive: {
    backgroundColor: 'rgba(122, 75, 143, 0.10)',
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
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 14,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.18)',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
    shadowColor: '#3b2248',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 10},
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
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 14,
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
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  uploadPickBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadClearBtn: {
    minHeight: 34,
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
    height: 38,
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
    height: 38,
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
    height: 38,
    minWidth: 84,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftSaveBtnDisabled: {
    opacity: 0.7,
  },
  draftSaveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.18)',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#3b2248',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 10},
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
    height: 36,
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
    height: 36,
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
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.24)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: colors.textPrimary,
  },
  radiusApplyBtn: {
    minWidth: 64,
    height: 40,
    borderRadius: 12,
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
    height: '62%',
    minHeight: 280,
  },
  nearbyEmptyWrap: {
    borderRadius: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(122, 75, 143, 0.14)',
    backgroundColor: '#fff',
    padding: 10,
    gap: 4,
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
