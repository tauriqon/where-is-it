import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, StorageUnit, Section, Item, UserSession, Group, GroupMember, GroupJoinRequest } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { DEFAULT_INITIAL_SPACES } from '../constants/defaultData';

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

/**
 * Supabase Storage publicUrl에서 버킷 내부 상대 경로(filePath) 추출
 * 예: https://.../storage/v1/object/public/item-images/items/12345.jpg -> items/12345.jpg
 */
export const extractStoragePath = (imageUrl?: string | null): string | null => {
  if (!imageUrl) return null;
  const marker = '/item-images/';
  const idx = imageUrl.indexOf(marker);
  if (idx !== -1) {
    const raw = imageUrl.substring(idx + marker.length);
    const clean = raw.split('?')[0].split('#')[0];
    return decodeURIComponent(clean);
  }
  return null;
};

/**
 * 물건/수납처 삭제 시 Supabase Storage의 고아 파일(Orphan File) 영구 파기
 */
export const deleteStorageImage = async (imageUrl?: string | null): Promise<void> => {
  if (!imageUrl) return;
  const filePath = extractStoragePath(imageUrl);
  if (!filePath) return;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.storage.from('item-images').remove([filePath]);
      if (error) {
        console.warn(`[Storage] Failed to delete image ${filePath}:`, error.message);
      } else {
        console.log(`[Storage] Cleaned up orphan image: ${filePath}`);
      }
    } catch (err) {
      console.warn(`[Storage] Error deleting image ${filePath}:`, err);
    }
  }
};

/**
 * 신규 그룹(보관소) 생성 시 대한민국 표준 1단계 공간 6개 및 핵심 수납처(냉장고, 옷장, 욕실 수납장) 자동 생성
 */
