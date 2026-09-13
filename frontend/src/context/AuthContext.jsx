import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nutritrack_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Verify stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('nutritrack_token');
    if (token) {
      authApi.getMe()
        .then(({ data }) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('nutritrack_token');
          localStorage.removeItem('nutritrack_refresh_token');
          localStorage.removeItem('nutritrack_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('nutritrack_token', data.accessToken);
    localStorage.setItem('nutritrack_refresh_token', data.refreshToken);
    localStorage.setItem('nutritrack_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await authApi.register({ name, email, password });
    localStorage.setItem('nutritrack_token', data.accessToken);
    localStorage.setItem('nutritrack_refresh_token', data.refreshToken);
    localStorage.setItem('nutritrack_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('nutritrack_refresh_token');
    try {
      if (refreshToken) await authApi.logout({ refreshToken });
    } catch (_) { /* best-effort */ }
    localStorage.removeItem('nutritrack_token');
    localStorage.removeItem('nutritrack_refresh_token');
    localStorage.removeItem('nutritrack_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
