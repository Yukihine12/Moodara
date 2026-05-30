import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api.js';

export interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  hasProfile: boolean;
  loginState: (user: User, token: string) => void;
  checkUserProfile: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  // Fungsi untuk memverifikasi apakah profil pengguna sudah tersimpan di database
  const checkUserProfile = async (): Promise<boolean> => {
    try {
      const { data } = await api.get('/api/users/profile', { timeout: 4000 });
      if (data && data.name) {
        setHasProfile(true);
        localStorage.setItem('moodara_onboarded', 'true');
        return true;
      }
      setHasProfile(false);
      return false;
    } catch (error: any) {
      if (error.response?.status === 404) {
        setHasProfile(false);
        localStorage.removeItem('moodara_onboarded');
        return false;
      }
      if (localStorage.getItem('moodara_onboarded') === 'true') {
        console.warn('⚠️ Gagal memverifikasi profil secara online. Menggunakan LocalStorage recovery fallback...');
        setHasProfile(true);
        return true;
      }
      setHasProfile(false);
      return false;
    }
  };

  const loginState = (userData: User, token: string) => {
    localStorage.setItem('moodara_access_token', token);
    localStorage.setItem('moodara_user', JSON.stringify(userData));
    setUser(userData);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('moodara_access_token');
        const userStr = localStorage.getItem('moodara_user');
        
        if (token && userStr) {
          const userData = JSON.parse(userStr);
          setUser(userData);
          // Ambil profil jika session ditemukan
          await checkUserProfile();
        }
      } catch (err) {
        console.error('Error in auth initial load:', err);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();
  }, []);

  const logout = () => {
    setLoading(true);
    localStorage.removeItem('moodara_access_token');
    localStorage.removeItem('moodara_user');
    localStorage.removeItem('moodara_onboarded');
    setUser(null);
    setHasProfile(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, initialized, hasProfile, checkUserProfile, loginState, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
