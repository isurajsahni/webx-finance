import { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler } from '@/api/client';
import { useMe } from '@/api/hooks';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const me = useMe();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.setQueryData(['me'], null);
    });
  }, [qc]);

  const value = {
    user: me.data ?? null,
    isLoading: me.isPending,
    error: me.error,
    isOwner: me.data?.role === 'owner',
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      qc.setQueryData(['me'], data.user);
      return data.user;
    },
    async logout() {
      await api.post('/auth/logout').catch(() => {});
      qc.clear();
      qc.setQueryData(['me'], null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
