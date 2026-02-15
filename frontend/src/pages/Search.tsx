import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import axios from 'axios'
import type { MarkerCategory } from '../types/marker'

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
    { slug: 'intro', title: '夏水仙的介绍' },
    { slug: 'hrt', title: 'HRT 的文档' },
]

const getDocTitle = (slug: string, content: string) => {
    const match = content.match(/^#\s+(.+)$/m)
    if (match?.[1]) return match[1].trim()
    const hit = orderedDocs.find((d) => d.slug === slug)
    return hit?.title ?? slug
}

const normalize = (s: string) => s.toLowerCase()

const snippetFrom = (content: string, q: string) => {
    if (!q) return ''
    const raw = content.replace(/\s+/g, ' ')
    const lower = normalize(raw)
    const idx = lower.indexOf(normalize(q))
    if (idx < 0) return ''
    const start = Math.max(0, idx - 30)
    const end = Math.min(raw.length, idx + q.length + 30)
    const snippet = raw.slice(start, end)
    return `${start > 0 ? '…' : ''}${snippet}${end < raw.length ? '…' : ''}`
}

const highlightText = (text: string, q: string) => {
    if (!q.trim()) return text
    const parts = text.split(new RegExp(`(${q})`, 'ig'))
    return parts.map((part, idx) =>
        part.toLowerCase() === q.toLowerCase() ? (
            <Box
                key={idx}
                component="span"
                sx={{
                    bgcolor: 'rgba(116, 73, 136, 0.15)',
                    color: '#4d2b62',
                    px: 0.5,
                    borderRadius: 0.5,
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
            sx={{
                px: { xs: 2, md: 4 },
                py: { xs: 2.5, md: 3.5 },
                maxWidth: 980,
                mx: 'auto',
            }}
        >
            <Box
                sx={{
                    borderRadius: 4,
                    p: { xs: 2, md: 3 },
                    mb: 3,
                    bgcolor: 'rgba(116, 73, 136, 0.06)',
                    border: '1px solid rgba(116, 73, 136, 0.12)',
                }}
            >
                <Typography variant="h4" fontWeight={800}>
                    搜索
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                    支持搜索点位与文档内容
                </Typography>

                <TextField
                    size="small"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="输入关键词"
                    fullWidth
                    sx={{
                        mt: 2,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 999,
                            bgcolor: '#fff',
                        },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <IconButton
                                onClick={() => navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
                                disabled={!query.trim()}
                                sx={{
                                    ml: 1,
                                    bgcolor: '#744988',
                                    color: '#fff',
                                    '&:hover': { bgcolor: '#6b3f80' },
                                }}
                            >
                                <SearchIcon fontSize="small" />
                            </IconButton>
                        ),
                    }}
                />
            </Box>

            <Stack spacing={3}>
                <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6" fontWeight={700}>
                            点位搜索结果
                        </Typography>
                        <Chip
                            label={loadingMarkers ? '加载中…' : `共 ${markers.length} 条`}
                            size="small"
                            sx={{
                                bgcolor: 'rgba(116, 73, 136, 0.10)',
                                color: '#744988',
                                fontWeight: 600,
                            }}
                        />
                    </Stack>

                    <Stack spacing={1.5}>
                        {markers.map((m) => (
                            <Card
                                key={m.id}
                                variant="outlined"
                                sx={{
                                    borderRadius: 3,
                                    borderColor: 'rgba(116, 73, 136, 0.15)',
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 10px 24px rgba(116, 73, 136, 0.12)',
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
                                <CardContent>
                                    <Typography fontWeight={700}>{highlightText(m.title, query)}</Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                                        {m.description ? highlightText(m.description, query) : '暂无描述'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
                                        {m.category} · {m.lat.toFixed(6)}, {m.lng.toFixed(6)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                        {!loadingMarkers && markers.length === 0 ? (
                            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                暂无点位匹配
                            </Typography>
                        ) : null}
                    </Stack>
                </Box>

                <Divider />

                <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6" fontWeight={700}>
                            文档搜索结果
                        </Typography>
                        <Chip
                            label={`共 ${matchedDocs.length} 条`}
                            size="small"
                            sx={{
                                bgcolor: 'rgba(116, 73, 136, 0.10)',
                                color: '#744988',
                                fontWeight: 600,
                            }}
                        />
                    </Stack>

                    <Stack spacing={1.5}>
                        {matchedDocs.map((d) => (
                            <Card
                                key={d.slug}
                                variant="outlined"
                                sx={{
                                    borderRadius: 3,
                                    borderColor: 'rgba(116, 73, 136, 0.15)',
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 10px 24px rgba(116, 73, 136, 0.12)',
                                    },
                                }}
                            >
                                <CardContent>
                                    <Typography fontWeight={700}>{highlightText(d.title, query)}</Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                                        {d.snippet ? highlightText(d.snippet, query) : '已命中关键词'}
                                    </Typography>
                                    <Button
                                        size="small"
                                        sx={{ mt: 1, color: '#744988' }}
                                        onClick={() => navigate(`/documents/${d.slug}`)}
                                    >
                                        打开文档
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                        {matchedDocs.length === 0 ? (
                            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                暂无文档匹配
                            </Typography>
                        ) : null}
                    </Stack>
                </Box>
            </Stack>
        </Box>
    )
}
