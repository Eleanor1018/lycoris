import {
    Avatar,
    Button,
    IconButton,
    Stack,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

type AuthButtonsProps = {
    isLoggedIn: boolean
    avatarUrl?: string
}

export default function AuthButtons({ isLoggedIn, avatarUrl }: AuthButtonsProps) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const navigate = useNavigate()

    //mobile
    if (isMobile) {
        if (isLoggedIn){
            return (
                <IconButton onClick={() => navigate('/me')} size='small' sx={{ p: 0.5 }}>
                    <Avatar src={avatarUrl} sx={{ width: 40, height: 40, bgcolor: 'rgba(116,73,136,0.12)' }}>
                        <PersonOutlineIcon sx={{ color: '#744988' }} />
                    </Avatar>
                </IconButton>
            );
        }
        else{
            return (
                <IconButton
                    onClick={() => navigate('/login')}
                    size="small"
                    sx={{ p: 0.5 }}
                    aria-label="login"
                >
                    <Avatar src={avatarUrl} sx={{ width: 40, height: 40 }} />
                </IconButton>
            );
        }
    }


    else{
        if(isLoggedIn){
            return (
                <IconButton onClick={() => navigate('/me')} size="small" sx={{ p: 0.5 }}>
                    <Avatar src={avatarUrl} sx={{ width: 40, height: 40, bgcolor: 'rgba(116,73,136,0.12)' }}>
                        <PersonOutlineIcon sx={{ color: '#744988' }} />
                    </Avatar>
                </IconButton>
            );
        }
        else{
            return (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                        component={RouterLink}
                        to="/login"
                        variant="contained"
                        disableElevation
                        sx={{
                            fontSize: 14,
                            textTransform: 'none',
                            borderRadius: 999,
                            bgcolor: '#744988',
                            '&:hover': { bgcolor: '#744988', opacity: 0.9 },
                        }}
                    >
                        登录
                    </Button>

                    <Button
                        component={RouterLink}
                        to="/register"
                        variant="outlined"
                        sx={{
                            fontSize: 14,
                            textTransform: 'none',
                            borderRadius: 999,
                            color: '#744988',
                            borderColor: '#744988',
                            bgcolor: '#fff',
                            '&:hover': { bgcolor: 'rgba(116, 73, 136, 0.08)', borderColor: '#744988' },
                        }}
                    >
                        注册
                    </Button>
                </Stack>
            );
        }
    }
}
