import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import imageCompression from 'browser-image-compression'
import type { MarkerCategory } from '../types/marker'

export type DraftMarker = {
    tempId: string
    lat: number
    lng: number
    category: MarkerCategory
    title: string
    description: string
    isPublic: boolean
    openTimeStart: string
    openTimeEnd: string
    markImage?: string
}

type Props = {
    open: boolean
    draft: DraftMarker | null
    editingId: number | null
    canDelete?: boolean
    categoryLabel: Record<string, string>
    markImageFile: File | null
    setDraft: React.Dispatch<React.SetStateAction<DraftMarker | null>>
    onClose: () => void
    onSave: () => void
    onDelete: () => void
    onMarkImageChange: (file: File | null) => void
    canUploadImage?: boolean
}

export default function MarkerFormDialog({
    open,
    draft,
    editingId,
    canDelete = true,
    categoryLabel,
    markImageFile,
    setDraft,
    onClose,
    onSave,
    onDelete,
    onMarkImageChange,
    canUploadImage = true,
}: Props) {
    const [imageError, setImageError] = useState('')
    const [imageHint, setImageHint] = useState('')
    const [processingImage, setProcessingImage] = useState(false)
    const [startHourInput, setStartHourInput] = useState('')
    const [startMinuteInput, setStartMinuteInput] = useState('')
    const [endHourInput, setEndHourInput] = useState('')
    const [endMinuteInput, setEndMinuteInput] = useState('')

    useEffect(() => {
        if (!open) {
            setImageError('')
            setImageHint('')
            setProcessingImage(false)
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        const start = splitTime(draft?.openTimeStart)
        const end = splitTime(draft?.openTimeEnd)
        setStartHourInput(start.hour)
        setStartMinuteInput(start.minute)
        setEndHourInput(end.hour)
        setEndMinuteInput(end.minute)
    }, [open, draft?.tempId, draft?.openTimeStart, draft?.openTimeEnd])

    const fieldSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 3,
        },
    }
    const MAX_MARKER_IMAGE_SIZE = 5 * 1024 * 1024

    const splitTime = (value?: string) => {
        if (!value || !/^\d{2}:\d{2}$/.test(value)) return { hour: '', minute: '' }
        const [hour, minute] = value.split(':')
        return { hour, minute }
    }

    const normalizePart = (value: string, max: number) => {
        if (!value) return ''
        const digits = value.replace(/\D/g, '').slice(0, 2)
        if (!digits) return ''
        const n = Number(digits)
        if (!Number.isFinite(n)) return ''
        return String(Math.max(0, Math.min(max, n))).padStart(2, '0')
    }

    const commitTime = (
        key: 'openTimeStart' | 'openTimeEnd',
        hour: string,
        minute: string
    ) => {
        setDraft((d) => {
            if (!d) return d
            return { ...d, [key]: hour.length === 2 && minute.length === 2 ? `${hour}:${minute}` : '' }
        })
    }

    const handlePartChange = (
        key: 'openTimeStart' | 'openTimeEnd',
        part: 'hour' | 'minute',
        rawValue: string
    ) => {
        const digits = rawValue.replace(/\D/g, '').slice(0, 2)
        if (key === 'openTimeStart') {
            if (part === 'hour') {
                setStartHourInput(digits)
                commitTime(key, digits, startMinuteInput)
            } else {
                setStartMinuteInput(digits)
                commitTime(key, startHourInput, digits)
            }
        } else {
            if (part === 'hour') {
                setEndHourInput(digits)
                commitTime(key, digits, endMinuteInput)
            } else {
                setEndMinuteInput(digits)
                commitTime(key, endHourInput, digits)
            }
        }
    }

    const handlePartBlur = (
        key: 'openTimeStart' | 'openTimeEnd',
        part: 'hour' | 'minute',
        rawValue: string
    ) => {
        const normalized = normalizePart(rawValue, part === 'hour' ? 23 : 59)
        if (key === 'openTimeStart') {
            if (part === 'hour') {
                setStartHourInput(normalized)
                commitTime(key, normalized, startMinuteInput)
            } else {
                setStartMinuteInput(normalized)
                commitTime(key, startHourInput, normalized)
            }
        } else {
            if (part === 'hour') {
                setEndHourInput(normalized)
                commitTime(key, normalized, endMinuteInput)
            } else {
                setEndMinuteInput(normalized)
                commitTime(key, endHourInput, normalized)
            }
        }
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 4 } }}
        >
            <DialogTitle
                sx={{
                    fontWeight: 800,
                    textAlign: 'center',
                    fontSize: { xs: 24, md: 30 },
                    pt: 3,
                }}
            >
                {editingId ? '编辑点位' : '新增点位'}
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 2.5, md: 4 }, pb: 3 }}>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                    {draft ? `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}` : ''}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={2}>
                    <FormControl fullWidth>
                        <InputLabel id="cat-label">类别</InputLabel>
                        <Select
                            labelId="cat-label"
                            label="类别"
                            value={draft?.category ?? 'accessible_toilet'}
                            sx={fieldSx}
                            onChange={(e) =>
                                setDraft((d) => (d ? { ...d, category: e.target.value as MarkerCategory } : d))
                            }
                        >
                            {Object.entries(categoryLabel).map(([k, v]) => (
                                <MenuItem key={k} value={k}>
                                    {v}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="标题"
                        value={draft?.title ?? ''}
                        onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                        placeholder="例如：地铁站A口无障碍卫生间"
                        fullWidth
                        sx={fieldSx}
                    />

                    <TextField
                        label="描述"
                        value={draft?.description ?? ''}
                        onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                        placeholder="例如：入口在XX旁边，晚上关闭时间…"
                        fullWidth
                        multiline
                        minRows={4}
                        sx={fieldSx}
                    />

                    <Button
                        variant="outlined"
                        component="label"
                        disabled={!canUploadImage}
                        sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            borderColor: 'rgba(116, 73, 136, 0.5)',
                            color: '#744988',
                        }}
                    >
                        {canUploadImage ? '选择图片（可选）' : '仅创建者可上传图片'}
                            <input
                                type="file"
                                accept="image/*"
                                hidden
                                disabled={!canUploadImage}
                                onChange={async (e) => {
                                    const f = e.target.files?.[0] ?? null
                                    if (!f) {
                                        setImageError('')
                                        setImageHint('')
                                        setProcessingImage(false)
                                        onMarkImageChange(null)
                                        return
                                    }

                                    setImageError('')
                                    setImageHint('')
                                    setProcessingImage(true)

                                    try {
                                        let nextFile = f
                                        const lowerName = f.name.toLowerCase()
                                        const isHeicLike =
                                            f.type === 'image/heic' ||
                                            f.type === 'image/heif' ||
                                            lowerName.endsWith('.heic') ||
                                            lowerName.endsWith('.heif')

                                        if (isHeicLike) {
                                            const { default: heic2any } = await import('heic2any')
                                            const blob = await heic2any({
                                                blob: f,
                                                toType: 'image/jpeg',
                                                quality: 0.92,
                                            })
                                            const converted = Array.isArray(blob) ? blob[0] : blob
                                            const safeName = f.name.replace(/\.(heic|heif)$/i, '.jpg')
                                            nextFile = new File([converted], safeName, { type: 'image/jpeg' })
                                        }

                                        if (nextFile.size > MAX_MARKER_IMAGE_SIZE) {
                                            const compressed = await imageCompression(nextFile, {
                                                maxSizeMB: 3,
                                                maxWidthOrHeight: 2048,
                                                useWebWorker: true,
                                                initialQuality: 0.85,
                                            })
                                            nextFile = new File([compressed], nextFile.name, {
                                                type: compressed.type || nextFile.type,
                                            })
                                        }

                                        if (nextFile.size > MAX_MARKER_IMAGE_SIZE) {
                                            throw new Error('图片处理后仍超过 5MB')
                                        }

                                        if (nextFile !== f) {
                                            setImageHint(
                                                `已自动处理图片（${(f.size / 1024 / 1024).toFixed(2)}MB → ${(nextFile.size / 1024 / 1024).toFixed(2)}MB）`
                                            )
                                        }

                                        onMarkImageChange(nextFile)
                                    } catch (err: unknown) {
                                        const message = err instanceof Error ? err.message : '图片处理失败，请换一张图片试试'
                                        setImageError(message)
                                        onMarkImageChange(null)
                                        e.currentTarget.value = ''
                                    } finally {
                                        setProcessingImage(false)
                                    }
                                }}
                            />
                        </Button>
                    {processingImage ? (
                        <Alert
                            severity="info"
                            icon={<CircularProgress size={16} color="inherit" />}
                            sx={{ borderRadius: 2 }}
                        >
                            正在处理图片，请稍候...
                        </Alert>
                    ) : null}
                    {imageHint ? (
                        <Alert severity="success" sx={{ borderRadius: 2 }}>
                            {imageHint}
                        </Alert>
                    ) : null}
                    {imageError ? (
                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            {imageError}
                        </Alert>
                    ) : null}
                    {markImageFile ? (
                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                            已选择：{markImageFile.name}
                        </Typography>
                    ) : null}

                    <FormControlLabel
                        control={
                            <Switch
                                checked={Boolean(draft?.isPublic)}
                                onChange={(e) =>
                                    setDraft((d) => (d ? { ...d, isPublic: e.target.checked } : d))
                                }
                            />
                        }
                        label="公开共享"
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="stretch">
                        <Stack spacing={1} sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                可用开始时间
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    label="时"
                                    value={startHourInput}
                                    onChange={(e) => handlePartChange('openTimeStart', 'hour', e.target.value)}
                                    onBlur={(e) => handlePartBlur('openTimeStart', 'hour', e.target.value)}
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 }}
                                    placeholder="00"
                                    sx={{ ...fieldSx, width: 90 }}
                                />
                                <Typography sx={{ opacity: 0.7 }}>:</Typography>
                                <TextField
                                    label="分"
                                    value={startMinuteInput}
                                    onChange={(e) => handlePartChange('openTimeStart', 'minute', e.target.value)}
                                    onBlur={(e) => handlePartBlur('openTimeStart', 'minute', e.target.value)}
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 }}
                                    placeholder="00"
                                    sx={{ ...fieldSx, width: 90 }}
                                />
                            </Stack>
                        </Stack>

                        <Stack spacing={1} sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                可用结束时间
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    label="时"
                                    value={endHourInput}
                                    onChange={(e) => handlePartChange('openTimeEnd', 'hour', e.target.value)}
                                    onBlur={(e) => handlePartBlur('openTimeEnd', 'hour', e.target.value)}
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 }}
                                    placeholder="00"
                                    sx={{ ...fieldSx, width: 90 }}
                                />
                                <Typography sx={{ opacity: 0.7 }}>:</Typography>
                                <TextField
                                    label="分"
                                    value={endMinuteInput}
                                    onChange={(e) => handlePartChange('openTimeEnd', 'minute', e.target.value)}
                                    onBlur={(e) => handlePartBlur('openTimeEnd', 'minute', e.target.value)}
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 }}
                                    placeholder="00"
                                    sx={{ ...fieldSx, width: 90 }}
                                />
                            </Stack>
                        </Stack>
                    </Stack>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        两项都留空表示全天可用；若填写需同时填写开始和结束时间（每日重复）。
                    </Typography>

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button onClick={onClose} sx={{ borderRadius: 999, textTransform: 'none' }}>
                            取消
                        </Button>
                        {editingId && canDelete ? (
                            <Button
                                color="error"
                                onClick={onDelete}
                                sx={{ borderRadius: 999, textTransform: 'none' }}
                            >
                                删除
                            </Button>
                        ) : null}
                        <Button
                            variant="contained"
                            onClick={onSave}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                bgcolor: '#b784a7',
                                '&:hover': { bgcolor: '#b784a7', opacity: 0.9 },
                            }}
                        >
                            保存
                        </Button>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    )
}
