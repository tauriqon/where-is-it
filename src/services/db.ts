import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, StorageUnit, Section, Item, UserSession, Group, GroupMember, GroupJoinRequest } from '../types';

// =========================================================================
// MOCK DATA & LOCALSTORAGE FALLBACK
// =========================================================================

const STORAGE_KEYS = {
  USER: 'wii_mock_user',
  SPACES: 'wii_mock_spaces',
  STORAGES: 'wii_mock_storages',
  SECTIONS: 'wii_mock_sections',
  ITEMS: 'wii_mock_items',
};

// 초기 시드 데이터 (전면 삭제로 빈 배열 적용)
const SEED_SPACES: Space[] = [];
const SEED_STORAGES: StorageUnit[] = [];
const SEED_SECTIONS: Section[] = [];
const SEED_ITEMS: Item[] = [];

// 로컬 스토리지 헬퍼 함수
const getLocal = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(data);
};

const setLocal = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// =========================================================================
// SERVICE ROUTER (SUPABASE OR MOCK)
// =========================================================================

export const dbService = {
  // 1. Authentication
  auth: {
    getCurrentUser: async (): Promise<UserSession | null> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        return {
          id: session.user.id,
          email: session.user.email,
          is_anonymous: session.user.is_anonymous || false,
        };
      } else {
        return getLocal<UserSession | null>(STORAGE_KEYS.USER, null);
      }
    },

    signInAnonymously: async (): Promise<UserSession> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (!data.user) throw new Error('Failed to create anonymous session');
        return {
          id: data.user.id,
          email: data.user.email,
          is_anonymous: true,
        };
      } else {
        let mockUser = getLocal<UserSession | null>(STORAGE_KEYS.USER, null);
        if (!mockUser) {
          mockUser = { id: 'mock-user', is_anonymous: true };
          setLocal(STORAGE_KEYS.USER, mockUser);
          // 시드 데이터 로드
          getLocal(STORAGE_KEYS.SPACES, SEED_SPACES);
          getLocal(STORAGE_KEYS.STORAGES, SEED_STORAGES);
          getLocal(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
          getLocal(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        }
        return mockUser;
      }
    },

    signInWithGroupCode: async (code: string): Promise<UserSession> => {
      const cleanCode = code.trim().toLowerCase();
      if (!cleanCode) throw new Error('공유 코드를 입력해 주세요.');
      
      if (isSupabaseConfigured && supabase) {
        // 입력값이 이메일 형식(골뱅이 포함)이면 그대로 사용, 단순 코드면 고유 이메일 접미사 변환
        const email = cleanCode.includes('@') ? cleanCode : `${cleanCode}-wii@gmail.com`;
        const password = `wii-share-secret-password-123`;

        // 1. 기존 가입 이력에 대해 로그인 시도
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          // 2. 가입되지 않은 신규 공유 코드인 경우, 즉석에서 안전하게 계정 생성 처리
          if (signInError.message.includes('Invalid login credentials') || signInError.status === 400) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password
            });
            if (signUpError) throw signUpError;
            if (!signUpData.user) throw new Error('공유 세션 계정 생성에 실패했습니다.');
            
            return {
              id: signUpData.user.id,
              email: signUpData.user.email,
              is_anonymous: false
            };
          }
          throw signInError;
        }

        if (!data.user) throw new Error('공유 세션 로그인에 실패했습니다.');
        return {
          id: data.user.id,
          email: data.user.email,
          is_anonymous: false
        };
      } else {
        // Mock Sandbox 환경: 로컬 그룹 아이디 생성 후 사용자 정보에 기록
        const userId = `mock-group-${cleanCode}`;
        const mockUser = { 
          id: userId, 
          email: `${cleanCode}@local-group.com`, 
          is_anonymous: false 
        };
        setLocal(STORAGE_KEYS.USER, mockUser);
        return mockUser;
      }
    },

    signOut: async (): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    },

    migrateLegacyData: async (groupId: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        // Update group_id for all tables if it's currently NULL
        await supabase.from('spaces').update({ group_id: groupId }).eq('user_id', userId).is('group_id', null);
        await supabase.from('storages').update({ group_id: groupId }).eq('user_id', userId).is('group_id', null);
        await supabase.from('sections').update({ group_id: groupId }).eq('user_id', userId).is('group_id', null);
        await supabase.from('items').update({ group_id: groupId }).eq('user_id', userId).is('group_id', null);
      }
    },

    importMigratedData: async (
      newGroupId: string,
      spaces: any[],
      storages: any[],
      sections: any[],
      items: any[]
    ): Promise<void> => {
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        // ID mapping tables
        const spaceIdMap: { [oldId: string]: string } = {};
        const storageIdMap: { [oldId: string]: string } = {};
        const sectionIdMap: { [oldId: string]: string } = {};

        // 1. spaces
        if (spaces.length > 0) {
          const spacesToInsert = spaces.map(s => {
            const newId = generateUUID();
            spaceIdMap[s.id] = newId;
            return {
              id: newId,
              name: s.name,
              icon: s.icon,
              user_id: userId,
              group_id: newGroupId,
              created_at: s.created_at
            };
          });
          const { error: spaceErr } = await supabase
            .from('spaces')
            .insert(spacesToInsert);
          if (spaceErr) throw spaceErr;
        }

        // 2. storages
        if (storages.length > 0) {
          const storagesToInsert = storages.map(st => {
            const newId = generateUUID();
            storageIdMap[st.id] = newId;
            const newSpaceId = spaceIdMap[st.space_id] || st.space_id;
            return {
              id: newId,
              space_id: newSpaceId,
              name: st.name,
              icon: st.icon,
              image_url: st.image_url,
              user_id: userId,
              group_id: newGroupId,
              created_at: st.created_at
            };
          });
          const { error: storageErr } = await supabase
            .from('storages')
            .insert(storagesToInsert);
          if (storageErr) throw storageErr;
        }

        // 3. sections
        if (sections.length > 0) {
          const sectionsToInsert = sections.map(se => {
            const newId = generateUUID();
            sectionIdMap[se.id] = newId;
            const newStorageId = storageIdMap[se.storage_id] || se.storage_id;
            return {
              id: newId,
              storage_id: newStorageId,
              name: se.name,
              icon: se.icon,
              image_url: se.image_url,
              user_id: userId,
              group_id: newGroupId,
              created_at: se.created_at
            };
          });
          const { error: sectionErr } = await supabase
            .from('sections')
            .insert(sectionsToInsert);
          if (sectionErr) throw sectionErr;
        }

        // 4. items
        if (items.length > 0) {
          const itemsToInsert = items.map(it => {
            const newId = generateUUID();
            const newSectionId = sectionIdMap[it.section_id] || it.section_id;
            return {
              id: newId,
              section_id: newSectionId,
              name: it.name,
              description: it.description,
              image_url: it.image_url,
              quantity: it.quantity,
              tags: it.tags,
              expiration_date: it.expiration_date,
              user_id: userId,
              group_id: newGroupId,
              created_at: it.created_at,
              updated_at: it.updated_at
            };
          });
          const { error: itemErr } = await supabase
            .from('items')
            .insert(itemsToInsert);
          if (itemErr) throw itemErr;
        }
      } else {
        // Mock Sandbox 환경: 로컬 데이터 group_id 업데이트
        const spacesList = getLocal<any[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
        const updatedSpaces = spacesList.map(s => ({ ...s, group_id: newGroupId }));
        setLocal(STORAGE_KEYS.SPACES, updatedSpaces);

        const storagesList = getLocal<any[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        const updatedStorages = storagesList.map(st => ({ ...st, group_id: newGroupId }));
        setLocal(STORAGE_KEYS.STORAGES, updatedStorages);

        const sectionsList = getLocal<any[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        const updatedSections = sectionsList.map(se => ({ ...se, group_id: newGroupId }));
        setLocal(STORAGE_KEYS.SECTIONS, updatedSections);

        const itemsList = getLocal<any[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        const updatedItems = itemsList.map(it => ({ ...it, group_id: newGroupId }));
        setLocal(STORAGE_KEYS.ITEMS, updatedItems);
      }
    }
  },

  // 1.5. Workspaces / Groups
  groups: {
    create: async (code: string): Promise<Group> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        // Insert into groups
        const { data: groupData, error: groupErr } = await supabase
          .from('groups')
          .insert({ code, owner_id: userId })
          .select()
          .single();
        if (groupErr) throw groupErr;

        // Insert owner into group_members
        const { error: memberErr } = await supabase
          .from('group_members')
          .insert({ group_id: groupData.id, user_id: userId, role: 'owner', user_name: '소유자' });
        if (memberErr) throw memberErr;

        return groupData;
      } else {
        // Mock Sandbox
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);
        const newGroup: Group = {
          id: `g-${Date.now()}`,
          code,
          owner_id: user?.id || 'mock-user',
          created_at: new Date().toISOString()
        };
        mockGroups.push(newGroup);
        setLocal('wii_mock_groups', mockGroups);

        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        mockMembers.push({
          id: `gm-${Date.now()}`,
          group_id: newGroup.id,
          user_id: user?.id || 'mock-user',
          role: 'owner',
          user_name: '소유자',
          created_at: new Date().toISOString()
        });
        setLocal('wii_mock_group_members', mockMembers);

        // Seed mock data with the new group_id if it's the first group
        if (mockGroups.length === 1) {
          const spaces = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
          const updatedSpaces = spaces.map(s => ({ ...s, group_id: newGroup.id }));
          setLocal(STORAGE_KEYS.SPACES, updatedSpaces);

          const storages = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
          const updatedStorages = storages.map(st => ({ ...st, group_id: newGroup.id }));
          setLocal(STORAGE_KEYS.STORAGES, updatedStorages);

          const sections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
          const updatedSections = sections.map(se => ({ ...se, group_id: newGroup.id }));
          setLocal(STORAGE_KEYS.SECTIONS, updatedSections);

          const items = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
          const updatedItems = items.map(it => ({ ...it, group_id: newGroup.id }));
          setLocal(STORAGE_KEYS.ITEMS, updatedItems);
        }

        return newGroup;
      }
    },

    join: async (code: string): Promise<Group> => {
      const cleanCode = code.trim().toLowerCase();
      if (!cleanCode) throw new Error('공유 코드를 입력해 주세요.');

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        // Find group by code
        const { data: groupData, error: findErr } = await supabase
          .from('groups')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!groupData) throw new Error('존재하지 않는 공유 코드입니다. 코드를 확인해 주세요.');

        // Insert into group_members
        const { error: upsertErr } = await supabase
          .from('group_members')
          .upsert({ group_id: groupData.id, user_id: userId, role: 'member' }, { onConflict: 'group_id, user_id' });
        if (upsertErr) throw upsertErr;

        return groupData;
      } else {
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);
        const group = mockGroups.find(g => g.code.toLowerCase() === cleanCode);
        if (!group) throw new Error('존재하지 않는 공유 코드입니다. 코드를 확인해 주세요.');

        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const alreadyMember = mockMembers.some(gm => gm.group_id === group.id && gm.user_id === user?.id);
        if (!alreadyMember) {
          mockMembers.push({
            id: `gm-${Date.now()}`,
            group_id: group.id,
            user_id: user?.id || 'mock-user',
            role: 'member',
            created_at: new Date().toISOString()
          });
          setLocal('wii_mock_group_members', mockMembers);
        }
        return group;
      }
    },

    leave: async (groupId: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        // Check role
        const { data: membership, error: memberErr } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .single();
        if (memberErr) throw memberErr;
        if (membership.role === 'owner') {
          throw new Error('보관함 소유자는 보관함을 퇴장할 수 없습니다. 다른 기기가 접속 중이라면 해당 기기에서 접속을 해제해야 합니다.');
        }

        const { error: leaveErr } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId);
        if (leaveErr) throw leaveErr;
      } else {
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const memberIdx = mockMembers.findIndex(gm => gm.group_id === groupId && gm.user_id === user?.id);
        if (memberIdx !== -1) {
          if (mockMembers[memberIdx].role === 'owner') {
            throw new Error('보관함 소유자는 보관함을 퇴장할 수 없습니다.');
          }
          mockMembers.splice(memberIdx, 1);
          setLocal('wii_mock_group_members', mockMembers);
        }
      }
    },

    getMyGroups: async (): Promise<Group[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return [];

        const { data, error } = await supabase
          .from('group_members')
          .select('group_id, groups(*)').eq('user_id', userId);
        if (error) throw error;

        return (data || []).map((row: any) => row.groups).filter(Boolean);
      } else {
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);

        const myGroupIds = mockMembers
          .filter(gm => gm.user_id === user?.id)
          .map(gm => gm.group_id);

        return mockGroups.filter(g => myGroupIds.includes(g.id));
      }
    },

    listMembers: async (groupId: string): Promise<GroupMember[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } else {
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        return mockMembers.filter(m => m.group_id === groupId);
      }
    },

    updateMemberName: async (groupId: string, userId: string, userName: string): Promise<void> => {
      const cleanName = userName.trim();
      if (!cleanName) throw new Error('호칭을 입력해 주세요.');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('group_members')
          .update({ user_name: cleanName })
          .eq('group_id', groupId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const idx = mockMembers.findIndex(m => m.group_id === groupId && m.user_id === userId);
        if (idx !== -1) {
          mockMembers[idx].user_name = cleanName;
          setLocal('wii_mock_group_members', mockMembers);
        }
      }
    }
  },

  joinRequests: {
    create: async (code: string, requesterName: string): Promise<GroupJoinRequest> => {
      const cleanCode = code.trim().toLowerCase();
      if (!cleanCode) throw new Error('공유 코드를 입력해 주세요.');
      const name = requesterName.trim();
      if (!name) throw new Error('이름 또는 호칭을 입력해 주세요.');

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        // 1. Find group by code
        const { data: groupData, error: findErr } = await supabase
          .from('groups')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!groupData) throw new Error('존재하지 않는 공유 코드입니다.');

        // 2. Check if already a member
        const { data: memberData, error: memberErr } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupData.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (memberErr) throw memberErr;
        if (memberData) throw new Error('이미 가입된 보관소입니다.');

        // 3. Create or upsert join request
        const { data: requestData, error: requestErr } = await supabase
          .from('group_join_requests')
          .upsert({
            group_id: groupData.id,
            requester_id: userId,
            requester_name: name,
            status: 'pending'
          }, { onConflict: 'group_id, requester_id' })
          .select()
          .single();
        if (requestErr) throw requestErr;

        return requestData;
      } else {
        // Mock Sandbox
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);
        const group = mockGroups.find(g => g.code.toLowerCase() === cleanCode);
        if (!group) throw new Error('존재하지 않는 공유 코드입니다.');

        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        if (mockMembers.some(gm => gm.group_id === group.id && gm.user_id === user?.id)) {
          throw new Error('이미 가입된 보관소입니다.');
        }

        const mockRequests = getLocal<GroupJoinRequest[]>('wii_mock_group_join_requests', []);
        const existingIdx = mockRequests.findIndex(r => r.group_id === group.id && r.requester_id === user?.id);

        const newRequest: GroupJoinRequest = {
          id: existingIdx !== -1 ? mockRequests[existingIdx].id : `jr-${Date.now()}`,
          group_id: group.id,
          requester_id: user?.id || 'mock-user',
          requester_name: name,
          status: 'pending',
          created_at: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          mockRequests[existingIdx] = newRequest;
        } else {
          mockRequests.push(newRequest);
        }
        setLocal('wii_mock_group_join_requests', mockRequests);
        return newRequest;
      }
    },

    listForOwner: async (): Promise<GroupJoinRequest[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return [];

        // Get groups owned by user
        const { data: myOwnedGroups, error: groupsErr } = await supabase
          .from('groups')
          .select('id')
          .eq('owner_id', userId);
        if (groupsErr) throw groupsErr;

        const ownedGroupIds = (myOwnedGroups || []).map(g => g.id);
        if (ownedGroupIds.length === 0) return [];

        // Get pending requests for these groups
        const { data, error } = await supabase
          .from('group_join_requests')
          .select('*')
          .in('group_id', ownedGroupIds)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;

        return data || [];
      } else {
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);
        const ownedGroupIds = mockGroups.filter(g => g.owner_id === user?.id).map(g => g.id);

        const mockRequests = getLocal<GroupJoinRequest[]>('wii_mock_group_join_requests', []);
        return mockRequests.filter(r => ownedGroupIds.includes(r.group_id) && r.status === 'pending');
      }
    },

    getMyRequests: async (): Promise<GroupJoinRequest[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return [];

        const { data, error } = await supabase
          .from('group_join_requests')
          .select('*')
          .eq('requester_id', userId);
        if (error) throw error;

        return data || [];
      } else {
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockRequests = getLocal<GroupJoinRequest[]>('wii_mock_group_join_requests', []);
        return mockRequests.filter(r => r.requester_id === user?.id);
      }
    },

    approve: async (requestId: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        // 1. Get request details
        const { data: request, error: findErr } = await supabase
          .from('group_join_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        if (findErr) throw findErr;

        // 2. Add to group members
        const { error: memberErr } = await supabase
          .from('group_members')
          .insert({
            group_id: request.group_id,
            user_id: request.requester_id,
            role: 'member',
            user_name: request.requester_name
          });
        if (memberErr) throw memberErr;

        // 3. Update request status to approved
        const { error: updateErr } = await supabase
          .from('group_join_requests')
          .update({ status: 'approved' })
          .eq('id', requestId);
        if (updateErr) throw updateErr;
      } else {
        const mockRequests = getLocal<GroupJoinRequest[]>('wii_mock_group_join_requests', []);
        const reqIdx = mockRequests.findIndex(r => r.id === requestId);
        if (reqIdx === -1) throw new Error('Request not found');

        const request = mockRequests[reqIdx];
        request.status = 'approved';
        mockRequests[reqIdx] = request;
        setLocal('wii_mock_group_join_requests', mockRequests);

        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const alreadyMember = mockMembers.some(m => m.group_id === request.group_id && m.user_id === request.requester_id);
        if (!alreadyMember) {
          mockMembers.push({
            id: `gm-${Date.now()}`,
            group_id: request.group_id,
            user_id: request.requester_id,
            role: 'member',
            created_at: new Date().toISOString()
          });
          setLocal('wii_mock_group_members', mockMembers);
        }
      }
    },

    reject: async (requestId: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('group_join_requests')
          .delete()
          .eq('id', requestId);
        if (error) throw error;
      } else {
        let mockRequests = getLocal<GroupJoinRequest[]>('wii_mock_group_join_requests', []);
        mockRequests = mockRequests.filter(r => r.id !== requestId);
        setLocal('wii_mock_group_join_requests', mockRequests);
      }
    }
  },

  // 2. Spaces (1단계)
  spaces: {
    list: async (groupId: string): Promise<Space[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('spaces')
          .select('*')
          .eq('group_id', groupId)
          .order('name');
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
        return list.filter(s => s.group_id === groupId);
      }
    },

    create: async (groupId: string, name: string, icon: string): Promise<Space> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('spaces')
          .insert({ name, icon, group_id: groupId, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const spaces = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const newSpace: Space = {
          id: `s-${Date.now()}`,
          user_id: user?.id || 'mock-user',
          group_id: groupId,
          name,
          icon,
          created_at: new Date().toISOString(),
        };
        spaces.push(newSpace);
        setLocal(STORAGE_KEYS.SPACES, spaces);
        return newSpace;
      }
    },

    delete: async (id: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error, count } = await supabase.from('spaces').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
          throw new Error('Supabase에서 해당 공간을 찾을 수 없거나 삭제 권한(RLS)이 없습니다.');
        }
      } else {
        let spaces = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
        spaces = spaces.filter(s => s.id !== id);
        setLocal(STORAGE_KEYS.SPACES, spaces);

        // Cascade delete mock storages, sections, items
        let storages = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        const storageIdsToDelete = storages.filter(st => st.space_id === id).map(st => st.id);
        storages = storages.filter(st => st.space_id !== id);
        setLocal(STORAGE_KEYS.STORAGES, storages);

        let sections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        const sectionIdsToDelete = sections.filter(se => storageIdsToDelete.includes(se.storage_id)).map(se => se.id);
        sections = sections.filter(se => !storageIdsToDelete.includes(se.storage_id));
        setLocal(STORAGE_KEYS.SECTIONS, sections);

        let items = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        items = items.filter(it => !sectionIdsToDelete.includes(it.section_id));
        setLocal(STORAGE_KEYS.ITEMS, items);
      }
    },

    update: async (
      id: string,
      updates: Partial<Omit<Space, 'id' | 'user_id' | 'created_at'>>
    ): Promise<Space> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('spaces')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
        const idx = list.findIndex(s => s.id === id);
        if (idx === -1) throw new Error('Space not found');

        const updatedSpace: Space = {
          ...list[idx],
          ...updates,
        };
        list[idx] = updatedSpace;
        setLocal(STORAGE_KEYS.SPACES, list);
        return updatedSpace;
      }
    }
  },

  // 3. Storages (2단계)
  storages: {
    list: async (groupId: string, spaceId?: string): Promise<StorageUnit[]> => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('storages').select('*').eq('group_id', groupId).order('name');
        if (spaceId) query = query.eq('space_id', spaceId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES).filter(s => s.group_id === groupId);
        return spaceId ? list.filter(s => s.space_id === spaceId) : list;
      }
    },

    create: async (groupId: string, spaceId: string, name: string, icon: string, imageUrl?: string): Promise<StorageUnit> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('storages')
          .insert({ space_id: spaceId, name, icon, image_url: imageUrl, group_id: groupId, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const newStorage: StorageUnit = {
          id: `st-${Date.now()}`,
          space_id: spaceId,
          user_id: user?.id || 'mock-user',
          group_id: groupId,
          name,
          icon,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        };
        list.push(newStorage);
        setLocal(STORAGE_KEYS.STORAGES, list);
        return newStorage;
      }
    },

    delete: async (id: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error, count } = await supabase.from('storages').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
          throw new Error('Supabase에서 해당 수납처를 찾을 수 없거나 삭제 권한(RLS)이 없습니다.');
        }
      } else {
        let list = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        list = list.filter(st => st.id !== id);
        setLocal(STORAGE_KEYS.STORAGES, list);

        let sections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        const sectionIdsToDelete = sections.filter(se => se.storage_id === id).map(se => se.id);
        sections = sections.filter(se => se.storage_id !== id);
        setLocal(STORAGE_KEYS.SECTIONS, sections);

        let items = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        items = items.filter(it => !sectionIdsToDelete.includes(it.section_id));
        setLocal(STORAGE_KEYS.ITEMS, items);
      }
    },

    update: async (
      id: string,
      updates: Partial<Omit<StorageUnit, 'id' | 'user_id' | 'created_at'>>
    ): Promise<StorageUnit> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('storages')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        const idx = list.findIndex(st => st.id === id);
        if (idx === -1) throw new Error('Storage not found');

        const updatedStorage: StorageUnit = {
          ...list[idx],
          ...updates,
        };
        list[idx] = updatedStorage;
        setLocal(STORAGE_KEYS.STORAGES, list);
        return updatedStorage;
      }
    }
  },

  // 4. Sections (3단계)
  sections: {
    list: async (groupId: string, storageId?: string): Promise<Section[]> => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('sections').select('*').eq('group_id', groupId).order('name');
        if (storageId) query = query.eq('storage_id', storageId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS).filter(s => s.group_id === groupId);
        return storageId ? list.filter(s => s.storage_id === storageId) : list;
      }
    },

    create: async (groupId: string, storageId: string, name: string, icon?: string, imageUrl?: string): Promise<Section> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('sections')
          .insert({ storage_id: storageId, name, icon, image_url: imageUrl, group_id: groupId, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const newSection: Section = {
          id: `se-${Date.now()}`,
          storage_id: storageId,
          user_id: user?.id || 'mock-user',
          group_id: groupId,
          name,
          icon,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        };
        list.push(newSection);
        setLocal(STORAGE_KEYS.SECTIONS, list);
        return newSection;
      }
    },

    delete: async (id: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error, count } = await supabase.from('sections').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
          throw new Error('Supabase에서 해당 세부 위치를 찾을 수 없거나 삭제 권한(RLS)이 없습니다.');
        }
      } else {
        let list = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        list = list.filter(se => se.id !== id);
        setLocal(STORAGE_KEYS.SECTIONS, list);

        let items = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        items = items.filter(it => it.section_id !== id);
        setLocal(STORAGE_KEYS.ITEMS, items);
      }
    },

    update: async (
      id: string,
      updates: Partial<Omit<Section, 'id' | 'user_id' | 'created_at'>>
    ): Promise<Section> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('sections')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        const idx = list.findIndex(se => se.id === id);
        if (idx === -1) throw new Error('Section not found');

        const updatedSection: Section = {
          ...list[idx],
          ...updates,
        };
        list[idx] = updatedSection;
        setLocal(STORAGE_KEYS.SECTIONS, list);
        return updatedSection;
      }
    }
  },

  // 5. Items (물건)
  items: {
    list: async (groupId: string, sectionId?: string): Promise<Item[]> => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('items').select('*').eq('group_id', groupId).order('name');
        if (sectionId) query = query.eq('section_id', sectionId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS).filter(s => s.group_id === groupId);
        return sectionId ? list.filter(i => i.section_id === sectionId) : list;
      }
    },

    listAll: async (groupId: string): Promise<Item[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('group_id', groupId)
          .order('name');
        if (error) throw error;
        return data || [];
      } else {
        return getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS).filter(s => s.group_id === groupId);
      }
    },

    create: async (
      groupId: string,
      sectionId: string,
      name: string,
      description?: string,
      imageUrl?: string,
      quantity: number = 1,
      tags: string[] = [],
      expirationDate?: string | null
    ): Promise<Item> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('items')
          .insert({
            section_id: sectionId,
            name,
            description,
            image_url: imageUrl,
            quantity,
            tags,
            group_id: groupId,
            user_id: userId,
            expiration_date: expirationDate
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const newItem: Item = {
          id: `i-${Date.now()}`,
          section_id: sectionId,
          user_id: user?.id || 'mock-user',
          group_id: groupId,
          name,
          description,
          image_url: imageUrl,
          quantity,
          tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expiration_date: expirationDate || null
        };
        list.push(newItem);
        setLocal(STORAGE_KEYS.ITEMS, list);
        return newItem;
      }
    },

    update: async (
      id: string,
      updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ): Promise<Item> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('items')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const list = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        const idx = list.findIndex(it => it.id === id);
        if (idx === -1) throw new Error('Item not found');

        const updatedItem: Item = {
          ...list[idx],
          ...updates,
          updated_at: new Date().toISOString(),
        };
        list[idx] = updatedItem;
        setLocal(STORAGE_KEYS.ITEMS, list);
        return updatedItem;
      }
    },

    delete: async (id: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error, count } = await supabase.from('items').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
          throw new Error('Supabase에서 해당 물건을 찾을 수 없거나 삭제 권한(RLS)이 없습니다.');
        }
      } else {
        let list = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        list = list.filter(it => it.id !== id);
        setLocal(STORAGE_KEYS.ITEMS, list);
      }
    },

    uploadImage: async (file: File): Promise<string> => {
      if (isSupabaseConfigured && supabase) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `items/${fileName}`;

        // Supabase Storage에 이미지 업로드
        const { error } = await supabase.storage
          .from('item-images')
          .upload(filePath, file);

        if (error) throw error;

        // 공개 URL 반환
        const { data } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        return data.publicUrl;
      } else {
        // Mock 환경: 로컬 Base64 데이터 URL로 변환하여 LocalStorage에 저장 가능케 함
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            // 이미지 압축 (용량 확보를 위함)
            const img = new Image();
            img.src = reader.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX_WIDTH = 400; // 넓이 제한
              const scale = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scale;

              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              // 퀄리티 0.7로 압축하여 크기 줄임
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
              resolve(compressedBase64);
            };
            img.onerror = (e) => reject(e);
          };
          reader.onerror = (error) => reject(error);
        });
      }
    }
  }
};
