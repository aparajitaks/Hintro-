import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, passwordHash: string) => Promise<void>;
  register: (email: string, passwordHash: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load auth token and user from local storage
    const storedToken = localStorage.getItem('hintro_token');
    const storedUser = localStorage.getItem('hintro_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Clear broken user data
        localStorage.removeItem('hintro_user');
        localStorage.removeItem('hintro_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, passwordHash: string) => {
    const response = await api.post('/auth/login', { email, password: passwordHash });
    
    // Express returns data nested inside a standard JSON envelope: {"traceId", "success", "data"/"error"}
    // Let's extract token and user
    const responseData = response.data;
    const { token: jwtToken, user: userData } = responseData.data;

    localStorage.setItem('hintro_token', jwtToken);
    localStorage.setItem('hintro_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  const register = async (email: string, passwordHash: string) => {
    const response = await api.post('/auth/register', { email, password: passwordHash });
    
    const responseData = response.data;
    const { token: jwtToken, user: userData } = responseData.data;

    localStorage.setItem('hintro_token', jwtToken);
    localStorage.setItem('hintro_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('hintro_token');
    localStorage.removeItem('hintro_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
