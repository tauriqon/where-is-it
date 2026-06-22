import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { UserSession } from '../types';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  authError: string | null;
  myOriginalCode: string;
  loginAnonymously: () => Promise<void>;
  loginWithGroupCode: (code: string) => Promise<void>;
  updateMyOriginalCode: (newCode: string, shouldMigrate?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const getGroupCode = (email?: string) => {
  if (!email) return null;
  if (email.endsWith('-wii@gmail.com')) return email.split('-wii@gmail.com')[0];
  if (email.endsWith('@local-group.com')) return email.split('@')[0];
  return email;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // 기기별 고유 랜덤 공유 코드 로컬스토리지 유지 관리 (동기식 초기화로 초기 렌더링 누수 차단)
  const [myOriginalCode, setMyOriginalCode] = useState<string>(() => {
    let code = localStorage.getItem('wii_my_original_code');
    if (!code) {
      const digits = Math.floor(100000 + Math.random() * 900000).toString();
      code = `wii-${digits}`;
      localStorage.setItem('wii_my_original_code', code);
    }
    return code;
  });

  // 현재 세션 로드 및 세팅
  const loadUserSession = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      let currentUser = await dbService.auth.getCurrentUser();
      
      // 토스 인앱 최적화: 가입 유도 없이 자동으로 기기 고유 공유 코드로 세션 진입
      if (!currentUser) {
        currentUser = await dbService.auth.signInWithGroupCode(myOriginalCode);
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

  const loginWithGroupCode = async (code: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      const session = await dbService.auth.signInWithGroupCode(code);
      setUser(session);
    } catch (error: any) {
      console.error('Group code sign in failed:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateMyOriginalCode = async (newCode: string, shouldMigrate: boolean = false) => {
    const cleanCode = newCode.trim().toLowerCase();
    if (!cleanCode) throw new Error('공유 코드를 입력해 주세요.');

    const isValid = /^[a-z0-9-_]+$/i.test(cleanCode);
    if (!isValid) {
      throw new Error('공유 코드는 영문, 숫자, 하이픈(-), 언더바(_)만 사용할 수 있습니다.');
    }

    try {
      setLoading(true);
      setAuthError(null);

      // 1. Fetch old data before changing user session if shouldMigrate is true
      let spacesData: any[] = [];
      let storagesData: any[] = [];
      let sectionsData: any[] = [];
      let itemsData: any[] = [];

      const currentCode = getGroupCode(user?.email);
      const isCurrentlyUsingOriginal = currentCode === myOriginalCode;

      if (shouldMigrate && isCurrentlyUsingOriginal) {
        try {
          const [sData, stData, seData, iData] = await Promise.all([
            dbService.spaces.list(),
            dbService.storages.list(),
            dbService.sections.list(),
            dbService.items.listAll(),
          ]);
          spacesData = sData;
          storagesData = stData;
          sectionsData = seData;
          itemsData = iData;
        } catch (fetchErr) {
          console.warn('Failed to pre-fetch existing data for migration:', fetchErr);
          // If fetching fails, we continue anyway or error out. Let's throw so the user knows.
          throw new Error('기존 데이터를 읽어오는데 실패하여 마이그레이션을 중단합니다: ' + fetchErr);
        }
      }

      // 2. Update storage and state
      localStorage.setItem('wii_my_original_code', cleanCode);
      setMyOriginalCode(cleanCode);

      // 3. If we were using the original code, re-authenticate with the new code
      if (isCurrentlyUsingOriginal) {
        const session = await dbService.auth.signInWithGroupCode(cleanCode);
        setUser(session);
        const newUserId = session.id;

        // 4. Migrate data if requested
        if (shouldMigrate) {
          await dbService.auth.importMigratedData(newUserId, spacesData, storagesData, sectionsData, itemsData);
        }
      }
    } catch (error: any) {
      console.error('Failed to update original share code:', error);
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
      
      // 로그아웃 시 원래 내 고유 보관함 세션으로 강제 자동 재로그인 처리하여 로그인 유실 방지
      const session = await dbService.auth.signInWithGroupCode(myOriginalCode);
      setUser(session);
      setAuthError(null);
    } catch (error: any) {
      console.error('Sign out failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, myOriginalCode, loginAnonymously, loginWithGroupCode, updateMyOriginalCode, logout }}>
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
