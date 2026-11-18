import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import type { UserSession, Group, GroupJoinRequest, GroupMember } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

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
  switchActiveGroup: (groupId: string, providedGroup?: Group) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshGroups: () => Promise<Group[]>;
  updateMyNickname: (name: string) => Promise<void>;
  removeMember: (groupId: string, targetUserId: string) => Promise<void>;
  familyShareUnlockedUntil: string | null;
  unlockFamilyShare: () => Promise<void>;
  disableFamilyShare: () => Promise<void>;
  isOwner: boolean;
  restoreByRecoveryCode: (code: string) => Promise<Group>;
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
  const activeGroupRef = useRef<Group | null>(activeGroup);
  const userRef = useRef<UserSession | null>(user);
  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [myRequests, setMyRequests] = useState<GroupJoinRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<GroupJoinRequest[]>([]);
  const [activeGroupMembers, setActiveGroupMembers] = useState<GroupMember[]>([]);
  const [familyShareUnlockedUntil, setFamilyShareUnlockedUntil] = useState<string | null>(null);

  const refreshActiveGroupMembers = async (groupId: string) => {
    try {
      const members = await dbService.groups.listMembers(groupId);
      setActiveGroupMembers(members);

      // 자가 치유(Self-Healing): 현재 사용자가 이 보관소의 멤버(role === 'member')인 상태에서,
      // 과거 소유자 호칭 자동 상속 버그로 인해 호칭이 보관소 소유자의 호칭으로 오염된 경우
      // 사용자의 로컬 저장 호칭 또는 '가족'으로 안전하게 즉시 복구
      const currentUser = userRef.current;
      const currentActive = activeGroupRef.current;
      if (currentUser && currentActive && currentActive.id === groupId) {
        const myMem = members.find(m => m.user_id === currentUser.id);
        const ownerMem = members.find(m => m.role === 'owner' || m.user_id === currentActive.owner_id);

        if (myMem && myMem.role === 'member' && ownerMem && ownerMem.user_name && myMem.user_name === ownerMem.user_name) {
          const localSavedName = localStorage.getItem('wii_my_nickname');
          const healedName = (localSavedName && localSavedName !== ownerMem.user_name) ? localSavedName : '가족';
          console.log(`[Auth] Self-healing contaminated member nickname "${myMem.user_name}" -> "${healedName}"`);
          setActiveGroupMembers(prev => prev.map(m => m.user_id === currentUser.id ? { ...m, user_name: healedName } : m));
          dbService.groups.updateMemberName(groupId, currentUser.id, healedName).catch(e => {
            console.warn('Failed to persist healed nickname:', e);
          });
        }
      }
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
      
      // 타임아웃 래퍼 헬퍼 함수 (20초 내 미응답 시 예외 발생시켜 무한로딩 방지)
      const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 20000, errorMsg = '서버 응답 시간이 초과되었습니다.'): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
        ]);
      };

      // 1. Get or create anonymous session (캐시 우선 확인 + 타임아웃 시 익명 로그인 자동 폴백)
      let currentUser: UserSession | null = null;
      try {
        currentUser = await withTimeout(dbService.auth.getCurrentUser(), 15000, '사용자 세션을 불러오는 중 응답이 지연되었습니다.');
      } catch (e) {
        console.warn('getCurrentUser timed out or failed, attempting anonymous sign in fallback:', e);
      }

      if (!currentUser) {
        currentUser = await withTimeout(dbService.auth.signInAnonymously(), 20000, '익명 로그인 진행 중 응답이 지연되었습니다. 네트워크 연결 상태를 확인해 주세요.');
      }
      setUser(currentUser);

      // Load user profile ad status
      if (currentUser) {
        try {
          const profile = await dbService.userProfile.get(currentUser.id);
          if (profile) {
            setFamilyShareUnlockedUntil(profile.family_share_unlocked_until);
          }
        } catch (profileErr) {
          console.warn('Failed to load user profile ad status:', profileErr);
        }
      }

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

      // Auto-synchronize user nickname across all user's groups if a custom nickname exists
      if (isSupabaseConfigured && supabase && currentUser) {
        try {
          const { data: userMemberRows } = await supabase
            .from('group_members')
            .select('user_name')
            .eq('user_id', currentUser.id);

          if (userMemberRows && userMemberRows.length > 1) {
            const customRow = userMemberRows.find(m => m.user_name && m.user_name !== '소유자') || userMemberRows[0];
            if (customRow && customRow.user_name) {
              const targetName = customRow.user_name;
              if (userMemberRows.some(m => m.user_name !== targetName)) {
                await supabase
                  .from('group_members')
                  .update({ user_name: targetName })
                  .eq('user_id', currentUser.id);
              }
            }
          }
        } catch (syncErr) {
          console.warn('Auto nickname sync failed:', syncErr);
        }
      }

      // 4. Resolve active group
      const savedActiveGroupId = localStorage.getItem('wii_active_group_id');
      let savedGroup = groups.find(g => g.id === savedActiveGroupId);

      // 자가 치유(Self-Healing): 무손실 합치기 완료 후 구 워크스페이스(아이템 0개)에 고립된 기기 자동 구제
      if (localStorage.getItem('wii_healed_merge_b00241') !== 'true' && savedGroup && currentUser && savedGroup.owner_id === currentUser.id && groups.length > 1) {
        try {
          const ownedItems = await dbService.items.listAll(savedGroup.id);
          if (ownedItems.length === 0) {
            const sharedGroup = groups.find(g => g.id !== savedGroup!.id);
            if (sharedGroup) {
              const sharedItems = await dbService.items.listAll(sharedGroup.id);
              if (sharedItems.length > 0) {
                console.log(`[Auth] Auto-healing: Switching from empty private vault ${savedGroup.id} to populated shared vault ${sharedGroup.id}`);
                savedGroup = sharedGroup;
                localStorage.setItem('wii_active_group_id', sharedGroup.id);
              }
            }
          }
          localStorage.setItem('wii_healed_merge_b00241', 'true');
        } catch (healErr) {
          console.warn('[Auth] Auto-healing check failed:', healErr);
        }
      }

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
        const currentActiveGroup = activeGroupRef.current;
        const [myReqs, incReqs, groups, members] = await Promise.all([
          dbService.joinRequests.getMyRequests(),
          dbService.joinRequests.listForOwner(),
          dbService.groups.getMyGroups(),
          currentActiveGroup ? dbService.groups.listMembers(currentActiveGroup.id) : Promise.resolve([])
        ]);
        setMyRequests(myReqs);
        setIncomingRequests(incReqs);
        setMyGroups(groups);

        if (currentActiveGroup) {
          setActiveGroupMembers(members);

          // Detect if user was kicked from their active group
          if (groups.length > 0 && !groups.some(g => g.id === currentActiveGroup.id)) {
            const fallbackGroup = groups.find(g => g.owner_id === user.id) || groups[0];
            if (fallbackGroup) {
              setActiveGroup(fallbackGroup);
              localStorage.setItem('wii_active_group_id', fallbackGroup.id);
              alert('보관소 소유자에 의해 공유 접근 권한이 해제되었습니다. 내 개인 보관소로 복귀합니다.');
              window.location.reload();
              return;
            }
          }
        }

        // Detect approved status changes to switch active group immediately
        const approvedReq = myReqs.find(r => r.status === 'approved');
        if (approvedReq) {
          let joinedGroup = groups.find(g => g.id === approvedReq.group_id);
          if (!joinedGroup) {
            try {
              const freshGroups = await dbService.groups.getMyGroups();
              setMyGroups(freshGroups);
              joinedGroup = freshGroups.find(g => g.id === approvedReq.group_id);
            } catch (freshErr) {
              console.warn('Failed to fetch fresh groups for approved request:', freshErr);
            }
          }
          if (joinedGroup) {
            // Delete approved request record to clean up db
            await dbService.joinRequests.reject(approvedReq.id);
            
            // Switch active group and reload
            setActiveGroup(joinedGroup);
            localStorage.setItem('wii_active_group_id', joinedGroup.id);
            alert(`🎉 가족 보관소 "${joinedGroup.code}" 가입 승인이 완료되었습니다!\n(기존 내 개인 보관소 데이터는 안전하게 보존되어 상단 보관소 전환기에서 언제든 전환할 수 있습니다)`);
            window.location.reload();
          }
        }
      } catch (err) {
        console.warn('Silent refresh of requests/groups failed:', err);
      }
    }, 3000);

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
      if (activeGroup) {
        await refreshActiveGroupMembers(activeGroup.id);
      }
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

  const refreshGroups = async (): Promise<Group[]> => {
    try {
      const groups = await dbService.groups.getMyGroups();
      setMyGroups(groups);
      return groups;
    } catch (err) {
      console.warn('Failed to refresh groups:', err);
      return myGroups;
    }
  };

  const switchActiveGroup = async (groupId: string, providedGroup?: Group) => {
    let targetGroup = providedGroup || myGroups.find(g => g.id === groupId);
    if (!targetGroup) {
      // Stale state fallback: fetch fresh groups from DB
      const freshGroups = await dbService.groups.getMyGroups();
      setMyGroups(freshGroups);
      targetGroup = freshGroups.find(g => g.id === groupId);
    }
    if (!targetGroup) {
      // Final fallback: fetch group directly by ID
      try {
        const directGroup = await dbService.groups.get(groupId);
        if (directGroup) {
          targetGroup = directGroup;
          const freshGroups = await dbService.groups.getMyGroups();
          setMyGroups(freshGroups.some(g => g.id === directGroup.id) ? freshGroups : [...freshGroups, directGroup]);
        }
      } catch (e) {
        console.warn('Failed to direct fetch group:', e);
      }
    }
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
      const cleanName = name.trim();
      if (!cleanName) return;

      localStorage.setItem('wii_my_nickname', cleanName);

      // Optimistically update the UI members state
      setActiveGroupMembers(prev => 
        prev.map(m => m.user_id === user.id ? { ...m, user_name: cleanName } : m)
      );
      await dbService.groups.updateMemberName(activeGroup.id, user.id, cleanName);
      await refreshActiveGroupMembers(activeGroup.id);
      const groups = await dbService.groups.getMyGroups();
      setMyGroups(groups);
    } catch (error: any) {
      console.error('Failed to update nickname:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Supabase 실시간 동기화 채널 설정 (그룹 멤버 및 신청서 변경 감지)
  useEffect(() => {
    if (!user) return;
    
    // Supabase가 구성되어 있고 실제 사용 중일 때만
    if (isSupabaseConfigured && supabase) {
      console.log("Subscribing to Realtime auth channels (group_members & requests)...");
      const channel = supabase
        .channel('realtime-auth-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_members' },
          async (payload) => {
            console.log('Realtime group_members change detected:', payload);
            const currentActiveGroup = activeGroupRef.current;
            try {
              const groups = await dbService.groups.getMyGroups();
              setMyGroups(groups);

              if (currentActiveGroup) {
                const isStillMember = groups.some(g => g.id === currentActiveGroup.id);
                if (!isStillMember) {
                  const fallbackGroup = groups.find(g => g.owner_id === user.id) || groups[0];
                  if (fallbackGroup) {
                    setActiveGroup(fallbackGroup);
                    localStorage.setItem('wii_active_group_id', fallbackGroup.id);
                    alert('보관소 소유자에 의해 공유 접근 권한이 해제되었습니다. 내 개인 보관소로 복귀합니다.');
                    window.location.reload();
                    return;
                  }
                }
                const members = await dbService.groups.listMembers(currentActiveGroup.id);
                setActiveGroupMembers(members);
              }
            } catch (err) {
              console.warn('Failed to process group_members realtime update:', err);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_join_requests' },
          async (payload) => {
            console.log('Realtime group_join_requests change detected:', payload);
            await refreshRequests();
          }
        )
        .subscribe((status) => {
          console.log(`Auth Realtime subscription status: ${status}`);
        });

      return () => {
        console.log("Unsubscribing from Realtime auth channels...");
        if (supabase) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, [user]);

  // 3안 적용: 가족 공유 100% 완전 무료화 (제약 및 자동 튕김 이펙트 전면 제거)

  const unlockFamilyShare = async () => {
    // 3안: 가족 공유는 조건 없이 항시 무료 제공
    return;
  };

  const disableFamilyShare = async () => {
    return;
  };

  const removeMember = async (groupId: string, targetUserId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      setAuthError(null);
      await dbService.groups.removeMember(groupId, targetUserId);
      await refreshActiveGroupMembers(groupId);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      setAuthError(error.message || String(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const myMembership = activeGroupMembers.find(m => m.user_id === user?.id);
  const isOwner = !!(activeGroup && user && (activeGroup.owner_id === user.id || myMembership?.role === 'owner'));

  const restoreByRecoveryCode = async (code: string): Promise<Group> => {
    try {
      setLoading(true);
      setAuthError(null);
      const currentActive = activeGroupRef.current;
      const restored = await dbService.groups.restoreByCode(code);

      // Clean up temporary empty group if current active group is different and has no items
      if (currentActive && currentActive.id !== restored.id && user) {
        try {
          const currentItems = await dbService.items.listAll(currentActive.id);
          if (currentItems.length === 0 && isSupabaseConfigured && supabase) {
            await supabase.from('group_members').delete().eq('group_id', currentActive.id).eq('user_id', user.id);
          }
        } catch (cleanErr) {
          console.warn('Failed to clean up temporary empty group:', cleanErr);
        }
      }

      localStorage.setItem('wii_active_group_id', restored.id);
      setActiveGroup(restored);
      await refreshActiveGroupMembers(restored.id);
      const groups = await dbService.groups.getMyGroups();
      setMyGroups(groups);
      return restored;
    } catch (err: any) {
      console.error('Failed to restore by recovery code:', err);
      setAuthError(err.message || String(err));
      throw err;
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
        isOwner,
        restoreByRecoveryCode,
        submitJoinRequest,
        cancelJoinRequest,
        approveRequest,
        rejectRequest,
        switchActiveGroup,
        leaveGroup,
        refreshRequests,
        refreshGroups,
        updateMyNickname,
        removeMember,
        familyShareUnlockedUntil,
        unlockFamilyShare,
        disableFamilyShare,
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
