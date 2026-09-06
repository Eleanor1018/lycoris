import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {toBackendAssetUrl} from '../config/runtime';
import {ApiError, requestJson} from '../lib/http';
import {
  advanceSessionGeneration,
  clearNativeSessionCookies,
  getSessionGeneration,
  SESSION_EXPIRED_MESSAGE,
  subscribeSessionExpired,
} from '../lib/session';
import type {ApiResponse, Me} from '../types/auth';

type AuthContextValue = {
  user: Me | null;
  loading: boolean;
  isLoggedIn: boolean;
  sessionNotice: string;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {
    username: string;
    nickname: string;
    email: string;
    password: string;
    website?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_USER_STORAGE_KEY = 'lycoris.auth.user.v1';

const normalizeUser = (user: Me): Me => ({
  ...user,
  avatarUrl: toBackendAssetUrl(user.avatarUrl),
});

const readCachedUser = async (): Promise<Me | null> => {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Me;
    if (!parsed?.publicId || !parsed?.username || !parsed?.email) return null;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
};

const writeCachedUser = async (user: Me | null): Promise<void> => {
  try {
    if (user) {
      await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  } catch {
    // Storage failures should not break runtime auth.
  }
};

const getPayloadData = <T,>(payload: ApiResponse<T> | T): T | null => {
  if (!payload) return null;
  if (typeof payload === 'object' && 'data' in (payload as object)) {
    return ((payload as ApiResponse<T>).data ?? null) as T | null;
  }
  return payload as T;
};

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');
  const userRef = useRef<Me | null>(null);
  const pendingSessionClearRef = useRef<Promise<void>>(Promise.resolve());

  const setAuthUser = useCallback((next: Me | null) => {
    const normalized = next ? normalizeUser(next) : null;
    userRef.current = normalized;
    setUser(normalized);
    writeCachedUser(normalized).catch(() => undefined);
  }, []);

  useEffect(() => subscribeSessionExpired(() => {
    const hadUser = userRef.current !== null;
    setAuthUser(null);
    if (hadUser) setSessionNotice(SESSION_EXPIRED_MESSAGE);
    pendingSessionClearRef.current = clearNativeSessionCookies().catch(() => undefined);
  }), [setAuthUser]);

  const refresh = useCallback(async () => {
    const requestGeneration = getSessionGeneration();
    try {
      const payload = await requestJson<ApiResponse<Me>>('/api/me');
      const me = getPayloadData(payload);
      if (requestGeneration === getSessionGeneration()) setAuthUser(me ?? null);
    } catch {
      // The HTTP layer handles expired sessions; network failures keep the cache.
    }
  }, [setAuthUser]);

  const login = useCallback(async (username: string, password: string) => {
    await pendingSessionClearRef.current;
    advanceSessionGeneration();
    const payload = await requestJson<ApiResponse<Me>>('/api/login', {
      method: 'POST',
      body: JSON.stringify({username, password}),
    });
    const me = getPayloadData(payload);
    if (!me) {
      throw new ApiError(500, 'Login succeeded but user payload is empty');
    }
    advanceSessionGeneration();
    setSessionNotice('');
    setAuthUser(me);
  }, [setAuthUser]);

  const register = useCallback(
    async (payload: {
      username: string;
      nickname: string;
      email: string;
      password: string;
      website?: string;
    }) => {
      await pendingSessionClearRef.current;
      advanceSessionGeneration();
      const result = await requestJson<ApiResponse<Me>>('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          username: payload.username,
          nickname: payload.nickname,
          email: payload.email,
          password: payload.password,
          website: payload.website ?? '',
        }),
      });
      const me = getPayloadData(result);
      if (!me) {
        throw new ApiError(500, 'Register succeeded but user payload is empty');
      }
      advanceSessionGeneration();
      setSessionNotice('');
      setAuthUser(me);
    },
    [setAuthUser],
  );

  const logout = useCallback(async () => {
    advanceSessionGeneration();
    try {
      await requestJson<ApiResponse<null>>('/api/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore backend logout failure and always clear local auth state.
    }
    setAuthUser(null);
    setSessionNotice('');
    pendingSessionClearRef.current = clearNativeSessionCookies().catch(() => undefined);
    await pendingSessionClearRef.current;
  }, [setAuthUser]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const cached = await readCachedUser();
      if (alive && cached) {
        userRef.current = cached;
        setUser(cached);
      }
      await refresh();
      if (alive) {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isLoggedIn: Boolean(user),
      sessionNotice,
      refresh,
      login,
      register,
      logout,
    }),
    [user, loading, sessionNotice, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return context;
};
