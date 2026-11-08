import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Search, Tag, X, ChevronRight, ChevronLeft, ChevronDown, Archive, Clock, Calendar, Camera, Trash2, Check, Plus, AlertCircle } from 'lucide-react';
import type { Item } from '../types';
import BottomSheet from './BottomSheet';
import EmojiIcon from './EmojiIcon';
import { getExpirationBadgeInfo } from '../utils/expiration';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { DEFAULT_SPACE_ICONS } from '../utils/iconLoader';
import { ImagePickerBottomSheet } from './ImagePickerBottomSheet';

const triggerHaptic = (
  type:
    | 'tickWeak'
    | 'tap'
    | 'tickMedium'
    | 'softMedium'
    | 'basicWeak'
    | 'basicMedium'
    | 'success'
    | 'error'
    | 'wiggle'
    | 'confetti' = 'basicMedium'
) => {
  try {
    generateHapticFeedback({ type });
  } catch (e) {
    // 일반 브라우저 대응용 예외 처리
  }
};

interface SearchTabProps {
  onNavigateTab?: (tab: 'home' | 'explore' | 'add' | 'search', params?: any) => void;
  onZoomImage: (url: string | null) => void;
  registerBackHandler?: (handler: () => boolean) => () => void;
}

// 한글 초성 추출 함수
const getChosung = (str: string) => {
  const cho = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code > -1 && code < 11172) {
      result += cho[Math.floor(code / 588)];
    } else {
      result += str.charAt(i);
    }
  }
  return result.toLowerCase();
};

