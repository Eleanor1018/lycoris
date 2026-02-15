import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    Box,
    Collapse,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Typography,
    useMediaQuery,
    useTheme,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Slider,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import Slugger from 'github-slugger'

const mdModules = import.meta.glob<string>('../docs/*.md', { query: '?raw', import: 'default' })

async function loadAboutDoc(): Promise<string> {
    const loader = mdModules['../docs/about.md']
    if (!loader) throw new Error('Doc not found: about.md')
    return await loader()
}

const drawerWidth = 280
const NAV_OFFSET_VAR = 'var(--nav-offset, var(--nav-height, 72px))'
const NAV_HEIGHT_VAR_MOBILE = 'var(--nav-height, 56px)'
const READING_PREFS_KEY = 'docs.readingPrefs'

const fontOptions = [
    { value: 'default', label: '默认无衬线', stack: '"Inter","Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",sans-serif' },
    { value: 'serif', label: '衬线体', stack: '"Source Han Serif SC","Noto Serif SC","Songti SC","STSong","SimSun",serif' },
    { value: 'mono', label: '等宽体', stack: '"JetBrains Mono","Fira Code","Noto Sans Mono CJK SC","Cascadia Mono",monospace' },
] as const

type FontOptionValue = (typeof fontOptions)[number]['value']

type TocItem = {
    level: 2 | 3 | 4
    text: string
    id: string
}

const headingRegex = /^#{2,4}\s+(.+)$/gm

