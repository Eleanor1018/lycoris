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
import MarkerFormDialog, { type DraftMarker } from '../components/MarkerFormDialog'
import AdminNav from '../components/AdminNav'
import { adminContainedButtonSx, adminOutlinedButtonSx, adminPaginationSx } from '../styles/adminButtons'
import { useLanguage } from '../i18n/LanguageProvider'

type AdminMarker = {
    id: number
    lat: number
    lng: number
    category: string
    title: string
    description?: string
    isPublic: boolean
    isActive: boolean
    openTimeStart?: string | null
    openTimeEnd?: string | null
    markImage?: string | null
    username: string
    userPublicId?: string | null
    reviewStatus?: string
    lastEditedBy?: string
    lastEditedByOwner?: boolean
}

const toDraft = (marker: AdminMarker): DraftMarker => ({
    tempId: String(marker.id),
    lat: marker.lat,
    lng: marker.lng,
    category: marker.category as DraftMarker['category'],
    title: marker.title,
    description: marker.description ?? '',
    isPublic: marker.isPublic,
    openTimeStart: marker.openTimeStart ?? '',
    openTimeEnd: marker.openTimeEnd ?? '',
    markImage: marker.markImage ?? undefined,
})

export default function AdminAll() {
    const PAGE_SIZE = 10
    const navigate = useNavigate()
    const { tr } = useLanguage()
    const categoryLabel: Record<string, string> = {
        accessible_toilet: tr('无障碍卫生间', 'Accessible Restroom'),
        friendly_clinic: tr('跨性别友好医疗机构', 'Trans-Friendly Clinic'),
        baby_room: tr('母婴室', 'Nursing Room'),
        self_definition: tr('自定义', 'Custom'),
    }
    const reviewStatusLabel: Record<string, string> = {
        PENDING: tr('待审核', 'Pending'),
        APPROVED: tr('已通过', 'Approved'),
        REJECTED: tr('已驳回', 'Rejected'),
    }
    const formatReviewStatus = (status?: string) => {
        if (!status) return tr('未知', 'Unknown')
        return reviewStatusLabel[status.toUpperCase()] ?? status
    }
    const [markers, setMarkers] = useState<AdminMarker[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)

    const [draft, setDraft] = useState<DraftMarker | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [markImageFile, setMarkImageFile] = useState<File | null>(null)
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

    const filteredMarkers = useMemo(() => markers, [markers])
    const pagedMarkers = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE
        return filteredMarkers.slice(start, start + PAGE_SIZE)
    }, [filteredMarkers, page, PAGE_SIZE])

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const res = await axios.get<AdminMarker[]>('/api/admin/markers/all', { withCredentials: true })
            setMarkers(res.data || [])
            setError(null)
        } catch (e: unknown) {
            setError(getErrorMessage(e, tr('点位加载失败。', 'Could not load the places.')))
        } finally {
            setLoading(false)
        }
    }, [tr])

    useEffect(() => {
        void loadAll()
    }, [loadAll])

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredMarkers.length / PAGE_SIZE))
        if (page > maxPage) setPage(maxPage)
    }, [filteredMarkers.length, page, PAGE_SIZE])

    const openEditor = (marker: AdminMarker) => {
        setEditingId(marker.id)
        setDraft(toDraft(marker))
        setMarkImageFile(null)
    }

    const handleSave = async () => {
        if (!draft || !editingId) return
        try {
            const res = await axios.patch<AdminMarker>(
                `/api/admin/markers/${editingId}`,
                {
                    category: draft.category,
                    title: draft.title,
                    description: draft.description,
                    isPublic: draft.isPublic,
                    openTimeStart: draft.openTimeStart || '',
                    openTimeEnd: draft.openTimeEnd || '',
                },
                { withCredentials: true }
            )
            setMarkers((prev) => prev.map((m) => (m.id === editingId ? res.data : m)))
            setEditingId(null)
            setDraft(null)
        } catch (e: unknown) {
            setError(getErrorMessage(e, tr('点位保存失败。', 'Could not save the place.')))
        }
    }

    const handleDelete = async () => {
        if (!editingId) return
        try {
            await axios.delete(`/api/admin/markers/${editingId}`, { withCredentials: true })
            setMarkers((prev) => prev.filter((m) => m.id !== editingId))
            setEditingId(null)
            setDraft(null)
        } catch (e: unknown) {
            setError(getErrorMessage(e, tr('点位删除失败。', 'Could not delete the place.')))
        }
    }

    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, overflowX: 'hidden' }}>
            <Stack spacing={2} sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {tr('管理 · 全量点位', 'Admin · All places')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {tr('在这里编辑或删除任意点位。', 'Edit or delete any place here.')}
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
                                {tr('校验二级口令', 'Verify the secondary passcode')}
                            </Button>
                        ) : null}
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        {pagedMarkers.map((item) => (
                            <Paper key={item.id} sx={{ p: 2, borderRadius: 2 }}>
                                <Stack spacing={1.2}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                            {item.title}
                                        </Typography>
                                        <Chip size="small" label={categoryLabel[item.category] ?? tr('自定义', 'Custom')} />
                                        <Chip size="small" label={tr(`状态：${formatReviewStatus(item.reviewStatus)}`, `Status: ${formatReviewStatus(item.reviewStatus)}`)} />
                                        {item.lastEditedByOwner === false ? (
                                            <Chip size="small" color="warning" label={tr('由他人编辑', 'Edited by someone else')} />
                                        ) : null}
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {item.description || tr('（无描述）', '(No description)')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {tr('坐标：', 'Coordinates: ')}{item.lat.toFixed(6)}, {item.lng.toFixed(6)} ·
                                        {tr('提交者：', 'Submitted by: ')}{item.username}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {tr('编辑者：', 'Edited by: ')}{item.lastEditedBy || item.username}
                                        {item.lastEditedByOwner === false ? tr('（非创建者）', ' (not the creator)') : ''}
                                    </Typography>
                                    {item.lastEditedByOwner === false ? (
                                        <Typography variant="caption" color="warning.main">
                                            {tr('审核提示：由创建者之外的用户编辑', 'Review note: edited by someone other than the creator')}
                                        </Typography>
                                    ) : null}
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                        <Button variant="outlined" onClick={() => openEditor(item)} sx={adminOutlinedButtonSx}>
                                            {tr('编辑', 'Edit')}
                                        </Button>
                                        <Button variant="text" color="error" onClick={() => openEditor(item)}>
                                            {tr('删除', 'Delete')}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                        {filteredMarkers.length > PAGE_SIZE ? (
                            <Pagination
                                count={Math.max(1, Math.ceil(filteredMarkers.length / PAGE_SIZE))}
                                page={page}
                                onChange={(_, p) => setPage(p)}
                                color="primary"
                                sx={adminPaginationSx}
                            />
                        ) : null}
                    </Stack>
                )}
            </Stack>

            <MarkerFormDialog
                open={Boolean(draft)}
                draft={draft}
                editingId={editingId}
                canDelete={true}
                categoryLabel={categoryLabel}
                markImageFile={markImageFile}
                setDraft={setDraft}
                onClose={() => {
                    setDraft(null)
                    setEditingId(null)
                }}
                onSave={handleSave}
                onDelete={handleDelete}
                onMarkImageChange={setMarkImageFile}
            />
        </Box>
    )
}
