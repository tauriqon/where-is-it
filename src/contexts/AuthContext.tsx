import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { UserSession, Group, GroupJoinRequest, GroupMember } from '../types';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  authError: string | null;
  activeGroup: Group | null;
  myGroups: Group[];
  myRequests: GroupJoinRequest[];
  incomingRequests: GroupJoinRequest[];
  activeGroupMembers: GroupMember[];
  submitJoinRequest: (code: string, name: string) => Promise<void>;
  cancelJoinRequest: (requestId: string) => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  switchActiveGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  updateMyNickname: (name: string) => Promise<void>;
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
  const [myRequests, setMyRequests] = useState<GroupJoinRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<GroupJoinRequest[]>([]);
  const [activeGroupMembers, setActiveGroupMembers] = useState<GroupMember[]>([]);

  const refreshActiveGroupMembers = async (groupId: string) => {
    try {
      const members = await dbService.groups.listMembers(groupId);
      setActiveGroupMembers(members);
    } catch (err) {
      console.warn('Failed to load group members:', err);
    }
  };

  const refreshRequests = async () => {
    if (!user) return;
    try {
      const [myReqs, incReqs] = await Promise.all([
        dbService.joinRequests.getMyRequests(),
        dbService.joinRequests.listForOwner()
      ]);
      setMyRequests(myReqs);
      setIncomingRequests(incReqs);
    } catch (err) {
      console.warn('Failed to refresh requests:', err);
    }
  };

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
      let resolvedGroup = savedGroup;
      if (savedGroup) {
        setActiveGroup(savedGroup);
      } else {
        const ownerGroup = groups.find(g => g.owner_id === currentUser?.id) || groups[0];
        if (ownerGroup) {
          setActiveGroup(ownerGroup);
          localStorage.setItem('wii_active_group_id', ownerGroup.id);
          resolvedGroup = ownerGroup;
        }
      }

      if (resolvedGroup) {
        await refreshActiveGroupMembers(resolvedGroup.id);
      }

      // 5. Load initial requests
      const [myReqs, incReqs] = await Promise.all([
        dbService.joinRequests.getMyRequests(),
        dbService.joinRequests.listForOwner()
      ]);
      setMyRequests(myReqs);
      setIncomingRequests(incReqs);

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

  // Polling effect for request approval and incoming requests updates
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      try {
        const [myReqs, incReqs, groups, members] = await Promise.all([
          dbService.joinRequests.getMyRequests(),
          dbService.joinRequests.listForOwner(),
          dbService.groups.getMyGroups(),
          activeGroup ? dbService.groups.listMembers(activeGroup.id) : Promise.resolve([])
        ]);
        setMyRequests(myReqs);
        setIncomingRequests(incReqs);
        if (activeGroup) {
          setActiveGroupMembers(members);
        }
        
        // Sync myGroups state
        setMyGroups(prevGroups => {
          const prevIds = prevGroups.map(g => g.id).sort().join(',');
          const newIds = groups.map(g => g.id).sort().join(',');
          if (prevIds !== newIds) {
            return groups;
          }
          return prevGroups;
        });

        // Detect approved status changes to switch active group immediately
        const approvedReq = myReqs.find(r => r.status === 'approved');
        if (approvedReq) {
          const joinedGroup = groups.find(g => g.id === approvedReq.group_id);
          if (joinedGroup) {
            // Delete approved request record to clean up db
            await dbService.joinRequests.reject(approvedReq.id);
            
            // Switch active group and reload
            setActiveGroup(joinedGroup);
            localStorage.setItem('wii_active_group_id', joinedGroup.id);
            alert(`가족 보관소 "${joinedGroup.code}" 가입 승인이 완료되었습니다!`);
            window.location.reload();
          }
        }
      } catch (err) {
        console.warn('Silent refresh of requests/groups failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const submitJoinRequest = async (code: string, name: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      await dbService.joinRequests.create(code, name);
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to submit join request:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancelJoinRequest = async (requestId: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      await dbService.joinRequests.reject(requestId);
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to cancel join request:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      await dbService.joinRequests.approve(requestId);
      
      // Refresh requests and groups lists
      const [groups] = await Promise.all([
        dbService.groups.getMyGroups(),
        refreshRequests()
      ]);
      setMyGroups(groups);
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      await dbService.joinRequests.reject(requestId);
      await refreshRequests();
    } catch (error: any) {
      console.error('Failed to reject request:', error);
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
    await refreshActiveGroupMembers(targetGroup.id);
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
          await refreshActiveGroupMembers(fallbackGroup.id);
        } else {
          setActiveGroup(null);
          localStorage.removeItem('wii_active_group_id');
          setActiveGroupMembers([]);
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

  const updateMyNickname = async (name: string) => {
    if (!user || !activeGroup) return;
    try {
      setLoading(true);
      await dbService.groups.updateMemberName(activeGroup.id, user.id, name);
      await refreshActiveGroupMembers(activeGroup.id);
    } catch (error: any) {
      console.error('Failed to update nickname:', error);
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
        myRequests,
        incomingRequests,
        activeGroupMembers,
        submitJoinRequest,
        cancelJoinRequest,
        approveRequest,
        rejectRequest,
        switchActiveGroup,
        leaveGroup,
        refreshRequests,
        updateMyNickname,
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
