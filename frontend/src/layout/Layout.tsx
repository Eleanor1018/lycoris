import {Outlet} from "react-router-dom";
import NavigationBar from "../components/NavigationBar.tsx";
import { Box } from '@mui/material'


export default function Layout(){
    return (
        <>
            <NavigationBar></NavigationBar>
            <Box
                component="main"
                sx={{
                    pt: 'var(--nav-offset, var(--nav-height, 64px))',
                    minHeight: 'calc(100vh - var(--nav-offset, var(--nav-height, 64px)))',
                }}
            >
                <Outlet></Outlet>
            </Box>
        </>
    )
}
