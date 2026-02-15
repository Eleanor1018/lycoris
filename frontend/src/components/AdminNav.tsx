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
        <Stack direction="row" spacing={1} flexWrap="wrap">
            {items.map((item) => {
                const active = location.pathname === item.path
                return (
                    <Button
                        key={item.path}
                        variant={active ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => navigate(item.path)}
                    >
                        {item.label}
                    </Button>
                )
            })}
        </Stack>
    )
}
