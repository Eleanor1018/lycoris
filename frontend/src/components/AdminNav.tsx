import { Button, Stack } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageProvider'

const adminNavButtonSx = {
    borderRadius: 999,
    fontWeight: 700,
    '&.MuiButton-contained': {
        bgcolor: '#f4b3cc',
        color: 'var(--ly-color-ink)',
        borderColor: '#f4b3cc',
        boxShadow: '0 8px 18px rgba(244, 179, 204, 0.32)',
        '&:hover': {
            bgcolor: '#efa7c5',
            borderColor: '#efa7c5',
        },
    },
    '&.MuiButton-outlined': {
        color: 'var(--ly-color-ink)',
        borderColor: 'rgba(90, 56, 80, 0.28)',
        '&:hover': {
            bgcolor: 'rgba(252, 221, 236, 0.36)',
            borderColor: '#f4b3cc',
        },
    },
}

export default function AdminNav() {
    const navigate = useNavigate()
    const location = useLocation()
    const { tr } = useLanguage()

    const items = [
        { label: tr('管理入口', 'Admin access'), path: '/admin' },
        { label: tr('审核中心', 'Review center'), path: '/admin/review' },
        { label: tr('全量点位', 'All places'), path: '/admin/all' },
        { label: tr('用户管理', 'User management'), path: '/admin/usr' },
    ]

    return (
        <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ minWidth: 0, maxWidth: '100%' }}
        >
            {items.map((item) => {
                const active = location.pathname === item.path
                return (
                    <Button
                        key={item.path}
                        variant={active ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => navigate(item.path)}
                        sx={{
                            flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' },
                            minWidth: 0,
                            px: { xs: 1, sm: 2 },
                            whiteSpace: 'nowrap',
                            ...adminNavButtonSx,
                        }}
                    >
                        {item.label}
                    </Button>
                )
            })}
        </Stack>
    )
}
