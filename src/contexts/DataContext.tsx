import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/db';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, StorageUnit, Section, Item } from '../types';
import { triggerSaveEditAd } from '../services/ads';
import { trackItemCreated } from '../services/analytics';
import { showUndoToast } from '../utils/toast';

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
  deleteSpace: (id: string, withUndo?: boolean) => Promise<void>;
  
  createStorage: (spaceId: string, name: string, icon: string, imageUrl?: string) => Promise<StorageUnit>;
  updateStorage: (id: string, updates: Partial<Omit<StorageUnit, 'id' | 'user_id' | 'created_at'>>) => Promise<StorageUnit>;
  deleteStorage: (id: string, withUndo?: boolean) => Promise<void>;
  
  createSection: (storageId: string, name: string, icon?: string, imageUrl?: string) => Promise<Section>;
  updateSection: (id: string, updates: Partial<Omit<Section, 'id' | 'user_id' | 'created_at'>>) => Promise<Section>;
  deleteSection: (id: string, withUndo?: boolean) => Promise<void>;
  
  createItem: (
    sectionId: string,
    name: string,
    description?: string,
    imageUrl?: string,
    quantity?: number,
    tags?: string[],
    expirationDate?: string | null,
    isPrivate?: boolean
  ) => Promise<Item>;
  updateItem: (id: string, updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<Item>;
  deleteItem: (id: string, withUndo?: boolean) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  allTags: string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * 한국어 명사 뒤에 붙는 주격 조사(이/가)를 받침 유무에 따라 판별
 */
const getSubjectMarker = (name: string): string => {
  if (!name) return '이';
  const clean = name.trim();
  if (!clean) return '이';
  const lastChar = clean[clean.length - 1];
  const code = lastChar.charCodeAt(0);
  
  // 한글 음절 (가 ~ 힣): 종성(받침) 여부 확인
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 > 0 ? '이' : '가';
  }
  
  // 숫자 받침 대응 (0, 1, 3, 6, 7, 8: 받침 있음 / 2, 4, 5, 9: 받침 없음)
  if (/[013678]/.test(lastChar)) return '이';
  if (/[2459]/.test(lastChar)) return '가';

  return '이';
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeGroup, isOwner: authIsOwner, loading: authLoading } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [storages, setStorages] = useState<StorageUnit[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // 워크스페이스 내 전체 등록된 유니크 태그 목록 자동 추출
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      it.tags?.forEach(t => {
        const trimmed = t?.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const refreshData = useCallback(async (silent = false) => {
    if (!user || !activeGroup) {
      if (!silent) setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      setDbError(null);
      
      let [fetchedSpaces, fetchedStorages, fetchedSections, fetchedItems] = await Promise.all([
        dbService.spaces.list(activeGroup.id),
        dbService.storages.list(activeGroup.id),
        dbService.sections.list(activeGroup.id),
        dbService.items.listAll(activeGroup.id),
      ]);

      const isOwner = authIsOwner || user.id === activeGroup.owner_id;

      // 만약 내 개인 보관소(소유자)인데 공간이 0개라면 기본 6대 공간(거실, 주방 등) 자동 복구 시딩
      if (isOwner && fetchedSpaces.length === 0) {
        console.log('[DataContext] 소유 보관소의 공간이 0개입니다. 기본 필수 공간을 자동 복구 시딩합니다...');
        try {
          await dbService.groups.seedDefaultData(activeGroup.id, user.id);
          [fetchedSpaces, fetchedStorages, fetchedSections, fetchedItems] = await Promise.all([
            dbService.spaces.list(activeGroup.id),
            dbService.storages.list(activeGroup.id),
            dbService.sections.list(activeGroup.id),
            dbService.items.listAll(activeGroup.id),
          ]);
        } catch (seedErr) {
          console.warn('[DataContext] 기본 공간 자동 복구 실패:', seedErr);
        }
      }

      // 중복 공간(동일 이름의 공간이 2개 이상) 자동 감지 및 스마트 계층 통합 정리
      const spaceNamesSet = new Set<string>();
      let hasDuplicateSpaces = false;
      for (const sp of fetchedSpaces) {
        const key = (sp.name || '').trim().toLowerCase();
        if (key) {
          if (spaceNamesSet.has(key)) {
            hasDuplicateSpaces = true;
            break;
          }
          spaceNamesSet.add(key);
        }
      }

      if (hasDuplicateSpaces) {
        console.log('[DataContext] 중복 공간 감지됨. 무손실 계층 자동 통합(deduplicateVault)을 실행합니다...');
        await dbService.spaces.deduplicateVault(activeGroup.id);
        [fetchedSpaces, fetchedStorages, fetchedSections, fetchedItems] = await Promise.all([
          dbService.spaces.list(activeGroup.id),
          dbService.storages.list(activeGroup.id),
          dbService.sections.list(activeGroup.id),
          dbService.items.listAll(activeGroup.id),
        ]);
      }
      
      const visibleItems = isOwner ? fetchedItems : fetchedItems.filter(it => !it.is_private);
      
      setSpaces(fetchedSpaces);
      setStorages(fetchedStorages);
      setSections(fetchedSections);
      setItems(visibleItems);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setDbError(error.message || String(error));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, activeGroup, authIsOwner]);

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

  const deleteSpace = async (id: string, withUndo: boolean = true) => {
    const targetSpace = spaces.find(s => s.id === id);
    if (!targetSpace || !withUndo) {
      await dbService.spaces.delete(id);
      setSpaces(prev => prev.filter(s => s.id !== id));
      setStorages(prev => prev.filter(st => st.space_id !== id));
      const storageIds = storages.filter(st => st.space_id === id).map(st => st.id);
      setSections(prev => prev.filter(se => !storageIds.includes(se.storage_id)));
      const sectionIds = sections.filter(se => storageIds.includes(se.storage_id)).map(se => se.id);
      setItems(prev => prev.filter(it => !sectionIds.includes(it.section_id)));
      return;
    }

    const childStorages = storages.filter(st => st.space_id === id);
    const childStorageIds = childStorages.map(st => st.id);
    const childSections = sections.filter(se => childStorageIds.includes(se.storage_id));
    const childSectionIds = childSections.map(se => se.id);
    const childItems = items.filter(it => childSectionIds.includes(it.section_id));

    // UI 즉각 제거
    setSpaces(prev => prev.filter(s => s.id !== id));
    setStorages(prev => prev.filter(st => st.space_id !== id));
    setSections(prev => prev.filter(se => !childStorageIds.includes(se.storage_id)));
    setItems(prev => prev.filter(it => !childSectionIds.includes(it.section_id)));

    showUndoToast({
      message: `"${targetSpace.name}" 공간이 삭제되었습니다.`,
      duration: 5000,
      onUndo: () => {
        setSpaces(prev => [...prev, targetSpace].sort((a, b) => a.name.localeCompare(b.name)));
        setStorages(prev => [...prev, ...childStorages].sort((a, b) => a.name.localeCompare(b.name)));
        setSections(prev => [...prev, ...childSections].sort((a, b) => a.name.localeCompare(b.name)));
        setItems(prev => [...prev, ...childItems].sort((a, b) => a.name.localeCompare(b.name)));
      },
      onCommit: async () => {
        await dbService.spaces.delete(id);
      }
    });
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

  const deleteStorage = async (id: string, withUndo: boolean = true) => {
    const targetStorage = storages.find(st => st.id === id);
    if (!targetStorage || !withUndo) {
      await dbService.storages.delete(id);
      setStorages(prev => prev.filter(st => st.id !== id));
      setSections(prev => prev.filter(se => se.storage_id !== id));
      const sectionIds = sections.filter(se => se.storage_id === id).map(se => se.id);
      setItems(prev => prev.filter(it => !sectionIds.includes(it.section_id)));
      return;
    }

    const childSections = sections.filter(se => se.storage_id === id);
    const childSectionIds = childSections.map(se => se.id);
    const childItems = items.filter(it => childSectionIds.includes(it.section_id));

    setStorages(prev => prev.filter(st => st.id !== id));
    setSections(prev => prev.filter(se => se.storage_id !== id));
    setItems(prev => prev.filter(it => !childSectionIds.includes(it.section_id)));

    showUndoToast({
      message: `"${targetStorage.name}" 수납처가 삭제되었습니다.`,
      duration: 5000,
      onUndo: () => {
        setStorages(prev => [...prev, targetStorage].sort((a, b) => a.name.localeCompare(b.name)));
        setSections(prev => [...prev, ...childSections].sort((a, b) => a.name.localeCompare(b.name)));
        setItems(prev => [...prev, ...childItems].sort((a, b) => a.name.localeCompare(b.name)));
      },
      onCommit: async () => {
        await dbService.storages.delete(id);
      }
    });
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

  const deleteSection = async (id: string, withUndo: boolean = true) => {
    const targetSection = sections.find(se => se.id === id);
    if (!targetSection || !withUndo) {
      await dbService.sections.delete(id);
      setSections(prev => prev.filter(se => se.id !== id));
      setItems(prev => prev.filter(it => it.section_id !== id));
      return;
    }

    const childItems = items.filter(it => it.section_id === id);

    setSections(prev => prev.filter(se => se.id !== id));
    setItems(prev => prev.filter(it => it.section_id !== id));

    showUndoToast({
      message: `"${targetSection.name}" 세부 위치가 삭제되었습니다.`,
      duration: 5000,
      onUndo: () => {
        setSections(prev => [...prev, targetSection].sort((a, b) => a.name.localeCompare(b.name)));
        setItems(prev => [...prev, ...childItems].sort((a, b) => a.name.localeCompare(b.name)));
      },
      onCommit: async () => {
        await dbService.sections.delete(id);
      }
    });
  };

  // --- Items CRUD ---
  const createItem = async (
    sectionId: string,
    name: string,
    description?: string,
    imageUrl?: string,
    quantity: number = 1,
    tags: string[] = [],
    expirationDate?: string | null,
    isPrivate?: boolean
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
      expirationDate,
      isPrivate
    );
    setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    // 토스 핵심 전환 이벤트(item_created) 및 적정 시점 인앱 리뷰 유도
    trackItemCreated(name, Boolean(expirationDate)).catch(err => console.warn('Failed to track item creation:', err));

    const totalCount = items.length + 1;
    if (totalCount >= 30) {
      setTimeout(() => {
        triggerSaveEditAd(totalCount).catch(err => console.warn('Failed to play save ad:', err));
      }, 700);
    }
    return newItem;
  };

  const updateItem = async (id: string, updates: Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    const updated = await dbService.items.update(id, updates);
    setItems(prev => prev.map(it => it.id === id ? updated : it));
    if (items.length >= 30) {
      setTimeout(() => {
        triggerSaveEditAd(items.length).catch(err => console.warn('Failed to play edit ad:', err));
      }, 700);
    }
    return updated;
  };

  const deleteItem = async (id: string, withUndo: boolean = true) => {
    const targetItem = items.find(it => it.id === id);
    if (!targetItem || !withUndo) {
      await dbService.items.delete(id);
      setItems(prev => prev.filter(it => it.id !== id));
      return;
    }

    // 1. UI에서 즉시 숨김 처리 (체감 속도 극대화)
    setItems(prev => prev.filter(it => it.id !== id));

    // 2. 5초 Undo 토스트 노출 (실행 취소 시 복구, 5초 만료 시 DB/Storage 영구 파기)
    const marker = getSubjectMarker(targetItem.name);
    showUndoToast({
      message: `"${targetItem.name}"${marker} 삭제되었습니다.`,
      duration: 5000,
      onUndo: () => {
        setItems(prev => [...prev, targetItem].sort((a, b) => a.name.localeCompare(b.name)));
      },
      onCommit: async () => {
        await dbService.items.delete(id);
      }
    });
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
        allTags,
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
