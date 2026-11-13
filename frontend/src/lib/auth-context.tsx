'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { limpiarTenantConfig } from './tenant-config';
import { setAccessToken, clearAccessToken } from './token-store';
import { decodeJwt } from './jwt';
import { RolUsuario } from '@/types';

interface AuthUser {
  userId: string;
  tenantId: string;
  rol: RolUsuario;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  // Devuelve 'mfa' si la cuenta tiene segundo factor y falta el código.
  login: (email: string, password: string, codigo?: string) => Promise<'ok' | 'mfa'>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const applyToken = useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    const decoded = decodeJwt(accessToken);
    if (decoded) {
      setUser({
        userId: decoded.sub,
        tenantId: decoded.tenantId,
        rol: decoded.rol,
        email: decoded.email,
      });
    }
  }, []);

  useEffect(() => {
    // Al montar, intenta recuperar sesión usando la cookie httpOnly del refresh token.
    api
      .post('/auth/refresh')
      .then((res) => applyToken(res.data.accessToken))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [applyToken]);

  const login = useCallback(
    async (email: string, password: string, codigo?: string): Promise<'ok' | 'mfa'> => {
      const res = await api.post('/auth/login', { email, password, ...(codigo ? { codigo } : {}) });
      if (res.data.mfaRequerido) return 'mfa';
      limpiarTenantConfig();
      applyToken(res.data.accessToken);
      router.push('/dashboard');
      return 'ok';
    },
    [applyToken, router],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    clearAccessToken();
    limpiarTenantConfig();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
