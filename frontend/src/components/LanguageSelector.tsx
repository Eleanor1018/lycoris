import { useState } from 'react'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import TranslateIcon from '@mui/icons-material/Translate'
import { useLanguage } from '../i18n/LanguageProvider'

export default function LanguageSelector() {
    const { preference, setPreference, t } = useLanguage()
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    return <>
        <Tooltip title={t('语言')}>
            <IconButton aria-label={t('语言')} aria-haspopup="menu" aria-expanded={Boolean(anchor)}
                onClick={(event) => setAnchor(event.currentTarget)}
                sx={{ color: 'var(--ly-color-ink)', width: 44, height: 44, flexShrink: 0 }}>
                <TranslateIcon />
            </IconButton>
        </Tooltip>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {(['system', 'zh', 'en'] as const).map((value) => <MenuItem key={value}
                selected={preference === value} onClick={() => { setPreference(value); setAnchor(null) }}>
                {value === 'system' ? t('跟随系统') : value === 'zh' ? '中文' : 'English'}
            </MenuItem>)}
        </Menu>
    </>
}
