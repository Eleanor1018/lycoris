import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Pagination,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { adminContainedButtonSx, adminOutlinedButtonSx, adminPaginationSx } from '../styles/adminButtons'

type AdminUser = {
    id: number
    publicId?: string | null
    username: string
    nickname?: string | null
    email?: string | null
    role?: string | null
    deleted?: boolean
    deletedAt?: string | null
}

type AdminUserPage = {
    page: number
    size: number
    totalPages: number
    totalElements: number
    items: AdminUser[]
}

export default function AdminUsers() {
    const navigate = useNavigate()
    const PAGE_SIZE = 10
    const [qInput, setQInput] = useState('')
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)
    const [result, setResult] = useState<AdminUserPage>({
        page: 0,
        size: PAGE_SIZE,
        totalPages: 0,
        totalElements: 0,
        items: [],
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true)
            const res = await axios.get<AdminUserPage>('/api/admin/users', {
                params: { page: page - 1, size: PAGE_SIZE, q: query.trim() || undefined },
                withCredentials: true,
            })
            setResult(res.data)
            setError(null)
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not load the user list.'))
        } finally {
            setLoading(false)
        }
    }, [page, query])

    useEffect(() => {
        void loadUsers()
    }, [loadUsers])

    const resetPassword = async (user: AdminUser) => {
        if (user.deleted) {
            setError('A deleted user cannot have their password reset.')
            return
        }
        try {
            await axios.post(`/api/admin/users/${user.id}/reset-password`, null, { withCredentials: true })
            setError(null)
            alert(`${user.username}'s password has been reset to the default password.`)
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not reset the password.'))
        }
    }

    const deleteUser = async (user: AdminUser) => {
        if (user.deleted) {
            setError('This user is already deleted.')
            return
        }
        const ok = window.confirm(`Delete user ${user.username}?`)
        if (!ok) return
        try {
            await axios.delete(`/api/admin/users/${user.id}`, { withCredentials: true })
            if (result.items.length === 1 && page > 1) {
                setPage(page - 1)
            } else {
                void loadUsers()
            }
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not delete the user.'))
        }
    }

    const restoreUser = async (user: AdminUser) => {
        if (!user.deleted) {
            setError('This user does not need to be restored.')
            return
        }
        const ok = window.confirm(`Restore user ${user.username}?`)
        if (!ok) return
        try {
            await axios.post(`/api/admin/users/${user.id}/restore`, null, { withCredentials: true })
            if (result.items.length === 1 && page > 1) {
                setPage(page - 1)
            } else {
                void loadUsers()
            }
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not restore the user.'))
        }
    }

    const onSearch = () => {
        setPage(1)
        setQuery(qInput)
    }

    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, overflowX: 'hidden' }}>
            <Stack spacing={2} sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Admin · User management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Search, delete, restore, and reset passwords for user accounts.
                </Typography>
                <AdminNav />
                <Divider />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                        size="small"
                        label="Search username, display name, or email"
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={onSearch} sx={adminContainedButtonSx}>
                        Search
                    </Button>
                </Stack>

                {loading ? (
                    <Stack alignItems="center" sx={{ py: 6 }}>
                        <CircularProgress />
                    </Stack>
                ) : error ? (
                    <Stack spacing={2}>
                        <Paper sx={{ p: 2, bgcolor: '#fff3f3', border: '1px solid #f5c2c2' }}>
                            <Typography color="error">{String(error)}</Typography>
                        </Paper>
                        {/secondary (passcode|password)/i.test(String(error)) ? (
                            <Button variant="contained" onClick={() => navigate('/admin')} sx={adminContainedButtonSx}>
                                Verify the secondary passcode
                            </Button>
                        ) : null}
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        {result.items.length === 0 ? (
                            <Paper sx={{ p: 2 }}>
                                <Typography color="text.secondary">No users found.</Typography>
                            </Paper>
                        ) : (
                            result.items.map((user) => (
                                <Paper key={user.id} sx={{ p: 2, borderRadius: 2 }}>
                                    <Stack spacing={1.2}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {user.username}
                                            </Typography>
                                            <Chip size="small" label={user.role || 'USER'} />
                                            {user.deleted ? <Chip size="small" color="warning" label="Deleted" /> : null}
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            Display name: {user.nickname || '(empty)'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Email: {user.email || '(empty)'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ID: {user.id} · Public ID: {user.publicId || '(empty)'}
                                        </Typography>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="outlined"
                                                onClick={() => void resetPassword(user)}
                                                disabled={Boolean(user.deleted)}
                                                sx={adminOutlinedButtonSx}
                                            >
                                                Reset to default password
                                            </Button>
                                            <Button
                                                variant="text"
                                                color="error"
                                                onClick={() => void deleteUser(user)}
                                                disabled={Boolean(user.deleted)}
                                            >
                                                Delete user
                                            </Button>
                                            <Button
                                                variant="text"
                                                color="success"
                                                onClick={() => void restoreUser(user)}
                                                disabled={!user.deleted}
                                            >
                                                Restore user
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            ))
                        )}
                        <Pagination
                            count={Math.max(1, result.totalPages)}
                            page={Math.min(page, Math.max(1, result.totalPages))}
                            onChange={(_, p) => setPage(p)}
                            color="primary"
                            sx={adminPaginationSx}
                        />
                    </Stack>
                )}
            </Stack>
        </Box>
    )
}