export const SearchTab: React.FC<SearchTabProps> = ({ onNavigateTab, onZoomImage, registerBackHandler }) => {
  const { items, spaces, storages, sections, deleteItem, updateItem, uploadImage, allTags, createSpace, createStorage, createSection } = useData();
  const { user, activeGroup } = useAuth();
  const isOwner = user?.id === activeGroup?.owner_id;
  
  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // 물건 상세 모달 상태
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 물건 수정 상태 관리
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editSpaceId, setEditSpaceId] = useState('');
  const [editStorageId, setEditStorageId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  // 유통기한 수정 상태
  const [editHasExpiration, setEditHasExpiration] = useState(false);
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // 위치 빠른 직접 추가 상태
  const [isAddingSpace, setIsAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceIcon, setNewSpaceIcon] = useState<string>(() => DEFAULT_SPACE_ICONS[0] || '🏠');
  const [showSpaceIconPicker, setShowSpaceIconPicker] = useState(false);

  const [isAddingStorage, setIsAddingStorage] = useState(false);
  const [newStorageName, setNewStorageName] = useState('');
  const [newStorageImageFile, setNewStorageImageFile] = useState<File | null>(null);
  const [newStorageImagePreview, setNewStorageImagePreview] = useState<string | null>(null);

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionImageFile, setNewSectionImageFile] = useState<File | null>(null);
  const [newSectionImagePreview, setNewSectionImagePreview] = useState<string | null>(null);

  const [isCreatingLoc, setIsCreatingLoc] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'storage' | 'section' | null>(null);

  const handleImageSelected = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (imagePickerTarget === 'storage') {
        setNewStorageImageFile(file);
        setNewStorageImagePreview(result);
      } else if (imagePickerTarget === 'section') {
        setNewSectionImageFile(file);
        setNewSectionImagePreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCancelSpaceAdd = () => {
    setIsAddingSpace(false);
    setNewSpaceName('');
    setShowSpaceIconPicker(false);
  };

  const handleCancelStorageAdd = () => {
    setIsAddingStorage(false);
    setNewStorageName('');
    setNewStorageImageFile(null);
    setNewStorageImagePreview(null);
  };

  const handleCancelSectionAdd = () => {
    setIsAddingSection(false);
    setNewSectionName('');
    setNewSectionImageFile(null);
    setNewSectionImagePreview(null);
  };

  const handleQuickCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    try {
      setIsCreatingLoc(true);
      const created = await createSpace(newSpaceName.trim(), newSpaceIcon);
      triggerHaptic('success');
      setEditSpaceId(created.id);
      setEditStorageId('');
      setEditSectionId('');
      setNewSpaceName('');
      setNewSpaceIcon(DEFAULT_SPACE_ICONS[0] || '🏠');
      setShowSpaceIconPicker(false);
      setIsAddingSpace(false);
    } catch (err: any) {
      alert(err.message || '공간 추가 실패');
    } finally {
      setIsCreatingLoc(false);
    }
  };

  const handleQuickCreateStorage = async () => {
    if (!newStorageName.trim() || !editSpaceId) return;
    try {
      setIsCreatingLoc(true);
      let imageUrl: string | undefined = undefined;
      if (newStorageImageFile) {
        imageUrl = await uploadImage(newStorageImageFile);
      }
      const created = await createStorage(editSpaceId, newStorageName.trim(), '📦', imageUrl);
      triggerHaptic('success');
      setEditStorageId(created.id);
      setEditSectionId('');
      setNewStorageName('');
      setNewStorageImageFile(null);
      setNewStorageImagePreview(null);
      setIsAddingStorage(false);
    } catch (err: any) {
      alert(err.message || '수납처 추가 실패');
    } finally {
      setIsCreatingLoc(false);
    }
  };

  const handleQuickCreateSection = async () => {
    if (!newSectionName.trim() || !editStorageId) return;
    try {
      setIsCreatingLoc(true);
      let imageUrl: string | undefined = undefined;
      if (newSectionImageFile) {
        imageUrl = await uploadImage(newSectionImageFile);
      }
      const created = await createSection(editStorageId, newSectionName.trim(), undefined, imageUrl);
      triggerHaptic('success');
      setEditSectionId(created.id);
      setNewSectionName('');
      setNewSectionImageFile(null);
      setNewSectionImagePreview(null);
      setIsAddingSection(false);
    } catch (err: any) {
      alert(err.message || '세부 위치 추가 실패');
    } finally {
      setIsCreatingLoc(false);
    }
  };

  useEffect(() => {
    if (!isDetailOpen || !isEditing) {
      handleCancelSpaceAdd();
      handleCancelStorageAdd();
      handleCancelSectionAdd();
    }
  }, [isDetailOpen, isEditing]);

  // 로컬스토리지에서 최근 검색어 가져오기 및 세션 스토리지 자동 검색 키워드 확인
  useEffect(() => {
    const stored = localStorage.getItem('wii_recent_searches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }

    try {
      const keyword = sessionStorage.getItem('wii_search_keyword');
      if (keyword) {
        setQuery(keyword);
        sessionStorage.removeItem('wii_search_keyword');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);



  // 검색어 입력 시 실시간 매칭
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const isChosungQuery = /^[ㄱ-ㅎ\s]+$/.test(trimmed);

    const filtered = items.filter(item => {
      // 1. 이름 매칭 (일반/초성)
      const name = item.name.toLowerCase();
      const nameMatch = name.includes(trimmed);
      const chosungMatch = isChosungQuery && getChosung(item.name).includes(trimmed);
      
      // 2. 설명 매칭
      const descMatch = item.description?.toLowerCase().includes(trimmed) || false;
      
      // 3. 태그 매칭
      const tagMatch = item.tags.some(tag => tag.toLowerCase().includes(trimmed));

      return nameMatch || chosungMatch || descMatch || tagMatch;
    });

    setResults(filtered);
  }, [query, items]);

  // 최근 검색어 추가 및 검색 실행
  const handleSearchSubmit = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;

    setQuery(term);

    // 중복 제거 및 최근 5개 유지
    setRecentSearches(prev => {
      const updated = [term, ...prev.filter(t => t !== term)].slice(0, 5);
      localStorage.setItem('wii_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(t => t !== termToRemove);
      localStorage.setItem('wii_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  // 물건의 전체 경로 구하기 (예: "안방 > 옷장 > 첫째 서랍")
  const getItemPath = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return '알 수 없는 세부위치';

    const storage = storages.find((st) => st.id === section.storage_id);
    if (!storage) return section.name;

    const space = spaces.find((sp) => sp.id === storage.space_id);
    if (!space) return `${storage.name} > ${section.name}`;

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle', flexWrap: 'wrap' }}>
        <EmojiIcon icon={space.icon} size={12} style={{ marginRight: '2px' }} />
        <span>{space.name}</span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>&gt;</span>
        <span>{storage.name}</span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>&gt;</span>
        <span>{section.name}</span>
      </span>
    );
  };

  // 모든 등록된 태그 구하기 (추천 태그용: 상위 8개)
  const popularTags = allTags.slice(0, 8);

  const currentItem = items.find(i => i.id === viewItemId);
  const section = currentItem ? sections.find(s => s.id === currentItem.section_id) : null;
  const storage = section ? storages.find(st => st.id === section.storage_id) : null;
  const hasSectionImage = !!section?.image_url;
  const hasStorageImage = !!storage?.image_url;

  // 수정 중 변경된 내용이 있는지 감지 (원래 물건 정보와 비교)
  const hasUnsavedChanges = (() => {
    if (!currentItem || !isEditing) return false;
    const origName = currentItem.name;
    const origDesc = currentItem.description || '';
    const origQty = currentItem.quantity;
    const origTags = currentItem.tags || [];
    const origSectionId = currentItem.section_id;
    const origHasExp = !!currentItem.expiration_date;
    const origExpDate = currentItem.expiration_date || '';
    const origPrivate = !!currentItem.is_private;

    return (
      editName !== origName ||
      editDesc !== origDesc ||
      editQty !== origQty ||
      JSON.stringify(editTags) !== JSON.stringify(origTags) ||
      editSectionId !== origSectionId ||
      editHasExpiration !== origHasExp ||
      editExpirationDate !== origExpDate ||
      editIsPrivate !== origPrivate ||
      !!editImageFile
    );
  })();

  // 수정 중 실시간 임시 저장 (X로 앱/시트 종료 시 100% 안전 복원용)
  useEffect(() => {
    if (!isEditing || !viewItemId || !currentItem) return;

    if (!hasUnsavedChanges) {
      localStorage.removeItem(`wii_edit_item_draft_${viewItemId}`);
      return;
    }

    const draft = {
      itemId: viewItemId,
      name: editName,
      description: editDesc,
      quantity: editQty,
      tags: editTags,
      spaceId: editSpaceId,
      storageId: editStorageId,
      sectionId: editSectionId,
      hasExpiration: editHasExpiration,
      expirationDate: editExpirationDate,
      isPrivate: editIsPrivate,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(`wii_edit_item_draft_${viewItemId}`, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save item edit draft in SearchTab:', e);
    }
  }, [
    isEditing, viewItemId, editName, editDesc, editQty, editTags,
    editSpaceId, editStorageId, editSectionId, editHasExpiration,
    editExpirationDate, editIsPrivate, hasUnsavedChanges
  ]);

  // 바텀시트 열릴 때 이전에 X로 종료된 임시 저장본이 있으면 자동 복원 (안전 복원 메커니즘)
  useEffect(() => {
    if (!isDetailOpen || !viewItemId || !currentItem) {
      setHasRestoredDraft(false);
      return;
    }

    try {
      const draftStr = localStorage.getItem(`wii_edit_item_draft_${viewItemId}`);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft && draft.itemId === viewItemId) {
          let restored = false;
          if (draft.name !== undefined && draft.name !== currentItem.name) {
            setEditName(draft.name);
            restored = true;
          } else {
            setEditName(currentItem.name);
          }
          if (draft.description !== undefined && draft.description !== (currentItem.description || '')) {
            setEditDesc(draft.description);
            restored = true;
          } else {
            setEditDesc(currentItem.description || '');
          }
          if (draft.quantity !== undefined && draft.quantity !== currentItem.quantity) {
            setEditQty(draft.quantity);
            restored = true;
          } else {
            setEditQty(currentItem.quantity);
          }
          if (draft.tags !== undefined) {
            setEditTags(draft.tags);
            if (JSON.stringify(draft.tags) !== JSON.stringify(currentItem.tags || [])) {
              restored = true;
            }
          } else {
            setEditTags(currentItem.tags || []);
          }
          if (draft.sectionId !== undefined && draft.sectionId !== currentItem.section_id) {
            setEditSectionId(draft.sectionId);
            if (draft.storageId) setEditStorageId(draft.storageId);
            if (draft.spaceId) setEditSpaceId(draft.spaceId);
            restored = true;
          } else {
            const curSec = sections.find(s => s.id === currentItem.section_id);
            const curSt = curSec ? storages.find(st => st.id === curSec.storage_id) : null;
            if (curSec) setEditSectionId(curSec.id);
            if (curSt) {
              setEditStorageId(curSt.id);
              setEditSpaceId(curSt.space_id);
            }
          }
          if (draft.hasExpiration !== undefined && draft.hasExpiration !== !!currentItem.expiration_date) {
            setEditHasExpiration(draft.hasExpiration);
            restored = true;
          } else {
            setEditHasExpiration(!!currentItem.expiration_date);
          }
          if (draft.expirationDate !== undefined && draft.expirationDate !== (currentItem.expiration_date || '')) {
            setEditExpirationDate(draft.expirationDate);
            restored = true;
          } else {
            setEditExpirationDate(currentItem.expiration_date || '');
          }
          if (draft.isPrivate !== undefined && draft.isPrivate !== !!currentItem.is_private) {
            setEditIsPrivate(draft.isPrivate);
            restored = true;
          } else {
            setEditIsPrivate(!!currentItem.is_private);
          }

          if (restored) {
            setIsEditing(true);
            setHasRestoredDraft(true);
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse item edit draft in SearchTab:', e);
    }

    setHasRestoredDraft(false);
  }, [isDetailOpen, viewItemId, currentItem]);

  const handleCancelEdit = () => {
    if (!currentItem) return;
    setEditName(currentItem.name);
    setEditDesc(currentItem.description || '');
    setEditQty(currentItem.quantity);
    setEditTags(currentItem.tags || []);
    setEditTagInput('');
    setEditImageFile(null);
    setEditImagePreview(currentItem.image_url || null);
    setEditExpirationDate(currentItem.expiration_date || '');
    setEditHasExpiration(!!currentItem.expiration_date);
    setEditIsPrivate(currentItem.is_private || false);
    const sec = sections.find(s => s.id === currentItem.section_id);
    if (sec) {
      setEditSectionId(sec.id);
      const st = storages.find(s => s.id === sec.storage_id);
      if (st) {
        setEditStorageId(st.id);
        setEditSpaceId(st.space_id);
      }
    }
    setIsEditing(false);
    setHasRestoredDraft(false);
  };

  // < 뒤로가기 또는 [취소] 클릭 시 경고창 처리
  const handleBackFromEdit = (): boolean => {
    if (hasUnsavedChanges) {
      triggerHaptic('tickMedium');
      const confirmed = window.confirm('수정 중인 내용이 있습니다. 변경사항을 저장하지 않고 나가시겠습니까?');
      if (!confirmed) {
        return true; // 취소 클릭: 수정 화면 유지
      }
    }
    // 확인 클릭 또는 변경사항 없음: 임시 저장본 삭제 및 원래 내용으로 복귀
    if (viewItemId) {
      localStorage.removeItem(`wii_edit_item_draft_${viewItemId}`);
    }
    handleCancelEdit();
    return true;
  };

  // 토스 네이티브 뒤로가기(backEvent) 연동
  useEffect(() => {
    if (!registerBackHandler) return;

    const hasBackAction = !!viewItemId || isEditing;
    if (hasBackAction) {
      const unregister = registerBackHandler(() => {
        if (isEditing) {
          return handleBackFromEdit();
        }
        if (viewItemId) {
          setViewItemId(null);
          setIsDetailOpen(false);
          return true; // handled
        }
        return false;
      });
      return unregister;
    }
  }, [registerBackHandler, viewItemId, isEditing, hasUnsavedChanges]);

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('이 물건을 삭제하시겠습니까?')) {
      try {
        setIsDetailOpen(false);
        if (id) {
          localStorage.removeItem(`wii_edit_item_draft_${id}`);
        }
        await deleteItem(id);
        setViewItemId(null);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    }
  };



  const handleAddEditTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = editTagInput.trim();
      if (trimmed && !editTags.includes(trimmed)) {
        setEditTags(prev => [...prev, trimmed]);
        setEditTagInput('');
      }
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartEdit = () => {
    if (!currentItem) return;
    setEditName(currentItem.name);
    setEditDesc(currentItem.description || '');
    setEditQty(currentItem.quantity);
    setEditTags(currentItem.tags || []);
    setEditTagInput('');
    
    const section = sections.find(s => s.id === currentItem.section_id);
    if (section) {
      setEditSectionId(section.id);
      const storage = storages.find(st => st.id === section.storage_id);
      if (storage) {
        setEditStorageId(storage.id);
        setEditSpaceId(storage.space_id);
      }
    }
    
    setEditImageFile(null);
    setEditImagePreview(currentItem.image_url || null);
    setEditExpirationDate(currentItem.expiration_date || '');
    setEditHasExpiration(!!currentItem.expiration_date);
    setEditIsPrivate(currentItem.is_private || false);
    setIsEditing(true);
    setTimeout(() => {
      const sheetBody = document.querySelector('.bottom-sheet-body');
      if (sheetBody) {
        sheetBody.scrollTop = 0;
      }
    }, 10);
  };

  const handleSaveEdit = async () => {
    if (!currentItem) return;
    if (!editName.trim()) {
      triggerHaptic('error');
      alert('물건 이름을 입력해 주세요.');
      return;
    }
    if (!editSpaceId) {
      triggerHaptic('error');
      alert('1단계 보관 공간을 선택하거나 추가해 주세요.');
      return;
    }
    if (!editStorageId) {
      triggerHaptic('error');
      alert('2단계 수납처가 지정되지 않았습니다.\n[+ 새 수납처]를 눌러 수납처를 추가하거나 기존 수납처를 선택해 주세요.');
      return;
    }
    if (!editSectionId) {
      triggerHaptic('error');
      alert('3단계 세부 위치가 지정되지 않았습니다.\n[+ 새 위치]를 눌러 세부 위치를 추가하거나 기존 위치를 선택해 주세요.');
      return;
    }

    try {
      setIsUpdatingItem(true);
      let finalImageUrl = currentItem.image_url || '';

      if (editImageFile) {
        finalImageUrl = await uploadImage(editImageFile);
      } else if (!editImagePreview) {
        finalImageUrl = '';
      }

      await updateItem(currentItem.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        quantity: editQty,
        tags: editTags,
        section_id: editSectionId,
        image_url: finalImageUrl || undefined,
        expiration_date: editHasExpiration ? (editExpirationDate || null) : null,
        is_private: isOwner ? editIsPrivate : false
      });

      if (viewItemId) {
        localStorage.removeItem(`wii_edit_item_draft_${viewItemId}`);
      }
      setHasRestoredDraft(false);
      setIsEditing(false);
      triggerHaptic('success');
      alert('물건 정보가 수정되었습니다.');
    } catch (err: any) {
      console.error(err);
      alert('수정 중 에러가 발생했습니다: ' + err.message);
    } finally {
      setIsUpdatingItem(false);
    }
  };

  return (
    <div className="page-transition">
      
      {/* 고정 검색 필드 */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-app)', paddingBottom: '16px', zIndex: 10 }}>
        <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Search size={20} color="var(--toss-blue)" />
          <span>검색</span>
        </h2>
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="input-text"
            style={{ paddingLeft: '48px', paddingRight: query ? '40px' : '16px', minHeight: '52px', height: 'auto' }}
            placeholder="물건명, 초성(예: ㅇㅍ), 태그, 설명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(query)}
          />
          <Search size={20} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px' }} />
          
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: '14px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}
            >
              <X size={18} color="var(--text-tertiary)" />
            </button>
          )}
        </div>
      </div>

      {/* 검색 결과 목록 */}
      {query.trim() ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>
            검색 결과 {results.length}개
          </div>

          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Archive size={36} strokeWidth={1.5} />
              <span>일치하는 물건을 찾지 못했습니다.<br />초성이나 태그를 다시 확인해 보세요.</span>
            </div>
          ) : (
            results.map(item => (
              <div
                key={item.id}
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => {
                  handleSearchSubmit(query); // 최근 검색어 추가
                  setViewItemId(item.id);
                  setIsDetailOpen(true);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain', background: '#f8f9fa' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                      📦
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '17px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </h4>
                      {item.is_private && (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--toss-blue)', background: 'var(--toss-blue-light)', border: '1px solid rgba(49, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                          🔒 개인
                        </span>
                      )}
                      {item.quantity > 1 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px' }}>
                          x{item.quantity}
                        </span>
                      )}
                      {item.expiration_date && (
                        (() => {
                          const badge = getExpirationBadgeInfo(item.expiration_date);
                          return (
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '700', 
                              color: badge.color, 
                              background: badge.bg, 
                              border: badge.border, 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}>
                              {badge.label}
                            </span>
                          );
                        })()
                      )}
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {getItemPath(item.section_id)}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>
            ))
          )}

        </div>
      ) : (
        /* 초기 기본 뷰: 최근 검색어 & 추천 태그 */
        <div>
          {/* 최근 검색어 */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>최근 검색어</span>
                <button
                  onClick={() => { setRecentSearches([]); localStorage.removeItem('wii_recent_searches'); }}
                  style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: '14px', cursor: 'pointer' }}
                >
                  전체 삭제
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                {recentSearches.map(term => (
                  <div
                    key={term}
                    onClick={() => handleSearchSubmit(term)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                      <Clock size={16} color="var(--text-tertiary)" />
                      <span style={{ fontSize: '17px' }}>{term}</span>
                    </div>
                    <button
                      onClick={(e) => handleClearRecentSearch(term, e)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                    >
                      <X size={14} color="var(--text-tertiary)" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 추천 태그 */}
          {popularTags.length > 0 && (
            <div>
              <label className="form-label">자주 찾는 태그</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {popularTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleSearchSubmit(tag)}
                    style={{
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-subtle)',
                      padding: '8px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  >
                    <Tag size={12} color="var(--toss-blue)" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 물건 상세 바텀시트 */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => { 
          setIsDetailOpen(false); 
          setViewItemId(null); 
          setIsEditing(false); 
          setHasRestoredDraft(false);
        }}
        title={
          isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                type="button" 
                onClick={handleBackFromEdit}
                style={{ 
                  border: 'none', 
                  background: 'none', 
                  padding: '4px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  color: 'var(--text-primary)',
                  marginLeft: '-4px' 
                }}
                aria-label="뒤로가기"
              >
                <ChevronLeft size={22} strokeWidth={2.4} />
              </button>
              <h3 className="h2-title" style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                물건 정보 수정
              </h3>
            </div>
          ) : (
            currentItem ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 className="h2-title" style={{ margin: 0, fontSize: '20px', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                  {currentItem.name}
                </h3>
                {currentItem.is_private && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--toss-blue)', background: 'var(--toss-blue-light)', border: '1px solid rgba(49, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                    🔒 개인
                  </span>
                )}
              </div>
            ) : "물건 상세 정보"
          )
        }
      >
        {currentItem && (
          isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 이전에 작성 중이던 임시 저장본이 복원되었을 때 알림 배너 */}
              {hasRestoredDraft && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'rgba(49, 130, 246, 0.08)',
                  border: '1px solid rgba(49, 130, 246, 0.2)',
                  borderRadius: '12px',
                  marginBottom: '4px',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>📝</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.4' }}>
                      이전에 수정 중이던 내용이 복원되었습니다.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tickMedium');
                      if (window.confirm('작성 중이던 수정 내용을 취소하고 원래 물건 정보로 되돌리시겠습니까?')) {
                        if (viewItemId) localStorage.removeItem(`wii_edit_item_draft_${viewItemId}`);
                        handleCancelEdit();
                      }
                    }}
                    style={{
                      border: 'none',
                      background: '#ffffff',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                    }}
                  >
                    원래대로
                  </button>
                </div>
              )}
              
              {/* 물건 이름 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '14px' }}>물건 이름 *</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="예: 비상약, 헤어드라이기"
                  required
                />
              </div>

              {/* 3단계 위치 지능형 선택 시스템 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 수정</span>
                
                {/* 1단계: 공간 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontSize: '14px', margin: 0 }}>1단계: 공간 *</label>
                    <button 
                      type="button" 
                      onClick={() => { setIsAddingSpace(!isAddingSpace); setNewSpaceName(''); }}
                      style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 4px' }}
                    >
                      {isAddingSpace ? <><X size={13} /> 닫기</> : <><Plus size={13} /> 새 공간</>}
                    </button>
                  </div>

                  {isAddingSpace && (
                    <div style={{ marginBottom: '10px', width: '100%', background: 'var(--bg-subtle)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-medium)' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => setShowSpaceIconPicker(!showSpaceIconPicker)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px',
                            height: '38px',
                            minHeight: '38px',
                            padding: '0 8px',
                            background: '#fff',
                            border: showSpaceIconPicker ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          title="기본 공간 아이콘 선택"
                        >
                          <EmojiIcon icon={newSpaceIcon} size={20} />
                          <ChevronDown size={12} color="var(--text-tertiary)" />
                        </button>
                        <input
                          type="text"
                          className="input-text"
                          style={{ flex: 1, minWidth: 0, minHeight: '38px', height: '38px', fontSize: '14px', padding: '0 12px', background: '#fff', border: '1.5px solid var(--toss-blue)', borderRadius: '8px', boxSizing: 'border-box' }}
                          placeholder="새 공간 이름 (예: 안방, 베란다)"
                          value={newSpaceName}
                          onChange={(e) => setNewSpaceName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateSpace(); } }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleQuickCreateSpace}
                          className="btn-primary"
                          style={{ width: 'auto', flexShrink: 0, minHeight: '38px', height: '38px', padding: '0 14px', fontSize: '13px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                          disabled={isCreatingLoc || !newSpaceName.trim()}
                        >
                          {isCreatingLoc ? '추가 중...' : '추가'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelSpaceAdd}
                          className="btn-secondary"
                          style={{ width: 'auto', flexShrink: 0, minHeight: '38px', height: '38px', padding: '0 10px', fontSize: '13px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                        >
                          취소
                        </button>
                      </div>

                      {showSpaceIconPicker && (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          background: '#fff',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                              기본 공간 아이콘 선택
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSpaceIconPicker(false)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                            >
                              <X size={14} color="var(--text-tertiary)" />
                            </button>
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(6, 1fr)',
                            gap: '6px',
                            maxHeight: '140px',
                            overflowY: 'auto',
                            padding: '2px'
                          }}>
                            {DEFAULT_SPACE_ICONS.map((ic) => (
                              <button
                                key={ic}
                                type="button"
                                onClick={() => {
                                  setNewSpaceIcon(ic);
                                  setShowSpaceIconPicker(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '38px',
                                  borderRadius: '8px',
                                  border: newSpaceIcon === ic ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                                  background: newSpaceIcon === ic ? 'var(--toss-blue-light)' : '#fff',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                <EmojiIcon icon={ic} size={22} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {spaces.length === 0 ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 공간이 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {spaces.map(s => {
                        const isSelected = editSpaceId === s.id;
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              setEditSpaceId(s.id);
                              setEditStorageId('');
                              setEditSectionId('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none',
                              fontSize: '14px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                            }}
                          >
                            <EmojiIcon icon={s.icon} size={16} />
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {s.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2단계: 수납처 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontSize: '14px', margin: 0 }}>2단계: 수납처 *</label>
                    {editSpaceId && (
                      <button 
                        type="button" 
                        onClick={() => { setIsAddingStorage(!isAddingStorage); setNewStorageName(''); }}
                        style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 4px' }}
                      >
                        {isAddingStorage ? <><X size={13} /> 닫기</> : <><Plus size={13} /> 새 수납처</>}
                      </button>
                    )}
                  </div>

                  {isAddingStorage && (
                    <div style={{ marginBottom: '10px', width: '100%', background: 'var(--bg-subtle)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-medium)' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => setImagePickerTarget('storage')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '38px',
                            minHeight: '38px',
                            width: '42px',
                            minWidth: '42px',
                            padding: 0,
                            background: '#fff',
                            border: newStorageImagePreview ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}
                          title={newStorageImagePreview ? '사진 변경' : '수납처 사진 등록 (카메라/앨범)'}
                        >
                          {newStorageImagePreview ? (
                            <img src={newStorageImagePreview} alt="수납처 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Camera size={18} color="var(--text-secondary)" />
                          )}
                        </button>
                        <input
                          type="text"
                          className="input-text"
                          style={{ flex: 1, minWidth: 0, minHeight: '38px', height: '38px', fontSize: '14px', padding: '0 12px', background: '#fff', border: '1.5px solid var(--toss-blue)', borderRadius: '8px', boxSizing: 'border-box' }}
                          placeholder="새 수납처 이름 (예: 서랍장, 옷장)"
                          value={newStorageName}
                          onChange={(e) => setNewStorageName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateStorage(); } }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleQuickCreateStorage}
                          className="btn-primary"
                          style={{ width: 'auto', flexShrink: 0, minHeight: '38px', height: '38px', padding: '0 14px', fontSize: '13px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                          disabled={isCreatingLoc || !newStorageName.trim()}
                        >
                          {isCreatingLoc ? '추가 중...' : '추가'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelStorageAdd}
                          className="btn-secondary"
                          style={{ width: 'auto', flexShrink: 0, minHeight: '38px', height: '38px', padding: '0 10px', fontSize: '13px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                        >
                          취소
                        </button>
                      </div>

                      {newStorageImagePreview ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '4px 8px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--toss-blue)', fontWeight: '600' }}>
                            📷 수납처 사진 첨부됨
                          </span>
                          <button
                            type="button"
                            onClick={() => { setNewStorageImageFile(null); setNewStorageImagePreview(null); }}
                            style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 4px' }}
                          >
                            <X size={12} /> 사진 삭제
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                          💡 사진을 등록하지 않으면 기본 아이콘(📦 박스)으로 생성됩니다.
                        </div>
                      )}
                    </div>
                  )}

                  {!editSpaceId ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>먼저 공간을 선택해 주세요.</div>
                  ) : storages.filter(st => st.space_id === editSpaceId).length === 0 ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>이 공간에 등록된 수납처가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {storages.filter(st => st.space_id === editSpaceId).map(st => {
                        const isSelected = editStorageId === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              setEditStorageId(st.id);
                              setEditSectionId('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none',
                              fontSize: '14px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                            }}
                          >
                            {st.image_url ? (
                              <img src={st.image_url} alt={st.name} style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                            ) : (
                              <EmojiIcon icon={st.icon || '📦'} size={16} />
                            )}
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {st.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3단계: 세부위치 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontSize: '14px', margin: 0 }}>3단계: 세부 위치 *</label>
                    {editStorageId && (
                      <button 
                        type="button" 
                        onClick={() => { setIsAddingSection(!isAddingSection); setNewSectionName(''); }}
                        style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 4px' }}
                      >
                        {isAddingSection ? <><X size={13} /> 닫기</> : <><Plus size={13} /> 새 위치</>}
                      </button>
                    )}
                  </div>

                  {isAddingSection && (
                    <div style={{ marginBottom: '10px', width: '100%', background: 'var(--bg-subtle)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-medium)' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => setImagePickerTarget('section')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '38px',
                            minHeight: '38px',
                            width: '42px',
                            minWidth: '42px',
                            padding: 0,
                            background: '#fff',
                            border: newSectionImagePreview ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}
                          title={newSectionImagePreview ? '사진 변경' : '세부위치 사진 등록 (카메라/앨범)'}
                        >
                          {newSectionImagePreview ? (
                            <img src={newSectionImagePreview} alt="세부위치 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Camera size={18} color="var(--text-secondary)" />
                          )}
                        </button>
                        <input
                          type="text"
                          className="input-text"
                          style={{ flex: 1, minWidth: 0, minHeight: '38px', height: '38px', fontSize: '14px', padding: '0 12px', background: '#fff', border: '1.5px solid var(--toss-blue)', borderRadius: '8px', boxSizing: 'border-box' }}
                          placeholder="새 세부 위치 (예: 1번칸, 맨위)"
                          value={newSectionName}
                          onChange={(e) => setNewSectionName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateSection(); } }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleQuickCreateSection}
                          className="btn-primary"
                          style={{ width: 'auto', flexShrink: 0, minHeight: '38px', height: '38px', padding: '0 14px', fontSize: '13px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                          disabled={isCreatingLoc || !newSectionName.trim()}
                        >
                          {isCreatingLoc ? '추가 중...' : '추가'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelSectionAdd}
                          className="btn-secondary"
                          style={{ width: 'auto', flexShrink: 0, minHeight: '38px', height: '38px', padding: '0 10px', fontSize: '13px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                        >
                          취소
                        </button>
                      </div>

                      {newSectionImagePreview ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '4px 8px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--toss-blue)', fontWeight: '600' }}>
                            📷 세부위치 사진 첨부됨
                          </span>
                          <button
                            type="button"
                            onClick={() => { setNewSectionImageFile(null); setNewSectionImagePreview(null); }}
                            style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 4px' }}
                          >
                            <X size={12} /> 사진 삭제
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                          💡 사진을 등록하지 않으면 기본 아이콘(📍 spot)으로 생성됩니다.
                        </div>
                      )}
                    </div>
                  )}

                  {!editStorageId ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>먼저 수납처를 선택해 주세요.</div>
                  ) : sections.filter(se => se.storage_id === editStorageId).length === 0 ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>이 수납처에 등록된 세부위치가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {sections.filter(se => se.storage_id === editStorageId).map(se => {
                        const isSelected = editSectionId === se.id;
                        return (
                          <div
                            key={se.id}
                            onClick={() => setEditSectionId(se.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none',
                              fontSize: '14px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                            }}
                          >
                            {se.image_url ? (
                              <img 
                                src={se.image_url} 
                                alt={se.name} 
                                style={{ 
                                  width: '18px', 
                                  height: '18px', 
                                  borderRadius: '3px', 
                                  objectFit: 'contain',
                                  background: '#f8f9fa'
                                }} 
                              />
                            ) : (
                              <EmojiIcon icon={se.icon || '📍'} size={16} />
                            )}
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {se.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3단계 전체 등록 안내 메시지 */}
                {(!editSpaceId || !editStorageId || !editSectionId) && (
                  <div style={{
                    padding: '10px 12px',
                    background: '#fff9db',
                    border: '1px solid #ffe066',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#d9480f',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    lineHeight: '1.4'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>
                      {!editSpaceId
                        ? '보관할 1단계 공간을 선택하거나 추가해 주세요.'
                        : !editStorageId
                          ? '새 공간이 선택되었습니다. 2단계 [+ 새 수납처]를 추가해 주세요.'
                          : '3단계 [+ 새 위치]를 추가하여 보관할 위치 지정을 완료해 주세요.'}
                    </span>
                  </div>
                )}
              </div>

              {/* 사진 등록/변경 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '14px' }}>물건 사진 수정</label>
                {editImagePreview ? (
                  <div style={{ position: 'relative', width: '100%', minHeight: '240px', height: 'auto', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <img src={editImagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa' }} />
                    <button 
                      type="button" 
                      onClick={() => { setEditImageFile(null); setEditImagePreview(null); }}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={14} color="#fff" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => editFileInputRef.current?.click()}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100px', height: 'auto', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '8px', background: 'var(--bg-subtle)' }}
                  >
                    <Camera size={24} color="var(--text-tertiary)" />
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>사진 찍기 또는 이미지 선택</span>
                    <input 
                      ref={editFileInputRef}
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleEditImageChange}
                    />
                  </div>
                )}
              </div>

              {/* 수량 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>수량</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    type="button"
                    onClick={() => {
                      triggerHaptic('basicMedium');
                      setEditQty(prev => Math.max(1, prev - 1));
                    }}
                    style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '18px', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>
                    {editQty}
                  </span>
                  <button 
                    type="button"
                    onClick={() => {
                      triggerHaptic('basicMedium');
                      setEditQty(prev => prev + 1);
                    }}
                    style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 유통기한 수정 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '14px', margin: 0 }}>유통기한 수정</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={!editHasExpiration} 
                      onChange={(e) => {
                        setEditHasExpiration(!e.target.checked);
                        if (e.target.checked) {
                          setEditExpirationDate('');
                        }
                      }} 
                      style={{ cursor: 'pointer', width: '13px', minHeight: '13px', height: 'auto', margin: 0 }}
                    />
                    유통기한 없음 (N/A)
                  </label>
                </div>
                {editHasExpiration ? (
                  <input 
                    type="date"
                    className="input-text"
                    value={editExpirationDate}
                    onChange={(e) => setEditExpirationDate(e.target.value)}
                    style={{ minHeight: '40px', height: 'auto', padding: '0 12px', fontSize: '15px' }}
                  />
                ) : (
                  <div style={{
                    minHeight: '40px', height: 'auto',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    유통기한 정보 없음 (N/A)
                  </div>
                )}
              </div>

              {/* 개인 물건 설정 (소유자 전용) */}
              {isOwner && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    padding: '12px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>🔒 개인 물건 (가족 공유 시 숨기기)</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>체크하면 나에게만 보이고 가족 참가자에게는 숨겨집니다.</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={editIsPrivate}
                      onChange={(e) => {
                        triggerHaptic('tickWeak');
                        setEditIsPrivate(e.target.checked);
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                    />
                  </div>
                </div>
              )}

              {/* 태그 등록 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '14px' }}>태그</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {editTags.map(t => (
                    <span key={t} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                      <Tag size={10} /> {t}
                      <button type="button" onClick={() => handleRemoveEditTag(t)} style={{ border: 'none', background: 'none', display: 'flex', cursor: 'pointer' }}>
                        <X size={10} color="var(--toss-blue)" />
                      </button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text"
                  className="input-text"
                  style={{ minHeight: '40px', height: 'auto', padding: '0 12px', fontSize: '15px' }}
                  placeholder="태그 입력 후 Enter"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={handleAddEditTag}
                />
                {/* 기존 등록된 태그에서 빠른 선택 */}
                {allTags.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                      🏷️ 기존 등록된 태그에서 선택
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allTags.map(tag => {
                        const isSelected = editTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              triggerHaptic('tickWeak');
                              if (isSelected) {
                                setEditTags(prev => prev.filter(t => t !== tag));
                              } else {
                                setEditTags(prev => [...prev, tag]);
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontWeight: isSelected ? '700' : '500',
                              border: isSelected ? '1px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#ffffff',
                              color: isSelected ? 'var(--toss-blue)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            {isSelected ? <Check size={10} strokeWidth={2.8} /> : <Plus size={10} />}
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 메모 및 설명 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '14px' }}>설명 및 메모</label>
                <textarea 
                  className="input-text"
                  style={{ minHeight: '60px', resize: 'vertical', padding: '10px 12px', fontSize: '15px' }}
                  placeholder="설명을 남겨보세요."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleBackFromEdit} 
                  className="btn-secondary"
                  style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0 }}
                >
                  취소
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveEdit} 
                  className="btn-primary"
                  disabled={isUpdatingItem}
                  style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0 }}
                >
                  {isUpdatingItem ? '저장 중...' : '수정 완료'}
                </button>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 이미지 */}
              {currentItem.image_url ? (
                <img
                  src={currentItem.image_url}
                  alt={currentItem.name}
                  onClick={() => onZoomImage(currentItem.image_url || null)}
                  style={{ width: '100%', minHeight: '240px', height: 'auto', borderRadius: 'var(--radius-md)', objectFit: 'contain', background: '#f8f9fa', cursor: 'zoom-in' }}
                />
              ) : (
                <div style={{ width: '100%', minHeight: '140px', height: 'auto', borderRadius: 'var(--radius-md)', background: 'var(--toss-blue-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '44px' }}>📦</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 사진이 없습니다</span>
                </div>
              )}

              {/* 보관 위치 경로 카드 */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="text-small" style={{ fontWeight: '600' }}>보관 위치</span>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('basicMedium');
                        setIsDetailOpen(false);
                        const sec = sections.find(s => s.id === currentItem.section_id);
                        const st = sec ? storages.find(s => s.id === sec.storage_id) : null;
                        onNavigateTab('explore', {
                          spaceId: st?.space_id,
                          storageId: st?.id,
                          sectionId: sec?.id
                        });
                      }}
                      style={{
                        border: 'none',
                        background: 'var(--toss-blue-light)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: 'var(--toss-blue)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        transition: 'opacity var(--transition-fast)'
                      }}
                    >
                      위치 바로가기
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                <div 
                  onClick={() => {
                    if (onNavigateTab && currentItem) {
                      triggerHaptic('basicMedium');
                      setIsDetailOpen(false);
                      const sec = sections.find(s => s.id === currentItem.section_id);
                      const st = sec ? storages.find(s => s.id === sec.storage_id) : null;
                      onNavigateTab('explore', {
                        spaceId: st?.space_id,
                        storageId: st?.id,
                        sectionId: sec?.id
                      });
                    }
                  }}
                  style={{ 
                    fontSize: '15px', 
                    fontWeight: 'bold', 
                    color: 'var(--text-primary)', 
                    display: 'flex', 
                    alignItems: 'center',
                    cursor: onNavigateTab ? 'pointer' : 'default'
                  }}
                >
                  {getItemPath(currentItem.section_id)}
                </div>
                {(hasSectionImage || hasStorageImage) ? (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    {hasStorageImage && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>📦 {storage?.name} 사진</span>
                        <img 
                          src={storage?.image_url} 
                          alt={storage?.name} 
                          onClick={() => onZoomImage(storage?.image_url || null)}
                          style={{ width: '100%', minHeight: '100px', height: 'auto', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-medium)', cursor: 'zoom-in' }} 
                        />
                      </div>
                    )}
                    {hasSectionImage && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>📍 {section?.name} 사진</span>
                        <img 
                          src={section?.image_url} 
                          alt={section?.name} 
                          onClick={() => onZoomImage(section?.image_url || null)}
                          style={{ width: '100%', minHeight: '100px', height: 'auto', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-medium)', cursor: 'zoom-in' }} 
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '10px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.025)',
                      border: '1px dashed var(--border-medium)',
                      color: 'var(--text-tertiary)',
                      fontSize: '12.5px',
                      cursor: 'default',
                      userSelect: 'none'
                    }}
                  >
                    <Camera size={13} style={{ opacity: 0.7 }} />
                    <span>등록된 보관 위치 사진이 없습니다.</span>
                  </div>
                )}
              </div>

              {/* 수량 정보 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 0', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>보관 수량</span>
                <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {currentItem.quantity}개
                </span>
              </div>

              {/* 유통기한 정보 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>유통기한</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '17px', fontWeight: '700', color: currentItem.expiration_date ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {currentItem.expiration_date ? currentItem.expiration_date : 'N/A'}
                  </span>
                  {currentItem.expiration_date && (
                    (() => {
                      const badge = getExpirationBadgeInfo(currentItem.expiration_date);
                      return (
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: '700', 
                          color: badge.color, 
                          background: badge.bg, 
                          border: badge.border, 
                          padding: '2px 8px', 
                          borderRadius: '4px'
                        }}>
                          {badge.label}
                        </span>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* 설명 및 메모 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="text-small" style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>설명 및 메모</span>
                {currentItem.description ? (
                  <div style={{
                    background: 'var(--bg-subtle)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '14.5px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {currentItem.description}
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-tertiary)',
                    fontSize: '13.5px'
                  }}>
                    등록된 설명 및 메모가 없습니다.
                  </div>
                )}
              </div>

              {/* 태그 목록 */}
              {currentItem.tags && currentItem.tags.length > 0 && (
                <div>
                  <div className="text-small" style={{ marginBottom: '8px', fontWeight: '600' }}>태그</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {currentItem.tags.map(tag => (
                      <span key={tag} className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 메타정보 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> 등록일: {new Date(currentItem.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* 액션 관리 영역 (수정 및 삭제를 프리미엄 2열 버튼으로 재구성) */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={handleStartEdit}
                  className="btn-primary"
                  style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0 }}
                >
                  수정하기
                </button>
                <button
                  onClick={() => handleDeleteItem(currentItem.id)}
                  className="btn-secondary"
                  style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0, background: 'var(--accent-red-light)', color: 'var(--accent-red)', border: 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#ffd1d1'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-red-light)'}
                >
                  <Trash2 size={16} /> 삭제하기
                </button>
              </div>

            </div>
          )
        )}
      </BottomSheet>
      <ImagePickerBottomSheet
        isOpen={imagePickerTarget !== null}
        onClose={() => setImagePickerTarget(null)}
        onImageSelected={handleImageSelected}
        title={
          imagePickerTarget === 'storage'
            ? '수납처 사진 등록'
            : '세부위치 사진 등록'
        }
        subtitle="카메라로 직접 촬영하거나 사진 앨범에서 선택해 주세요"
      />
    </div>
  );
};
export default SearchTab;
