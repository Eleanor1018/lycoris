import axios from 'axios'
import { useState } from 'react'
import {useNavigate, Link as RouterLink} from "react-router-dom";
import { Button, TextField, Stack, Typography, Alert, Box } from '@mui/material'
import {useAuth} from "../auth/AuthProvider.tsx";

export default function Login(){
    const getErrorMessage = (err: unknown, fallback: string) => {
        if (typeof err === 'object' && err !== null && 'response' in err) {
            const response = (err as { response?: { data?: unknown } }).response
            const data = response?.data
            if (typeof data === 'string') return data
            if (data && typeof data === 'object' && 'message' in data) {
                const msg = (data as { message?: unknown }).message
                if (typeof msg === 'string') return msg
            }
        }
        return fallback
    }

    const [loginForm, setLoginForm] = useState({
        username: "",
        password: "",
    })
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();
    const {refresh} = useAuth();
    const fieldSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 3,
        },
    }

    const handleLogin = async ( e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        try{
            const response = await axios.post('/api/login', loginForm, {withCredentials: true});
            console.log('login OK', response.data);
            if (response.data.code === 0) {
                await refresh();
                navigate('/');
            }
            else{
                setErrorMessage(response.data);
            }
        }catch(err: unknown){
            const errorMSG = getErrorMessage(err, 'login failed.')
            setErrorMessage(errorMSG);
        }
    }

    return(
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: {xs: 1, md: 2},
                py: {xs: 4, md: 7},
            }}
        >
            <Typography
                variant="h5"
                sx={{
                    fontWeight: 800,
                    fontSize: {xs: 32, md: 44},
                    py: 2,
                }}
            >
                登录
            </Typography>
            <Stack
                component="form"
                onSubmit={handleLogin}
                spacing={3}
                sx={{
                    width: {xs: 320, md: 420},
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 4,
                    border: '1px solid rgba(116, 73, 136, 0.12)',
                    bgcolor: '#fff',
                    boxShadow: '0 12px 30px rgba(116, 73, 136, 0.08)',
                }}
            >
                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

                <TextField
                    label="用户名或邮箱"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((prev) => ({...prev, username: e.target.value}))}
                    autoComplete="username"
                    sx={fieldSx}
                />

                <TextField
                    label="密码"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((prev) => ({...prev, password: e.target.value}))}
                    autoComplete="current-password"
                    sx={fieldSx}
                />

                <Button
                    disableElevation={true}
                    type="submit"
                    variant="contained"
                    sx={{
                        fontSize: {xs: 14, md: 17},
                        textTransform: 'none',
                        borderRadius: 999,
                        bgcolor: '#b784a7',
                        '&:hover': { bgcolor: '#b784a7', opacity: 0.9 },
                    }}
                >
                    登录
                </Button>

                <Typography variant="body2">
                    没有账号？ <RouterLink to="/register">去注册</RouterLink>
                </Typography>
            </Stack>
        </Box>

    )

}

