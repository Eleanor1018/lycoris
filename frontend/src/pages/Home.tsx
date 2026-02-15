import { useEffect, useState } from 'react'
import { Alert, Box, Button, Snackbar, Typography } from '@mui/material'
import logo from "@/images/LycorisIcon.png";
import { Link as RouterLink } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthProvider'
import EditProfileDialog from '../components/EditProfileDialog'

export default function Home() {
    const { user, refresh } = useAuth()
    const [editOpen, setEditOpen] = useState(false)
    const [nickname, setNickname] = useState('')
    const [pronouns, setPronouns] = useState('')
    const [signature, setSignature] = useState('')
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [saveOpen, setSaveOpen] = useState(false)

    useEffect(() => {
        if (!user) return
        const shouldOpen = window.localStorage.getItem('onboarding.editProfileAfterRegister') === '1'
        if (!shouldOpen) return
        window.localStorage.removeItem('onboarding.editProfileAfterRegister')
        const timer = window.setTimeout(() => {
            setNickname(user.nickname || user.username || '')
            setPronouns(user.pronouns || '')
            setSignature(user.signature || '')
            setAvatarFile(null)
            setEditOpen(true)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [user])

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: { xs: 'calc(100vh - 56px)', md: 'calc(100vh - 70px)' },
                    px: {xs: 1, md: 4},
                    py: {xs: 4, md: 6},
                    gap: { xs: 0.5, md: 1 },
                }}
            >
                <Box
                    component="img"
                    src={logo}
                    alt="lycoris"
                    sx={{
                        maxWidth: {xs: 200, md: 350},
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                    }}
                />
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Box
                        sx={{
                            py: { xs: 1.5, md: 2.5 },
                        }}
                    >
                        <Typography
                            component="h1"
                            sx={{
                                fontFamily: '"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
                                fontSize: { xs: '2.5rem', md: '4rem' },
                                fontWeight: 700,
                                fontSynthesis: 'weight',
                                letterSpacing: '0.08em',
                                lineHeight: 1.1,
                                userSelect: 'none',
                                textShadow: '0 6px 18px rgba(122, 75, 143, 0.12)',
                                display: 'inline-flex',
                                alignItems: 'center',
                            }}
                        >
                            <Box component="span" sx={{ color: '#8d58e3' }}>夏</Box>
                            <Box component="span" sx={{ color: '#4ea8df', mx: 0.4 }}>水</Box>
                            <Box component="span" sx={{ color: '#df86a7' }}>仙</Box>
                        </Typography>
                    </Box>
                    <Typography
                        variant="body1"
                        sx={{
                            display: {xs: 'none', md:'block'},
                            fontSize: '1.35rem',
                            fontWeight: 500,
                            letterSpacing: '0.01em',
                            paddingBottom: 3,
                        }}
                    >
                        一个为跨性别者提供
                        <strong>无障碍设施信息和互助信息</strong>的平台
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            display: {xs: 'block', md:'none'},
                            textAlign: 'center',
                            fontSize: '1.08rem',
                            fontWeight: 500,
                            letterSpacing: '0.01em',
                            paddingBottom: 3,
                        }}
                    >
                        一个为跨性别者提供<br/>
                        <strong>无障碍设施信息和互助信息</strong>的平台
                    </Typography>
                </Box>
                <Button
                    disableElevation={true}
                    component={RouterLink}
                    variant= 'contained'
                    to="/maps"
                    sx={{
                        fontSize: {xs: 14, md: 17},
                        textTransform: 'none',
                        borderRadius: 999,
                        bgcolor: '#b784a7',
                        '&:hover': { bgcolor: '#b784a7', opacity: 0.9 },
                        px: {xs: 3, md: 6},
                        py: {xs: 0.6, md: 1.2},
                    }}
                >
                    进入地图
                </Button>
            </Box>
            <EditProfileDialog
                open={editOpen}
                nickname={nickname}
                pronouns={pronouns}
                signature={signature}
                avatarFile={avatarFile}
                onNicknameChange={setNickname}
                onPronounsChange={setPronouns}
                onSignatureChange={setSignature}
                onAvatarChange={setAvatarFile}
                onClose={() => setEditOpen(false)}
                onSave={async () => {
                    await axios.patch(
                        '/api/me',
                        { nickname, pronouns, signature },
                        { withCredentials: true }
                    )
                    if (avatarFile) {
                        const form = new FormData()
                        form.append('file', avatarFile)
                        await axios.post('/api/me/avatar', form, { withCredentials: true })
                    }
                    await refresh()
                    setEditOpen(false)
                    setSaveOpen(true)
                }}
            />
            <Snackbar
                open={saveOpen}
                autoHideDuration={2200}
                onClose={() => setSaveOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" variant="filled" onClose={() => setSaveOpen(false)}>
                    欢迎加入，资料保存成功
                </Alert>
            </Snackbar>
        </>
    )}
