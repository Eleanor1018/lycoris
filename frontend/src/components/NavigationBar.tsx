import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import AuthButtons from './AuthButtons.tsx'
import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Stack,
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

import { useAuth } from '../auth/AuthProvider.tsx'

type NavItem = { label: string; to: string }

export default function NavigationBar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { isLoggedIn, user, logout } = useAuth()
    const navShellRef = useRef<HTMLDivElement | null>(null)
    const lastScrollYRef = useRef(0)
    const theme = useTheme()
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
    const [isNavCollapsed, setIsNavCollapsed] = useState(false)
    const [navOpen, setNavOpen] = useState(false)
    const navCollapsed = isDesktop && isNavCollapsed

    const navItems: NavItem[] = useMemo(
        () => [
            { label: '地图', to: '/maps' },
            { label: 'HRT 指南', to: '/documents' },
            { label: '关于', to: '/about' },
        ],
        []
    )

    const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`)
    const closeNavMenu = () => setNavOpen(false)

    useEffect(() => {
        const el = navShellRef.current
        if (!el) return

        const update = () => {
            const height = Math.round(el.getBoundingClientRect().height)
            if (height > 0) {
                document.documentElement.style.setProperty('--nav-height', `${height}px`)
            }
        }

        update()
        if (typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(update)
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
            navCollapsed ? '0px' : 'var(--nav-height, 104px)'
        )
    }, [navCollapsed])

    return (
        <AppBar
            position="fixed"
            elevation={0}
            sx={{
                bgcolor: 'transparent',
                color: 'var(--ly-color-ink)',
                boxShadow: 'none',
                pointerEvents: 'none',
                zIndex: 9999,
                top: 0,
                left: 0,
                right: 0,
                transform: navCollapsed ? 'translateY(calc(-1 * var(--nav-height, 104px)))' : 'translateY(0)',
                transition: 'transform 220ms ease',
            }}
        >
            <Box
                ref={navShellRef}
                sx={{
                    px: { xs: 1.5, md: 'clamp(28px, 4.6vw, 66px)' },
                    pt: { xs: 1.5, md: 'clamp(20px, 3.4vw, 49px)' },
                    pb: { xs: 1.25, md: 1.75 },
                    pointerEvents: 'none',
                }}
            >
                <Toolbar
                    disableGutters
                    sx={{
                        minHeight: { xs: 70, md: 82 },
                        width: { xs: 'calc(100vw - 24px)', md: '100%' },
                        maxWidth: { xs: 'calc(100vw - 24px)', md: 1308 },
                        mx: 'auto',
                        px: { xs: 2, md: 3, lg: 4 },
                        gap: { xs: 1, md: 2.4 },
                        position: 'relative',
                        pointerEvents: 'auto',
                        borderRadius: 999,
                        border: '2px solid rgba(221, 165, 196, 0.31)',
                        background: {
                            xs: 'rgba(255, 255, 255, 0.48)',
                            md: 'rgba(230, 203, 255, 0.26)',
                        },
                        boxShadow: '0 20px 42px rgba(221, 165, 196, 0.24)',
                        backdropFilter: 'blur(22px)',
                        WebkitBackdropFilter: 'blur(22px)',
                    }}
                >
                    <IconButton
                        onClick={() => setNavOpen((prev) => !prev)}
                        sx={{
                            display: { xs: 'inline-flex', md: 'none' },
                            width: 54,
                            height: 54,
                            bgcolor: 'var(--ly-color-blush)',
                            color: '#1d1b20',
                            '&:hover': { bgcolor: '#f8cfe3' },
                        }}
                        aria-label="打开导航菜单"
                    >
                        {navOpen ? <CloseIcon /> : <MenuIcon />}
                    </IconButton>

                    <Box
                        component={RouterLink}
                        to="/"
                        aria-label="返回首页"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            textDecoration: 'none',
                            color: '#000',
                            position: { xs: 'absolute', md: 'static' },
                            left: { xs: '50%', md: 'auto' },
                            top: { xs: '50%', md: 'auto' },
                            transform: { xs: 'translate(-50%, -50%)', md: 'none' },
                        }}
                    >
                        <Typography
                            component="span"
                            sx={{
                                fontFamily: 'var(--ly-font-logo)',
                                fontWeight: 700,
                                fontSize: { xs: 38, md: 38 },
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                            }}
                        >
                            Lycoris
                        </Typography>
                    </Box>

                    <Divider
                        orientation="vertical"
                        flexItem
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            mx: { md: 1.4, lg: 2 },
                            borderColor: 'var(--ly-color-ink)',
                            borderRightWidth: 3,
                            opacity: 0.95,
                            borderRadius: 999,
                        }}
                    />

                    <Stack
                        direction="row"
                        spacing={{ md: 2.5, lg: 4 }}
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
                                        fontFamily: 'var(--ly-font-body)',
                                        fontSize: { md: 22, lg: 26 },
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        borderRadius: 999,
                                        px: 1.25,
                                        color: 'var(--ly-color-ink)',
                                        bgcolor: active ? 'rgba(208, 188, 255, 0.42)' : 'transparent',
                                        '&:hover': {
                                            bgcolor: 'rgba(208, 188, 255, 0.36)',
                                        },
                                    }}
                                >
                                    {item.label}
                                </Button>
                            )
                        })}
                    </Stack>

                    <Box sx={{ flex: 1 }} />

                    <IconButton
                        aria-label="打开搜索页"
                        onClick={() => navigate('/search')}
                        sx={{
                            width: 54,
                            height: 54,
                            position: { xs: 'fixed', md: 'static' },
                            right: { xs: 56, md: 'auto' },
                            top: { xs: 20, md: 'auto' },
                            transform: 'none',
                            pointerEvents: 'auto',
                            bgcolor: { xs: '#e8def8', md: '#f4b3cc' },
                            color: '#1d1b20',
                            '&:hover': { bgcolor: { xs: '#ded1f2', md: '#efa7c5' } },
                        }}
                    >
                        <SearchIcon />
                    </IconButton>

                    <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                        <AuthButtons isLoggedIn={isLoggedIn} avatarUrl={user?.avatarUrl} />
                    </Box>
                </Toolbar>
            </Box>

            <Drawer
                anchor="left"
                open={navOpen}
                onClose={closeNavMenu}
                PaperProps={{
                    sx: {
                        width: 'min(360px, 100vw)',
                        borderRadius: 0,
                        background: 'linear-gradient(180deg, #f6f6f6 0%, #f8ebff 100%)',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.5,
                        py: 2,
                        borderBottom: '1px solid rgba(221, 165, 196, 0.36)',
                    }}
                >
                    <Typography
                        sx={{
                            fontFamily: 'var(--ly-font-logo)',
                            fontWeight: 700,
                            fontSize: 34,
                            letterSpacing: '-0.03em',
                            color: '#000',
                        }}
                    >
                        Lycoris
                    </Typography>
                    <IconButton onClick={closeNavMenu} aria-label="关闭导航菜单">
                        <CloseIcon />
                    </IconButton>
                </Box>

                <List sx={{ px: 2, py: 1.5 }}>
                    {navItems.map((item) => (
                        <ListItemButton
                            key={item.to}
                            selected={isActive(item.to)}
                            onClick={() => {
                                closeNavMenu()
                                navigate(item.to)
                            }}
                            sx={{
                                borderRadius: 999,
                                color: 'var(--ly-color-ink)',
                                '&.Mui-selected': {
                                    bgcolor: 'rgba(208, 188, 255, 0.52)',
                                },
                            }}
                        >
                            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 700 }} />
                        </ListItemButton>
                    ))}
                </List>

                <Divider />

                {!isLoggedIn ? (
                    <List sx={{ px: 2, py: 1.5 }}>
                        <ListItemButton
                            onClick={() => {
                                closeNavMenu()
                                navigate('/login')
                            }}
                            sx={{ borderRadius: 999 }}
                        >
                            <ListItemText primary="登录" primaryTypographyProps={{ fontWeight: 700 }} />
                        </ListItemButton>
                        <ListItemButton
                            onClick={() => {
                                closeNavMenu()
                                navigate('/register')
                            }}
                            sx={{ borderRadius: 999 }}
                        >
                            <ListItemText primary="注册" primaryTypographyProps={{ fontWeight: 700 }} />
                        </ListItemButton>
                    </List>
                ) : (
                    <List sx={{ px: 2, py: 1.5 }}>
                        <ListItemButton
                            onClick={() => {
                                closeNavMenu()
                                navigate('/me')
                            }}
                            sx={{ borderRadius: 999 }}
                        >
                            <ListItemText primary="个人中心" primaryTypographyProps={{ fontWeight: 700 }} />
                        </ListItemButton>
                        <ListItemButton
                            onClick={async () => {
                                closeNavMenu()
                                await logout()
                                navigate('/maps')
                            }}
                            sx={{ borderRadius: 999 }}
                        >
                            <ListItemText primary="退出登录" primaryTypographyProps={{ fontWeight: 700 }} />
                        </ListItemButton>
                    </List>
                )}
            </Drawer>
        </AppBar>
    )
}
