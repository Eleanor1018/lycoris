import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Box,
    Typography,
    Button,
    IconButton,
    Stack,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Chip,
    Drawer,
    Card,
    CardContent,
    TextField,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import type { AlertColor } from '@mui/material'

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import axios from 'axios'
import type { AxiosError } from 'axios'
import L from 'leaflet'
import type { Layer, LeafletMouseEvent, Map as LeafletMap } from 'leaflet'
import type { MarkerCategory } from '../types/marker'
import { useAuth } from '../auth/AuthProvider'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import WcIcon from '@mui/icons-material/Wc'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import SettingsIcon from '@mui/icons-material/Settings'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MarkerFormDialog from '../components/MarkerFormDialog'
import type { DraftMarker } from '../components/MarkerFormDialog'
import { toBackendAssetUrl } from '../config/runtime'

// ====== 后端返回的 Marker（id 是 number / Long）======
type ApiMarker = {
    id: number
    lat: number
    lng: number
    category: MarkerCategory
    title: string
    description?: string
    isPublic: boolean
    isActive: boolean
    openTimeStart?: string | null
    openTimeEnd?: string | null
    markImage?: string | null
    username: string
    userPublicId?: string | null
    createdAt?: string
    updatedAt?: string
}

type NearbyResult = ApiMarker & {
    distanceMeters: number
}

type SavedMapView = {
    lat: number
    lng: number
    zoom: number
}

type FocusTarget = {
    lat: number
    lng: number
    title?: string
}

const coerceMarkerArray = (raw: unknown): ApiMarker[] => {
    if (Array.isArray(raw)) return raw as ApiMarker[]
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>
        if (Array.isArray(obj.content)) return obj.content as ApiMarker[]
        if (Array.isArray(obj.items)) return obj.items as ApiMarker[]
        if (Array.isArray(obj.data)) return obj.data as ApiMarker[]
    }
    return []
}

const sanitizeAttribution = (text: string): string =>
    text
        .replaceAll('🇺🇦', '')
        .replaceAll('Stand with Ukraine', '')
        .replaceAll('  ', ' ')
        .trim()

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
    const axiosError = error as AxiosError
    const data = axiosError?.response?.data
    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data === 'object' && 'message' in data) {
        const msg = (data as { message?: unknown }).message
        if (typeof msg === 'string' && msg.trim()) return msg
    }
    return fallback
}

// —— 小工具：生成临时 id
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

const supportedCategories = [
    'accessible_toilet',
    'friendly_clinic',
    'conversion_therapy',
    'self_definition',
] as const

type SupportedCategory = (typeof supportedCategories)[number]
type TileProvider = 'osm' | 'tf_atlas' | 'tianditu_vec'
type NearbyCategory = 'accessible_toilet' | 'friendly_clinic'

const categoryLabel: Record<SupportedCategory, string> = {
    accessible_toilet: '无障碍卫生间',
    friendly_clinic: '友好医疗机构',
    conversion_therapy: '扭转机构/风险点位',
    self_definition: '自定义',
}

const categoryColor: Record<SupportedCategory, string> = {
    accessible_toilet: '#1e88e5',
    friendly_clinic: '#43a047',
    conversion_therapy: '#e53935',
    self_definition: '#f0bf2f',
}

const nearbyCategoryLabel: Record<NearbyCategory, string> = {
    accessible_toilet: '无障碍卫生间',
    friendly_clinic: '友好医疗机构',
}

const INACTIVE_MARKER_COLOR = '#9e9e9e'
const MAP_LAST_VIEW_KEY = 'map.lastView'
const MAP_NEARBY_CATEGORY_KEY = 'map.nearbyCategory'
const MAP_ADD_MARKER_HINT_SEEN_KEY = 'map.addMarkerHintSeen'
const MAP_VISUAL_VIEWPORT_TOP_VAR = '--ly-map-vv-top'
const MAP_VISUAL_VIEWPORT_BOTTOM_VAR = '--ly-map-vv-bottom'
const MAP_VISUAL_VIEWPORT_HEIGHT_VAR = '--ly-map-vv-height'
const THUNDERFOREST_API_KEY = (import.meta.env.VITE_THUNDERFOREST_API_KEY ?? '').trim()
const TIANDITU_API_KEY = (import.meta.env.VITE_TIANDITU_API_KEY ?? '').trim()
const hasThunderforestKey = THUNDERFOREST_API_KEY.length > 0
const hasTiandituKey = TIANDITU_API_KEY.length > 0
const tileProviderConfig: Record<
    TileProvider,
    { label: string; url: string; attribution: string; labelUrl?: string }
> = {
    osm: {
        label: 'OSM',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
    },
    tf_atlas: {
        label: 'TF Atlas',
        url: `https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=${THUNDERFOREST_API_KEY}`,
        attribution: '&copy; OpenStreetMap contributors, Tiles style by Thunderforest',
    },
    tianditu_vec: {
        label: '天地图·矢量',
        url: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        labelUrl: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        attribution: '© 天地图',
    },
}

const normalizeCategory = (category: MarkerCategory | string): SupportedCategory => {
    if (supportedCategories.includes(category as SupportedCategory)) {
        return category as SupportedCategory
    }
    return 'self_definition'
}

const getMarkerIcon = (category: SupportedCategory, isActive: boolean) =>
    L.divIcon({
        className: '',
        html: `
            <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 1C7.9 1 3 5.9 3 12c0 9.4 9.2 20.7 10.5 22.3.3.4.9.4 1.2 0C15.8 32.7 25 21.4 25 12 25 5.9 20.1 1 14 1z"
                      fill="${isActive ? categoryColor[category] : INACTIVE_MARKER_COLOR}" stroke="#fff" stroke-width="2"/>
                <circle cx="14" cy="12" r="4.5" fill="#fff"/>
            </svg>
        `,
        iconSize: [28, 40],
        iconAnchor: [14, 38],
        popupAnchor: [0, -32],
    })

const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(bLat - aLat)
    const dLng = toRad(bLng - aLng)
    const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
    return 6371000 * c
}

const clampLat = (v: number) => Math.max(-90, Math.min(90, v))
const normalizeLng = (v: number) => {
    const n = ((v + 180) % 360 + 360) % 360 - 180
    return Math.max(-180, Math.min(180, n))
}

const escapeAttr = (v: string) =>
    v
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')

const copyCoords = async (lat: number, lng: number) => {
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }
    const temp = document.createElement('textarea')
    temp.value = text
    temp.style.position = 'fixed'
    temp.style.opacity = '0'
    document.body.appendChild(temp)
    temp.focus()
    temp.select()
    document.execCommand('copy')
    document.body.removeChild(temp)
}

const readSavedMapView = (): SavedMapView | null => {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(MAP_LAST_VIEW_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<SavedMapView>
        const lat = Number(parsed.lat)
        const lng = Number(parsed.lng)
        const zoom = Number(parsed.zoom)
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
        return { lat, lng, zoom: Math.max(3, Math.min(19, Math.round(zoom))) }
    } catch {
        return null
    }
}

