import {Route, Routes} from "react-router-dom";
import Home from "./pages/Home.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Layout from "./layout/Layout.tsx";
import Maps from "./pages/Maps.tsx";
import Documents from "./pages/Documents.tsx";
import Profile from "./pages/Profile.tsx";
import ChangePassword from "./pages/ChangePassword.tsx";
import Search from "./pages/Search.tsx";
import About from "./pages/About.tsx";
import Admin from "./pages/Admin.tsx";
import AdminAll from "./pages/AdminAll.tsx";
import AdminEntry from "./pages/AdminEntry.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";



export default function App() {

    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="" element={<Home/>}></Route>
                <Route path="/about" element={<About/>}></Route>
                <Route path="/maps" element={<Maps />}></Route>
                <Route path="/documents" element={<Documents/>}></Route>
                <Route path="/documents/:slug?" element={<Documents></Documents>}></Route>
                <Route path="/login" element={<Login/>}></Route>
                <Route path="/register" element={<Register/>}></Route>
                <Route path="/me" element={<Profile/>}></Route>
                <Route path="/me/password" element={<ChangePassword/>}></Route>
                <Route path="/search" element={<Search/>}></Route>
                <Route path="/admin" element={<AdminEntry/>}></Route>
                <Route path="/admin/review" element={<Admin/>}></Route>
                <Route path="/admin/all" element={<AdminAll/>}></Route>
                <Route path="/admin/usr" element={<AdminUsers/>}></Route>
            </Route>
        </Routes>
    )
}
