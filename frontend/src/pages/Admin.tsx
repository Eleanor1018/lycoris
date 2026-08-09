import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
    Box,
    Typography,
    Stack,
    Paper,
    Button,
    Chip,
    Divider,
    CircularProgress,
    Pagination,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { toBackendAssetUrl } from '../config/runtime'
import { adminContainedButtonSx, adminPaginationSx } from '../styles/adminButtons'

type AdminMarker = {
    id: number
    lat: number
    lng: number
    category: string
    title: string
    description?: string
    isPublic: boolean
    isActive: boolean
    username: string
    userPublicId?: string | null
    reviewStatus?: string
    lastEditedBy?: string
    lastEditedByOwner?: boolean
    createdAt?: string
    updatedAt?: string
}

type PendingImageProposal = {
    id: number
    markerId: number
    markerTitle: string
    proposerUsername: string
    imageUrl: string
    status?: string
    createdAt?: string
}

type PendingEditProposal = {
    id: number
    markerId: number
    markerTitle: string
    lat: number
    lng: number
    category: string
    title: string
    description?: string
    isPublic: boolean
    isActive: boolean
    openTimeStart?: string | null
    openTimeEnd?: string | null
    proposerUsername: string
    proposerPublicId?: string | null
    proposerIsOwner?: boolean
    status?: string
    createdAt?: string
}

const categoryLabel: Record<string, string> = {
    accessible_toilet: 'Accessible Restroom',
    friendly_clinic: 'Trans-Friendly Clinic',
    baby_room: 'Nursing Room',
    self_definition: 'Custom',
}

const formatCategory = (category: string) => categoryLabel[category] ?? 'Custom'

const statusColor = (status?: string) => {
    switch ((status || '').toUpperCase()) {
        case 'APPROVED':
            return 'success' as const
        case 'REJECTED':
            return 'error' as const
        default:
            return 'warning' as const
    }
}

