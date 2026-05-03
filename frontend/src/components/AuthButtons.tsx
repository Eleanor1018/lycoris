import { Avatar, Button, IconButton } from '@mui/material'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

type AuthButtonsProps = {
    isLoggedIn: boolean
    avatarUrl?: string
}

export default function AuthButtons({ isLoggedIn, avatarUrl }: AuthButtonsProps) {
    const navigate = useNavigate()

    if (isLoggedIn) {
        return (
            <IconButton
                onClick={() => navigate('/me')}
                size="small"
                sx={{
                    p: 0,
                    width: 54,
                    height: 54,
                    bgcolor: 'var(--ly-color-lilac)',
                    '&:hover': { bgcolor: '#c8afff' },
                }}
                aria-label="打开个人中心"
            >
                <Avatar src={avatarUrl} sx={{ width: 44, height: 44, bgcolor: 'rgba(90, 56, 80, 0.12)' }}>
                    <PersonOutlineIcon sx={{ color: 'var(--ly-color-ink)' }} />
                </Avatar>
            </IconButton>
        )
    }

    return (
        <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            disableElevation
            sx={{
                minWidth: 158,
                height: 54,
                px: 3,
                borderRadius: 999,
                bgcolor: 'var(--ly-color-lilac)',
                color: 'var(--ly-color-ink)',
                fontFamily: 'var(--ly-font-body)',
                fontSize: { md: 20, lg: 24 },
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#c8afff' },
            }}
        >
            登录/注册
        </Button>
    )
}
