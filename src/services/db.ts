import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, StorageUnit, Section, Item, UserSession } from '../types';

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
    }
  },

  // 2. Spaces (1단계)
  spaces: {
    list: async (): Promise<Space[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('spaces')
          .select('*')
          .order('name');
        if (error) throw error;
        return data || [];
      } else {
        return getLocal<Space[]>(STORAGE_KEYS.SPACES, SEED_SPACES);
      }
    },

    create: async (name: string, icon: string): Promise<Space> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('spaces')
          .insert({ name, icon, user_id: userId })
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
    list: async (spaceId?: string): Promise<StorageUnit[]> => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('storages').select('*').order('name');
        if (spaceId) query = query.eq('space_id', spaceId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<StorageUnit[]>(STORAGE_KEYS.STORAGES, SEED_STORAGES);
        return spaceId ? list.filter(s => s.space_id === spaceId) : list;
      }
    },

    create: async (spaceId: string, name: string, icon: string, imageUrl?: string): Promise<StorageUnit> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('storages')
          .insert({ space_id: spaceId, name, icon, image_url: imageUrl, user_id: userId })
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
    list: async (storageId?: string): Promise<Section[]> => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('sections').select('*').order('name');
        if (storageId) query = query.eq('storage_id', storageId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<Section[]>(STORAGE_KEYS.SECTIONS, SEED_SECTIONS);
        return storageId ? list.filter(s => s.storage_id === storageId) : list;
      }
    },

    create: async (storageId: string, name: string, icon?: string, imageUrl?: string): Promise<Section> => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('User session not found');

        const { data, error } = await supabase
          .from('sections')
          .insert({ storage_id: storageId, name, image_url: imageUrl, user_id: userId })
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
    list: async (sectionId?: string): Promise<Item[]> => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('items').select('*').order('name');
        if (sectionId) query = query.eq('section_id', sectionId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } else {
        const list = getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
        return sectionId ? list.filter(i => i.section_id === sectionId) : list;
      }
    },

    listAll: async (): Promise<Item[]> => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .order('name');
        if (error) throw error;
        return data || [];
      } else {
        return getLocal<Item[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
      }
    },

    create: async (
      sectionId: string,
      name: string,
      description?: string,
      imageUrl?: string,
      quantity: number = 1,
      tags: string[] = []
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
            user_id: userId
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
          name,
          description,
          image_url: imageUrl,
          quantity,
          tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
