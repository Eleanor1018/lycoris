import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import axios from 'axios'
import type { MarkerCategory } from '../types/marker'

const searchPinPath =
    'M319 562C333.025 562 345.031 556.987 355.019 546.96C365.006 536.933 370 524.88 370 510.8C370 496.72 365.006 484.667 355.019 474.64C345.031 464.613 333.025 459.6 319 459.6C304.975 459.6 292.969 464.613 282.981 474.64C272.994 484.667 268 496.72 268 510.8C268 524.88 272.994 536.933 282.981 546.96C292.969 556.987 304.975 562 319 562ZM319 750.16C370.85 702.373 409.313 658.96 434.388 619.92C459.463 580.88 472 546.213 472 515.92C472 469.413 457.231 431.333 427.694 401.68C398.156 372.027 361.925 357.2 319 357.2C276.075 357.2 239.844 372.027 210.306 401.68C180.769 431.333 166 469.413 166 515.92C166 546.213 178.538 580.88 203.613 619.92C228.688 658.96 267.15 702.373 319 750.16ZM319 818C250.575 759.547 199.469 705.253 165.681 655.12C131.894 604.987 115 558.587 115 515.92C115 451.92 135.506 400.933 176.519 362.96C217.531 324.987 265.025 306 319 306C372.975 306 420.469 324.987 461.481 362.96C502.494 400.933 523 451.92 523 515.92C523 558.587 506.106 604.987 472.319 655.12C438.531 705.253 387.425 759.547 319 818Z'

type ApiMarker = {
    id: number
    lat: number
    lng: number
    category: MarkerCategory
    title: string
    description?: string
    isPublic: boolean
    isActive: boolean
    markImage?: string | null
    username: string
    userPublicId?: string | null
}

type DocItem = {
    slug: string
    title: string
    content: string
}

const mdModules = import.meta.glob<string>('../docs/*.md', { query: '?raw', import: 'default' })

const orderedDocs = [
    { slug: 'about', title: '关于夏水仙' },
    { slug: 'nora-hrt-guide', title: '雪雁的HRT指南（MTF）' },
]

const markerCategoryLabel: Record<MarkerCategory, string> = {
    accessible_toilet: '无障碍卫生间',
    friendly_clinic: '友好医疗机构',
    baby_room: '母婴室',
    self_definition: '自定义',
}

const cleanDocText = (s: string) =>
    s
        .replace(/&ensp;|&emsp;|&nbsp;/g, ' ')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[#>*_~`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const getDocTitle = (slug: string, content: string) => {
    const match = content.match(/^\uFEFF?#\s+(.+)$/m)
    if (match?.[1]) return cleanDocText(match[1])
    const hit = orderedDocs.find((d) => d.slug === slug)
    return hit?.title ?? slug
}

const normalize = (s: string) => s.toLowerCase()
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const snippetFrom = (content: string, q: string) => {
    if (!q) return ''
    const raw = cleanDocText(content)
    const lower = normalize(raw)
    const idx = lower.indexOf(normalize(q))
    if (idx < 0) return ''
    const start = Math.max(0, idx - 30)
    const end = Math.min(raw.length, idx + q.length + 30)
    const snippet = raw.slice(start, end)
    return `${start > 0 ? '…' : ''}${snippet}${end < raw.length ? '…' : ''}`
}

const highlightText = (text: string, q: string) => {
    const needle = q.trim()
    if (!needle) return text
    const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'ig'))
    return parts.map((part, idx) =>
        part.toLowerCase() === needle.toLowerCase() ? (
            <Box
                key={idx}
                component="span"
                sx={{
                    bgcolor: 'rgba(208, 188, 255, 0.46)',
                    color: 'var(--ly-color-ink)',
                    px: 0.5,
                    borderRadius: 1,
                }}
            >
                {part}
            </Box>
        ) : (
            <Box key={idx} component="span">
                {part}
            </Box>
        )
    )
}