export const seedDefaultSpacesAndStorages = async (groupId: string, userId: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    for (const spaceData of DEFAULT_INITIAL_SPACES) {
      const { data: space, error: spaceErr } = await supabase
        .from('spaces')
        .insert({
          name: spaceData.name,
          icon: spaceData.icon,
          group_id: groupId,
          user_id: userId,
        })
        .select()
        .single();

      if (spaceErr) {
        console.warn(`[Seed] Failed to seed space ${spaceData.name}:`, spaceErr);
        continue;
      }

      if (spaceData.storages && spaceData.storages.length > 0) {
        for (const storageData of spaceData.storages) {
          const { data: storage, error: storageErr } = await supabase
            .from('storages')
            .insert({
              space_id: space.id,
              name: storageData.name,
              icon: storageData.icon,
              group_id: groupId,
              user_id: userId,
            })
            .select()
            .single();

          if (storageErr) {
            console.warn(`[Seed] Failed to seed storage ${storageData.name}:`, storageErr);
            continue;
          }

          if (storageData.sections && storageData.sections.length > 0) {
            const sectionsToInsert = storageData.sections.map((sec) => ({
              storage_id: storage.id,
              name: sec.name,
              group_id: groupId,
              user_id: userId,
            }));
            await supabase.from('sections').insert(sectionsToInsert);
          }
        }
      }
    }
  } else {
    // Mock Sandbox Seeding
    const spaces = getLocal<Space[]>(STORAGE_KEYS.SPACES, []);
    const storages = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, []);
    const sections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, []);

    let seedTime = Date.now();
    for (const spaceData of DEFAULT_INITIAL_SPACES) {
      const spaceId = `s-${seedTime++}`;
      spaces.push({
        id: spaceId,
        user_id: userId,
        group_id: groupId,
        name: spaceData.name,
        icon: spaceData.icon,
        created_at: new Date().toISOString(),
      });

      if (spaceData.storages) {
        for (const storageData of spaceData.storages) {
          const storageId = `st-${seedTime++}`;
          storages.push({
            id: storageId,
            space_id: spaceId,
            user_id: userId,
            group_id: groupId,
            name: storageData.name,
            icon: storageData.icon,
            created_at: new Date().toISOString(),
          });

          if (storageData.sections) {
            for (const secData of storageData.sections) {
              sections.push({
                id: `se-${seedTime++}`,
                storage_id: storageId,
                user_id: userId,
                group_id: groupId,
                name: secData.name,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    setLocal(STORAGE_KEYS.SPACES, spaces);
    setLocal(STORAGE_KEYS.STORAGES, storages);
    setLocal(STORAGE_KEYS.SECTIONS, sections);
  }
};

// =========================================================================
// SERVICE ROUTER (SUPABASE OR MOCK)
// =========================================================================

export const dbService = {
  // 1. Authentication
  auth: {
    getCurrentUser: async (): Promise<UserSession | null> => {
      if (isSupabaseConfigured && supabase) {
        try {
          // 1. 로컬 세션 캐시 우선 확인 (0ms 즉시 복원 - 네트워크 지연으로 인한 타임아웃 원천 차단)
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // 백그라운드에서 최신 유효성 비동기 갱신 (앱 실행을 블로킹하지 않음)
            supabase.auth.getUser().catch(err => {
              console.warn('Background session verification notice:', err);
            });
            return {
              id: session.user.id,
              email: session.user.email,
              is_anonymous: session.user.is_anonymous || false,
            };
          }

          // 2. 로컬 세션이 없는 신규 사용자인 경우에만 서버에 세션 조회
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            return null;
          }
          return {
            id: user.id,
            email: user.email,
            is_anonymous: user.is_anonymous || false,
          };
        } catch (err) {
          console.warn('Session verification failed, attempting fallback to local session:', err);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              return {
                id: session.user.id,
                email: session.user.email,
                is_anonymous: session.user.is_anonymous || false,
              };
            }
          } catch {}
          return null;
        }
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
              is_private: it.is_private || false,
              user_id: userId,
              group_id: newGroupId,
              created_at: it.created_at,
              updated_at: it.updated_at
            };
          });
          let { error: itemErr } = await supabase
            .from('items')
            .insert(itemsToInsert);

          if (itemErr) {
            const isSchemaCacheError = 
              itemErr.message?.includes('is_private') || 
              itemErr.message?.includes('schema cache') || 
              itemErr.code === 'PGRST204';

            if (isSchemaCacheError) {
              console.warn("Supabase schema cache error for 'is_private' column during group seed. Retrying without is_private...", itemErr.message);
              const cleanItemsToInsert = itemsToInsert.map((it: any) => {
                const copy = { ...it };
                delete copy.is_private;
                return copy;
              });
              const retryRes = await supabase
                .from('items')
                .insert(cleanItemsToInsert);
              if (retryRes.error) throw retryRes.error;
            } else {
              throw itemErr;
            }
          }
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
    seedDefaultData: async (groupId: string, userId: string): Promise<void> => {
      await seedDefaultSpacesAndStorages(groupId, userId);
    },

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
        let initialUserName = '소유자';
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('user_name')
          .eq('user_id', userId)
          .not('user_name', 'is', null)
          .neq('user_name', '')
          .neq('user_name', '소유자')
          .order('created_at', { ascending: false })
          .limit(1);
        if (existingMember && existingMember.length > 0 && existingMember[0].user_name) {
          initialUserName = existingMember[0].user_name;
        }

        const { error: memberErr } = await supabase
          .from('group_members')
          .insert({ group_id: groupData.id, user_id: userId, role: 'owner', user_name: initialUserName });
        if (memberErr) throw memberErr;

        // 신규 보관함 생성 시 기본 6개 공간 및 필수 수납처 자동 생성
        try {
          await seedDefaultSpacesAndStorages(groupData.id, userId);
        } catch (seedErr) {
          console.warn('[Seed] Error during default seeding:', seedErr);
        }

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
        const existingMock = mockMembers.find(m => m.user_id === (user?.id || 'mock-user') && m.user_name && m.user_name !== '소유자');
        const mockUserName = existingMock ? existingMock.user_name : '소유자';
        mockMembers.push({
          id: `gm-${Date.now()}`,
          group_id: newGroup.id,
          user_id: user?.id || 'mock-user',
          role: 'owner',
          user_name: mockUserName,
          created_at: new Date().toISOString()
        });
        setLocal('wii_mock_group_members', mockMembers);

        // Seed mock initial spaces & storages
        await seedDefaultSpacesAndStorages(newGroup.id, user?.id || 'mock-user');

        return newGroup;
      }
    },

    join: async (code: string, userName?: string): Promise<Group> => {
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
        const memberPayload: any = { group_id: groupData.id, user_id: userId, role: 'member' };
        if (userName) {
          memberPayload.user_name = userName;
        }
        const { error: upsertErr } = await supabase
          .from('group_members')
          .upsert(memberPayload, { onConflict: 'group_id, user_id' });
        if (upsertErr) throw upsertErr;

        return groupData;
      } else {
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);
        const group = mockGroups.find(g => g.code.toLowerCase() === cleanCode);
        if (!group) throw new Error('존재하지 않는 공유 코드입니다. 코드를 확인해 주세요.');

        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const existing = mockMembers.find(gm => gm.group_id === group.id && gm.user_id === user?.id);
        if (existing) {
          if (userName) existing.user_name = userName;
        } else {
          mockMembers.push({
            id: `gm-${Date.now()}`,
            group_id: group.id,
            user_id: user?.id || 'mock-user',
            role: 'member',
            user_name: userName || '가족',
            created_at: new Date().toISOString()
          });
        }
        setLocal('wii_mock_group_members', mockMembers);
        return group;
      }
    },

    /**
     * 가족 보관소 합류 시 기존 내 보관소의 데이터(공간, 수납처, 세부위치, 물건)를
     * 대상 가족 보관소로 일괄 무손실 이전(Merge)
     */
    merge: async (sourceGroupId: string, targetGroupId: string): Promise<void> => {
      if (!sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) return;

      if (isSupabaseConfigured && supabase) {
        // 1. Move spaces
        const { error: spErr } = await supabase
          .from('spaces')
          .update({ group_id: targetGroupId })
          .eq('group_id', sourceGroupId);
        if (spErr) console.warn('[Merge] Error migrating spaces:', spErr);

        // 2. Move storages
        const { error: stErr } = await supabase
          .from('storages')
          .update({ group_id: targetGroupId })
          .eq('group_id', sourceGroupId);
        if (stErr) console.warn('[Merge] Error migrating storages:', stErr);

        // 3. Move sections
        const { error: seErr } = await supabase
          .from('sections')
          .update({ group_id: targetGroupId })
          .eq('group_id', sourceGroupId);
        if (seErr) console.warn('[Merge] Error migrating sections:', seErr);

        // 4. Move items
        const { error: itErr } = await supabase
          .from('items')
          .update({ group_id: targetGroupId })
          .eq('group_id', sourceGroupId);
        if (itErr) console.warn('[Merge] Error migrating items:', itErr);

        // 5. 무손실 계층 중복 통합 자동 수행 (공간, 수납처, 세부위치 일원화)
        await dbService.spaces.deduplicateVault(targetGroupId);
      } else {
        // Mock Sandbox merge
        const mockSpaces = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES).map(s => 
          s.group_id === sourceGroupId ? { ...s, group_id: targetGroupId } : s
        );
        setLocal(STORAGE_KEYS.SPACES, mockSpaces);

        const mockStorages = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES).map(st => 
          st.group_id === sourceGroupId ? { ...st, group_id: targetGroupId } : st
        );
        setLocal(STORAGE_KEYS.STORAGES, mockStorages);

        const mockSections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS).map(se => 
          se.group_id === sourceGroupId ? { ...se, group_id: targetGroupId } : se
        );
        setLocal(STORAGE_KEYS.SECTIONS, mockSections);

        const mockItems = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS).map(it => 
          it.group_id === sourceGroupId ? { ...it, group_id: targetGroupId } : it
        );
        setLocal(STORAGE_KEYS.ITEMS, mockItems);

        // 5. Mock 무손실 계층 중복 통합 자동 수행
        await dbService.spaces.deduplicateVault(targetGroupId);
      }
    },

    restoreByCode: async (code: string): Promise<Group> => {
      const cleanInput = code.trim().toLowerCase();
      if (!cleanInput) throw new Error('복구 코드를 입력해 주세요.');

      const candidate1 = cleanInput;
      const candidate2 = cleanInput.startsWith('wii-') ? cleanInput.replace('wii-', '') : `wii-${cleanInput}`;

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('사용자 세션을 찾을 수 없습니다.');

        // Find group by candidate1 or candidate2
        const { data: groupData, error: findErr } = await supabase
          .from('groups')
          .select('*')
          .or(`code.eq.${candidate1},code.eq.${candidate2}`)
          .maybeSingle();

        if (findErr) throw findErr;
        if (!groupData) throw new Error('일치하는 보관소를 찾을 수 없습니다. 복구 코드를 다시 확인해 주세요.');

        // 1. 해당 보관소(groupData)의 기존 소유자/멤버 커스텀 호칭 우선 탐색
        let userName = '';
        const { data: vaultOwnerMembers } = await supabase
          .from('group_members')
          .select('user_name')
          .eq('group_id', groupData.id)
          .not('user_name', 'is', null)
          .neq('user_name', '')
          .neq('user_name', '소유자')
          .order('created_at', { ascending: false });

        if (vaultOwnerMembers && vaultOwnerMembers.length > 0 && vaultOwnerMembers[0].user_name) {
          userName = vaultOwnerMembers[0].user_name;
        }

        // 2. 보관소 내에 없다면 현재 사용자 세션의 다른 보관소 호칭 탐색
        if (!userName) {
          const { data: existingMember } = await supabase
            .from('group_members')
            .select('user_name')
            .eq('user_id', userId)
            .not('user_name', 'is', null)
            .neq('user_name', '')
            .neq('user_name', '소유자')
            .limit(1);
          if (existingMember && existingMember.length > 0 && existingMember[0].user_name) {
            userName = existingMember[0].user_name;
          }
        }

        userName = userName || '소유자';

        // Upsert into group_members as owner
        const { error: memberErr } = await supabase
          .from('group_members')
          .upsert({
            group_id: groupData.id,
            user_id: userId,
            role: 'owner',
            user_name: userName
          }, { onConflict: 'group_id, user_id' });
        if (memberErr) throw memberErr;

        // Try to update groups.owner_id to current active user
        try {
          await supabase.from('groups').update({ owner_id: userId }).eq('id', groupData.id);
        } catch {
          // If RLS prevents it, will be resolved by schema update
        }

        return groupData;
      } else {
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);
        const group = mockGroups.find(g => 
          g.code.toLowerCase() === candidate1 || 
          g.code.toLowerCase() === candidate2
        );
        if (!group) throw new Error('일치하는 보관소를 찾을 수 없습니다. 복구 코드를 다시 확인해 주세요.');

        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const existing = mockMembers.find(m => m.group_id === group.id && m.user_id === user?.id);
        if (existing) {
          existing.role = 'owner';
        } else {
          mockMembers.push({
            id: `gm-${Date.now()}`,
            group_id: group.id,
            user_id: user?.id || 'mock-user',
            role: 'owner',
            user_name: '소유자',
            created_at: new Date().toISOString()
          });
        }
        setLocal('wii_mock_group_members', mockMembers);
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
          throw new Error('보관소 소유자는 보관소를 퇴장할 수 없습니다. 다른 기기가 접속 중이라면 해당 기기에서 접속을 해제해야 합니다.');
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
            throw new Error('보관소 소유자는 보관소를 퇴장할 수 없습니다.');
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

        const rawGroups: Group[] = (data || []).map((row: any) => row.groups).filter(Boolean);
        if (rawGroups.length === 0) return [];

        const ownerIds = Array.from(new Set(rawGroups.map(g => g.owner_id)));
        const groupIds = rawGroups.map(g => g.id);

        const { data: ownerMembers } = await supabase
          .from('group_members')
          .select('group_id, user_id, user_name')
          .in('group_id', groupIds)
          .in('user_id', ownerIds);

        const ownerNameMap: Record<string, string> = {};
        (ownerMembers || []).forEach((om: any) => {
          if (om.user_name) {
            ownerNameMap[`${om.group_id}_${om.user_id}`] = om.user_name;
            if (!ownerNameMap[om.user_id]) {
              ownerNameMap[om.user_id] = om.user_name;
            }
          }
        });

        return rawGroups.map((g) => ({
          ...g,
          owner_name: ownerNameMap[`${g.id}_${g.owner_id}`] || ownerNameMap[g.owner_id] || null
        }));
      } else {
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const mockGroups = getLocal<Group[]>('wii_mock_groups', []);

        const myGroupIds = mockMembers
          .filter(gm => gm.user_id === user?.id)
          .map(gm => gm.group_id);

        const myGroups = mockGroups.filter(g => myGroupIds.includes(g.id));
        return myGroups.map(g => {
          const ownerMember = mockMembers.find(m => m.group_id === g.id && (m.user_id === g.owner_id || m.role === 'owner'));
          return {
            ...g,
            owner_name: ownerMember?.user_name || null
          };
        });
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
        
        const list = data || [];
        const ownerMembers = list.filter(m => m.role === 'owner');
        const familyMembers = list.filter(m => m.role !== 'owner');

        // 보관소당 소유자(owner)는 오직 1명만 유효:
        // 과거 기기 초기화/복구 테스트로 누적된 고스트 소유자 세션들을 정리하여 활성 소유자 1명만 유지
        const { data: { session } } = await supabase.auth.getSession();
        const currentUid = session?.user?.id;
        const activeOwner = ownerMembers.find(m => currentUid && m.user_id === currentUid) || ownerMembers[ownerMembers.length - 1];

        return activeOwner ? [activeOwner, ...familyMembers] : familyMembers;
      } else {
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const list = mockMembers.filter(m => m.group_id === groupId);
        const ownerMembers = list.filter(m => m.role === 'owner');
        const familyMembers = list.filter(m => m.role !== 'owner');
        const user = getLocal<UserSession | null>(STORAGE_KEYS.USER, { id: 'mock-user', is_anonymous: true });
        const activeOwner = ownerMembers.find(m => user && m.user_id === user.id) || ownerMembers[ownerMembers.length - 1];
        return activeOwner ? [activeOwner, ...familyMembers] : familyMembers;
      }
    },

    updateMemberName: async (groupId: string, userId: string, userName: string): Promise<void> => {
      const cleanName = userName.trim();
      if (!cleanName) throw new Error('호칭을 입력해 주세요.');
      if (isSupabaseConfigured && supabase) {
        // Update user_name across ALL group_members rows for this user so nickname stays consistent across My Vault and Shared Vaults
        const { error } = await supabase
          .from('group_members')
          .update({ user_name: cleanName })
          .eq('user_id', userId);
        if (error) throw error;

        // Also update any pending join requests created by this user
        await supabase
          .from('group_join_requests')
          .update({ requester_name: cleanName })
          .eq('requester_id', userId);
      } else {
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        mockMembers.forEach(m => {
          if (m.user_id === userId) {
            m.user_name = cleanName;
          }
        });
        setLocal('wii_mock_group_members', mockMembers);

        const mockRequests = getLocal<GroupJoinRequest[]>('wii_mock_group_join_requests', []);
        mockRequests.forEach(r => {
          if (r.requester_id === userId) {
            r.requester_name = cleanName;
          }
        });
        setLocal('wii_mock_group_join_requests', mockRequests);
      }
    },

    removeMember: async (groupId: string, targetUserId: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        if (!currentUserId) throw new Error('User session not found');

        // Check if requester is owner of the group
        const { data: group, error: groupErr } = await supabase
          .from('groups')
          .select('owner_id')
          .eq('id', groupId)
          .single();
        if (groupErr) throw groupErr;

        // 소유자 여부 검증: groups.owner_id 이거나 group_members에서 role === 'owner'
        const { data: ownerMember } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', currentUserId)
          .eq('role', 'owner')
          .maybeSingle();

        const isVerifiedOwner = group.owner_id === currentUserId || Boolean(ownerMember);
        if (!isVerifiedOwner) {
          throw new Error('보관소 소유자만 멤버를 내보낼 수 있습니다.');
        }
        if (targetUserId === currentUserId) {
          throw new Error('소유자 자신은 내보낼 수 없습니다.');
        }

        // 1. 원자적 보안 RPC 함수(remove_group_member) 우선 시도 (가장 안전하고 신뢰성 높음)
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('remove_group_member', {
            p_group_id: groupId,
            p_target_user_id: targetUserId
          });

          if (!rpcErr && rpcData && typeof rpcData === 'object') {
            const res = rpcData as { success: boolean; error?: string; deleted_count?: number };
            if (res.success) {
              return;
            } else if (res.error) {
              throw new Error(res.error);
            }
          }
        } catch (rpcEx: any) {
          // RPC가 아직 미설치된 상태면 직접 쿼리(Direct Delete)로 fallback 진행
          if (rpcEx?.message && !rpcEx.message.includes('function') && !rpcEx.message.includes('not found')) {
            console.warn('remove_group_member RPC error, trying direct delete:', rpcEx);
          }
        }

        // 2. Direct Delete (group_id AND user_id)
        const { error: removeErr, count } = await supabase
          .from('group_members')
          .delete({ count: 'exact' })
          .eq('group_id', groupId)
          .eq('user_id', targetUserId);
          
        if (removeErr) throw removeErr;

        // 3. If 0 rows deleted, fallback delete by primary key id
        if (count === 0) {
          const { error: removeErr2, count: count2 } = await supabase
            .from('group_members')
            .delete({ count: 'exact' })
            .eq('group_id', groupId)
            .eq('id', targetUserId);
          if (removeErr2) throw removeErr2;
          if (count2 === 0) {
            // 소유자 ID 동기화 시도 (groups.owner_id = currentUserId)
            try {
              await supabase.from('groups').update({ owner_id: currentUserId }).eq('id', groupId);
              // 동기화 후 재시도
              const { error: retryErr, count: retryCount } = await supabase
                .from('group_members')
                .delete({ count: 'exact' })
                .eq('group_id', groupId)
                .eq('user_id', targetUserId);
              if (!retryErr && retryCount && retryCount > 0) {
                return;
              }
            } catch {
              // Ignore fallback update attempt
            }

            throw new Error('Supabase RLS 삭제 정책 갱신이 필요합니다. 안내된 SQL 쿼리를 Supabase 대시보드 SQL Editor에서 1회 실행해 주세요.');
          }
        }
      } else {
        const mockMembers = getLocal<GroupMember[]>('wii_mock_group_members', []);
        const idx = mockMembers.findIndex(m => m.group_id === groupId && (m.user_id === targetUserId || m.id === targetUserId));
        if (idx !== -1) {
          mockMembers.splice(idx, 1);
          setLocal('wii_mock_group_members', mockMembers);
        }
      }
    }
  },

  userProfile: {
    get: async (userId: string): Promise<{ family_share_unlocked_until: string | null } | null> => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('family_share_unlocked_until')
            .eq('id', userId)
            .maybeSingle();
          if (error) {
            console.warn('Failed to fetch user_profiles:', error);
            return null;
          }
          return data;
        } catch (e) {
          console.warn('Exception during fetching user_profiles:', e);
          return null;
        }
      } else {
        const until = localStorage.getItem('wii_family_share_unlocked_until');
        return { family_share_unlocked_until: until };
      }
    },

    updateUnlockTime: async (userId: string, durationMs: number = 5 * 60 * 1000): Promise<string> => {
      const unlockUntil = new Date(Date.now() + durationMs).toISOString();
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({ id: userId, family_share_unlocked_until: unlockUntil });
        if (error) throw error;
      } else {
        localStorage.setItem('wii_family_share_unlocked_until', unlockUntil);
      }
      return unlockUntil;
    },

    disableFamilyShare: async (userId: string): Promise<void> => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({ id: userId, family_share_unlocked_until: null });
        if (error) throw error;
      } else {
        localStorage.removeItem('wii_family_share_unlocked_until');
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
    },

    /**
     * 보관소 내 동일 이름의 공간(Spaces), 수납처(Storages), 세부위치(Sections)를
     * 무손실로 계층 통합(Deduplicate & Consolidate)
     */
    deduplicateVault: async (groupId: string): Promise<void> => {
      if (!groupId) return;

      if (isSupabaseConfigured && supabase) {
        // -------------------------------------------------------------
        // STEP 1. 공간(Spaces) 중복 감지 및 통합
        // -------------------------------------------------------------
        const { data: spaces, error: spErr } = await supabase
          .from('spaces')
          .select('id, name, icon, created_at')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });
        
        if (!spErr && spaces && spaces.length > 1) {
          // Fetch storages and items to determine data density per space
          const { data: storages } = await supabase
            .from('storages')
            .select('id, space_id, name, created_at')
            .eq('group_id', groupId);

          const { data: sections } = await supabase
            .from('sections')
            .select('id, storage_id, name, created_at')
            .eq('group_id', groupId);

          const { data: items } = await supabase
            .from('items')
            .select('id, section_id')
            .eq('group_id', groupId);

          // Map items to sections and storages
          const itemCountBySection = new Map<string, number>();
          (items || []).forEach(it => {
            if (it.section_id) {
              itemCountBySection.set(it.section_id, (itemCountBySection.get(it.section_id) || 0) + 1);
            }
          });

          const itemCountByStorage = new Map<string, number>();
          const sectionCountByStorage = new Map<string, number>();
          (sections || []).forEach(se => {
            if (se.storage_id) {
              sectionCountByStorage.set(se.storage_id, (sectionCountByStorage.get(se.storage_id) || 0) + 1);
              const itemsInSection = itemCountBySection.get(se.id) || 0;
              itemCountByStorage.set(se.storage_id, (itemCountByStorage.get(se.storage_id) || 0) + itemsInSection);
            }
          });

          const storageCountBySpace = new Map<string, number>();
          const itemCountBySpace = new Map<string, number>();
          (storages || []).forEach(st => {
            if (st.space_id) {
              storageCountBySpace.set(st.space_id, (storageCountBySpace.get(st.space_id) || 0) + 1);
              const itemsInStorage = itemCountByStorage.get(st.id) || 0;
              itemCountBySpace.set(st.space_id, (itemCountBySpace.get(st.space_id) || 0) + itemsInStorage);
            }
          });

          // Group spaces by trimmed lowercase name
          const spacesByName = new Map<string, typeof spaces>();
          for (const sp of spaces) {
            const key = (sp.name || '').trim().toLowerCase();
            if (!key) continue;
            if (!spacesByName.has(key)) spacesByName.set(key, []);
            spacesByName.get(key)!.push(sp);
          }

          for (const [, spaceGroup] of spacesByName.entries()) {
            if (spaceGroup.length <= 1) continue;

            // Sort: highest data score (storages*10 + items) first, then earlier created_at
            spaceGroup.sort((a, b) => {
              const scoreA = (storageCountBySpace.get(a.id) || 0) * 10 + (itemCountBySpace.get(a.id) || 0);
              const scoreB = (storageCountBySpace.get(b.id) || 0) * 10 + (itemCountBySpace.get(b.id) || 0);
              if (scoreB !== scoreA) return scoreB - scoreA;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            const primarySpace = spaceGroup[0];
            const secondarySpaces = spaceGroup.slice(1);

            for (const secondary of secondarySpaces) {
              // Re-point all storages from secondary to primary space
              await supabase
                .from('storages')
                .update({ space_id: primarySpace.id })
                .eq('space_id', secondary.id);

              // Delete secondary space
              await supabase
                .from('spaces')
                .delete()
                .eq('id', secondary.id);
            }
          }

          // -------------------------------------------------------------
          // STEP 2. 수납처(Storages) 동일 공간 내 중복 통합 (예: 안방 내 중복 '옷장')
          // -------------------------------------------------------------
          const { data: updatedStorages } = await supabase
            .from('storages')
            .select('id, space_id, name, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

          if (updatedStorages && updatedStorages.length > 1) {
            const storagesBySpaceAndName = new Map<string, typeof updatedStorages>();
            for (const st of updatedStorages) {
              const key = `${st.space_id}:::${(st.name || '').trim().toLowerCase()}`;
              if (!storagesBySpaceAndName.has(key)) storagesBySpaceAndName.set(key, []);
              storagesBySpaceAndName.get(key)!.push(st);
            }

            for (const [, stGroup] of storagesBySpaceAndName.entries()) {
              if (stGroup.length <= 1) continue;

              stGroup.sort((a, b) => {
                const scoreA = (itemCountByStorage.get(a.id) || 0) * 10 + (sectionCountByStorage.get(a.id) || 0);
                const scoreB = (itemCountByStorage.get(b.id) || 0) * 10 + (sectionCountByStorage.get(b.id) || 0);
                if (scoreB !== scoreA) return scoreB - scoreA;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              });

              const primaryStorage = stGroup[0];
              const secondaryStorages = stGroup.slice(1);

              for (const secondary of secondaryStorages) {
                // Re-point sections to primary storage
                await supabase
                  .from('sections')
                  .update({ storage_id: primaryStorage.id })
                  .eq('storage_id', secondary.id);

                // Delete secondary storage
                await supabase
                  .from('storages')
                  .delete()
                  .eq('id', secondary.id);
              }
            }
          }

          // -------------------------------------------------------------
          // STEP 3. 세부위치(Sections) 동일 수납처 내 중복 통합 (예: 옷장 내 중복 '옷걸이 칸')
          // -------------------------------------------------------------
          const { data: updatedSections } = await supabase
            .from('sections')
            .select('id, storage_id, name, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

          if (updatedSections && updatedSections.length > 1) {
            const sectionsByStorageAndName = new Map<string, typeof updatedSections>();
            for (const se of updatedSections) {
              const key = `${se.storage_id}:::${(se.name || '').trim().toLowerCase()}`;
              if (!sectionsByStorageAndName.has(key)) sectionsByStorageAndName.set(key, []);
              sectionsByStorageAndName.get(key)!.push(se);
            }

            for (const [, seGroup] of sectionsByStorageAndName.entries()) {
              if (seGroup.length <= 1) continue;

              seGroup.sort((a, b) => {
                const scoreA = itemCountBySection.get(a.id) || 0;
                const scoreB = itemCountBySection.get(b.id) || 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              });

              const primarySection = seGroup[0];
              const secondarySections = seGroup.slice(1);

              for (const secondary of secondarySections) {
                // Re-point items to primary section
                await supabase
                  .from('items')
                  .update({ section_id: primarySection.id })
                  .eq('section_id', secondary.id);

                // Delete secondary section
                await supabase
                  .from('sections')
                  .delete()
                  .eq('id', secondary.id);
              }
            }
          }
        }
      } else {
        // Mock Sandbox deduplication
        let mockSpaces = getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
        let mockStorages = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        let mockSections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        let mockItems = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);

        // 1. Spaces
        const groupSpaces = mockSpaces.filter(s => s.group_id === groupId);
        const spacesByName = new Map<string, Space[]>();
        for (const sp of groupSpaces) {
          const key = (sp.name || '').trim().toLowerCase();
          if (!key) continue;
          if (!spacesByName.has(key)) spacesByName.set(key, []);
          spacesByName.get(key)!.push(sp);
        }

        const deletedSpaceIds = new Set<string>();
        for (const [, spaceGroup] of spacesByName.entries()) {
          if (spaceGroup.length <= 1) continue;

          spaceGroup.sort((a, b) => {
            const storagesA = mockStorages.filter(st => st.space_id === a.id).length;
            const storagesB = mockStorages.filter(st => st.space_id === b.id).length;
            if (storagesB !== storagesA) return storagesB - storagesA;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });

          const primary = spaceGroup[0];
          const secondaries = spaceGroup.slice(1);
          for (const sec of secondaries) {
            mockStorages = mockStorages.map(st => st.space_id === sec.id ? { ...st, space_id: primary.id } : st);
            deletedSpaceIds.add(sec.id);
          }
        }
        mockSpaces = mockSpaces.filter(s => !deletedSpaceIds.has(s.id));

        // 2. Storages
        const groupStorages = mockStorages.filter(st => st.group_id === groupId);
        const storagesBySpaceAndName = new Map<string, StorageUnit[]>();
        for (const st of groupStorages) {
          const key = `${st.space_id}:::${(st.name || '').trim().toLowerCase()}`;
          if (!storagesBySpaceAndName.has(key)) storagesBySpaceAndName.set(key, []);
          storagesBySpaceAndName.get(key)!.push(st);
        }

        const deletedStorageIds = new Set<string>();
        for (const [, stGroup] of storagesBySpaceAndName.entries()) {
          if (stGroup.length <= 1) continue;
          stGroup.sort((a, b) => {
            const secA = mockSections.filter(se => se.storage_id === a.id).length;
            const secB = mockSections.filter(se => se.storage_id === b.id).length;
            if (secB !== secA) return secB - secA;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          const primary = stGroup[0];
          const secondaries = stGroup.slice(1);
          for (const sec of secondaries) {
            mockSections = mockSections.map(se => se.storage_id === sec.id ? { ...se, storage_id: primary.id } : se);
            deletedStorageIds.add(sec.id);
          }
        }
        mockStorages = mockStorages.filter(st => !deletedStorageIds.has(st.id));

        // 3. Sections
        const groupSections = mockSections.filter(se => se.group_id === groupId);
        const sectionsByStorageAndName = new Map<string, Section[]>();
        for (const se of groupSections) {
          const key = `${se.storage_id}:::${(se.name || '').trim().toLowerCase()}`;
          if (!sectionsByStorageAndName.has(key)) sectionsByStorageAndName.set(key, []);
          sectionsByStorageAndName.get(key)!.push(se);
        }

        const deletedSectionIds = new Set<string>();
        for (const [, seGroup] of sectionsByStorageAndName.entries()) {
          if (seGroup.length <= 1) continue;
          seGroup.sort((a, b) => {
            const itA = mockItems.filter(it => it.section_id === a.id).length;
            const itB = mockItems.filter(it => it.section_id === b.id).length;
            if (itB !== itA) return itB - itA;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          const primary = seGroup[0];
          const secondaries = seGroup.slice(1);
          for (const sec of secondaries) {
            mockItems = mockItems.map(it => it.section_id === sec.id ? { ...it, section_id: primary.id } : it);
            deletedSectionIds.add(sec.id);
          }
        }
        mockSections = mockSections.filter(se => !deletedSectionIds.has(se.id));

        setLocal(STORAGE_KEYS.SPACES, mockSpaces);
        setLocal(STORAGE_KEYS.STORAGES, mockStorages);
        setLocal(STORAGE_KEYS.SECTIONS, mockSections);
        setLocal(STORAGE_KEYS.ITEMS, mockItems);
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
      let targetImageUrl: string | null = null;
      let childItemImages: string[] = [];

      if (isSupabaseConfigured && supabase) {
        // 1. 수납처 이미지 및 하위 물건 이미지 경로 조회
        const { data: storage } = await supabase.from('storages').select('image_url').eq('id', id).maybeSingle();
        targetImageUrl = storage?.image_url || null;

        const { data: sections } = await supabase.from('sections').select('id').eq('storage_id', id);
        if (sections && sections.length > 0) {
          const secIds = sections.map(s => s.id);
          const { data: items } = await supabase.from('items').select('image_url').in('section_id', secIds);
          if (items) {
            childItemImages = items.map(it => it.image_url).filter((img): img is string => Boolean(img));
          }
        }

        const { error, count } = await supabase.from('storages').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
          throw new Error('Supabase에서 해당 수납처를 찾을 수 없거나 삭제 권한(RLS)이 없습니다.');
        }
      } else {
        let list = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        const storage = list.find(st => st.id === id);
        targetImageUrl = storage?.image_url || null;
        list = list.filter(st => st.id !== id);
        setLocal(STORAGE_KEYS.STORAGES, list);

        let sections = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        const sectionIdsToDelete = sections.filter(se => se.storage_id === id).map(se => se.id);
        sections = sections.filter(se => se.storage_id !== id);
        setLocal(STORAGE_KEYS.SECTIONS, sections);

        let items = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        const itemsToDelete = items.filter(it => sectionIdsToDelete.includes(it.section_id));
        childItemImages = itemsToDelete.map(it => it.image_url).filter((img): img is string => Boolean(img));
        items = items.filter(it => !sectionIdsToDelete.includes(it.section_id));
        setLocal(STORAGE_KEYS.ITEMS, items);
      }

      // 2. Storage 고아 파일 일괄 영구 파기
      if (targetImageUrl) {
        await deleteStorageImage(targetImageUrl);
      }
      for (const itemImg of childItemImages) {
        await deleteStorageImage(itemImg);
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
        return (data || []).map((s: any) => ({
          ...s,
          icon: s.icon || '📍'
        }));
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

        // Note: Supabase 'sections' table does not have an 'icon' column.
        const { data, error } = await supabase
          .from('sections')
          .insert({ storage_id: storageId, name, image_url: imageUrl, group_id: groupId, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return {
          ...data,
          icon: icon || '📍'
        };
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
        const { icon: _ignoredIcon, ...dbUpdates } = updates as any;
        const { data, error } = await supabase
          .from('sections')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return {
          ...data,
          icon: updates.icon || '📍'
        };
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
      expirationDate?: string | null,
      isPrivate: boolean = false
    ): Promise<Item> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const insertPayload: any = {
          section_id: sectionId,
          name,
          description,
          image_url: imageUrl,
          quantity,
          tags,
          group_id: groupId,
          user_id: userId,
          expiration_date: expirationDate,
          is_private: isPrivate
        };

        let { data, error } = await supabase
          .from('items')
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          const isSchemaCacheError = 
            error.message?.includes('is_private') || 
            error.message?.includes('schema cache') || 
            error.code === 'PGRST204';

          if (isSchemaCacheError) {
            console.warn("Supabase schema cache error for 'is_private' column. Retrying insert without is_private...", error.message);
            delete insertPayload.is_private;
            const retryRes = await supabase
              .from('items')
              .insert(insertPayload)
              .select()
              .single();
            if (retryRes.error) throw retryRes.error;
            data = retryRes.data;
          } else {
            throw error;
          }
        }
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
          expiration_date: expirationDate || null,
          is_private: isPrivate
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
        let { data, error } = await supabase
          .from('items')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          const isSchemaCacheError = 
            error.message?.includes('is_private') || 
            error.message?.includes('schema cache') || 
            error.code === 'PGRST204';

          if (isSchemaCacheError && 'is_private' in updates) {
            console.warn("Supabase schema cache error for 'is_private' column during update. Retrying without is_private...", error.message);
            const cleanUpdates = { ...updates };
            delete cleanUpdates.is_private;
            const retryRes = await supabase
              .from('items')
              .update(cleanUpdates)
              .eq('id', id)
              .select()
              .single();
            if (retryRes.error) throw retryRes.error;
            data = retryRes.data;
          } else {
            throw error;
          }
        }
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
      let targetImageUrl: string | null = null;
      if (isSupabaseConfigured && supabase) {
        const { data: item } = await supabase.from('items').select('image_url').eq('id', id).maybeSingle();
        targetImageUrl = item?.image_url || null;

        const { error, count } = await supabase.from('items').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
          throw new Error('Supabase에서 해당 물건을 찾을 수 없거나 삭제 권한(RLS)이 없습니다.');
        }
      } else {
        let list = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        const item = list.find(it => it.id === id);
        targetImageUrl = item?.image_url || null;
        list = list.filter(it => it.id !== id);
        setLocal(STORAGE_KEYS.ITEMS, list);
      }

      if (targetImageUrl) {
        await deleteStorageImage(targetImageUrl);
      }
    },

    uploadImage: async (file: File): Promise<string> => {
      // 1. 클라이언트 사이드 자동 압축 (최대 1024px, JPEG 품질 0.8)
      //    카메라 원본 5~15MB를 150~300KB로 95% 이상 경량화
      const compressedFile = await compressImage(file);

      if (isSupabaseConfigured && supabase) {
        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `items/${fileName}`;

        // Supabase Storage에 압축된 이미지 업로드
        const { error } = await supabase.storage
          .from('item-images')
          .upload(filePath, compressedFile, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        // 공개 URL 반환
        const { data } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        return data.publicUrl;
      } else {
        // Mock 환경: 압축된 파일의 Base64 반환 (LocalStorage 용량 절약)
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(compressedFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      }
    }
  },

  deleteStorageImage: deleteStorageImage
};
