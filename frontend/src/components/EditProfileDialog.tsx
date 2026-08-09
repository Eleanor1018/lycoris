import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import imageCompression from 'browser-image-compression'

const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const COMPRESSED_TARGET_MB = 2

type EditProfileDialogProps = {
    open: boolean
    nickname: string
    pronouns: string
    signature: string
    avatarFile: File | null
    onNicknameChange: (value: string) => void
    onPronounsChange: (value: string) => void
    onSignatureChange: (value: string) => void
    onAvatarChange: (file: File | null) => void
    onClose: () => void
    onSave: () => Promise<void>
}

export default function EditProfileDialog({
    open,
    nickname,
    pronouns,
    signature,
    avatarFile,
    onNicknameChange,
    onPronounsChange,
    onSignatureChange,
    onAvatarChange,
    onClose,
    onSave,
}: EditProfileDialogProps) {
    const [avatarError, setAvatarError] = useState('')
    const [avatarHint, setAvatarHint] = useState('')
    const [isCompressing, setIsCompressing] = useState(false)
    useEffect(() => {
        if (!open) {
            setAvatarError('')
            setAvatarHint('')
            setIsCompressing(false)
        }
    }, [open])
    const fieldSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 3,
        },
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
            <DialogContent sx={{ px: { xs: 2.5, md: 4 }, py: 2.5 }}>
                <Stack spacing={2.5}>
                    <Typography
                        variant="h5"
                        sx={{
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: { xs: 30, md: 34 },
                            py: 0.5,
                        }}
                    >
                        Edit profile
                    </Typography>

                    <TextField
                        label="Display name"
                        value={nickname}
                        onChange={(e) => onNicknameChange(e.target.value)}
                        fullWidth
                        sx={fieldSx}
                    />

                    <TextField
                        label="Pronouns"
                        value={pronouns}
                        onChange={(e) => onPronounsChange(e.target.value)}
                        placeholder="For example, she/her"
                        fullWidth
                        sx={fieldSx}
                    />

                    <TextField
                        label="Bio"
                        value={signature}
                        onChange={(e) => onSignatureChange(e.target.value)}
                        placeholder="Tell people a little about yourself"
                        fullWidth
                        multiline
                        minRows={2}
                        sx={fieldSx}
                    />

                    <Box>
                        <Button
                            variant="outlined"
                            component="label"
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                borderColor: 'rgba(116, 73, 136, 0.5)',
                                color: '#744988',
                            }}
                        >
                            Choose profile photo
                            <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={async (e) => {
                                    const f = e.target.files?.[0] ?? null
                                    if (!f) {
                                        setAvatarError('')
                                        setAvatarHint('')
                                        setIsCompressing(false)
                                        onAvatarChange(null)
                                        return
                                    }

                                    let finalFile = f
                                    setAvatarError('')
                                    setAvatarHint('')
                                    setIsCompressing(true)

                                    try {
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
                                            finalFile = new File([converted], safeName, { type: 'image/jpeg' })
                                            setAvatarHint('HEIC converted to JPG automatically.')
                                        }
                                    } catch {
                                        setAvatarError('Could not convert the HEIC image. Please try another image.')
                                        onAvatarChange(null)
                                        e.currentTarget.value = ''
                                        setIsCompressing(false)
                                        return
                                    }

                                    if (finalFile.size > MAX_AVATAR_SIZE) {
                                        try {
                                            const compressed = await imageCompression(finalFile, {
                                                maxSizeMB: COMPRESSED_TARGET_MB,
                                                maxWidthOrHeight: 2048,
                                                useWebWorker: true,
                                                initialQuality: 0.85,
                                            })
                                            finalFile = new File([compressed], finalFile.name, {
                                                type: compressed.type || finalFile.type,
                                            })
                                            setAvatarHint(`Profile photo compressed automatically (${(f.size / 1024 / 1024).toFixed(2)} MB → ${(finalFile.size / 1024 / 1024).toFixed(2)} MB).`)
                                        } catch {
                                            setAvatarError('Could not compress the profile photo. Please try a smaller image.')
                                            onAvatarChange(null)
                                            e.currentTarget.value = ''
                                            setIsCompressing(false)
                                            return
                                        }
                                    }

                                    if (finalFile.size > MAX_AVATAR_SIZE) {
                                        setAvatarError('The compressed image is still over 5 MB. Please choose a smaller image.')
                                        onAvatarChange(null)
                                        e.currentTarget.value = ''
                                        setIsCompressing(false)
                                        return
                                    }

                                    onAvatarChange(finalFile)
                                    setIsCompressing(false)
                                }}
                            />
                        </Button>
                        {isCompressing ? (
                            <Alert
                                severity="info"
                                icon={<CircularProgress size={16} color="inherit" />}
                                sx={{ mt: 1, borderRadius: 2 }}
                            >
                                Compressing your profile photo…
                            </Alert>
                        ) : null}
                        {avatarHint ? (
                            <Alert severity="success" sx={{ mt: 1, borderRadius: 2 }}>
                                {avatarHint}
                            </Alert>
                        ) : null}
                        {avatarError ? (
                            <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
                                {avatarError}
                            </Alert>
                        ) : null}
                        {avatarFile ? (
                            <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
                                Selected: {avatarFile.name}
                            </Alert>
                        ) : null}
                    </Box>

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button onClick={onClose} disabled={isCompressing} sx={{ borderRadius: 999, textTransform: 'none' }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={onSave}
                            disabled={isCompressing}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                bgcolor: '#b784a7',
                                '&:hover': { bgcolor: '#b784a7', opacity: 0.9 },
                            }}
                        >
                            Save
                        </Button>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    )
}