const getUserLocationIcon = (avatarUrl?: string | null) => {
    const hasAvatar = Boolean(avatarUrl)
    const safeAvatarUrl = hasAvatar ? escapeAttr(String(avatarUrl)) : ''
    return L.divIcon({
        className: '',
        html: `
            <svg width="56" height="56" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 8px 14px rgba(122,75,143,0.34));">
                <defs>
                    <clipPath id="user-avatar-clip">
                        <circle cx="20" cy="20" r="15.6" />
                    </clipPath>
                </defs>
                <circle cx="20" cy="20" r="16.8" fill="none" stroke="#7a4b8f" stroke-width="1.2" opacity="0.42">
                    <animate attributeName="r" values="16.8;20.8;16.8" dur="1.9s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.42;0;0.42" dur="1.9s" repeatCount="indefinite" />
                </circle>
                ${
                    hasAvatar
                        ? `<image href="${safeAvatarUrl}" x="4.4" y="4.4" width="31.2" height="31.2" clip-path="url(#user-avatar-clip)" preserveAspectRatio="xMidYMid slice" />`
                        : `
                            <circle cx="20" cy="20" r="14.7" fill="#fff" />
                            <circle cx="20" cy="15.2" r="4.1" fill="none" stroke="#7a4b8f" stroke-width="1.8" />
                            <path d="M13.3 25c1.6-2.8 4-4.1 6.7-4.1 2.7 0 5.1 1.3 6.7 4.1" fill="none" stroke="#7a4b8f" stroke-width="1.8" stroke-linecap="round" />
                        `
                }
                <circle cx="20" cy="20" r="15.6" fill="none" stroke="#7a4b8f" stroke-width="2" />
                <circle cx="20" cy="37.2" r="2.2" fill="#7a4b8f" opacity="0.88" />
            </svg>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
        popupAnchor: [0, -28],
    })
}

function ClickToAdd({
    enabled,
    onPick,
    onMapTap,
}: {
    enabled: boolean
    onPick: (lat: number, lng: number) => void
    onMapTap?: () => void
}) {
    useMapEvents({
        click(e: LeafletMouseEvent) {
            onMapTap?.()
            if (!enabled) return
            onPick(e.latlng.lat, e.latlng.lng)
        },
    })
    return null
}

function MapReady({ onReady }: { onReady: (map: L.Map) => void }) {
    const map = useMap()
    useEffect(() => {
        onReady(map)
    }, [map, onReady])
    return null
}

export default function Maps() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { isLoggedIn, user } = useAuth()
    // 已保存点（来自后端）
    const [markers, setMarkers] = useState<ApiMarker[]>([])
    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set())

    // 新建草稿
    const [draft, setDraft] = useState<DraftMarker | null>(null)
    const [markImageFile, setMarkImageFile] = useState<File | null>(null)

    // Drawer 开关
    const dialogOpen = Boolean(draft)
    const [addMode, setAddMode] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [map, setMap] = useState<LeafletMap | null>(null)
    const [visibleCats, setVisibleCats] = useState<Record<SupportedCategory, boolean>>({
        accessible_toilet: true,
        friendly_clinic: true,
        conversion_therapy: true,
        self_definition: true,
    })
    const [legendOpen, setLegendOpen] = useState(false)
    const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine' | 'fav'>('all')
    const [tileProvider, setTileProvider] = useState<TileProvider>(() => {
        if (typeof window === 'undefined') return 'osm'
        const saved = window.localStorage.getItem('map.tileProvider')
        if (saved === 'tf_atlas') return 'tf_atlas'
        if (saved === 'tianditu_vec') return 'tianditu_vec'
        return 'osm'
    })
    const [nearbyRadius, setNearbyRadius] = useState<number>(() => {
        if (typeof window === 'undefined') return 1000
        const saved = window.localStorage.getItem('map.nearbyRadius')
        const parsed = Number(saved)
        if (!Number.isFinite(parsed)) return 1000
        if (parsed <= 0) return 1000
        return Math.max(0, Math.min(10000, Math.round(parsed)))
    })
    const [nearbyCategory, setNearbyCategory] = useState<NearbyCategory>(() => {
        if (typeof window === 'undefined') return 'accessible_toilet'
        const saved = window.localStorage.getItem(MAP_NEARBY_CATEGORY_KEY)
        return saved === 'friendly_clinic' ? 'friendly_clinic' : 'accessible_toilet'
    })
    const [nearbyRadiusInput, setNearbyRadiusInput] = useState<string>(String(nearbyRadius))
    const [nearbyRadiusError, setNearbyRadiusError] = useState<string>('')
    const activeTileProvider: TileProvider =
        tileProvider === 'tf_atlas' && !hasThunderforestKey
            ? 'osm'
            : tileProvider === 'tianditu_vec' && !hasTiandituKey
                ? 'osm'
                : tileProvider
    const [settingsOpen, setSettingsOpen] = useState(false)
    const savedMapView = useMemo(() => readSavedMapView(), [])
    const [didAutoLocate, setDidAutoLocate] = useState(false)
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
    const userLocationIcon = useMemo(() => getUserLocationIcon(user?.avatarUrl), [user?.avatarUrl])
    const [nearbyIds, setNearbyIds] = useState<Set<number>>(new Set())
    const [nearbyResults, setNearbyResults] = useState<NearbyResult[]>([])
    const [nearbyOnly, setNearbyOnly] = useState(false)
    const [nearbyPanelOpen, setNearbyPanelOpen] = useState(false)
    const [nearbyLoading, setNearbyLoading] = useState(false)
    const [reviewNoticeOpen, setReviewNoticeOpen] = useState(false)
    const [copyNoticeOpen, setCopyNoticeOpen] = useState(false)
    const [copyNoticeText, setCopyNoticeText] = useState('坐标已复制')
    const [noticeOpen, setNoticeOpen] = useState(false)
    const [noticeText, setNoticeText] = useState('')
    const [noticeSeverity, setNoticeSeverity] = useState<AlertColor>('info')
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [addHintOpen, setAddHintOpen] = useState(false)
    const [addHintPulse, setAddHintPulse] = useState(false)
    const [canDeleteDraft, setCanDeleteDraft] = useState(true)
    const [missingImageMarkerIds, setMissingImageMarkerIds] = useState<Set<number>>(new Set())
    const overlayTopOffset = `calc(env(safe-area-inset-top, 0px) + var(${MAP_VISUAL_VIEWPORT_TOP_VAR}, 0px) + 12px)`
    const overlayBottomOffset = `calc(env(safe-area-inset-bottom, 0px) + var(${MAP_VISUAL_VIEWPORT_BOTTOM_VAR}, 0px) + 20px)`
    const markerViewportRequestSeq = useRef(0)
    const markerImageUrlRef = useRef<Map<number, string>>(new Map())
    const targetFocusDoneRef = useRef<string | null>(null)
    const viewportMetaPrevRef = useRef<string | null>(null)
    const isIOSWebKit = useMemo(() => {
        if (typeof navigator === 'undefined') return false
        const ua = navigator.userAgent
        const isIOS =
            /iPhone|iPad|iPod/i.test(ua) ||
            (navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
        const hasWebKit = /AppleWebKit/i.test(ua)
        return isIOS && hasWebKit
    }, [])

    const showNotice = (text: string, severity: AlertColor = 'info') => {
        setNoticeText(text)
        setNoticeSeverity(severity)
        setNoticeOpen(true)
    }

    const dismissAddHint = useCallback(() => {
        setAddHintOpen(false)
        setAddHintPulse(false)
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(MAP_ADD_MARKER_HINT_SEEN_KEY, '1')
        }
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (window.localStorage.getItem(MAP_ADD_MARKER_HINT_SEEN_KEY) === '1') return
        setAddHintOpen(true)
        setAddHintPulse(true)
        const timer = window.setTimeout(() => setAddHintPulse(false), 3000)
        return () => window.clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem('map.tileProvider', tileProvider)
    }, [tileProvider])

    const handleMapReady = useCallback((mapInstance: LeafletMap) => {
        mapInstance.attributionControl?.setPrefix('')
        setMap(mapInstance)
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem('map.nearbyRadius', String(nearbyRadius))
    }, [nearbyRadius])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(MAP_NEARBY_CATEGORY_KEY, nearbyCategory)
    }, [nearbyCategory])

    useEffect(() => {
        setNearbyRadiusInput(String(nearbyRadius))
        setNearbyRadiusError('')
    }, [nearbyRadius])

    const fallbackCenter = useMemo<[number, number]>(() => [39.9042, 116.4074], [])
    const initialCenter = useMemo<[number, number]>(
        () => (savedMapView ? [savedMapView.lat, savedMapView.lng] : fallbackCenter),
        [savedMapView, fallbackCenter]
    )
    const initialZoom = savedMapView?.zoom ?? 12
    const targetMarkerId = useMemo(() => {
        const raw = searchParams.get('markerId')
        const id = raw ? Number(raw) : null
        return Number.isFinite(id) ? id : null
    }, [searchParams])
    const targetLatLng = useMemo(() => {
        const latRaw = searchParams.get('lat')
        const lngRaw = searchParams.get('lng')
        if (!latRaw || !lngRaw) return null
        const lat = Number(latRaw)
        const lng = Number(lngRaw)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return { lat, lng }
    }, [searchParams])
    const targetTitle = useMemo(() => searchParams.get('title') ?? '', [searchParams])
    const hasScaleResetFlag = useMemo(() => searchParams.get('__mapScaleReset') === '1', [searchParams])
    const targetFocusKey = useMemo(() => {
        if (targetMarkerId != null) return `id:${targetMarkerId}`
        if (targetLatLng) return `latlng:${targetLatLng.lat.toFixed(6)},${targetLatLng.lng.toFixed(6)}`
        return ''
    }, [targetMarkerId, targetLatLng])

    const loadMarkersInCurrentViewport = async (
        mapInstance: LeafletMap,
        categories: SupportedCategory[]
    ) => {
        if (categories.length === 0) {
            setMarkers([])
            return
        }
        const seq = ++markerViewportRequestSeq.current
        const bounds = mapInstance.getBounds()
        const minLat = clampLat(bounds.getSouth())
        const maxLat = clampLat(bounds.getNorth())
        let minLng = normalizeLng(bounds.getWest())
        let maxLng = normalizeLng(bounds.getEast())
        // Crossing the antimeridian after normalization: fall back to full longitude range.
        if (minLng > maxLng) {
            minLng = -180
            maxLng = 180
        }
        try {
            const res = await axios.get<ApiMarker[]>('/api/markers/viewport', {
                params: {
                    minLat,
                    maxLat,
                    minLng,
                    maxLng,
                    categories: categories.join(','),
                },
                withCredentials: true,
            })
            if (seq !== markerViewportRequestSeq.current) return
            setMarkers(coerceMarkerArray(res.data))
        } catch (e) {
            if (seq !== markerViewportRequestSeq.current) return
            console.error('load viewport markers failed', e)
        }
    }

    const loadFavorites = useCallback(async () => {
        if (!isLoggedIn) {
            setFavoriteIds(new Set())
            return
        }
        try {
            const res = await axios.get<number[]>('/api/markers/me/favorites', { withCredentials: true })
            setFavoriteIds(new Set(res.data ?? []))
        } catch {
            setFavoriteIds(new Set())
        }
    }, [isLoggedIn])

    useEffect(() => {
        void loadFavorites()
    }, [loadFavorites])

    useEffect(() => {
        if (!isLoggedIn && addMode) setAddMode(false)
    }, [isLoggedIn, addMode])

    const toggleCat = (key: SupportedCategory) => {
        setVisibleCats((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const showAllCats = () => {
        setVisibleCats({
            accessible_toilet: true,
            friendly_clinic: true,
            conversion_therapy: true,
            self_definition: true,
        })
    }

    const hideAllCats = () => {
        setVisibleCats({
            accessible_toilet: false,
            friendly_clinic: false,
            conversion_therapy: false,
            self_definition: false,
        })
    }

    const selectedVisibleCategories = useMemo(
        () => supportedCategories.filter((key) => visibleCats[key]),
        [visibleCats]
    )

    const filteredMarkers = useMemo(() => {
        const markerList = Array.isArray(markers) ? markers : []
        return markerList.filter((m) => {
            if (!visibleCats[normalizeCategory(m.category)]) return false
            if (nearbyOnly && !nearbyIds.has(m.id)) return false
            if (ownerFilter === 'mine') {
                if (!user?.publicId || m.userPublicId !== user.publicId) return false
            }
            if (ownerFilter === 'fav') {
                if (!favoriteIds.has(m.id)) return false
            }
            return true
        })
    }, [markers, visibleCats, nearbyOnly, nearbyIds, ownerFilter, user?.publicId, favoriteIds])

    useEffect(() => {
        if (!map || (!targetLatLng && targetMarkerId == null)) return
        if (targetFocusKey && targetFocusDoneRef.current === targetFocusKey) return
        const byId = markers.find((m) => m.id === targetMarkerId) || null
        const hasMarkerTarget = targetMarkerId != null

        // If a markerId is provided, wait for real marker data so we can open
        // the full popup instead of a title-only fallback popup.
        if (hasMarkerTarget && !byId) {
            if (targetLatLng) {
                map.whenReady(() => {
                    map.setView([targetLatLng.lat, targetLatLng.lng], Math.max(map.getZoom(), 14), { animate: true })
                })
            }
            return
        }

        const resolved: FocusTarget | null =
            byId ?? (targetLatLng ? { lat: targetLatLng.lat, lng: targetLatLng.lng, title: targetTitle } : null)

        if (!resolved) return

        map.whenReady(() => {
            map.setView([resolved.lat, resolved.lng], Math.max(map.getZoom(), 14), { animate: true })
            if (targetFocusKey) targetFocusDoneRef.current = targetFocusKey

            setTimeout(() => {
                let opened = false
                map.eachLayer((layer: Layer) => {
                    if (layer instanceof L.Marker) {
                        const ll = layer.getLatLng()
                        const sameLat = Math.abs(ll.lat - resolved.lat) < 1e-6
                        const sameLng = Math.abs(ll.lng - resolved.lng) < 1e-6
                        if (sameLat && sameLng) {
                            layer.openPopup()
                            opened = true
                        }
                    }
                })
                if (!opened) {
                    const title = resolved.title || targetTitle
                    L.popup()
                        .setLatLng([resolved.lat, resolved.lng])
                        .setContent(title ? `<strong>${title}</strong>` : '点位')
                        .openOn(map)
                }
            }, 200)
        })
    }, [map, markers, targetMarkerId, targetLatLng, targetTitle, targetFocusKey])

    useEffect(() => {
        if (!map) return
        let timer: ReturnType<typeof setTimeout> | null = null
        const scheduleLoad = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                void loadMarkersInCurrentViewport(map, selectedVisibleCategories)
            }, 220)
        }
        scheduleLoad()
        map.on('moveend zoomend', scheduleLoad)
        return () => {
            if (timer) clearTimeout(timer)
            map.off('moveend zoomend', scheduleLoad)
        }
    }, [map, selectedVisibleCategories])

    useEffect(() => {
        if (!map || typeof window === 'undefined') return
        const persistView = () => {
            const center = map.getCenter()
            const next: SavedMapView = {
                lat: Number(center.lat.toFixed(6)),
                lng: Number(center.lng.toFixed(6)),
                zoom: map.getZoom(),
            }
            window.localStorage.setItem(MAP_LAST_VIEW_KEY, JSON.stringify(next))
        }
        persistView()
        map.on('moveend zoomend', persistView)
        return () => {
            map.off('moveend zoomend', persistView)
        }
    }, [map])

    useEffect(() => {
        setMissingImageMarkerIds((prev) => {
            if (prev.size === 0) return prev

            const next = new Set(prev)
            const currentMap = new Map<number, string>()
            for (const marker of markers) {
                if (marker.markImage) {
                    currentMap.set(marker.id, marker.markImage)
                }
            }

            for (const markerId of prev) {
                const latestUrl = currentMap.get(markerId)
                const previousUrl = markerImageUrlRef.current.get(markerId)
                // Retry once image URL changed, or marker/image disappeared.
                if (!latestUrl || (previousUrl && latestUrl !== previousUrl)) {
                    next.delete(markerId)
                }
            }

            markerImageUrlRef.current = currentMap
            return next
        })
    }, [markers])

    useEffect(() => {
        if (!isIOSWebKit || typeof document === 'undefined') return
        const vv = window.visualViewport
        if (vv && vv.scale !== 1 && !hasScaleResetFlag) {
            const next = new URL(window.location.href)
            next.searchParams.set('__mapScaleReset', '1')
            window.location.replace(next.toString())
            return
        }
        const viewportMeta = document.querySelector('meta[name="viewport"]')
        if (!viewportMeta) return
        const prev = viewportMeta.getAttribute('content')
        viewportMetaPrevRef.current = prev
        viewportMeta.setAttribute(
            'content',
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        )
        try {
            if (window.visualViewport && window.visualViewport.scale !== 1) {
                window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: 'instant' as ScrollBehavior })
            }
        } catch {
            // no-op: best-effort zoom reset
        }
        return () => {
            const previous = viewportMetaPrevRef.current
            if (previous != null) viewportMeta.setAttribute('content', previous)
        }
    }, [isIOSWebKit, hasScaleResetFlag])

    useEffect(() => {
        if (!isIOSWebKit || typeof window === 'undefined' || typeof document === 'undefined') return

        const root = document.documentElement
        const syncViewportInsets = () => {
            const vv = window.visualViewport
            const top = vv ? Math.max(0, vv.offsetTop) : 0
            const height = vv ? vv.height : window.innerHeight
            const bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
            root.style.setProperty(MAP_VISUAL_VIEWPORT_TOP_VAR, `${Math.round(top)}px`)
            root.style.setProperty(MAP_VISUAL_VIEWPORT_BOTTOM_VAR, `${Math.round(bottom)}px`)
            root.style.setProperty(MAP_VISUAL_VIEWPORT_HEIGHT_VAR, `${Math.round(height)}px`)
            if (map) {
                map.invalidateSize(false)
            }
        }

        let frame = 0
        const scheduleSync = () => {
            if (frame) window.cancelAnimationFrame(frame)
            frame = window.requestAnimationFrame(() => {
                frame = 0
                syncViewportInsets()
            })
        }

        scheduleSync()

        const vv = window.visualViewport
        vv?.addEventListener('resize', scheduleSync)
        vv?.addEventListener('scroll', scheduleSync)
        window.addEventListener('resize', scheduleSync)
        window.addEventListener('orientationchange', scheduleSync)

        return () => {
            if (frame) window.cancelAnimationFrame(frame)
            vv?.removeEventListener('resize', scheduleSync)
            vv?.removeEventListener('scroll', scheduleSync)
            window.removeEventListener('resize', scheduleSync)
            window.removeEventListener('orientationchange', scheduleSync)
            root.style.removeProperty(MAP_VISUAL_VIEWPORT_TOP_VAR)
            root.style.removeProperty(MAP_VISUAL_VIEWPORT_BOTTOM_VAR)
            root.style.removeProperty(MAP_VISUAL_VIEWPORT_HEIGHT_VAR)
        }
    }, [isIOSWebKit, map])
    useEffect(() => {
        if (!isIOSWebKit || typeof document === 'undefined') return

        const preventGestureZoom = (event: Event) => {
            event.preventDefault()
        }

        const preventPopupPinchZoom = (event: TouchEvent) => {
            const target = event.target as HTMLElement | null
            if (!target) return
            const inMapPopup = Boolean(target.closest('.leaflet-popup'))
            if (!inMapPopup) return
            const touchCount = event.touches?.length ?? 0
            if (touchCount > 1) {
                event.preventDefault()
            }
        }

        document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
        document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
        document.addEventListener('gestureend', preventGestureZoom, { passive: false })
        document.addEventListener('touchmove', preventPopupPinchZoom, { passive: false })

        return () => {
            document.removeEventListener('gesturestart', preventGestureZoom)
            document.removeEventListener('gesturechange', preventGestureZoom)
            document.removeEventListener('gestureend', preventGestureZoom)
            document.removeEventListener('touchmove', preventPopupPinchZoom)
        }
    }, [isIOSWebKit])

    useEffect(() => {
        if (!isIOSWebKit || dialogOpen || typeof window === 'undefined') return

        const resetAfterDialogClose = () => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
            map?.invalidateSize(false)
        }

        const timer = window.setTimeout(resetAfterDialogClose, 48)
        return () => window.clearTimeout(timer)
    }, [dialogOpen, isIOSWebKit, map])
    useEffect(() => {
        if (!hasScaleResetFlag) return
        const next = new URLSearchParams(searchParams)
        next.delete('__mapScaleReset')
        navigate({ search: next.toString() ? `?${next.toString()}` : '' }, { replace: true })
    }, [hasScaleResetFlag, searchParams, navigate])

    useEffect(() => {
        if (!map) return
        const openedFromSearch = Boolean(targetLatLng || targetMarkerId != null)
        if (!navigator.geolocation) {
            setDidAutoLocate(true)
            return
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords
                const next: [number, number] = [latitude, longitude]
                setUserLocation(next)
                // Keep search target center if this page is opened from search,
                // but still refresh location in background for nearby actions.
                if (!didAutoLocate && !openedFromSearch) {
                    map.setView(next, Math.max(map.getZoom(), 14), { animate: true })
                }
                if (!didAutoLocate) setDidAutoLocate(true)
            },
            () => {
                // Permission denied / timeout: keep default center.
                setDidAutoLocate(true)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )

        return () => navigator.geolocation.clearWatch(watchId)
    }, [map, didAutoLocate, targetLatLng, targetMarkerId])

    const openDraft = (lat: number, lng: number) => {
        setDraft({
            tempId: uid(),
            lat,
            lng,
            category: 'accessible_toilet',
            title: '',
            description: '',
            isPublic: true,
            openTimeStart: '',
            openTimeEnd: '',
            markImage: '',
        })
        setMarkImageFile(null)
        setEditingId(null)
        setCanDeleteDraft(true)
        setAddMode(false)
    }

    const openEdit = (m: ApiMarker) => {
        const isOwner = user?.publicId != null && m.userPublicId === user.publicId
        setDraft({
            tempId: uid(),
            lat: m.lat,
            lng: m.lng,
            category: normalizeCategory(m.category),
            title: m.title,
            description: m.description ?? '',
            isPublic: m.isPublic,
            openTimeStart: m.openTimeStart ?? '',
            openTimeEnd: m.openTimeEnd ?? '',
            markImage: m.markImage ?? '',
        })
        setMarkImageFile(null)
        setEditingId(m.id)
        setCanDeleteDraft(isOwner)
        setAddMode(false)
    }

    const closeDraft = () => {
        setDraft(null)
        setMarkImageFile(null)
        setEditingId(null)
        setCanDeleteDraft(true)
    }

    const recenterToUserLocation = () => {
        if (!map || !userLocation) return
        map.setView(userLocation, Math.max(map.getZoom(), 14), { animate: true })
    }

    const focusMarkerOnMap = (m: ApiMarker) => {
        if (!map) return
        map.setView([m.lat, m.lng], Math.max(map.getZoom(), 15), { animate: true })
        setTimeout(() => {
            map.eachLayer((layer: Layer) => {
                if (layer instanceof L.Marker) {
                    const ll = layer.getLatLng()
                    if (Math.abs(ll.lat - m.lat) < 1e-6 && Math.abs(ll.lng - m.lng) < 1e-6) {
                        layer.openPopup()
                    }
                }
            })
        }, 180)
    }

    const closeNearbyPanel = () => {
        setNearbyPanelOpen(false)
        setNearbyOnly(false)
    }

    const applyNearbyRadiusInput = () => {
        const parsed = Number(nearbyRadiusInput.trim())
        if (!Number.isFinite(parsed)) {
            setNearbyRadiusError('请输入数字（0-10000）')
            return
        }
        if (parsed < 0 || parsed > 10000) {
            setNearbyRadiusError('范围需在 0-10000m，已自动修正')
        } else {
            setNearbyRadiusError('')
        }
        const next = Math.max(0, Math.min(10000, Math.round(parsed)))
        setNearbyRadius(next)
        setNearbyRadiusInput(String(next))
    }

    const searchNearbyAccessibleToilets = async () => {
        if (!map || !userLocation) return
        setNearbyLoading(true)
        try {
            const [lat, lng] = userLocation
            const res = await axios.get<ApiMarker[]>('/api/markers/nearby', {
                params: { lat, lng, radius: nearbyRadius, category: nearbyCategory },
                withCredentials: true,
            })
            const list = coerceMarkerArray(res.data)
            const results: NearbyResult[] = list.map((m) => ({
                ...m,
                distanceMeters: haversineMeters(lat, lng, m.lat, m.lng),
            }))
            const ids = new Set(list.map((m) => m.id))
            setNearbyResults(results)
            setNearbyIds(ids)
            setNearbyOnly(true)
            setNearbyPanelOpen(results.length > 0)

            if (list.length === 0) {
                showNotice(`你附近 ${nearbyRadius}m 内暂无${nearbyCategoryLabel[nearbyCategory]}点位。`, 'info')
                return
            }
        } catch (e: unknown) {
            showNotice(extractApiErrorMessage(e, '附近查询失败'), 'error')
        } finally {
            setNearbyLoading(false)
        }
    }

    const saveDraft = async () => {
        if (!draft) return
        if (!draft.title.trim()) {
            showNotice('请填写标题（例如：地铁站 A 口无障碍卫生间）', 'warning')
            return
        }

        try {
            let created: ApiMarker
            if (editingId) {
                const res = await axios.patch<ApiMarker>(
                    `/api/markers/${editingId}`,
                    {
                        category: draft.category,
                        title: draft.title,
                        description: draft.description,
                        isPublic: draft.isPublic,
                        openTimeStart: draft.openTimeStart || '',
                        openTimeEnd: draft.openTimeEnd || '',
                    },
                    { withCredentials: true }
                )
                created = res.data
            } else {
                const res = await axios.post<ApiMarker>(
                    '/api/markers',
                    {
                        lat: draft.lat,
                        lng: draft.lng,
                        category: draft.category,
                        title: draft.title,
                        description: draft.description,
                        isPublic: draft.isPublic,
                        openTimeStart: draft.openTimeStart || '',
                        openTimeEnd: draft.openTimeEnd || '',
                        markImage: draft.markImage ?? null,
                    },
                    { withCredentials: true }
                )
                created = res.data
            }

            if (markImageFile) {
                const form = new FormData()
                form.append('file', markImageFile)
                const imgRes = await axios.post<ApiMarker>(
                    `/api/markers/${created.id}/image`,
                    form,
                    { withCredentials: true }
                )
                created = imgRes.data
            }

            setMarkers((prev) => {
                const safePrev = Array.isArray(prev) ? prev : []
                return [created, ...safePrev.filter((m) => m.id !== created.id)]
            })
            setDraft(null)
            setMarkImageFile(null)
            setEditingId(null)
            setReviewNoticeOpen(true)
        } catch (e: unknown) {
            showNotice(extractApiErrorMessage(e, '保存失败'), 'error')
        }
    }

    const confirmDeleteMarker = async () => {
        if (!editingId || deleting) return
        setDeleting(true)
        try {
            await axios.delete(`/api/markers/${editingId}`, { withCredentials: true })
            setDeleteConfirmOpen(false)
            closeDraft()
            if (map) {
                await loadMarkersInCurrentViewport(map, selectedVisibleCategories)
            }
            await loadFavorites()
            showNotice('点位已删除', 'success')
        } catch (e: unknown) {
            showNotice(extractApiErrorMessage(e, '删除失败'), 'error')
        } finally {
            setDeleting(false)
        }
    }

    const addHintText = isLoggedIn
        ? '点击左上角按钮即可在地图上标记点位。'
        : '登录后点击左上角按钮可在地图上标记点位。'

    return (
        <Box
            sx={{
                height: `calc(var(${MAP_VISUAL_VIEWPORT_HEIGHT_VAR}, 100dvh) - var(--nav-offset, var(--nav-height, 64px)))`, 
                width: '100%',
            }}
        >
            <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
                    <Box
                        sx={{
                            position: 'absolute',
                            zIndex: 1200,
                            left: { xs: 12, md: 16 },
                            top: { xs: overlayTopOffset, md: 16 },
                            pointerEvents: 'none',
                        }}
                    >
                        <Button
                            variant="contained"
                            onClick={() => {
                                if (addHintOpen) dismissAddHint()
                                if (!isLoggedIn) {
                                    navigate('/login')
                                    return
                                }
                                setAddMode((prev) => !prev)
                            }}
                            sx={{
                                width: 46,
                                height: 46,
                                minWidth: 46,
                                borderRadius: 2.5,
                                p: 0,
                                pointerEvents: 'auto',
                                color: addMode ? '#3b2a14' : '#fff',
                                bgcolor: addMode ? '#f2a93b' : '#7a4b8f',
                                boxShadow: addMode
                                    ? '0 10px 24px rgba(242, 169, 59, 0.42)'
                                    : '0 8px 20px rgba(122, 75, 143, 0.28)',
                                '&:hover': { bgcolor: addMode ? '#de9327' : '#6b3f80' },
                                ...(addMode
                                    ? {
                                          outline: '2px solid rgba(255,255,255,0.9)',
                                          outlineOffset: '1px',
                                      }
                                    : null),
                                ...(addHintPulse
                                    ? {
                                          animation: 'mapAddMarkerPulse 1s ease-in-out 3',
                                          '@keyframes mapAddMarkerPulse': {
                                              '0%': { transform: 'scale(1)' },
                                              '50%': { transform: 'scale(1.08)' },
                                              '100%': { transform: 'scale(1)' },
                                          },
                                      }
                                    : null),
                            }}
                            aria-label={!isLoggedIn ? '登录后添加' : addMode ? '添加中' : '添加标记点'}
                        >
                            <Box sx={{ position: 'relative', width: 22, height: 22 }}>
                                <MapOutlinedIcon sx={{ fontSize: 20 }} />
                                <EditRoundedIcon
                                    sx={{
                                        position: 'absolute',
                                        right: -3,
                                        bottom: -3,
                                        fontSize: 12,
                                        bgcolor: addMode ? '#f2a93b' : '#7a4b8f',
                                        borderRadius: 999,
                                        p: '1px',
                                        color: addMode ? '#3b2a14' : '#fff',
                                    }}
                                />
                            </Box>
                        </Button>
                    </Box>
                    {addHintOpen ? (
                        <Box
                            sx={{
                                position: 'absolute',
                                zIndex: 1250,
                                left: { xs: 68, md: 74 },
                                top: { xs: overlayTopOffset, md: 16 },
                                width: { xs: 220, md: 280 },
                                pointerEvents: 'auto',
                            }}
                        >
                            <Card
                                sx={{
                                    position: 'relative',
                                    borderRadius: 2.5,
                                    border: '1px solid rgba(122, 75, 143, 0.2)',
                                    boxShadow: '0 12px 26px rgba(72, 42, 92, 0.18)',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        left: -8,
                                        top: 14,
                                        width: 0,
                                        height: 0,
                                        borderTop: '8px solid transparent',
                                        borderBottom: '8px solid transparent',
                                        borderRight: '8px solid #fff',
                                    },
                                }}
                            >
                                <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                                    <Typography sx={{ fontSize: 13, lineHeight: 1.45, color: '#4a2c62' }}>
                                        {addHintText}
                                    </Typography>
                                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.8 }}>
                                        <Button
                                            size="small"
                                            onClick={dismissAddHint}
                                            sx={{
                                                minWidth: 0,
                                                px: 1.1,
                                                borderRadius: 999,
                                                textTransform: 'none',
                                                color: '#744988',
                                                fontWeight: 700,
                                            }}
                                        >
                                            我知道了
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>
                    ) : null}

                    <Stack
                        spacing={1}
                        sx={{
                            position: 'fixed',
                            zIndex: 1200,
                            left: 20,
                            bottom: overlayBottomOffset,
                            pointerEvents: 'none',
                            '& .MuiButton-root': {
                                pointerEvents: 'auto',
                            },
                        }}
                    >
                        {nearbyOnly ? (
                            <Button
                                variant="outlined"
                                onClick={closeNearbyPanel}
                                sx={{
                                    minWidth: 0,
                                    borderRadius: 2.5,
                                    px: 1.2,
                                    bgcolor: '#fff',
                                    color: '#7a4b8f',
                                    borderColor: 'rgba(122, 75, 143, 0.35)',
                                    '&:hover': { bgcolor: 'rgba(122, 75, 143, 0.08)', borderColor: '#7a4b8f' },
                                }}
                            >
                                退出附近筛选
                            </Button>
                        ) : null}

                        <Button
                            variant="contained"
                            onClick={recenterToUserLocation}
                            disabled={!userLocation}
                            sx={{
                                width: 46,
                                height: 46,
                                minWidth: 46,
                                borderRadius: 2.5,
                                p: 0,
                                color: '#fff',
                                bgcolor: '#7a4b8f',
                                boxShadow: '0 8px 20px rgba(122, 75, 143, 0.28)',
                                '&:hover': { bgcolor: '#6b3f80' },
                                '&.Mui-disabled': {
                                    bgcolor: '#c5b5cc',
                                    color: '#fff',
                                },
                            }}
                        >
                            <MyLocationIcon fontSize="small" />
                        </Button>
                    </Stack>

                    <Box
                        sx={{
                            position: 'fixed',
                            zIndex: 1200,
                            left: '50%',
                            bottom: overlayBottomOffset,
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                        }}
                    >
                        <Button
                            variant="contained"
                            onClick={searchNearbyAccessibleToilets}
                            disabled={!userLocation || nearbyLoading}
                            sx={{
                                minWidth: 0,
                                borderRadius: 2.5,
                                px: 1.3,
                                pointerEvents: 'auto',
                                color: '#fff',
                                bgcolor:
                                    nearbyCategory === 'friendly_clinic'
                                        ? categoryColor.friendly_clinic
                                        : categoryColor.accessible_toilet,
                                boxShadow:
                                    nearbyCategory === 'friendly_clinic'
                                        ? '0 8px 20px rgba(67, 160, 71, 0.28)'
                                        : '0 8px 20px rgba(30, 136, 229, 0.28)',
                                '&:hover': {
                                    bgcolor:
                                        nearbyCategory === 'friendly_clinic'
                                            ? '#388e3c'
                                            : '#1565c0',
                                },
                                '&.Mui-disabled': {
                                    bgcolor: '#c5b5cc',
                                    color: '#fff',
                                },
                            }}
                        >
                            {nearbyCategory === 'friendly_clinic' ? (
                                <LocalHospitalIcon sx={{ mr: 0.6 }} fontSize="small" />
                            ) : (
                                <WcIcon sx={{ mr: 0.6 }} fontSize="small" />
                            )}
                            {nearbyLoading
                                ? '查询中...'
                                : nearbyCategory === 'friendly_clinic'
                                    ? '附近友好医疗机构'
                                    : '附近无障碍卫生间'}
                        </Button>
                    </Box>

                    <Button
                        variant="contained"
                        onClick={() => setSettingsOpen(true)}
                        sx={{
                            position: 'fixed',
                            zIndex: 1200,
                            right: 20,
                            bottom: overlayBottomOffset,
                            width: 46,
                            height: 46,
                            minWidth: 46,
                            borderRadius: 2.5,
                            p: 0,
                            color: '#fff',
                            bgcolor: '#7a4b8f',
                            boxShadow: '0 8px 20px rgba(122, 75, 143, 0.28)',
                            '&:hover': { bgcolor: '#6b3f80' },
                        }}
                    >
                        <SettingsIcon fontSize="small" />
                    </Button>

                    <Snackbar
                        open={reviewNoticeOpen}
                        autoHideDuration={4000}
                        onClose={() => setReviewNoticeOpen(false)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert
                            onClose={() => setReviewNoticeOpen(false)}
                            severity="info"
                            sx={{ borderRadius: 3, bgcolor: 'rgba(123, 79, 143, 0.92)', color: '#fff' }}
                        >
                            已提交管理员审核，将在审核通过后显示
                        </Alert>
                    </Snackbar>

                    <Snackbar
                        open={copyNoticeOpen}
                        autoHideDuration={2500}
                        onClose={() => setCopyNoticeOpen(false)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert
                            onClose={() => setCopyNoticeOpen(false)}
                            severity="success"
                            sx={{ borderRadius: 3 }}
                        >
                            {copyNoticeText}
                        </Alert>
                    </Snackbar>

                    <Snackbar
                        open={noticeOpen}
                        autoHideDuration={3600}
                        onClose={() => setNoticeOpen(false)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert onClose={() => setNoticeOpen(false)} severity={noticeSeverity} sx={{ borderRadius: 3 }}>
                            {noticeText}
                        </Alert>
                    </Snackbar>

                    {/* 图例与筛选 */}
                    <Box
                        sx={{
                            position: 'absolute',
                            right: { xs: 12, md: 16 },
                            top: { xs: overlayTopOffset, md: 16 },
                            zIndex: 1200,
                            bgcolor: '#fff',
                            borderRadius: 3,
                            p: legendOpen ? 1.5 : 0.5,
                            minWidth: legendOpen ? 180 : 'auto',
                            boxShadow: '0 10px 24px rgba(116, 73, 136, 0.12)',
                            border: '1px solid rgba(116, 73, 136, 0.12)',
                            pointerEvents: 'none',
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: legendOpen ? 'flex-end' : 'flex-start' }}>
                            <Button
                                size="small"
                                onClick={() => setLegendOpen((v) => !v)}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    color: '#744988',
                                    fontWeight: 700,
                                    px: 1.5,
                                    pointerEvents: 'auto',
                                }}
                            >
                                筛选点位 {legendOpen ? '▲' : '▼'}
                            </Button>
                        </Box>

                        {legendOpen ? (
                            <Box sx={{ mt: 1, pointerEvents: 'auto' }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                    <Typography fontWeight={700}>图例</Typography>
                                    <Stack direction="row" spacing={0.5}>
                                        <Button size="small" onClick={showAllCats} sx={{ minWidth: 0, px: 1 }}>
                                            全选
                                        </Button>
                                        <Button size="small" onClick={hideAllCats} sx={{ minWidth: 0, px: 1 }}>
                                            全不选
                                        </Button>
                                    </Stack>
                                </Stack>
                                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                    <Button
                                        size="small"
                                        variant={ownerFilter === 'all' ? 'contained' : 'outlined'}
                                        onClick={() => setOwnerFilter('all')}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            bgcolor: ownerFilter === 'all' ? '#744988' : 'transparent',
                                            color: ownerFilter === 'all' ? '#fff' : '#744988',
                                            borderColor: 'rgba(116, 73, 136, 0.35)',
                                            '&:hover': {
                                                bgcolor: ownerFilter === 'all' ? '#6b3f80' : 'rgba(116, 73, 136, 0.08)',
                                            },
                                        }}
                                    >
                                        全部
                                    </Button>
                                    <Button
                                        size="small"
                                        variant={ownerFilter === 'mine' ? 'contained' : 'outlined'}
                                        onClick={() => setOwnerFilter('mine')}
                                        disabled={!isLoggedIn}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            bgcolor: ownerFilter === 'mine' ? '#744988' : 'transparent',
                                            color: ownerFilter === 'mine' ? '#fff' : '#744988',
                                            borderColor: 'rgba(116, 73, 136, 0.35)',
                                            '&:hover': {
                                                bgcolor: ownerFilter === 'mine' ? '#6b3f80' : 'rgba(116, 73, 136, 0.08)',
                                            },
                                        }}
                                    >
                                        我添加的
                                    </Button>
                                    <Button
                                        size="small"
                                        variant={ownerFilter === 'fav' ? 'contained' : 'outlined'}
                                        onClick={() => setOwnerFilter('fav')}
                                        disabled={!isLoggedIn}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            bgcolor: ownerFilter === 'fav' ? '#744988' : 'transparent',
                                            color: ownerFilter === 'fav' ? '#fff' : '#744988',
                                            borderColor: 'rgba(116, 73, 136, 0.35)',
                                            '&:hover': {
                                                bgcolor: ownerFilter === 'fav' ? '#6b3f80' : 'rgba(116, 73, 136, 0.08)',
                                            },
                                        }}
                                    >
                                        我收藏的
                                    </Button>
                                </Stack>

                                <FormGroup>
                                    {supportedCategories.map((key) => (
                                        <FormControlLabel
                                            key={key}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={visibleCats[key]}
                                                    onChange={() => toggleCat(key)}
                                                    sx={{
                                                        color: categoryColor[key],
                                                        '&.Mui-checked': { color: categoryColor[key] },
                                                    }}
                                                />
                                            }
                                            label={
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Chip
                                                        size="small"
                                                        sx={{
                                                            bgcolor: categoryColor[key],
                                                            color: '#fff',
                                                            fontWeight: 600,
                                                        }}
                                                        label={categoryLabel[key]}
                                                    />
                                                </Stack>
                                            }
                                        />
                                    ))}
                                </FormGroup>
                            </Box>
                        ) : null}
                    </Box>

                    <MapContainer
                        center={initialCenter}
                        zoom={initialZoom}
                        zoomControl={false}
                        attributionControl
                        touchZoom
                        doubleClickZoom
                        scrollWheelZoom
                        worldCopyJump
                        style={{ height: '100%', width: '100%', touchAction: 'none' }}
                    >
                        <MapReady onReady={handleMapReady} />
                        <TileLayer
                            attribution={sanitizeAttribution(tileProviderConfig[activeTileProvider].attribution)}
                            url={tileProviderConfig[activeTileProvider].url}
                        />
                        {tileProviderConfig[activeTileProvider].labelUrl ? (
                            <TileLayer
                                attribution={sanitizeAttribution(tileProviderConfig[activeTileProvider].attribution)}
                                url={tileProviderConfig[activeTileProvider].labelUrl!}
                            />
                        ) : null}

                        {/* 点击地图创建点 */}
                        <ClickToAdd
                            enabled={addMode && isLoggedIn}
                            onPick={openDraft}
                            onMapTap={() => {
                                if (isMobile && legendOpen) {
                                    setLegendOpen(false)
                                }
                            }}
                        />

                        {/* 已保存的点 */}
                        {filteredMarkers.map((m) => (
                            <Marker
                                key={m.id}
                                position={[m.lat, m.lng]}
                                icon={getMarkerIcon(normalizeCategory(m.category), m.isActive)}
                            >
                                <Popup>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {isLoggedIn ? (
                                            <IconButton size="small" onClick={() => openEdit(m)} aria-label="编辑点位">
                                                <EditRoundedIcon fontSize="small" />
                                            </IconButton>
                                        ) : null}
                                        <Typography fontWeight={700} sx={{ flex: 1 }}>
                                            {m.title}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={async () => {
                                                if (!isLoggedIn) {
                                                    navigate('/login')
                                                    return
                                                }
                                                try {
                                                    if (favoriteIds.has(m.id)) {
                                                        await axios.delete(`/api/markers/${m.id}/favorite`, {
                                                            withCredentials: true,
                                                        })
                                                    } else {
                                                        await axios.post(`/api/markers/${m.id}/favorite`, null, {
                                                            withCredentials: true,
                                                        })
                                                    }
                                                } finally {
                                                    await loadFavorites()
                                                }
                                            }}
                                            aria-label={favoriteIds.has(m.id) ? '取消收藏点位' : '收藏点位'}
                                        >
                                            {favoriteIds.has(m.id) ? (
                                                <StarIcon sx={{ color: '#f6c344' }} />
                                            ) : (
                                                <StarBorderIcon sx={{ color: '#9e9e9e' }} />
                                            )}
                                        </IconButton>
                                    </Box>

                                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                                        {categoryLabel[normalizeCategory(m.category)]}
                                    </Typography>
                                    <Typography variant="caption" sx={{ mt: 0.4, opacity: 0.8, display: 'block' }}>
                                        可用时间：
                                        {m.openTimeStart && m.openTimeEnd
                                            ? `${m.openTimeStart} - ${m.openTimeEnd}`
                                            : '全天'}
                                    </Typography>

                                    {!m.isActive ? (
                                        <Typography variant="body2" sx={{ mt: 0.5, color: '#757575', fontWeight: 600 }}>
                                            此点位暂不可用
                                        </Typography>
                                    ) : null}

                                    {!missingImageMarkerIds.has(m.id) && m.markImage ? (
                                        <Box
                                            component="img"
                                            src={toBackendAssetUrl(m.markImage)}
                                            alt={m.title}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                                setMissingImageMarkerIds((prev) => new Set(prev).add(m.id))
                                            }}
                                            sx={{
                                                mt: 1,
                                                width: '100%',
                                                maxWidth: 260,
                                                maxHeight: 180,
                                                borderRadius: 1.5,
                                                objectFit: 'cover',
                                                display: 'block',
                                            }}
                                        />
                                    ) : null}

                                    {m.description ? (
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            {m.description}
                                        </Typography>
                                    ) : null}

                                    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 1 }}>
                                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                            {m.lat.toFixed(6)}, {m.lng.toFixed(6)}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                copyCoords(m.lat, m.lng)
                                                setCopyNoticeText('坐标已复制')
                                                setCopyNoticeOpen(true)
                                            }}
                                            aria-label="复制坐标"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: 14, color: '#9e9e9e' }} />
                                        </IconButton>
                                    </Stack>
                                </Popup>
                            </Marker>
                        ))}

                        {userLocation ? (
                            <Marker position={userLocation} icon={userLocationIcon} interactive={false} />
                        ) : null}
                    </MapContainer>
            </Box>

            <Drawer
                anchor={isMobile ? 'bottom' : 'right'}
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                PaperProps={{
                    sx: isMobile
                        ? {
                              borderTopLeftRadius: 16,
                              borderTopRightRadius: 16,
                              minHeight: '36vh',
                          }
                        : {
                              width: 320,
                          },
                }}
            >
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography fontWeight={800}>地图设置</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.4 }}>
                        地图来源与附近查询范围
                    </Typography>
                </Box>
                <Stack spacing={2.2} sx={{ p: 2 }}>
                    <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                            地图来源
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {(Object.keys(tileProviderConfig) as TileProvider[]).map((key) => (
                        <Button
                            key={key}
                            size="small"
                            variant={activeTileProvider === key ? 'contained' : 'outlined'}
                            onClick={() => setTileProvider(key)}
                            disabled={
                                (key === 'tf_atlas' && !hasThunderforestKey) ||
                                (key === 'tianditu_vec' && !hasTiandituKey)
                            }
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        minWidth: 0,
                                        px: 1.2,
                                        bgcolor: activeTileProvider === key ? '#744988' : 'transparent',
                                        color: activeTileProvider === key ? '#fff' : '#744988',
                                        borderColor: 'rgba(116, 73, 136, 0.35)',
                                        '&:hover': {
                                            bgcolor: activeTileProvider === key ? '#6b3f80' : 'rgba(116, 73, 136, 0.08)',
                                        },
                                    }}
                                >
                                    {tileProviderConfig[key].label}
                                </Button>
                            ))}
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                            附近查询类型
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            {(['accessible_toilet', 'friendly_clinic'] as NearbyCategory[]).map((key) => (
                                <Button
                                    key={`nearby-cat-${key}`}
                                    size="small"
                                    variant={nearbyCategory === key ? 'contained' : 'outlined'}
                                    onClick={() => setNearbyCategory(key)}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        minWidth: 0,
                                        px: 1.2,
                                        bgcolor: nearbyCategory === key ? '#744988' : 'transparent',
                                        color: nearbyCategory === key ? '#fff' : '#744988',
                                        borderColor: 'rgba(116, 73, 136, 0.35)',
                                        '&:hover': {
                                            bgcolor: nearbyCategory === key ? '#6b3f80' : 'rgba(116, 73, 136, 0.08)',
                                        },
                                    }}
                                >
                                    {nearbyCategoryLabel[key]}
                                </Button>
                            ))}
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                            附近查询范围
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {[1000, 2500].map((radius) => (
                                <Button
                                    key={`radius-${radius}`}
                                    size="small"
                                    variant={nearbyRadius === radius ? 'contained' : 'outlined'}
                                    onClick={() => setNearbyRadius(radius)}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        minWidth: 0,
                                        px: 1.6,
                                        bgcolor: nearbyRadius === radius ? '#744988' : 'transparent',
                                        color: nearbyRadius === radius ? '#fff' : '#744988',
                                        borderColor: 'rgba(116, 73, 136, 0.35)',
                                        '&:hover': {
                                            bgcolor: nearbyRadius === radius ? '#6b3f80' : 'rgba(116, 73, 136, 0.08)',
                                        },
                                    }}
                                >
                                    {radius}m
                                </Button>
                            ))}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.2, alignItems: 'flex-start' }}>
                            <TextField
                                size="small"
                                label="自定义(m)"
                                value={nearbyRadiusInput}
                                onChange={(e) => {
                                    setNearbyRadiusInput(e.target.value)
                                    if (nearbyRadiusError) setNearbyRadiusError('')
                                }}
                                onBlur={applyNearbyRadiusInput}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        applyNearbyRadiusInput()
                                    }
                                }}
                                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0, max: 10000 }}
                                error={Boolean(nearbyRadiusError)}
                                helperText={nearbyRadiusError || ' '}
                                sx={{ width: 128 }}
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={applyNearbyRadiusInput}
                                sx={{
                                    minWidth: 64,
                                    height: 40,
                                    flexShrink: 0,
                                    px: 1.6,
                                    borderRadius: 2.2,
                                    textTransform: 'none',
                                    whiteSpace: 'nowrap',
                                    color: '#744988',
                                    borderColor: 'rgba(116, 73, 136, 0.35)',
                                    '&:hover': { borderColor: '#744988', bgcolor: 'rgba(116, 73, 136, 0.08)' },
                                }}
                            >
                                应用
                            </Button>
                        </Stack>
                        <Typography variant="caption" sx={{ opacity: 0.68 }}>
                            范围 0-10000m，超出会自动修正。
                        </Typography>
                    </Box>
                </Stack>
            </Drawer>

            <Drawer
                anchor={isMobile ? 'bottom' : 'right'}
                open={nearbyPanelOpen}
                onClose={closeNearbyPanel}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: isMobile
                        ? {
                              borderTopLeftRadius: 16,
                              borderTopRightRadius: 16,
                              height: '52vh',
                          }
                        : {
                              width: 360,
                          },
                }}
            >
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography fontWeight={800}>
                        附近 {nearbyRadius}m {nearbyCategoryLabel[nearbyCategory]}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                        共 {nearbyResults.length} 个结果，点击可在地图上定位
                    </Typography>
                </Box>
                <Box sx={{ p: 1.5, overflowY: 'auto' }}>
                    <Stack spacing={1.2}>
                        {nearbyResults.map((m) => (
                            <Card
                                key={`nearby-${m.id}`}
                                variant="outlined"
                                onClick={() => {
                                    focusMarkerOnMap(m)
                                    if (isMobile) setNearbyPanelOpen(false)
                                }}
                                sx={{
                                    cursor: 'pointer',
                                    borderRadius: 3,
                                    borderColor: 'rgba(116, 73, 136, 0.15)',
                                    '&:hover': {
                                        boxShadow: '0 8px 18px rgba(116, 73, 136, 0.12)',
                                    },
                                }}
                            >
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                                        <Typography fontWeight={700}>{m.title}</Typography>
                                        <Chip
                                            size="small"
                                            label={`${Math.round(m.distanceMeters)} m`}
                                            sx={{ bgcolor: 'rgba(116, 73, 136, 0.10)', color: '#744988' }}
                                        />
                                    </Stack>
                                    <Typography variant="body2" sx={{ mt: 0.6 }}>
                                        {categoryLabel[normalizeCategory(m.category)]}
                                    </Typography>
                                    {!m.isActive ? (
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                mt: 0.5,
                                                color: '#8a5a00',
                                                fontWeight: 700,
                                            }}
                                        >
                                            当前不可用
                                            {m.openTimeStart && m.openTimeEnd
                                                ? `（可用时段 ${m.openTimeStart} - ${m.openTimeEnd}）`
                                                : ''}
                                        </Typography>
                                    ) : null}
                                    {m.description ? (
                                        <Typography variant="body2" sx={{ mt: 0.6, opacity: 0.8 }}>
                                            {m.description}
                                        </Typography>
                                    ) : null}
                                    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.8 }}>
                                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                            {m.lat.toFixed(6)}, {m.lng.toFixed(6)}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                copyCoords(m.lat, m.lng)
                                                setCopyNoticeText('坐标已复制')
                                                setCopyNoticeOpen(true)
                                            }}
                                            aria-label="复制坐标"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: 14, color: '#9e9e9e' }} />
                                        </IconButton>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                </Box>
            </Drawer>

            <MarkerFormDialog
                open={dialogOpen}
                draft={draft}
                editingId={editingId}
                canDelete={canDeleteDraft}
                categoryLabel={categoryLabel}
                markImageFile={markImageFile}
                setDraft={setDraft}
                onClose={closeDraft}
                onSave={saveDraft}
                onDelete={() => {
                    if (!editingId) return
                    setDeleteConfirmOpen(true)
                }}
                onMarkImageChange={(f) => setMarkImageFile(f)}
            />

            <Dialog
                open={deleteConfirmOpen}
                onClose={() => (deleting ? undefined : setDeleteConfirmOpen(false))}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle sx={{ pb: 1 }}>确认删除点位？</DialogTitle>
                <DialogContent sx={{ pt: '8px !important' }}>
                    <DialogContentText>
                        删除后将无法恢复。你确定要删除这个点位吗？
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 2, pb: 2 }}>
                    <Button
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={deleting}
                        variant="outlined"
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={confirmDeleteMarker}
                        disabled={deleting}
                        color="error"
                        variant="contained"
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                        {deleting ? '删除中...' : '确认删除'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    )
}
