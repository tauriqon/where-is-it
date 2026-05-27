import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { UserSession } from '../types';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  authError: string | null;
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // 현재 세션 로드 및 세팅
  const loadUserSession = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      let currentUser = await dbService.auth.getCurrentUser();
      
      // 토스 인앱 최적화: 가입 유도 없이 즉시 익명 로그인 처리
      if (!currentUser) {
        currentUser = await dbService.auth.signInAnonymously();
      }
      
      setUser(currentUser);
    } catch (error: any) {
      console.error('Failed to load auth session:', error);
      setAuthError(error.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserSession();
  }, []);

  const loginAnonymously = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const session = await dbService.auth.signInAnonymously();
      setUser(session);
    } catch (error: any) {
      console.error('Anonymous sign in failed:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await dbService.auth.signOut();
      setUser(null);
      setAuthError(null);
    } catch (error: any) {
      console.error('Sign out failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, loginAnonymously, logout }}>
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
