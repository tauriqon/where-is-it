import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { UserSession, Group } from '../types';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  authError: string | null;
  activeGroup: Group | null;
  myGroups: Group[];
  joinGroup: (code: string) => Promise<void>;
  switchActiveGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateGroupCode = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'wii-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);

  const loadUserSession = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      
      // 1. Get or create anonymous session
      let currentUser = await dbService.auth.getCurrentUser();
      if (!currentUser) {
        currentUser = await dbService.auth.signInAnonymously();
      }
      setUser(currentUser);

      // 2. Load user's groups
      let groups = await dbService.groups.getMyGroups();
      
      // 3. If no groups exist, create a default private workspace group
      if (groups.length === 0) {
        let defaultGroup: Group | null = null;
        let retryCount = 0;
        while (!defaultGroup && retryCount < 5) {
          try {
            const code = generateGroupCode();
            defaultGroup = await dbService.groups.create(code);
          } catch (err) {
            console.warn('Failed to create default group, retrying...', err);
            retryCount++;
          }
        }
        if (!defaultGroup) {
          throw new Error('기본 공유 보관소를 생성하는 데 실패했습니다.');
        }

        // Migrate any legacy user data (where group_id IS NULL) to the new default group
        try {
          if (dbService.auth.migrateLegacyData) {
            await dbService.auth.migrateLegacyData(defaultGroup.id);
          }
        } catch (migErr) {
          console.warn('Legacy data migration failed:', migErr);
        }

        groups = await dbService.groups.getMyGroups();
      }

      setMyGroups(groups);

      // 4. Resolve active group
      const savedActiveGroupId = localStorage.getItem('wii_active_group_id');
      const savedGroup = groups.find(g => g.id === savedActiveGroupId);
      if (savedGroup) {
        setActiveGroup(savedGroup);
      } else {
        // Fallback: try to find the group owned by the user, or default to the first group
        const ownerGroup = groups.find(g => g.owner_id === currentUser?.id) || groups[0];
        if (ownerGroup) {
          setActiveGroup(ownerGroup);
          localStorage.setItem('wii_active_group_id', ownerGroup.id);
        }
      }
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

  const joinGroup = async (code: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      const joinedGroup = await dbService.groups.join(code);
      
      // Refresh groups list
      const groups = await dbService.groups.getMyGroups();
      setMyGroups(groups);
      
      // Switch active group to the joined one
      setActiveGroup(joinedGroup);
      localStorage.setItem('wii_active_group_id', joinedGroup.id);
    } catch (error: any) {
      console.error('Failed to join group:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const switchActiveGroup = async (groupId: string) => {
    const targetGroup = myGroups.find(g => g.id === groupId);
    if (!targetGroup) {
      throw new Error('존재하지 않는 워크스페이스입니다.');
    }
    setActiveGroup(targetGroup);
    localStorage.setItem('wii_active_group_id', targetGroup.id);
  };

  const leaveGroup = async (groupId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      setAuthError(null);
      await dbService.groups.leave(groupId);

      // Refresh groups list
      const groups = await dbService.groups.getMyGroups();
      setMyGroups(groups);

      // If we left the active group, switch active group to user's default/private group
      if (activeGroup?.id === groupId) {
        const fallbackGroup = groups.find(g => g.owner_id === user.id) || groups[0];
        if (fallbackGroup) {
          setActiveGroup(fallbackGroup);
          localStorage.setItem('wii_active_group_id', fallbackGroup.id);
        } else {
          setActiveGroup(null);
          localStorage.removeItem('wii_active_group_id');
        }
      }
    } catch (error: any) {
      console.error('Failed to leave group:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        activeGroup,
        myGroups,
        joinGroup,
        switchActiveGroup,
        leaveGroup,
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
