import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRight, Trash2, Tag, Calendar, Camera, X, ChevronDown, Check, Plus, Layers, AlertCircle } from 'lucide-react';
import BottomSheet from './BottomSheet';
import EmojiIcon from './EmojiIcon';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { StorageUnit, Section } from '../types';
import { getExpirationBadgeInfo } from '../utils/expiration';
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


interface ExploreTabProps {
  initialParams?: {
    spaceId?: string | null;
    storageId?: string | null;
    sectionId?: string | null;
    selectedItemId?: string | null;
  } | null;
  onClearParams?: () => void;
  onZoomImage: (url: string | null) => void;
  registerBackHandler?: (handler: () => boolean) => () => void;
}

export const ExploreTab: React.FC<ExploreTabProps> = ({ 
  initialParams, 
  onClearParams, 
  onZoomImage,
  registerBackHandler
}) => {
  const { 
    spaces, storages, sections, items, loading,
    deleteItem, updateItem, uploadImage, allTags,
    createSpace, createStorage, createSection
  } = useData();
  const { user, activeGroup } = useAuth();
  const isOwner = user?.id === activeGroup?.owner_id;

  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // 탐색 상태 관리
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const breadcrumbScrollRef = useRef<HTMLDivElement>(null);
  
  // 물건/수납처/세부위치 상세 바텀시트 상태
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [previewStorage, setPreviewStorage] = useState<StorageUnit | null>(null);
  const [previewSection, setPreviewSection] = useState<Section | null>(null);

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

  const [isSpaceDropdownOpen, setIsSpaceDropdownOpen] = useState(false);
  const [isStorageDropdownOpen, setIsStorageDropdownOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);

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

  // 바텀시트 닫히거나 수정 모드 진입/해제 시 드롭다운 및 추가창 닫기
  useEffect(() => {
    if (!isEditing || !isDetailOpen) {
      setIsSpaceDropdownOpen(false);
      setIsStorageDropdownOpen(false);
      setIsSectionDropdownOpen(false);
      handleCancelSpaceAdd();
      handleCancelStorageAdd();
      handleCancelSectionAdd();
    }
  }, [isEditing, isDetailOpen]);

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

  // 외부(Home/Search 등)에서 파라미터가 유입될 때 상태 동기화
  useEffect(() => {
    if (initialParams) {
      if (initialParams.sectionId) {
        const section = sections.find(se => se.id === initialParams.sectionId);
        if (section) {
          setSelectedSectionId(section.id);
          const storage = storages.find(st => st.id === section.storage_id);
          if (storage) {
            setSelectedStorageId(storage.id);
            setSelectedSpaceId(storage.space_id);
          }
        }
      } else if (initialParams.spaceId) {
        setSelectedSpaceId(initialParams.spaceId);
        setSelectedStorageId(null);
        setSelectedSectionId(null);
      }

      if (initialParams.selectedItemId) {
        setViewItemId(initialParams.selectedItemId);
        setIsDetailOpen(true);
      }

      // 파라미터 소비 후 초기화
      if (onClearParams) onClearParams();
    }
  }, [initialParams, sections, storages, onClearParams]);

  // 탐색 경로 변경 시 활성 브레드크럼 위치로 자동 가로 스크롤
  useEffect(() => {
    if (breadcrumbScrollRef.current) {
      breadcrumbScrollRef.current.scrollTo({
        left: breadcrumbScrollRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [selectedSpaceId, selectedStorageId, selectedSectionId]);

  // 엔티티 매핑
  const currentSpace = spaces.find(s => s.id === selectedSpaceId);
  const currentStorage = storages.find(s => s.id === selectedStorageId);
  const currentSection = sections.find(s => s.id === selectedSectionId);
  const currentItem = items.find(i => i.id === viewItemId);

  // 현재 필터링된 목록들
  const filteredStorages = storages.filter(st => st.space_id === selectedSpaceId);
  const filteredSections = sections.filter(se => se.storage_id === selectedStorageId);
  const filteredItems = items.filter(it => it.section_id === selectedSectionId);

  // 특정 공간에 속한 물건 갯수 구하기
  const getSpaceItemsCount = (spaceId: string) => {
    const storageIds = storages.filter(st => st.space_id === spaceId).map(st => st.id);
    const secIds = sections.filter(sec => storageIds.includes(sec.storage_id)).map(sec => sec.id);
    return items.filter(it => secIds.includes(it.section_id)).length;
  };

  // 특정 수납처에 속한 물건 갯수 구하기
  const getStorageItemsCount = (storageId: string) => {
    const secIds = sections.filter(sec => sec.storage_id === storageId).map(sec => sec.id);
    return items.filter(it => secIds.includes(it.section_id)).length;
  };


  // 토스 네이티브 뒤로가기(backEvent) 연동
  useEffect(() => {
    if (!registerBackHandler) return;

    const hasBackAction = !!viewItemId || isEditing || !!selectedSectionId || !!selectedStorageId || !!selectedSpaceId;
    
    if (hasBackAction) {
      const unregister = registerBackHandler(() => {
        if (isEditing) {
          setIsEditing(false);
          return true; // handled
        }
        if (viewItemId) {
          setViewItemId(null);
          setIsDetailOpen(false);
          return true; // handled
        }
        if (selectedSectionId) {
          setSelectedSectionId(null);
          return true; // handled
        }
        if (selectedStorageId) {
          setSelectedStorageId(null);
          return true; // handled
        }
        if (selectedSpaceId) {
          setSelectedSpaceId(null);
          return true; // handled
        }
        return false;
      });
      return unregister;
    }
  }, [registerBackHandler, viewItemId, isEditing, selectedSectionId, selectedStorageId, selectedSpaceId]);



  const handleDeleteItem = async (id: string) => {
    if (window.confirm('이 물건을 삭제하시겠습니까?')) {
      try {
        setIsDetailOpen(false);
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

  const getFullLocationPath = (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return '';
    const st = storages.find(s => s.id === sec.storage_id);
    if (!st) return sec.name;
    const sp = spaces.find(s => s.id === st.space_id);
    if (!sp) return `${st.name} > ${sec.name}`;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle', flexWrap: 'wrap' }}>
        <EmojiIcon icon={sp.icon} size={14} style={{ marginRight: '2px' }} />
        <span>{sp.name}</span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>&gt;</span>
        <span>{st.name}</span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>&gt;</span>
        <span>{sec.name}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', height: 'auto', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--toss-blue-light)', borderTopColor: 'var(--toss-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>공간 탐색 중...</span>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {/* 상단 브레드크럼 네비게이션 헤더 (가로 스크롤 칩 방식) */}
      <div style={{ marginBottom: '16px' }}>
        <div 
          ref={breadcrumbScrollRef}
          className="no-scrollbar"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            padding: '4px 0',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* 위치 탐색 */}
          <span 
            onClick={() => {
              if (selectedSpaceId) {
                setSelectedSpaceId(null);
                setSelectedStorageId(null);
                setSelectedSectionId(null);
              }
            }}
            style={{ 
              fontSize: !selectedSpaceId ? '20px' : '17px', 
              color: !selectedSpaceId ? 'var(--text-primary)' : 'var(--text-secondary)', 
              cursor: selectedSpaceId ? 'pointer' : 'default', 
              fontWeight: !selectedSpaceId ? '700' : '600',
              padding: selectedSpaceId ? '6px 8px' : '0',
              margin: selectedSpaceId ? '-6px -4px' : '0',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all var(--transition-fast)'
            }}
          >
            <Layers size={!selectedSpaceId ? 20 : 17} color="var(--toss-blue)" style={{ flexShrink: 0 }} />
            <span>위치 탐색</span>
          </span>

          {selectedSpaceId && (
            <>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <span 
                onClick={() => {
                  if (selectedStorageId) {
                    setSelectedStorageId(null);
                    setSelectedSectionId(null);
                  }
                }}
                style={{
                  fontSize: !selectedStorageId ? '20px' : '17px',
                  color: !selectedStorageId ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: selectedStorageId ? 'pointer' : 'default',
                  fontWeight: !selectedStorageId ? '700' : '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  padding: selectedStorageId ? '6px 8px' : '0',
                  margin: selectedStorageId ? '-6px -4px' : '0',
                  borderRadius: '8px',
                  verticalAlign: 'middle',
                  transition: 'all var(--transition-fast)'
                }}
                title={currentSpace?.name}
              >
                <EmojiIcon icon={currentSpace?.icon || ''} size={18} style={{ marginRight: '4px', flexShrink: 0 }} /> 
                <span>{currentSpace?.name}</span>
              </span>
            </>
          )}

          {selectedStorageId && (
            <>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <span 
                onClick={() => {
                  if (selectedSectionId) {
                    setSelectedSectionId(null);
                  }
                }}
                style={{
                  fontSize: !selectedSectionId ? '20px' : '17px',
                  color: !selectedSectionId ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: selectedSectionId ? 'pointer' : 'default',
                  fontWeight: !selectedSectionId ? '700' : '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  padding: selectedSectionId ? '6px 8px' : '0',
                  margin: selectedSectionId ? '-6px -4px' : '0',
                  borderRadius: '8px',
                  verticalAlign: 'middle',
                  transition: 'all var(--transition-fast)'
                }}
                title={currentStorage?.name}
              >
                <EmojiIcon icon={currentStorage?.icon || ''} size={18} style={{ marginRight: '4px', flexShrink: 0 }} /> 
                <span>{currentStorage?.name}</span>
              </span>
            </>
          )}

          {selectedSectionId && (
            <>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <span 
                style={{
                  fontSize: '20px',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  verticalAlign: 'middle'
                }}
                title={currentSection?.name}
              >
                {currentSection?.image_url ? (
                  <img 
                    src={currentSection.image_url} 
                    alt={currentSection.name} 
                    style={{ 
                      width: '24px', 
                      minHeight: '24px', height: '24px', 
                      borderRadius: '4px', 
                      objectFit: 'contain', 
                      background: '#f8f9fa',
                      marginRight: '4px',
                      flexShrink: 0
                    }} 
                  />
                ) : (
                  <EmojiIcon icon={currentSection?.icon || '📍'} size={18} style={{ marginRight: '4px', flexShrink: 0 }} />
                )}
                <span>{currentSection?.name}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 탐색 콘텐츠 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* LEVEL 1: 공간 선택 */}
        {!selectedSpaceId && (
          spaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              공간이 존재하지 않습니다.<br />물건 추가 탭에서 새 공간을 생성해보세요!
            </div>
          ) : (
            spaces.map(space => (
              <div 
                key={space.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}
                onClick={() => setSelectedSpaceId(space.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <EmojiIcon icon={space.icon} size={24} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: '600', fontSize: '17px', wordBreak: 'keep-all', lineHeight: '1.35' }}>{space.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    물건 {getSpaceItemsCount(space.id)}개 · 수납처 {storages.filter(st => st.space_id === space.id).length}개
                  </span>
                  <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            ))
          )
        )}

        {/* LEVEL 2: 수납처 선택 */}
        {selectedSpaceId && !selectedStorageId && (
          filteredStorages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              등록된 수납처가 없습니다.<br />하단 플러스 버튼을 클릭해 첫 물건과 함께 수납처를 등록해보세요!
            </div>
          ) : (
            filteredStorages.map(storage => (
              <div 
                key={storage.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0, cursor: 'pointer' }}
                onClick={() => setSelectedStorageId(storage.id)}
              >
                {/* 수납처 사진, 이름 탭 시 상세정보 바텀시트 표시 */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewStorage(storage as StorageUnit);
                  }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    minWidth: 0, 
                    flex: 1, 
                    cursor: 'pointer',
                    padding: '4px 8px',
                    margin: '-4px -8px',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="사진 또는 이름 탭 시 상세 정보 바텀시트 표시"
                >
                  {storage.image_url ? (
                    <img src={storage.image_url} alt={storage.name} style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                  ) : (
                    <EmojiIcon icon={storage.icon} size={48} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: '600', fontSize: '17px', wordBreak: 'keep-all', lineHeight: '1.35' }}>{storage.name}</span>
                </div>

                {/* 나머지 영역 탭 시 기존과 같이 다음단계 (세부위치 선택) 이동 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    물건 {getStorageItemsCount(storage.id)}개 · 세부위치 {sections.filter(se => se.storage_id === storage.id).length}개
                  </span>
                  <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            ))
          )
        )}

        {/* LEVEL 3: 세부위치 선택 */}
        {selectedStorageId && !selectedSectionId && (
          filteredSections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              등록된 세부위치가 없습니다.<br />첫 물건을 등록하면서 세부위치(예: 서랍칸)를 추가해보세요!
            </div>
          ) : (
            filteredSections.map(section => (
              <div 
                key={section.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0, cursor: 'pointer' }}
                onClick={() => setSelectedSectionId(section.id)}
              >
                {/* 세부위치 사진, 이름 탭 시 상세정보 바텀시트 표시 */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewSection(section as Section);
                  }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    minWidth: 0, 
                    flex: 1, 
                    cursor: 'pointer',
                    padding: '4px 8px',
                    margin: '-4px -8px',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="사진 또는 이름 탭 시 상세 정보 바텀시트 표시"
                >
                  {section.image_url ? (
                    <img src={section.image_url} alt={section.name} style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                  ) : (
                    <EmojiIcon icon={section.icon || '📍'} size={48} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: '600', fontSize: '17px', wordBreak: 'keep-all', lineHeight: '1.35' }}>{section.name}</span>
                </div>

                {/* 나머지 영역 탭 시 기존과 같이 다음단계 (물건 목록) 이동 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    물건 {items.filter(it => it.section_id === section.id).length}개
                  </span>
                  <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            ))
          )
        )}

        {/* LEVEL 4: 물건 목록 */}
        {selectedSectionId && (
          filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              이 위치에 저장된 물건이 없습니다.<br />하단 '추가' 탭에서 이 위치를 선택해 물건을 저장해보세요!
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => { setViewItemId(item.id); setIsDetailOpen(true); }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain', background: '#f8f9fa' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>
                      📦
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '17px', fontWeight: '600' }}>{item.name}</h4>
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
                    {item.description && (
                      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>
            ))
          )
        )}

      </div>

      {/* 물건 상세정보 바텀시트 */}
      <BottomSheet 
        isOpen={isDetailOpen} 
        onClose={() => { setIsDetailOpen(false); setViewItemId(null); setIsEditing(false); }}
        title={
          isEditing ? "물건 정보 수정" : (
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
        {currentItem && (() => {
          const selectedSpace = spaces.find(s => s.id === editSpaceId);
          const selectedStorage = storages.find(st => st.id === editStorageId);
          const selectedSection = sections.find(se => se.id === editSectionId);
          const section = sections.find(s => s.id === currentItem.section_id);
          const storage = section ? storages.find(st => st.id === section.storage_id) : null;
          const hasSectionImage = !!section?.image_url;
          const hasStorageImage = !!storage?.image_url;
          return isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 물건 이름 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">물건 이름 *</label>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 수정</span>
                
                {/* 1단계: 공간 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>1단계: 공간 *</label>
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

                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => {
                        setIsSpaceDropdownOpen(!isSpaceDropdownOpen);
                        setIsStorageDropdownOpen(false);
                        setIsSectionDropdownOpen(false);
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        width: '100%', 
                        minHeight: '40px', height: 'auto', 
                        padding: '0 10px', 
                        background: 'var(--bg-app)', 
                        border: '1px solid var(--border-medium)', 
                        borderRadius: 'var(--radius-sm)', 
                        cursor: 'pointer', 
                        fontSize: '15px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedSpace ? (
                          <>
                            <EmojiIcon icon={selectedSpace.icon} size={18} />
                            <span style={{ color: 'var(--text-primary)' }}>{selectedSpace.name}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>공간을 선택하세요</span>
                        )}
                      </div>
                      <ChevronDown size={16} color="var(--text-tertiary)" />
                    </div>
                    {isSpaceDropdownOpen && (
                      <>
                        <div 
                          onClick={() => setIsSpaceDropdownOpen(false)}
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                        />
                        <div style={{ 
                          position: 'absolute', 
                          top: '44px', 
                          left: 0, 
                          right: 0, 
                          background: '#fff', 
                          border: '1px solid var(--border-medium)', 
                          borderRadius: 'var(--radius-sm)', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                          zIndex: 100, 
                          maxHeight: '200px', 
                          overflowY: 'auto' 
                        }}>
                          {spaces.map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => {
                                setEditSpaceId(s.id); 
                                setEditStorageId(''); 
                                setEditSectionId('');
                                setIsSpaceDropdownOpen(false);
                              }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '10px', 
                                cursor: 'pointer', 
                                fontSize: '15px',
                                background: editSpaceId === s.id ? 'var(--bg-subtle)' : '#fff'
                              }}
                              className="dropdown-option-hover"
                            >
                              <EmojiIcon icon={s.icon} size={18} />
                              <span>{s.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 2단계: 수납처 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>2단계: 수납처 *</label>
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

                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => {
                        if (!editSpaceId) return;
                        setIsStorageDropdownOpen(!isStorageDropdownOpen);
                        setIsSpaceDropdownOpen(false);
                        setIsSectionDropdownOpen(false);
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        width: '100%', 
                        minHeight: '40px', height: 'auto', 
                        padding: '0 10px', 
                        background: editSpaceId ? 'var(--bg-app)' : 'var(--bg-subtle)', 
                        border: '1px solid var(--border-medium)', 
                        borderRadius: 'var(--radius-sm)', 
                        cursor: editSpaceId ? 'pointer' : 'not-allowed', 
                        opacity: editSpaceId ? 1 : 0.6,
                        fontSize: '15px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedStorage ? (
                          <>
                            {selectedStorage.image_url ? (
                              <img src={selectedStorage.image_url} alt={selectedStorage.name} style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                            ) : (
                              <EmojiIcon icon={selectedStorage.icon || '📦'} size={18} />
                            )}
                            <span style={{ color: 'var(--text-primary)' }}>{selectedStorage.name}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {!editSpaceId ? '공간을 선택하세요' : '수납처를 선택하세요'}
                          </span>
                        )}
                      </div>
                      <ChevronDown size={16} color="var(--text-tertiary)" />
                    </div>
                    {isStorageDropdownOpen && editSpaceId && (
                      <>
                        <div 
                          onClick={() => setIsStorageDropdownOpen(false)}
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                        />
                        <div style={{ 
                          position: 'absolute', 
                          top: '44px', 
                          left: 0, 
                          right: 0, 
                          background: '#fff', 
                          border: '1px solid var(--border-medium)', 
                          borderRadius: 'var(--radius-sm)', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                          zIndex: 100, 
                          maxHeight: '200px', 
                          overflowY: 'auto' 
                        }}>
                          {storages.filter(st => st.space_id === editSpaceId).map(st => (
                            <div 
                              key={st.id} 
                              onClick={() => {
                                setEditStorageId(st.id); 
                                setEditSectionId('');
                                setIsStorageDropdownOpen(false);
                              }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '10px', 
                                cursor: 'pointer', 
                                fontSize: '15px',
                                background: editStorageId === st.id ? 'var(--bg-subtle)' : '#fff'
                              }}
                              className="dropdown-option-hover"
                            >
                              {st.image_url ? (
                                <img src={st.image_url} alt={st.name} style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                              ) : (
                                <EmojiIcon icon={st.icon || '📦'} size={18} />
                              )}
                              <span>{st.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 3단계: 세부위치 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>3단계: 세부 위치 *</label>
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
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => {
                        if (!editStorageId) return;
                        setIsSectionDropdownOpen(!isSectionDropdownOpen);
                        setIsSpaceDropdownOpen(false);
                        setIsStorageDropdownOpen(false);
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        width: '100%', 
                        minHeight: '40px', height: 'auto', 
                        padding: '0 10px', 
                        background: editStorageId ? 'var(--bg-app)' : 'var(--bg-subtle)', 
                        border: '1px solid var(--border-medium)', 
                        borderRadius: 'var(--radius-sm)', 
                        cursor: editStorageId ? 'pointer' : 'not-allowed', 
                        opacity: editStorageId ? 1 : 0.6,
                        fontSize: '15px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedSection ? (
                          <>
                            {selectedSection.image_url ? (
                              <img src={selectedSection.image_url} alt={selectedSection.name} style={{ width: '18px', height: '18px', borderRadius: '2px', objectFit: 'contain', background: '#f8f9fa' }} />
                            ) : (
                              <EmojiIcon icon={selectedSection.icon || '📍'} size={18} />
                            )}
                            <span style={{ color: 'var(--text-primary)' }}>{selectedSection.name}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {!editStorageId ? '수납처를 선택하세요' : '세부위치를 선택하세요'}
                          </span>
                        )}
                      </div>
                      <ChevronDown size={16} color="var(--text-tertiary)" />
                    </div>
                    {isSectionDropdownOpen && editStorageId && (
                      <>
                        <div 
                          onClick={() => setIsSectionDropdownOpen(false)}
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                        />
                        <div style={{ 
                          position: 'absolute', 
                          top: '44px', 
                          left: 0, 
                          right: 0, 
                          background: '#fff', 
                          border: '1px solid var(--border-medium)', 
                          borderRadius: 'var(--radius-sm)', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                          zIndex: 100, 
                          maxHeight: '200px', 
                          overflowY: 'auto' 
                        }}>
                          {sections.filter(se => se.storage_id === editStorageId).map(se => (
                            <div 
                              key={se.id} 
                              onClick={() => {
                                setEditSectionId(se.id); 
                                setIsSectionDropdownOpen(false);
                              }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '10px', 
                                cursor: 'pointer', 
                                fontSize: '15px',
                                background: editSectionId === se.id ? 'var(--bg-subtle)' : '#fff'
                              }}
                              className="dropdown-option-hover"
                            >
                              {se.image_url ? (
                                <img src={se.image_url} alt={se.name} style={{ width: '18px', height: '18px', borderRadius: '2px', objectFit: 'contain', background: '#f8f9fa' }} />
                              ) : (
                                <EmojiIcon icon={se.icon || '📍'} size={18} />
                              )}
                              <span>{se.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
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
                <label className="form-label">물건 사진 수정</label>
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
                  <label className="form-label" style={{ margin: 0 }}>유통기한 수정</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', userSelect: 'none' }}>
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
                      <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>🔒 개인 물건 (가족 공유 시 숨기기)</span>
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
                <label className="form-label">태그</label>
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
                <label className="form-label">설명 및 메모</label>
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
                  onClick={() => setIsEditing(false)} 
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
                  <span style={{ fontSize: '52px' }}>📦</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 사진이 없습니다</span>
                </div>
              )}

              {/* 보관 위치 경로 (Breadcrumb Card) */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div className="text-small" style={{ marginBottom: '6px', fontWeight: '600' }}>보관 위치</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  {getFullLocationPath(currentItem.section_id)}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 0' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-tertiary)' }}>
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
          );
        })()}
      </BottomSheet>

      {/* 수납처 상세 정보 바텀시트 */}
      <BottomSheet
        isOpen={!!previewStorage}
        onClose={() => setPreviewStorage(null)}
        title="수납처 상세 정보"
      >
        {previewStorage && (() => {
          const parentSpace = spaces.find(s => s.id === previewStorage.space_id);
          const childSections = sections.filter(sec => sec.storage_id === previewStorage.id);
          const childSectionIds = new Set(childSections.map(sec => sec.id));
          const childItemsCount = items.filter(item => childSectionIds.has(item.section_id)).length;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 대표 이미지 영역 */}
              {previewStorage.image_url ? (
                <img 
                  src={previewStorage.image_url} 
                  alt={previewStorage.name} 
                  style={{ width: '100%', minHeight: '220px', maxHeight: '340px', height: 'auto', borderRadius: 'var(--radius-md)', objectFit: 'contain', background: '#f8f9fa' }} 
                />
              ) : (
                <div style={{ width: '100%', minHeight: '140px', height: 'auto', borderRadius: 'var(--radius-md)', background: 'var(--toss-blue-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0' }}>
                  <EmojiIcon icon={previewStorage.icon || '📦'} size={52} />
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 사진이 없습니다</span>
                </div>
              )}

              {/* 수납처 이름 및 설명 */}
              <div>
                <h2 className="h2-title" style={{ fontSize: '20px', margin: '0 0 4px', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {previewStorage.name}
                </h2>
                <p className="body-desc" style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
                  2단계 수납처
                </p>
              </div>

              {/* 보관 위치 경로 (Breadcrumb Card) */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div className="text-small" style={{ marginBottom: '6px', fontWeight: '600' }}>보관 위치</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {parentSpace && (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <EmojiIcon icon={parentSpace.icon} size={18} /> {parentSpace.name}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>&gt;</span>
                    </>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--toss-blue)' }}>
                    {previewStorage.image_url ? (
                      <img src={previewStorage.image_url} alt={previewStorage.name} style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                    ) : (
                      <EmojiIcon icon={previewStorage.icon || '📦'} size={18} />
                    )}
                    {previewStorage.name}
                  </span>
                </div>
              </div>

              {/* 보관 현황 요약 정보 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 0' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>보관 현황</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  세부위치 {childSections.length}개 · 물건 {childItemsCount}개
                </span>
              </div>

              {/* 하단 닫기 버튼 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => setPreviewStorage(null)} 
                  className="btn-primary"
                  style={{ width: '100%', minHeight: '48px', height: 'auto', padding: 0 }}
                >
                  확인
                </button>
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {/* 세부위치 상세 정보 바텀시트 */}
      <BottomSheet
        isOpen={!!previewSection}
        onClose={() => setPreviewSection(null)}
        title="세부위치 상세 정보"
      >
        {previewSection && (() => {
          const parentStorage = storages.find(st => st.id === previewSection.storage_id);
          const parentSpace = parentStorage ? spaces.find(s => s.id === parentStorage.space_id) : null;
          const childItems = items.filter(item => item.section_id === previewSection.id);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 대표 이미지 영역 */}
              {previewSection.image_url ? (
                <img 
                  src={previewSection.image_url} 
                  alt={previewSection.name} 
                  style={{ width: '100%', minHeight: '220px', maxHeight: '340px', height: 'auto', borderRadius: 'var(--radius-md)', objectFit: 'contain', background: '#f8f9fa' }} 
                />
              ) : (
                <div style={{ width: '100%', minHeight: '140px', height: 'auto', borderRadius: 'var(--radius-md)', background: 'var(--toss-blue-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0' }}>
                  <EmojiIcon icon={previewSection.icon || '📍'} size={52} />
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 사진이 없습니다</span>
                </div>
              )}

              {/* 세부위치 이름 및 설명 */}
              <div>
                <h2 className="h2-title" style={{ fontSize: '20px', margin: '0 0 4px', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {previewSection.name}
                </h2>
                <p className="body-desc" style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
                  3단계 세부 위치
                </p>
              </div>

              {/* 보관 위치 경로 (Breadcrumb Card) */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div className="text-small" style={{ marginBottom: '6px', fontWeight: '600' }}>보관 위치</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {parentSpace && (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <EmojiIcon icon={parentSpace.icon} size={18} /> {parentSpace.name}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>&gt;</span>
                    </>
                  )}
                  {parentStorage && (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {parentStorage.image_url ? (
                          <img src={parentStorage.image_url} alt={parentStorage.name} style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                        ) : (
                          <EmojiIcon icon={parentStorage.icon || '📦'} size={18} />
                        )}
                        {parentStorage.name}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>&gt;</span>
                    </>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--toss-blue)' }}>
                    {previewSection.image_url ? (
                      <img src={previewSection.image_url} alt={previewSection.name} style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                    ) : (
                      <EmojiIcon icon={previewSection.icon || '📍'} size={18} />
                    )}
                    {previewSection.name}
                  </span>
                </div>
              </div>

              {/* 보관 현황 요약 정보 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 0' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>보관 현황</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  보관된 물건 {childItems.length}개
                </span>
              </div>

              {/* 하단 닫기 버튼 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => setPreviewSection(null)} 
                  className="btn-primary"
                  style={{ width: '100%', minHeight: '48px', height: 'auto', padding: 0 }}
                >
                  확인
                </button>
              </div>
            </div>
          );
        })()}
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
export default ExploreTab;