const sanitizeHeadingText = (raw: string) =>
    raw
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/[`*_~]/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()

const buildToc = (markdown: string): TocItem[] => {
    const items: TocItem[] = []
    const slugger = new Slugger()
    let match: RegExpExecArray | null

    while ((match = headingRegex.exec(markdown)) !== null) {
        const full = match[0]
        const rawText = match[1]
        const level = (full.match(/^#+/)?.[0].length ?? 0) as 2 | 3 | 4
        if (level < 2 || level > 4) continue

        const text = sanitizeHeadingText(rawText)
        if (!text) continue

        const id = slugger.slug(text)

        items.push({ level, text, id })
    }

    return items
}

export default function About() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const navigate = useNavigate()
    const location = useLocation()

    const [content, setContent] = useState<string>('# Loading...')
    const [err, setErr] = useState('')
    const [tocItems, setTocItems] = useState<TocItem[]>([])
    const [mobileOpen, setMobileOpen] = useState(false)
    const [aboutOpen, setAboutOpen] = useState(true)
    const [fontSize, setFontSize] = useState<number>(() => {
        if (typeof window === 'undefined') return 15
        try {
            const raw = window.localStorage.getItem(READING_PREFS_KEY)
            if (!raw) return 15
            const parsed = JSON.parse(raw) as { fontSize?: number }
            const n = Number(parsed.fontSize)
            if (!Number.isFinite(n)) return 15
            return Math.max(13, Math.min(22, Math.round(n)))
        } catch {
            return 15
        }
    })
    const [fontFamilyKey, setFontFamilyKey] = useState<FontOptionValue>(() => {
        if (typeof window === 'undefined') return 'default'
        try {
            const raw = window.localStorage.getItem(READING_PREFS_KEY)
            if (!raw) return 'default'
            const parsed = JSON.parse(raw) as { fontFamilyKey?: string }
            return fontOptions.some((f) => f.value === parsed.fontFamilyKey)
                ? (parsed.fontFamilyKey as FontOptionValue)
                : 'default'
        } catch {
            return 'default'
        }
    })
    const fontScale = useMemo(() => fontSize / 15, [fontSize])
    const selectedFontFamily = useMemo(
        () => fontOptions.find((f) => f.value === fontFamilyKey)?.stack ?? fontOptions[0].stack,
        [fontFamilyKey]
    )

    useEffect(() => {
        let alive = true
        void loadAboutDoc()
            .then((md) => {
                if (!alive) return
                setContent(md)
                setTocItems(buildToc(md))
            })
            .catch((e) => {
                if (!alive) return
                setErr(String(e?.message ?? e))
                setContent('# 文档加载失败')
                setTocItems([])
            })

        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        if (!location.hash) return
        const id = decodeURIComponent(location.hash.replace('#', ''))
        if (!id) return
        const el = document.getElementById(id)
        if (!el) return
        const handle = window.setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 0)
        return () => window.clearTimeout(handle)
    }, [location.hash, content])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(READING_PREFS_KEY, JSON.stringify({ fontSize, fontFamilyKey }))
    }, [fontSize, fontFamilyKey])

    const drawer = useMemo(
        () => (
            <Box sx={{ width: drawerWidth, px: 1.5 }}>
                <List dense>
                    <ListItemButton
                        onClick={() => setAboutOpen((prev) => !prev)}
                        sx={{
                            mt: 1,
                            borderRadius: 2,
                            fontWeight: 700,
                            bgcolor: 'rgba(25, 118, 210, 0.08)',
                        }}
                    >
                        <ListItemText primary="关于夏水仙" />
                        {aboutOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>

                    <Collapse in={aboutOpen} timeout="auto" unmountOnExit>
                        <Box
                            sx={{
                                mt: 0.5,
                                mb: 0.5,
                                borderRadius: 3,
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                px: 0.5,
                                py: 0.5,
                            }}
                        >
                            <List dense disablePadding>
                                {tocItems.map((item) => (
                                    <ListItemButton
                                        key={item.id}
                                        onClick={() => {
                                            navigate(`/about#${item.id}`)
                                            if (isMobile) setMobileOpen(false)
                                        }}
                                        sx={{
                                            borderRadius: 2,
                                            px: item.level === 2 ? 2 : item.level === 3 ? 3 : 4,
                                        }}
                                    >
                                        <ListItemText primary={item.text} />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>
                    </Collapse>
                </List>
            </Box>
        ),
        [aboutOpen, isMobile, navigate, tocItems]
    )

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {!isMobile && (
                <Drawer
                    variant="permanent"
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                            borderRadius: 0,
                            top: NAV_OFFSET_VAR,
                            height: `calc(100vh - ${NAV_OFFSET_VAR})`,
                            paddingTop: 0,
                        },
                    }}
                >
                    <Box
                        sx={{
                            px: 2.75,
                            py: 1.2,
                            bgcolor: '#fff',
                            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                        }}
                    >
                        <Typography
                            sx={{
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                color: 'text.primary',
                                fontSize: '0.95rem',
                            }}
                        >
                            目录
                        </Typography>
                    </Box>
                    <Divider />
                    {drawer}
                </Drawer>
            )}

            {isMobile && (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                            borderRadius: 0,
                            top: NAV_HEIGHT_VAR_MOBILE,
                            height: `calc(100vh - ${NAV_HEIGHT_VAR_MOBILE})`,
                            paddingTop: 0,
                        },
                    }}
                >
                    {drawer}
                </Drawer>
            )}

            {isMobile && (
                <IconButton
                    onClick={() => setMobileOpen(true)}
                    aria-label="open toc"
                    sx={{
                        position: 'fixed',
                        right: 16,
                        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                        zIndex: 1300,
                        width: 46,
                        height: 46,
                        bgcolor: '#7a4b8f',
                        color: '#fff',
                        boxShadow: '0 10px 24px rgba(122, 75, 143, 0.34)',
                        '&:hover': { bgcolor: '#6b3f80' },
                    }}
                >
                    <MenuIcon />
                </IconButton>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ px: { xs: 2, md: 6, xl: 9 }, py: { xs: 1.25, md: 3 } }}>
                    {err ? (
                        <Typography color="error" sx={{ mb: 2 }}>
                            {err}
                        </Typography>
                    ) : null}

                    <Box
                        sx={{
                            fontSize,
                            fontFamily: selectedFontFamily,
                            lineHeight: 1.72,
                            '& h1': { fontSize: { xs: `${Math.round(26 * fontScale)}px`, md: `${Math.round(30 * fontScale)}px` }, lineHeight: 1.25, mb: 1.25 },
                            '& h2': { fontSize: { xs: `${Math.round(20 * fontScale)}px`, md: `${Math.round(22 * fontScale)}px` }, lineHeight: 1.3, mt: 2.5, mb: 1.1, scrollMarginTop: 90 },
                            '& h3': { fontSize: { xs: `${Math.round(17 * fontScale)}px`, md: `${Math.round(18 * fontScale)}px` }, lineHeight: 1.35, mt: 2, mb: 0.9, scrollMarginTop: 90 },
                            '& h4': { scrollMarginTop: 90 },
                            '& p': { my: 1.1, fontSize: `${fontSize}px` },
                            '& li': { my: 0.5, fontSize: `${fontSize}px` },
                            '& code': {
                                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                                fontSize: '0.92em',
                            },
                            '& img': {
                                width: { xs: '260px', md: '600px', xl: '900px' },
                                maxWidth: '100%',
                                height: 'auto',
                                display: 'block',
                                margin: '12px auto',
                            },
                        }}
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                            {content}
                        </ReactMarkdown>
                    </Box>
                </Box>
            </Box>

            {!isMobile && (
                <Box
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        borderLeft: '1px solid rgba(122, 75, 143, 0.14)',
                        bgcolor: 'rgba(255,255,255,0.82)',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <Box
                        sx={{
                            position: 'sticky',
                            top: NAV_OFFSET_VAR,
                            height: `calc(100vh - ${NAV_OFFSET_VAR})`,
                            overflowY: 'auto',
                            px: 2,
                            py: 2,
                        }}
                    >
                        <Typography fontWeight={800} sx={{ mb: 1.6 }}>
                            阅读设置
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.72, mb: 1.6 }}>
                            仅影响当前文档排版
                        </Typography>

                        <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                            字号
                        </Typography>
                        <Slider
                            value={fontSize}
                            min={13}
                            max={22}
                            step={1}
                            valueLabelDisplay="auto"
                            onChange={(_, value) => setFontSize(value as number)}
                            sx={{ mb: 2.4 }}
                        />

                        <FormControl fullWidth size="small">
                            <InputLabel id="about-font-label">字体</InputLabel>
                            <Select
                                labelId="about-font-label"
                                label="字体"
                                value={fontFamilyKey}
                                onChange={(e) => setFontFamilyKey(e.target.value as FontOptionValue)}
                            >
                                {fontOptions.map((f) => (
                                    <MenuItem key={f.value} value={f.value}>
                                        {f.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>
            )}
        </Box>
    )
}
