import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from "axios";
import { toBackendAssetUrl } from '../config/runtime'

export type Me = {
    publicId: string
    username: string
    nickname?: string
    email: string
    avatarUrl?: string
    pronouns?: string
    signature?: string
}

type AuthContextValue = {
    user: Me | null
    loading: boolean
    isLoggedIn: boolean
    refresh: () => Promise<void>
    setUser: (u: Me | null) => void
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<Me | null>(null)
    const [loading, setLoading] = useState(true)

    const refresh = async () => {
        try {
            const res = await axios.get('/api/me', {withCredentials: true})
            const data = res.data?.data ?? null
            if (!data) {
                setUser(null)
                return
            }
            setUser({
                ...data,
                avatarUrl: toBackendAssetUrl(data.avatarUrl),
            })
        } catch {
            setUser(null)
        }
    }

    const logout = async () => {
        // 如果你后端还没写 /logout，就先注释掉请求也行
        try {
            await axios.post('/api/logout',null, {withCredentials: true})
        } catch {
            // ignore
        }
        setUser(null)
    }

    useEffect(() => {
        ;(async () => {
            setLoading(true)
            await refresh()
            setLoading(false)
        })()
    }, [])

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading,
            isLoggedIn: !!user,
            refresh,
            setUser,
            logout,
        }),
        [user, loading]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
    return ctx
}
