import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import AuthButtons from "./AuthButtons.tsx";
import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Chip,
    Stack,
    TextField,
    InputAdornment,
    IconButton,
    Drawer,
    Divider,
    List,
    ListItemButton,
    ListItemText,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'

import logo from '@/images/LycorisIcon.png'
import {useAuth} from "../auth/AuthProvider.tsx";

type NavItem = { label: string; to: string }


export default function NavigationBar() {
    const location = useLocation()
    const navigate = useNavigate()
    const {isLoggedIn, user, logout} = useAuth()
    const toolbarRef = useRef<HTMLDivElement | null>(null)
    const lastScrollYRef = useRef(0)
    const theme = useTheme()
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
    const [isNavCollapsed, setIsNavCollapsed] = useState(false)
    const navCollapsed = isDesktop && isNavCollapsed

    const navItems: NavItem[] = useMemo(
        () => [
            { label: '地图', to: '/maps' },
            { label: 'HRT指南', to: '/documents' },
            { label: '关于', to: '/about' },
        ],
        []
    )

    const isActive = (to: string) => location.pathname === to

    const hoverColor = '#744988'
    const buttonFontSize = 15

    const [q, setQ] = useState('')

    const [navOpen, setNavOpen] = useState(false)
    const toggleNavMenu = () => setNavOpen((prev) => !prev)
    const closeNavMenu = () => setNavOpen(false)


    useEffect(() => {
        const el = toolbarRef.current
        if (!el) return
        const update = () => {
            const height = Math.round(el.getBoundingClientRect().height)
            if (height > 0) {
                document.documentElement.style.setProperty('--nav-height', `${height}px`)
            }
        }
        update()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(() => update())
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!isDesktop) return

        lastScrollYRef.current = window.scrollY
        const onScroll = () => {
            const current = window.scrollY
            const delta = current - lastScrollYRef.current

            if (current <= 12) {
                setIsNavCollapsed(false)
            } else if (delta > 8) {
                setIsNavCollapsed(true)
            } else if (delta < -8) {
                setIsNavCollapsed(false)
            }
            lastScrollYRef.current = current
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [isDesktop])

    useEffect(() => {
        document.documentElement.style.setProperty(
            '--nav-offset',
            navCollapsed ? '0px' : 'var(--nav-height, 72px)'
        )
    }, [navCollapsed])

    return (
        <AppBar
            position="fixed"
            elevation={0}
            sx={{
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                color: '#201c24',
                borderBottom: '1px solid rgba(122, 75, 143, 0.14)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                top: 0,
                left: 0,
                right: 0,
                transform: navCollapsed ? 'translateY(calc(-1 * var(--nav-height, 72px)))' : 'translateY(0)',
                transition: 'transform 220ms ease',
            }}
        >
            <Toolbar
                ref={toolbarRef}
                sx={{
                    minHeight: { xs: 56, md: 70 },
                    px: { xs: 1.5, md: 3, xl: 4.5 },
                    gap: { xs: 1, md: 2 },
                }}
            >
                <IconButton
                    onClick={toggleNavMenu}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                    aria-label="menu"
                >
                    {navOpen ? <CloseIcon /> : <MenuIcon />}
                </IconButton>

                <Drawer
                    anchor="left"
                    open={navOpen}
                    onClose={closeNavMenu}
                    PaperProps={{ sx: { width: '100vw', borderRadius: 0 } }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                                component="img"
                                src={logo}
                                alt="lycoris"
                                sx={{ height: 28, width: 'auto', display: 'block' }}
                            />
                            <Typography fontWeight={700}>Lycoris</Typography>
                        </Box>
                        <IconButton onClick={closeNavMenu} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <List sx={{ px: 2, py: 1 }}>
                        {navItems.map((item) => (
                            <ListItemButton
                                key={item.to}
                                selected={isActive(item.to)}
                                onClick={() => {
                                    closeNavMenu()
                                    navigate(item.to)
                                }}
                                sx={{ borderRadius: 2 }}
                            >
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        ))}
                    </List>

                    {!isLoggedIn ? (
                        <>
                            <Divider />
                            <List sx={{ px: 2, py: 1 }}>
                                <ListItemButton
                                    onClick={() => {
                                        closeNavMenu()
                                        navigate('/login')
                                    }}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <ListItemText primary="登录" />
                                </ListItemButton>
                                <ListItemButton
                                    onClick={() => {
                                        closeNavMenu()
                                        navigate('/register')
                                    }}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <ListItemText primary="注册" />
                                </ListItemButton>
                            </List>
                        </>
                    ) : (
                        <>
                            <Divider />
                            <List sx={{ px: 2, py: 1 }}>
                                <ListItemButton
                                    onClick={() => {
                                        closeNavMenu()
                                        navigate('/me')
                                    }}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <ListItemText primary="个人中心" />
                                </ListItemButton>
                                <ListItemButton
                                    onClick={async () => {
                                        closeNavMenu()
                                        await logout()
                                        navigate('/maps')
                                    }}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <ListItemText primary="退出登录" />
                                </ListItemButton>
                            </List>
                        </>
                    )}
                </Drawer>

                <Box
                    onClick={() => navigate('/')}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        flexShrink: 0,
                        paddingRight: {xs: 0, md: 2 , xl: 4},
                    }}
                >
                    <Box
                        component="img"
                        src={logo}
                        alt="lycoris"
                        sx={{ height: { xs: 42, md: 50 }, width: 'auto', display: 'block' }}
                    />
                </Box>

                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}
                >
                    {navItems.map((item) => {
                        const active = isActive(item.to)
                        return (
                            <Button
                                key={item.to}
                                component={RouterLink}
                                to={item.to}
                                variant="text"
                                sx={{
                                    fontSize: buttonFontSize,
                                    textTransform: 'none',
                                    borderRadius: 999,
                                    px: 1.5,
                                    color: active ? hoverColor : '#000',
                                    bgcolor: active ? 'rgba(116, 73, 136, 0.10)' : 'transparent',
                                    '&:hover': {
                                        color: hoverColor,
                                        bgcolor: 'rgba(116, 73, 136, 0.10)',
                                    },
                                }}
                            >
                                {item.label}
                            </Button>
                        )
                    })}
                </Stack>
                <Chip
                    label="工具模块筹备中 · 将以独立 App 上线"
                    size="small"
                    sx={{
                        display: { xs: 'none', md: 'inline-flex' },
                        ml: 0.8,
                        borderRadius: 999,
                        bgcolor: 'rgba(116, 73, 136, 0.10)',
                        color: '#744988',
                        fontWeight: 600,
                    }}
                />

                <Box sx={{ flex: 1 }} />
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        alignItems: 'center',
                        width: { md: 300, lg: 380 },
                    }}
                >
                    <TextField
                        size="small"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && q.trim()) {
                                navigate(`/search?q=${encodeURIComponent(q.trim())}`)
                            }
                        }}
                        placeholder="搜索"
                        fullWidth
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 999,
                            },
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                <IconButton
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                    aria-label="search"
                    onClick={() => navigate('/search')}
                >
                    <SearchIcon />
                </IconButton>

                <AuthButtons isLoggedIn={isLoggedIn} avatarUrl={user?.avatarUrl}></AuthButtons>
            </Toolbar>
        </AppBar>
    )
}


