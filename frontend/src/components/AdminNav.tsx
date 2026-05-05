import { Button, Stack } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

export default function AdminNav() {
    const navigate = useNavigate()
    const location = useLocation()

    const items = [
        { label: '管理入口', path: '/admin' },
        { label: '审核中心', path: '/admin/review' },
        { label: '全量点位', path: '/admin/all' },
        { label: '用户管理', path: '/admin/usr' },
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
                        }}
                    >
                        {item.label}
                    </Button>
                )
            })}
        </Stack>
    )
}
