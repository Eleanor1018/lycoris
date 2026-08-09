import { Box, Typography } from '@mui/material'

export default function Tools() {
    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#744988' }}>
                The tools module is being developed separately
            </Typography>
            <Typography sx={{ mt: 1, opacity: 0.75 }}>
                Tools are hidden in this first website release and will return later as a standalone app.
            </Typography>
        </Box>
    )
}
