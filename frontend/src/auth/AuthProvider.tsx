import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
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
const AUTH_USER_STORAGE_KEY = 'lycoris.auth.user.v1'

const normalizeUser = (raw: unknown): Me | null => {
    if (!raw || typeof raw !== 'object') return null
    const data = raw as Partial<Me>
    if (!data.publicId || !data.username || !data.email) return null
    return {
        publicId: String(data.publicId),
        username: String(data.username),
        nickname: data.nickname ? String(data.nickname) : undefined,
        email: String(data.email),
        avatarUrl: toBackendAssetUrl(data.avatarUrl),
        pronouns: data.pronouns ? String(data.pronouns) : undefined,
        signature: data.signature ? String(data.signature) : undefined,
    }
}

const readCachedUser = (): Me | null => {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY)
        if (!raw) return null
        return normalizeUser(JSON.parse(raw))
    } catch {
        return null
    }
}

const writeCachedUser = (user: Me | null) => {
    if (typeof window === 'undefined') return
    try {
        if (user) {
            window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
        } else {
            window.localStorage.removeItem(AUTH_USER_STORAGE_KEY)
        }
    } catch {
        // Ignore storage failures and keep runtime auth usable.
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<Me | null>(() => readCachedUser())
    const [loading, setLoading] = useState(true)

    const setUser = useCallback((next: Me | null) => {
        const normalized = next ? normalizeUser(next) : null
        setUserState(normalized)
        writeCachedUser(normalized)
    }, [])

    const refresh = useCallback(async () => {
        try {
            const res = await axios.get('/api/me', { withCredentials: true })
            const nextUser = normalizeUser(res.data?.data ?? null)
            if (!nextUser) {
                setUser(null)
                return
            }
            setUser(nextUser)
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response && [401, 403].includes(error.response.status)) {
                setUser(null)
            }
        } finally {
            setLoading(false)
        }
    }, [setUser])

    const logout = useCallback(async () => {
        try {
            await axios.post('/api/logout', null, { withCredentials: true })
        } catch {
            // ignore
        }
        setUser(null)
    }, [setUser])

    useEffect(() => {
        setLoading(true)
        void refresh()
    }, [refresh])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleFocus = () => {
            void refresh()
        }
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refresh()
            }
        }
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== AUTH_USER_STORAGE_KEY) return
            setUserState(readCachedUser())
        }

        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('storage', handleStorage)
        return () => {
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('storage', handleStorage)
        }
    }, [refresh])

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading,
            isLoggedIn: !!user,
            refresh,
            setUser,
            logout,
        }),
        [user, loading, refresh, setUser, logout]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
    return ctx
}
