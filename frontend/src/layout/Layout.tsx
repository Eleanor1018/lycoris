import {Outlet, useLocation} from "react-router-dom";
import NavigationBar from "../components/NavigationBar.tsx";
import { Box } from '@mui/material'


export default function Layout(){
    const location = useLocation()
    const isMapPage = location.pathname.startsWith('/maps')

    return (
        <>
            <NavigationBar></NavigationBar>
            <Box
                component="main"
                sx={{
                    pt: isMapPage ? 0 : 'var(--nav-height, 80px)',
                    minHeight: '100vh',
                }}
            >
                <Outlet></Outlet>
            </Box>
        </>
    )
}
