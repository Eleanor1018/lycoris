import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {toBackendAssetUrl} from '../config/runtime';
import {ApiError, requestJson} from '../lib/http';
import type {ApiResponse, Me} from '../types/auth';

type AuthContextValue = {
  user: Me | null;
  loading: boolean;
  isLoggedIn: boolean;
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

const normalizeUser = (user: Me): Me => ({
  ...user,
  avatarUrl: toBackendAssetUrl(user.avatarUrl),
});

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

  const refresh = useCallback(async () => {
    try {
      const payload = await requestJson<ApiResponse<Me>>('/api/me');
      const me = getPayloadData(payload);
      setUser(me ? normalizeUser(me) : null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return;
      }
      setUser(null);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const payload = await requestJson<ApiResponse<Me>>('/api/login', {
      method: 'POST',
      body: JSON.stringify({username, password}),
    });
    const me = getPayloadData(payload);
    if (!me) {
      throw new ApiError(500, 'Login succeeded but user payload is empty');
    }
    setUser(normalizeUser(me));
  }, []);

  const register = useCallback(
    async (payload: {
      username: string;
      nickname: string;
      email: string;
      password: string;
      website?: string;
    }) => {
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
      setUser(normalizeUser(me));
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await requestJson<ApiResponse<null>>('/api/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore backend logout failure and always clear local auth state.
    }
    setUser(null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
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
      refresh,
      login,
      register,
      logout,
    }),
    [user, loading, refresh, login, register, logout],
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
