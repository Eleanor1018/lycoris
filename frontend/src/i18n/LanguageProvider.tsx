import axios from 'axios'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type Language = 'zh' | 'en'

type LanguageContextValue = {
    language: Language
    setLanguage: (language: Language) => void
    toggleLanguage: () => void
    tr: (zh: string, en: string) => string
}

const LANGUAGE_STORAGE_KEY = 'lycoris.language.v1'
const LanguageContext = createContext<LanguageContextValue | null>(null)

const detectInitialLanguage = (): Language => {
    if (typeof window === 'undefined') return 'en'
    try {
        const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
        if (saved === 'zh' || saved === 'en') return saved
    } catch {
        // Storage may be unavailable in private browsing; browser language still works.
    }
    try {
        const browserLanguage = window.navigator?.language?.toLowerCase() ?? ''
        return browserLanguage.startsWith('zh') ? 'zh' : 'en'
    } catch {
        return 'en'
    }
}

const initialLanguage = detectInitialLanguage()

const applyLanguage = (language: Language) => {
    axios.defaults.headers.common['Accept-Language'] = language === 'zh' ? 'zh-CN' : 'en'
    if (typeof document !== 'undefined') {
        document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    }
}

applyLanguage(initialLanguage)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>(initialLanguage)

    const setLanguage = useCallback((next: Language) => {
        applyLanguage(next)
        setLanguageState(next)
        try {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
        } catch {
            // Keep the in-memory preference usable when persistence is unavailable.
        }
    }, [])

    const toggleLanguage = useCallback(() => {
        setLanguageState((current) => {
            const next = current === 'zh' ? 'en' : 'zh'
            applyLanguage(next)
            try {
                window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
            } catch {
                // Keep the in-memory preference usable when persistence is unavailable.
            }
            return next
        })
    }, [])

    const tr = useCallback((zh: string, en: string) => (language === 'zh' ? zh : en), [language])

    const value = useMemo(
        () => ({ language, setLanguage, toggleLanguage, tr }),
        [language, setLanguage, toggleLanguage, tr]
    )

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) throw new Error('useLanguage must be used within <LanguageProvider>')
    return context
}
