import { useState } from 'react'
import axios from 'axios'
import { Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { adminContainedButtonSx, adminOutlinedButtonSx } from '../styles/adminButtons'
import { useLanguage } from '../i18n/LanguageProvider'

export default function AdminEntry() {
    const navigate = useNavigate()
    const { tr } = useLanguage()
    const [passcode, setPasscode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

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

    const handleVerify = async () => {
        if (!passcode.trim()) {
            setError(tr('请输入二级口令。', 'Enter the secondary passcode.'))
            return
        }
        try {
            setLoading(true)
            await axios.post('/api/admin/verify', { passcode }, { withCredentials: true })
            setError(null)
            navigate('/admin/review')
        } catch (e: unknown) {
            setError(getErrorMessage(e, tr('二级口令校验失败。', 'Could not verify the secondary passcode.')))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, overflowX: 'hidden' }}>
            <Stack spacing={2} sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {tr('管理入口', 'Admin access')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {tr('如果启用了二级校验，请先在此验证。临时关闭时，管理员可以直接打开管理页面。', 'If secondary verification is enabled, verify here first. When it is temporarily disabled, an administrator can open the admin pages directly.')}
                </Typography>
                <AdminNav />
                <Divider />

                <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Stack spacing={2}>
                        <TextField
                            type="password"
                            label={tr('二级口令', 'Secondary passcode')}
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            fullWidth
                        />
                        {error ? (
                            <Typography color="error" variant="body2">
                                {error}
                            </Typography>
                        ) : null}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button variant="contained" onClick={() => void handleVerify()} disabled={loading} sx={{ ...adminContainedButtonSx, width: { xs: '100%', sm: 'auto' } }}>
                                {loading ? tr('校验中…', 'Verifying…') : tr('校验并打开审核中心', 'Verify and open review center')}
                            </Button>
                            <Button variant="outlined" onClick={() => navigate('/admin/review')} sx={{ ...adminOutlinedButtonSx, width: { xs: '100%', sm: 'auto' } }}>
                                {tr('打开审核中心', 'Open review center')}
                            </Button>
                            <Button variant="outlined" onClick={() => navigate('/admin/all')} sx={{ ...adminOutlinedButtonSx, width: { xs: '100%', sm: 'auto' } }}>
                                {tr('打开全量点位', 'Open all places')}
                            </Button>
                            <Button variant="outlined" onClick={() => navigate('/admin/usr')} sx={{ ...adminOutlinedButtonSx, width: { xs: '100%', sm: 'auto' } }}>
                                {tr('打开用户管理', 'Open user management')}
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    )
}