export default function Admin() {
    const PAGE_SIZE = 10
    const navigate = useNavigate()
    const [pending, setPending] = useState<AdminMarker[]>([])
    const [pendingEdits, setPendingEdits] = useState<PendingEditProposal[]>([])
    const [pendingImages, setPendingImages] = useState<PendingImageProposal[]>([])
    const [pendingPage, setPendingPage] = useState(1)
    const [editPage, setEditPage] = useState(1)
    const [imagePage, setImagePage] = useState(1)
    const [loading, setLoading] = useState(true)
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

    const loadPending = useCallback(async () => {
        try {
            setLoading(true)
            const [markerRes, editRes, imageRes] = await Promise.all([
                axios.get<AdminMarker[]>('/api/admin/markers/pending', { withCredentials: true }),
                axios.get<PendingEditProposal[]>('/api/admin/markers/pending-edits', { withCredentials: true }),
                axios.get<PendingImageProposal[]>('/api/admin/markers/pending-images', { withCredentials: true }),
            ])
            setPending(markerRes.data || [])
            setPendingEdits(editRes.data || [])
            setPendingImages(imageRes.data || [])
            setError(null)
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not load the review queue.'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadPending()
    }, [loadPending])

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(pending.length / PAGE_SIZE))
        if (pendingPage > maxPage) setPendingPage(maxPage)
    }, [pending.length, pendingPage, PAGE_SIZE])

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(pendingEdits.length / PAGE_SIZE))
        if (editPage > maxPage) setEditPage(maxPage)
    }, [pendingEdits.length, editPage, PAGE_SIZE])

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(pendingImages.length / PAGE_SIZE))
        if (imagePage > maxPage) setImagePage(maxPage)
    }, [pendingImages.length, imagePage, PAGE_SIZE])

    const pendingPageItems = useMemo(() => {
        const start = (pendingPage - 1) * PAGE_SIZE
        return pending.slice(start, start + PAGE_SIZE)
    }, [pending, pendingPage, PAGE_SIZE])

    const editPageItems = useMemo(() => {
        const start = (editPage - 1) * PAGE_SIZE
        return pendingEdits.slice(start, start + PAGE_SIZE)
    }, [pendingEdits, editPage, PAGE_SIZE])

    const imagePageItems = useMemo(() => {
        const start = (imagePage - 1) * PAGE_SIZE
        return pendingImages.slice(start, start + PAGE_SIZE)
    }, [pendingImages, imagePage, PAGE_SIZE])

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        try {
            await axios.post(`/api/admin/markers/${id}/${action}`, null, { withCredentials: true })
            setPending(prev => prev.filter(item => item.id !== id))
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not complete the action.'))
        }
    }

    const handleImageAction = async (id: number, action: 'approve' | 'reject') => {
        try {
            await axios.post(`/api/admin/markers/image-proposals/${id}/${action}`, null, { withCredentials: true })
            setPendingImages((prev) => prev.filter((item) => item.id !== id))
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not update the image proposal.'))
        }
    }

    const handleEditAction = async (id: number, action: 'approve' | 'reject') => {
        try {
            await axios.post(`/api/admin/markers/edit-proposals/${id}/${action}`, null, { withCredentials: true })
            setPendingEdits((prev) => prev.filter((item) => item.id !== id))
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Could not update the edit proposal.'))
        }
    }

    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, overflowX: 'hidden' }}>
            <Stack spacing={2} sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Admin · Review center
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Administrators only. New and edited places appear publicly after approval.
                </Typography>
                <AdminNav />
                <Divider />
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
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Places awaiting review
                        </Typography>
                        {pending.length === 0 ? (
                            <Paper sx={{ p: 2 }}>
                                <Typography color="text.secondary">No places are awaiting review.</Typography>
                            </Paper>
                        ) : (
                            pendingPageItems.map(item => (
                                <Paper key={item.id} sx={{ p: 2, borderRadius: 2 }}>
                                    <Stack spacing={1.2}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {item.title}
                                            </Typography>
                                            <Chip size="small" label={formatCategory(item.category)} />
                                            <Chip size="small" color={statusColor(item.reviewStatus)} label="Pending" />
                                            {item.lastEditedByOwner === false ? (
                                                <Chip size="small" color="warning" label="Edited by someone else" />
                                            ) : null}
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            {item.description || '(No description)'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Coordinates: {item.lat.toFixed(6)}, {item.lng.toFixed(6)} ·
                                            Submitted by: {item.username}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Edited by: {item.lastEditedBy || item.username}
                                            {item.lastEditedByOwner === false ? ' (not the creator)' : ''}
                                        </Typography>
                                        {item.lastEditedByOwner === false ? (
                                            <Typography variant="caption" color="warning.main">
                                                Review note: edited by someone other than the creator
                                            </Typography>
                                        ) : null}
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                onClick={() => handleAction(item.id, 'approve')}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                onClick={() => handleAction(item.id, 'reject')}
                                            >
                                                Reject
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            ))
                        )}
                        {pending.length > PAGE_SIZE ? (
                            <Pagination
                                count={Math.max(1, Math.ceil(pending.length / PAGE_SIZE))}
                                page={pendingPage}
                                onChange={(_, p) => setPendingPage(p)}
                                color="primary"
                                sx={adminPaginationSx}
                            />
                        ) : null}

                        <Divider />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Edit proposals awaiting review
                        </Typography>
                        {pendingEdits.length === 0 ? (
                            <Paper sx={{ p: 2 }}>
                                <Typography color="text.secondary">No edit proposals are awaiting review.</Typography>
                            </Paper>
                        ) : (
                            editPageItems.map((item) => (
                                <Paper key={`edit-${item.id}`} sx={{ p: 2, borderRadius: 2 }}>
                                    <Stack spacing={1.2}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {item.title}
                                            </Typography>
                                            <Chip size="small" label={formatCategory(item.category)} />
                                            <Chip size="small" color="warning" label="Edit pending" />
                                            {item.proposerIsOwner === false ? (
                                                <Chip size="small" color="warning" label="Edited by someone else" />
                                            ) : null}
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            Original place: {item.markerTitle}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {item.description || '(No description)'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Place ID: {item.markerId} · Coordinates: {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Submitted by: {item.proposerUsername}
                                            {item.proposerIsOwner === false ? ' (not the creator)' : ''}
                                        </Typography>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                onClick={() => handleEditAction(item.id, 'approve')}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                onClick={() => handleEditAction(item.id, 'reject')}
                                            >
                                                Reject
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            ))
                        )}
                        {pendingEdits.length > PAGE_SIZE ? (
                            <Pagination
                                count={Math.max(1, Math.ceil(pendingEdits.length / PAGE_SIZE))}
                                page={editPage}
                                onChange={(_, p) => setEditPage(p)}
                                color="primary"
                                sx={adminPaginationSx}
                            />
                        ) : null}

                        <Divider />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Image proposals awaiting review
                        </Typography>
                        {pendingImages.length === 0 ? (
                            <Paper sx={{ p: 2 }}>
                                <Typography color="text.secondary">No images are awaiting review.</Typography>
                            </Paper>
                        ) : (
                            imagePageItems.map((item) => (
                                <Paper key={`img-${item.id}`} sx={{ p: 2, borderRadius: 2 }}>
                                    <Stack spacing={1.2}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {item.markerTitle}
                                            </Typography>
                                            <Chip size="small" color="warning" label="Image pending" />
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            Place ID: {item.markerId} · Submitted by: {item.proposerUsername}
                                        </Typography>
                                        <Box
                                            component="img"
                                            src={toBackendAssetUrl(item.imageUrl)}
                                            alt={item.markerTitle}
                                            sx={{
                                                width: '100%',
                                                maxWidth: 280,
                                                maxHeight: 180,
                                                borderRadius: 1.5,
                                                objectFit: 'cover',
                                                display: 'block',
                                            }}
                                        />
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                onClick={() => handleImageAction(item.id, 'approve')}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                onClick={() => handleImageAction(item.id, 'reject')}
                                            >
                                                Reject
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            ))
                        )}
                        {pendingImages.length > PAGE_SIZE ? (
                            <Pagination
                                count={Math.max(1, Math.ceil(pendingImages.length / PAGE_SIZE))}
                                page={imagePage}
                                onChange={(_, p) => setImagePage(p)}
                                color="primary"
                                sx={adminPaginationSx}
                            />
                        ) : null}
                    </Stack>
                )}
            </Stack>
        </Box>
    )
}
