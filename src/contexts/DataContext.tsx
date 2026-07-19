import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/db';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, StorageUnit, Section, Item } from '../types';
import { triggerInterstitialAd } from '../services/ads';

interface DataContextType {
  spaces: Space[];
  storages: StorageUnit[];
  sections: Section[];
  items: Item[];
  loading: boolean;
  dbError: string | null;
  refreshData: (silent?: boolean) => Promise<void>;
  
  createSpace: (name: string, icon: string) => Promise<Space>;
  updateSpace: (id: string, updates: Partial<Omit<Space, 'id' | 'user_id' | 'created_at'>>) => Promise<Space>;
  deleteSpace: (id: string) => Promise<void>;
  
  createStorage: (spaceId: string, name: string, icon: string, imageUrl?: string) => Promise<StorageUnit>;
  updateStorage: (id: string, updates: Partial<Omit<StorageUnit, 'id' | 'user_id' | 'created_at'>>) => Promise<StorageUnit>;
  deleteStorage: (id: string) => Promise<void>;
  
  createSection: (storageId: string, name: string, icon?: string, imageUrl?: string) => Promise<Section>;
  updateSection: (id: string, updates: Partial<Omit<Section, 'id' | 'user_id' | 'created_at'>>) => Promise<Section>;
  deleteSection: (id: string) => Promise<void>;
  
  createItem: (
    sectionId: string,
    name: string,
    description?: string,
    imageUrl?: string,
    quantity?: number,
    tags?: string[],
    expirationDate?: string | null
  ) => Promise<Item>;
  updateItem: (id: string, updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeGroup, loading: authLoading } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [storages, setStorages] = useState<StorageUnit[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const refreshData = useCallback(async (silent = false) => {
    if (!user || !activeGroup) return;
    try {
      if (!silent) setLoading(true);
      setDbError(null);
      
      const [fetchedSpaces, fetchedStorages, fetchedSections, fetchedItems] = await Promise.all([
        dbService.spaces.list(activeGroup.id),
        dbService.storages.list(activeGroup.id),
        dbService.sections.list(activeGroup.id),
        dbService.items.listAll(activeGroup.id),
      ]);
      
      setSpaces(fetchedSpaces);
      setStorages(fetchedStorages);
      setSections(fetchedSections);
      setItems(fetchedItems);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setDbError(error.message || String(error));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, activeGroup]);

  useEffect(() => {
    if (!authLoading) {
      if (user && activeGroup) {
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
  }, [user, activeGroup, authLoading, refreshData]);

  // --- Spaces CRUD ---
  const createSpace = async (name: string, icon: string) => {
    if (!activeGroup) throw new Error('선택된 워크스페이스가 없습니다.');
    const trimmedName = name.trim();
    const isDuplicate = spaces.some(
      s => s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`이미 "${trimmedName}"(이)라는 이름의 공간이 존재합니다.`);
    }

    const newSpace = await dbService.spaces.create(activeGroup.id, trimmedName, icon);
    setSpaces(prev => [...prev, newSpace].sort((a, b) => a.name.localeCompare(b.name)));
    return newSpace;
  };

  const updateSpace = async (id: string, updates: Partial<Omit<Space, 'id' | 'user_id' | 'created_at'>>) => {
    if (updates.name) {
      const trimmedName = updates.name.trim();
      const isDuplicate = spaces.some(
        s => s.id !== id && s.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`이미 "${trimmedName}"(이)라는 이름의 공간이 존재합니다.`);
      }
    }
    const updated = await dbService.spaces.update(id, updates);
    setSpaces(prev => prev.map(s => s.id === id ? updated : s).sort((a, b) => a.name.localeCompare(b.name)));
    return updated;
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
  const createStorage = async (spaceId: string, name: string, icon: string, imageUrl?: string) => {
    if (!activeGroup) throw new Error('선택된 워크스페이스가 없습니다.');
    const trimmedName = name.trim();
    const isDuplicate = storages.some(
      st => st.space_id === spaceId && st.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`이 공간 안에 이미 "${trimmedName}"(이)라는 이름의 수납처가 존재합니다.`);
    }

    const newStorage = await dbService.storages.create(activeGroup.id, spaceId, trimmedName, icon, imageUrl);
    setStorages(prev => [...prev, newStorage].sort((a, b) => a.name.localeCompare(b.name)));
    return newStorage;
  };

  const updateStorage = async (id: string, updates: Partial<Omit<StorageUnit, 'id' | 'user_id' | 'created_at'>>) => {
    if (updates.name) {
      const trimmedName = updates.name.trim();
      const currentStorage = storages.find(st => st.id === id);
      const spaceId = currentStorage?.space_id;
      if (spaceId) {
        const isDuplicate = storages.some(
          st => st.id !== id && st.space_id === spaceId && st.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
          throw new Error(`이 공간 안에 이미 "${trimmedName}"(이)라는 이름의 수납처가 존재합니다.`);
        }
      }
    }
    const updated = await dbService.storages.update(id, updates);
    setStorages(prev => prev.map(st => st.id === id ? updated : st).sort((a, b) => a.name.localeCompare(b.name)));
    return updated;
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
  const createSection = async (storageId: string, name: string, icon?: string, imageUrl?: string) => {
    if (!activeGroup) throw new Error('선택된 워크스페이스가 없습니다.');
    const trimmedName = name.trim();
    const isDuplicate = sections.some(
      se => se.storage_id === storageId && se.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`이 수납처 안에 이미 "${trimmedName}"(이)라는 이름의 세부 위치가 존재합니다.`);
    }

    const newSection = await dbService.sections.create(activeGroup.id, storageId, trimmedName, icon, imageUrl);
    setSections(prev => [...prev, newSection].sort((a, b) => a.name.localeCompare(b.name)));
    return newSection;
  };

  const updateSection = async (id: string, updates: Partial<Omit<Section, 'id' | 'user_id' | 'created_at'>>) => {
    if (updates.name) {
      const trimmedName = updates.name.trim();
      const currentSection = sections.find(se => se.id === id);
      const storageId = currentSection?.storage_id;
      if (storageId) {
        const isDuplicate = sections.some(
          se => se.id !== id && se.storage_id === storageId && se.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
          throw new Error(`이 수납처 안에 이미 "${trimmedName}"(이)라는 이름의 세부 위치가 존재합니다.`);
        }
      }
    }
    const updated = await dbService.sections.update(id, updates);
    setSections(prev => prev.map(se => se.id === id ? updated : se).sort((a, b) => a.name.localeCompare(b.name)));
    return updated;
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
    tags: string[] = [],
    expirationDate?: string | null
  ) => {
    if (!activeGroup) throw new Error('선택된 워크스페이스가 없습니다.');
    const newItem = await dbService.items.create(
      activeGroup.id,
      sectionId,
      name,
      description,
      imageUrl,
      quantity,
      tags,
      expirationDate
    );
    if (items.length >= 30) {
      triggerInterstitialAd().catch(err => console.warn('Failed to play interstitial ad:', err));
    }
    setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    return newItem;
  };

  const updateItem = async (id: string, updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (items.length >= 30) {
      triggerInterstitialAd().catch(err => console.warn('Failed to play interstitial ad:', err));
    }
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
        updateSpace,
        deleteSpace,
        createStorage,
        updateStorage,
        deleteStorage,
        createSection,
        updateSection,
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
