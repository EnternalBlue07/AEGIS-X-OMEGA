import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const API_BASE = 'http://127.0.0.1:8000/api';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('aegis_token'));
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('aegis_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const isAuthenticated = !!token;

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Invalid credentials');
      }

      const data = await res.json();
      localStorage.setItem('aegis_token', data.access_token);
      localStorage.setItem('aegis_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('aegis_token');
    localStorage.removeItem('aegis_user');
    setToken(null);
    setUser(null);
  };

  // transparently inject Auth headers for all fetches
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      const storedToken = localStorage.getItem('aegis_token');
      if (storedToken && !url.includes('/api/login')) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${storedToken}`
        };
      }
      try {
        const response = await originalFetch(url, options);
        if (response.status === 401 && !url.includes('/api/login')) {
          logout();
        }
        return response;
      } catch (err) {
        return Promise.reject(err);
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
