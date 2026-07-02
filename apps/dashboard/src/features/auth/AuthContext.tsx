import type { AuthUserDto, LoginRequestDto } from '@logistics/shared-types';
import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { authApi } from '../../services/auth.api';
import { ACCESS_TOKEN_KEY } from '../../services/apiClient';

interface AuthContextValue {
  user: AuthUserDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequestDto) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) { setIsLoading(false); return; }
    authApi.me().then(setUser).catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (credentials: LoginRequestDto) => {
    await authApi.login(credentials);
    setUser(await authApi.me());
  }, []);
  const logout = useCallback(async () => { await authApi.logout(); setUser(null); }, []);
  const value = useMemo(() => ({ user, isLoading, isAuthenticated: Boolean(user), login, logout }), [user, isLoading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