export default function Search() {
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const qParam = params.get('q') ?? ''
    const [query, setQuery] = useState(qParam)
    const [markers, setMarkers] = useState<ApiMarker[]>([])
    const [docs, setDocs] = useState<DocItem[]>([])
    const [loadingMarkers, setLoadingMarkers] = useState(false)

    useEffect(() => {
        setQuery(qParam)
    }, [qParam])

    useEffect(() => {
        const loadDocs = async () => {
            const entries = Object.entries(mdModules)
            const loaded = await Promise.all(
                entries.map(async ([key, loader]) => {
                    const slug = key.split('/').pop()?.replace('.md', '') ?? key
                    const content = await loader()
                    return {
                        slug,
                        title: getDocTitle(slug, content),
                        content,
                    } as DocItem
                })
            )
            setDocs(loaded)
        }
        void loadDocs()
    }, [])

    useEffect(() => {
        const run = async () => {
            const q = query.trim()
            if (!q) {
                setMarkers([])
                return
            }
            setLoadingMarkers(true)
            try {
                const res = await axios.get<ApiMarker[]>('/api/markers/search', {
                    params: { q },
                    withCredentials: true,
                })
                setMarkers(res.data ?? [])
            } finally {
                setLoadingMarkers(false)
            }
        }
        void run()
    }, [query])

    const matchedDocs = useMemo(() => {
        const q = query.trim()
        if (!q) return []
        return docs
            .map((d) => ({
                ...d,
                snippet: snippetFrom(d.content, q),
            }))
            .filter((d) => normalize(d.content).includes(normalize(q)))
    }, [docs, query])

    return (
        <Box
            component="section"
            sx={{
                position: 'relative',
                overflow: 'hidden',
                minHeight: 'calc(100svh - var(--nav-height, 94px))',
                px: { xs: 2, md: 'clamp(32px, 5vw, 72px)' },
                py: { xs: 3, md: 5 },
                background: 'linear-gradient(180deg, #f6f6f6 0%, #f6f6f6 52%, #f8ebff 100%)',
            }}
        >
            <Box
                component="svg"
                viewBox="0 0 402 874"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
                sx={{
                    position: 'absolute',
                    right: { xs: '-70%', md: '-10%' },
                    bottom: { xs: '-24%', md: '-30%' },
                    width: { xs: '138%', md: '54%' },
                    height: { xs: '92%', md: '118%' },
                    color: 'var(--ly-color-pin)',
                    pointerEvents: 'none',
                }}
            >
                <path d={searchPinPath} fill="currentColor" fillOpacity="0.18" />
            </Box>

            <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1120, mx: 'auto' }}>
                <Box
                    sx={{
                        borderRadius: '21px',
                        p: { xs: 3, md: 4 },
                        mb: { xs: 3, md: 4 },
                        bgcolor: 'rgba(255, 255, 255, 0.72)',
                        border: '2px solid rgba(221, 165, 196, 0.31)',
                        boxShadow: '0 24px 70px rgba(90, 56, 80, 0.10)',
                        backdropFilter: 'blur(22px)',
                        WebkitBackdropFilter: 'blur(22px)',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                        justifyContent="space-between"
                        sx={{ mb: 2.5 }}
                    >
                        <Box>
                            <Typography
                                component="h1"
                                sx={{
                                    m: 0,
                                    fontFamily: 'var(--ly-font-logo)',
                                    fontSize: { xs: 36, md: 44 },
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    letterSpacing: '-0.035em',
                                    color: '#000',
                                }}
                            >
                                搜索
                            </Typography>
                            <Typography
                                sx={{
                                    mt: 1,
                                    fontFamily: 'var(--ly-font-body)',
                                    fontSize: { xs: 15, md: 16 },
                                    lineHeight: 1.65,
                                    color: 'var(--ly-color-muted)',
                                }}
                            >
                                搜索点位与文档内容，找到有用的信息
                            </Typography>
                        </Box>
                        <Chip
                            label={query.trim() ? `关键词：${query.trim()}` : '输入关键词开始搜索'}
                            sx={{
                                maxWidth: '100%',
                                borderRadius: 999,
                                bgcolor: 'rgba(208, 188, 255, 0.46)',
                                color: 'var(--ly-color-ink)',
                                fontWeight: 700,
                            }}
                        />
                    </Stack>

                    <TextField
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="输入关键词"
                        fullWidth
                        inputProps={{
                            'aria-label': '搜索关键词',
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                minHeight: 56,
                                borderRadius: 999,
                                bgcolor: 'rgba(255, 255, 255, 0.88)',
                                pr: 0.75,
                                '& fieldset': {
                                    borderColor: 'rgba(90, 56, 80, 0.22)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(90, 56, 80, 0.42)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'var(--ly-color-lilac)',
                                    borderWidth: 2,
                                },
                            },
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: 'var(--ly-color-ink)' }} />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <IconButton
                                    onClick={() => navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
                                    disabled={!query.trim()}
                                    aria-label="执行搜索"
                                    sx={{
                                        width: 46,
                                        height: 46,
                                        bgcolor: 'var(--ly-color-lilac)',
                                        color: 'var(--ly-color-ink)',
                                        '&:hover': { bgcolor: '#c8afff' },
                                        '&.Mui-disabled': {
                                            bgcolor: 'rgba(208, 188, 255, 0.36)',
                                            color: 'rgba(90, 56, 80, 0.42)',
                                        },
                                    }}
                                >
                                    <SearchIcon fontSize="small" />
                                </IconButton>
                            ),
                        }}
                    />
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: { xs: 2.5, md: 3 },
                        alignItems: 'start',
                    }}
                >
                    <Box
                        sx={{
                            borderRadius: '21px',
                            p: { xs: 2.25, md: 2.75 },
                            bgcolor: 'rgba(255, 255, 255, 0.68)',
                            border: '1px solid rgba(221, 165, 196, 0.28)',
                            boxShadow: '0 18px 48px rgba(90, 56, 80, 0.08)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                        }}
                    >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#000' }}>
                                点位结果
                            </Typography>
                            <Chip
                                label={loadingMarkers ? '加载中…' : `${markers.length} 条`}
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(252, 221, 236, 0.72)',
                                    color: 'var(--ly-color-ink)',
                                    fontWeight: 700,
                                }}
                            />
                        </Stack>

                        <Stack spacing={1.5}>
                            {markers.map((m) => (
                                <Card
                                    key={m.id}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 4,
                                        borderColor: 'rgba(221, 165, 196, 0.35)',
                                        bgcolor: 'rgba(255, 255, 255, 0.78)',
                                        transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            borderColor: 'rgba(90, 56, 80, 0.36)',
                                            boxShadow: '0 14px 30px rgba(90, 56, 80, 0.12)',
                                        },
                                        cursor: 'pointer',
                                    }}
                                    onClick={() =>
                                        navigate(
                                            `/maps?markerId=${m.id}&lat=${encodeURIComponent(
                                                m.lat
                                            )}&lng=${encodeURIComponent(m.lng)}&title=${encodeURIComponent(m.title)}`
                                        )
                                    }
                                >
                                    <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
                                        <Typography fontWeight={800} sx={{ color: '#000' }}>
                                            {highlightText(m.title, query)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(17, 24, 39, 0.76)', mt: 0.75 }}>
                                            {m.description ? highlightText(m.description, query) : '暂无描述'}
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                                            <Chip
                                                label={markerCategoryLabel[m.category] ?? m.category}
                                                size="small"
                                                sx={{
                                                    bgcolor: 'rgba(208, 188, 255, 0.38)',
                                                    color: 'var(--ly-color-ink)',
                                                }}
                                            />
                                            <Chip
                                                label={`${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}`}
                                                size="small"
                                                sx={{
                                                    bgcolor: 'rgba(246, 246, 246, 0.86)',
                                                    color: 'rgba(17, 24, 39, 0.68)',
                                                }}
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                            {!loadingMarkers && markers.length === 0 ? (
                                <Box
                                    sx={{
                                        borderRadius: 4,
                                        p: 2.5,
                                        bgcolor: 'rgba(255, 255, 255, 0.52)',
                                        border: '1px dashed rgba(90, 56, 80, 0.26)',
                                        color: 'var(--ly-color-muted)',
                                    }}
                                >
                                    <Typography variant="body2">
                                        {query.trim() ? '暂无点位匹配' : '输入关键词后会在这里显示点位结果'}
                                    </Typography>
                                </Box>
                            ) : null}
                        </Stack>
                    </Box>

                    <Box
                        sx={{
                            borderRadius: '21px',
                            p: { xs: 2.25, md: 2.75 },
                            bgcolor: 'rgba(255, 255, 255, 0.68)',
                            border: '1px solid rgba(221, 165, 196, 0.28)',
                            boxShadow: '0 18px 48px rgba(90, 56, 80, 0.08)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                        }}
                    >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#000' }}>
                                文档结果
                            </Typography>
                            <Chip
                                label={`${matchedDocs.length} 条`}
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(252, 221, 236, 0.72)',
                                    color: 'var(--ly-color-ink)',
                                    fontWeight: 700,
                                }}
                            />
                        </Stack>

                        <Stack spacing={1.5}>
                            {matchedDocs.map((d) => (
                                <Card
                                    key={d.slug}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 4,
                                        borderColor: 'rgba(221, 165, 196, 0.35)',
                                        bgcolor: 'rgba(255, 255, 255, 0.78)',
                                        transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            borderColor: 'rgba(90, 56, 80, 0.36)',
                                            boxShadow: '0 14px 30px rgba(90, 56, 80, 0.12)',
                                        },
                                    }}
                                >
                                    <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
                                        <Typography fontWeight={800} sx={{ color: '#000' }}>
                                            {highlightText(d.title, query)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(17, 24, 39, 0.76)', mt: 0.75 }}>
                                            {d.snippet ? highlightText(d.snippet, query) : '已命中关键词'}
                                        </Typography>
                                        <Button
                                            size="small"
                                            sx={{
                                                mt: 1.5,
                                                borderRadius: 999,
                                                px: 1.75,
                                                color: 'var(--ly-color-ink)',
                                                bgcolor: 'rgba(208, 188, 255, 0.34)',
                                                '&:hover': { bgcolor: 'rgba(208, 188, 255, 0.52)' },
                                            }}
                                            onClick={() => navigate(`/documents/${d.slug}`)}
                                        >
                                            打开文档
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {matchedDocs.length === 0 ? (
                                <Box
                                    sx={{
                                        borderRadius: 4,
                                        p: 2.5,
                                        bgcolor: 'rgba(255, 255, 255, 0.52)',
                                        border: '1px dashed rgba(90, 56, 80, 0.26)',
                                        color: 'var(--ly-color-muted)',
                                    }}
                                >
                                    <Typography variant="body2">
                                        {query.trim() ? '暂无文档匹配' : '输入关键词后会在这里显示文档结果'}
                                    </Typography>
                                </Box>
                            ) : null}
                        </Stack>
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}
