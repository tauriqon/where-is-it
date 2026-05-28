import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/db';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, StorageUnit, Section, Item } from '../types';

interface DataContextType {
  spaces: Space[];
  storages: StorageUnit[];
  sections: Section[];
  items: Item[];
  loading: boolean;
  dbError: string | null;
  refreshData: (silent?: boolean) => Promise<void>;
  
  createSpace: (name: string, icon: string) => Promise<Space>;
  deleteSpace: (id: string) => Promise<void>;
  
  createStorage: (spaceId: string, name: string, icon: string) => Promise<StorageUnit>;
  deleteStorage: (id: string) => Promise<void>;
  
  createSection: (storageId: string, name: string) => Promise<Section>;
  deleteSection: (id: string) => Promise<void>;
  
  createItem: (
    sectionId: string,
    name: string,
    description?: string,
    imageUrl?: string,
    quantity?: number,
    tags?: string[]
  ) => Promise<Item>;
  updateItem: (id: string, updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [storages, setStorages] = useState<StorageUnit[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // 기본 데모 시드 데이터 생성 함수
  const seedDefaultData = async () => {
    // 1. 공간 생성
    const s1 = await dbService.spaces.create('거실', '🏠');
    const s2 = await dbService.spaces.create('주방', '🍳');
    const s3 = await dbService.spaces.create('안방', '🛏️');
    
    // 2. 수납처 생성
    const st1 = await dbService.storages.create(s1.id, '거실 수납장', '📺');
    await dbService.storages.create(s1.id, '거실 책장', '📚');
    const st3 = await dbService.storages.create(s2.id, '냉장고', '❄️');
    const st4 = await dbService.storages.create(s3.id, '옷장', '👔');
    
    // 3. 세부위치 생성
    const se1 = await dbService.sections.create(st1.id, '첫째 칸');
    const se2 = await dbService.sections.create(st3.id, '냉장실');
    await dbService.sections.create(st3.id, '야채칸');
    const se4 = await dbService.sections.create(st4.id, '첫째 서랍');
    
    // 4. 물건 생성
    await Promise.all([
      dbService.items.create(se1.id, 'TV 리모컨', '셋톱박스 통합 리모컨', 'https://images.unsplash.com/photo-1572621426441-697711b2298c?w=150', 1, ['전자제품', '필수품']),
      dbService.items.create(se2.id, '신선한 우유', '내일까지 마셔야 함', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=150', 2, ['식료품', '음료']),
      dbService.items.create(se4.id, '여권 및 서류', '해외 여행 및 비상용 서류 파우치', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=150', 2, ['중요서류', '신분증'])
    ]);
  };

  const refreshData = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      if (!silent) setLoading(true);
      setDbError(null);
      
      const fetchedSpaces = await dbService.spaces.list();
      
      // 초도 로그인 유저 최적화: 계정이 비어있다면 자동으로 깔끔한 데모 시드 데이터 생성
      if (!silent && fetchedSpaces.length === 0) {
        console.log("Empty account detected. Seeding default demo data...");
        try {
          await seedDefaultData();
        } catch (seedErr) {
          console.error("Failed to seed default records:", seedErr);
        }
      }

      const [fetchedSpacesRefreshed, fetchedStorages, fetchedSections, fetchedItems] = await Promise.all([
        dbService.spaces.list(),
        dbService.storages.list(),
        dbService.sections.list(),
        dbService.items.listAll(),
      ]);
      
      setSpaces(fetchedSpacesRefreshed);
      setStorages(fetchedStorages);
      setSections(fetchedSections);
      setItems(fetchedItems);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setDbError(error.message || String(error));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        refreshData();

        // Supabase 실시간 동기화 채널 설정
        if (isSupabaseConfigured && supabase) {
          console.log("Subscribing to Supabase Realtime changes silently...");
          
          const channel = supabase
            .channel('realtime-data-sync')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public' }, // spaces, storages, sections, items 변경 전체 구독
              (payload) => {
                console.log('Realtime Postgres change detected:', payload);
                // 실시간 데이터 변경 감지 시 화면 깜빡임 없이 무소음 새로고침 수행
                refreshData(true);
              }
            )
            .subscribe((status) => {
              console.log(`Realtime subscription status: ${status}`);
            });
            
          return () => {
            console.log("Unsubscribing from Supabase Realtime...");
            if (supabase) {
              supabase.removeChannel(channel);
            }
          };
        }
      } else {
        setSpaces([]);
        setStorages([]);
        setSections([]);
        setItems([]);
        setLoading(false);
      }
    }
  }, [user, authLoading, refreshData]);

  // --- Spaces CRUD ---
  const createSpace = async (name: string, icon: string) => {
    const trimmedName = name.trim();
    const isDuplicate = spaces.some(
      s => s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`이미 "${trimmedName}"(이)라는 이름의 공간이 존재합니다.`);
    }

    const newSpace = await dbService.spaces.create(trimmedName, icon);
    setSpaces(prev => [...prev, newSpace].sort((a, b) => a.name.localeCompare(b.name)));
    return newSpace;
  };

  const deleteSpace = async (id: string) => {
    await dbService.spaces.delete(id);
    setSpaces(prev => prev.filter(s => s.id !== id));
    
    // Cascade delete locally
    setStorages(prev => prev.filter(st => st.space_id !== id));
    const storageIds = storages.filter(st => st.space_id === id).map(st => st.id);
    setSections(prev => prev.filter(se => !storageIds.includes(se.storage_id)));
    const sectionIds = sections.filter(se => storageIds.includes(se.storage_id)).map(se => se.id);
    setItems(prev => prev.filter(it => !sectionIds.includes(it.section_id)));
  };

  // --- Storages CRUD ---
  const createStorage = async (spaceId: string, name: string, icon: string) => {
    const trimmedName = name.trim();
    const isDuplicate = storages.some(
      st => st.space_id === spaceId && st.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`이 공간 안에 이미 "${trimmedName}"(이)라는 이름의 수납처가 존재합니다.`);
    }

    const newStorage = await dbService.storages.create(spaceId, trimmedName, icon);
    setStorages(prev => [...prev, newStorage].sort((a, b) => a.name.localeCompare(b.name)));
    return newStorage;
  };

  const deleteStorage = async (id: string) => {
    await dbService.storages.delete(id);
    setStorages(prev => prev.filter(st => st.id !== id));
    
    // Cascade delete locally
    setSections(prev => prev.filter(se => se.storage_id !== id));
    const sectionIds = sections.filter(se => se.storage_id === id).map(se => se.id);
    setItems(prev => prev.filter(it => !sectionIds.includes(it.section_id)));
  };

  // --- Sections CRUD ---
  const createSection = async (storageId: string, name: string) => {
    const trimmedName = name.trim();
    const isDuplicate = sections.some(
      se => se.storage_id === storageId && se.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`이 수납처 안에 이미 "${trimmedName}"(이)라는 이름의 세부 위치가 존재합니다.`);
    }

    const newSection = await dbService.sections.create(storageId, trimmedName);
    setSections(prev => [...prev, newSection].sort((a, b) => a.name.localeCompare(b.name)));
    return newSection;
  };

  const deleteSection = async (id: string) => {
    await dbService.sections.delete(id);
    setSections(prev => prev.filter(se => se.id !== id));
    setItems(prev => prev.filter(it => it.section_id !== id));
  };

  // --- Items CRUD ---
  const createItem = async (
    sectionId: string,
    name: string,
    description?: string,
    imageUrl?: string,
    quantity: number = 1,
    tags: string[] = []
  ) => {
    const newItem = await dbService.items.create(sectionId, name, description, imageUrl, quantity, tags);
    setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    return newItem;
  };

  const updateItem = async (id: string, updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    const updated = await dbService.items.update(id, updates);
    setItems(prev => prev.map(it => it.id === id ? updated : it));
    return updated;
  };

  const deleteItem = async (id: string) => {
    await dbService.items.delete(id);
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const uploadImage = async (file: File) => {
    return await dbService.items.uploadImage(file);
  };

  return (
    <DataContext.Provider
      value={{
        spaces,
        storages,
        sections,
        items,
        loading,
        dbError,
        refreshData,
        createSpace,
        deleteSpace,
        createStorage,
        deleteStorage,
        createSection,
        deleteSection,
        createItem,
        updateItem,
        deleteItem,
        uploadImage,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
