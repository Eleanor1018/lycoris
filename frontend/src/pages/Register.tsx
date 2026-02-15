import { useState } from 'react'
import axios from "axios";
import {useNavigate, Link as RouterLink} from "react-router-dom";
import {Button, TextField, Stack, Typography, Alert, Box} from '@mui/material'
import {useAuth} from "../auth/AuthProvider.tsx";


export default function Register() {
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

    const [registerForm, setRegisterForm] = useState({
        username: "",
        nickname: "",
        email: "",
        password: "",
        website: "",
    })
    const [errorMessage, setErrorMessage] = useState('')
    const [password2, setPassword2] = useState("")
    const navigate = useNavigate();
    const {refresh} = useAuth();
    const fieldSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 3,
        },
    }

    const handleRegister = async () => {
        setErrorMessage("");
        if (registerForm.password !== password2) {
            setErrorMessage("两次密码输入不一致");
            return;
        }
        try{
            const response = await axios.post("/api/register", registerForm, {withCredentials: true});
            console.log('Register OK', response.data);
            if (response.data.code === 0) {
                await refresh();
                window.localStorage.setItem('onboarding.editProfileAfterRegister', '1')
                navigate('/');
            }
            else{
                setErrorMessage(response.data);
            }

            }
        catch(error: unknown){
            const errorMsg = getErrorMessage(error, "注册失败，请检查用户名和密码是否正确")
            setErrorMessage(errorMsg);
        }

    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: {xs: 1, md: 2},
                py: {xs: 3, md: 6},
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
                注册
            </Typography>
            <Stack
                component="form"
                onSubmit={(e) => {e.preventDefault();
                    handleRegister();
                }}
                // onSubmit={handleRegister}
                spacing={3}
                sx={{
                    width: {xs:320, md:420},
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 4,
                    border: '1px solid rgba(116, 73, 136, 0.12)',
                    bgcolor: '#fff',
                    boxShadow: '0 12px 30px rgba(116, 73, 136, 0.08)',
                }}
            >
                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

                <input
                    type="text"
                    name="website"
                    value={registerForm.website}
                    onChange={(e) => setRegisterForm((prev) => ({...prev, website: e.target.value}))}
                    autoComplete="off"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: '-10000px',
                        width: '1px',
                        height: '1px',
                        opacity: 0,
                        pointerEvents: 'none',
                    }}
                />

                <TextField
                    label="用户名"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm((prev) => ({...prev, username: e.target.value}))}
                    autoComplete="username"
                    sx={fieldSx}
                />

                <TextField
                    label="昵称"
                    value={registerForm.nickname}
                    onChange={(e) => setRegisterForm((prev) => ({...prev, nickname: e.target.value}))}
                    autoComplete="nickname"
                    sx={fieldSx}
                />

                <TextField
                    label="邮箱"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((prev) => ({...prev, email: e.target.value}))}
                    autoComplete="email"
                    sx={fieldSx}
                />

                <TextField
                    label="密码"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((prev) => ({...prev, password: e.target.value}))}
                    autoComplete="current-password"
                    sx={fieldSx}
                />

                <TextField
                    label="再次输入密码"
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
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
                    注册
                </Button>

                <Typography variant="body2">
                    已经有账号？ <RouterLink to="/login">去登录</RouterLink>
                </Typography>
            </Stack>
        </Box>

    )
}
