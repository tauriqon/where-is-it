import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Plus, X, Tag, Loader2, Check } from 'lucide-react';
import EmojiIcon from './EmojiIcon';
import { ImagePickerBottomSheet } from './ImagePickerBottomSheet';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';

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

interface AddTabProps {
  onNavigateTab: (tab: 'home' | 'explore' | 'add' | 'search' | 'settings', params?: any) => void;
  registerBackHandler?: (handler: () => boolean) => () => void;
  registerTabLeaveHandler?: (handler: (targetTab: string, params?: any) => boolean) => () => void;
}

export const AddTab: React.FC<AddTabProps> = ({ 
  onNavigateTab, 
  registerBackHandler,
  registerTabLeaveHandler
}) => {
  const { 
    spaces, storages, sections, 
    createItem, uploadImage, allTags 
  } = useData();
  const { user, activeGroup } = useAuth();
  const isOwner = user?.id === activeGroup?.owner_id;

  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // [1] 새 물건 등록 관련 상태
  // ==========================================
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedStorageId, setSelectedStorageId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  // 이미지 업로드 상태
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  const handleImageSelected = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 유통기한 관련 상태
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');

  // 취소 및 제출 중 탭 가드 중복 확인 방지 플래그
  const isNavigatingAwayRef = useRef(false);

  // 작성 중인 내용이 있는지 판별
  const checkHasContent = () => {
    return Boolean(
      name.trim() || 
      description.trim() || 
      imagePreview || 
      imageFile ||
      tags.length > 0 || 
      expirationDate || 
      selectedSpaceId || 
      selectedStorageId || 
      selectedSectionId
    );
  };

  // 필터링된 셀렉트박스 옵션
  const availableStorages = storages.filter(st => st.space_id === selectedSpaceId);
  const availableSections = sections.filter(se => se.storage_id === selectedStorageId);

  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // ==========================================
  // [드래프트 보존 메커니즘] 로컬 스토리지 영구 연동 (앱 강제 종료/새로고침 대비)
  // ==========================================
  // 1) 마운트 시 드래프트 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('wii_add_item_draft') || sessionStorage.getItem('wii_add_item_draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        let restored = false;
        if (draft.name) { setName(draft.name); restored = true; }
        if (draft.description) { setDescription(draft.description); restored = true; }
        if (draft.quantity) setQuantity(draft.quantity);
        if (draft.tags && draft.tags.length > 0) { setTags(draft.tags); restored = true; }
        if (draft.selectedSpaceId) { setSelectedSpaceId(draft.selectedSpaceId); restored = true; }
        if (draft.selectedStorageId) { setSelectedStorageId(draft.selectedStorageId); restored = true; }
        if (draft.selectedSectionId) { setSelectedSectionId(draft.selectedSectionId); restored = true; }
        if (draft.hasExpiration !== undefined) setHasExpiration(draft.hasExpiration);
        if (draft.expirationDate) { setExpirationDate(draft.expirationDate); restored = true; }
        if (draft.isPrivate !== undefined) setIsPrivate(draft.isPrivate);
        if (restored) {
          setHasRestoredDraft(true);
        }
      } catch (e) {
        console.error('Failed to parse item draft:', e);
      }
    }
  }, []);

  // 2) 값이 변경될 때마다 자동 저장 수행 (취소/제출 등으로 이탈 중이거나 내용이 없을 때는 드래프트 소거)
  useEffect(() => {
    if (isNavigatingAwayRef.current) return;
    const hasDraftContent = Boolean(
      name.trim() || 
      description.trim() || 
      tags.length > 0 || 
      expirationDate || 
      selectedSpaceId || 
      selectedStorageId || 
      selectedSectionId
    );
    if (!hasDraftContent) {
      localStorage.removeItem('wii_add_item_draft');
      sessionStorage.removeItem('wii_add_item_draft');
      return;
    }
    const draft = {
      name,
      description,
      quantity,
      tags,
      selectedSpaceId,
      selectedStorageId,
      selectedSectionId,
      hasExpiration,
      expirationDate,
      isPrivate
    };
    try {
      localStorage.setItem('wii_add_item_draft', JSON.stringify(draft));
      sessionStorage.setItem('wii_add_item_draft', JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save item draft:', e);
    }
  }, [name, description, quantity, tags, selectedSpaceId, selectedStorageId, selectedSectionId, hasExpiration, expirationDate, isPrivate]);

  // ==========================================
  // [핸들러] 이미지 선택 및 프리뷰 처리
  // ==========================================
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 태그 추가
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags(prev => [...prev, trimmed]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // ==========================================
  // [리다이렉트 핸들러] 설정 탭의 새 위치 추가로 이동
  // ==========================================
  const handleRedirectToLocationAdd = (type: 'space' | 'storage' | 'section') => {
    // 1) 복귀할 타겟 페이지 기록
    sessionStorage.setItem('wii_location_add_redirect', 'add');
    
    // 2) 설정 페이지에 넘겨줄 보관위치 타입 매개변수 기록
    sessionStorage.setItem(
      'wii_settings_navigate_params',
      JSON.stringify({ locationType: type })
    );

    // 3) 설정 탭의 추가 페이지로 강제 네비게이션
    onNavigateTab('settings', { subPage: 'add' });
  };

  // ==========================================
  // [제출] 물건 등록 완료
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('물건 이름을 입력해 주세요.');
      return;
    }
    if (!selectedSectionId) {
      alert('세부 보관 위치까지 모두 선택해 주세요.');
      return;
    }

    try {
      setIsUploading(true);
      let uploadedUrl = '';
      
      if (imageFile) {
        uploadedUrl = await uploadImage(imageFile);
      }

      await createItem(
        selectedSectionId,
        name.trim(),
        description.trim() || undefined,
        uploadedUrl || undefined,
        quantity,
        tags,
        hasExpiration ? (expirationDate || null) : null,
        isOwner ? isPrivate : false
      );

      // 성공 시 드래프트 소거
      localStorage.removeItem('wii_add_item_draft');
      sessionStorage.removeItem('wii_add_item_draft');
      setHasRestoredDraft(false);

      triggerHaptic('success');
      alert('물건이 성공적으로 등록되었습니다!');
      setName('');
      setDescription('');
      setQuantity(1);
      setTags([]);
      setImageFile(null);
      setImagePreview(null);
      setHasExpiration(false);
      setExpirationDate('');
      setIsPrivate(false);
      
      // Explore 탭으로 이동
      isNavigatingAwayRef.current = true;
      onNavigateTab('explore', { sectionId: selectedSectionId });
    } catch (err: any) {
      console.error(err);
      alert('등록 중 에러가 발생했습니다: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 취소 처리 (작성 중 내용 있으면 confirm 확인, 폼 초기화 후 home 이동)
  const handleCancel = () => {
    triggerHaptic('tap');
    const hasContent = checkHasContent();

    if (hasContent) {
      if (!window.confirm('물건 등록을 취소하시겠습니까?\n작성 중인 내용이 초기화됩니다.')) {
        return;
      }
    }

    // 드래프트 삭제 및 상태 초기화
    isNavigatingAwayRef.current = true;
    localStorage.removeItem('wii_add_item_draft');
    sessionStorage.removeItem('wii_add_item_draft');
    setHasRestoredDraft(false);
    setName('');
    setDescription('');
    setQuantity(1);
    setTags([]);
    setTagInput('');
    setImageFile(null);
    setImagePreview(null);
    setHasExpiration(false);
    setExpirationDate('');
    setIsPrivate(false);
    setSelectedSpaceId('');
    setSelectedStorageId('');
    setSelectedSectionId('');
    onNavigateTab('home');
  };

  // 다른 탭 전환 시 미저장 내용 확인 가드 연동
  useEffect(() => {
    if (!registerTabLeaveHandler) return;

    const unregister = registerTabLeaveHandler((targetTab, params) => {
      // 1) 제출 완료 후 이동이거나 취소 확정 후 이동인 경우 무조건 통과
      if (isNavigatingAwayRef.current) {
        return true;
      }

      // 2) 설정 탭의 '새 보관위치(공간/수납처/세부위치) 추가'로 리다이렉트하는 경우 통과 (드래프트 유지)
      if (params?.subPage === 'add' || sessionStorage.getItem('wii_location_add_redirect') === 'add') {
        return true;
      }

      // 3) 작성 중인 내용이 있는 경우 확인 모달 표시
      if (checkHasContent()) {
        triggerHaptic('tap');
        const confirmed = window.confirm('물건 등록을 취소하시겠습니까?\n작성 중인 내용이 초기화됩니다.');
        if (!confirmed) {
          return false; // 화면 유지 (탭 전환 중단)
        }

        // 확인 시 내용 초기화 및 드래프트 삭제 후 이동 허용
        isNavigatingAwayRef.current = true;
        localStorage.removeItem('wii_add_item_draft');
        sessionStorage.removeItem('wii_add_item_draft');
        setHasRestoredDraft(false);
        setName('');
        setDescription('');
        setQuantity(1);
        setTags([]);
        setTagInput('');
        setImageFile(null);
        setImagePreview(null);
        setHasExpiration(false);
        setExpirationDate('');
        setIsPrivate(false);
        setSelectedSpaceId('');
        setSelectedStorageId('');
        setSelectedSectionId('');
        return true;
      }

      // 내용이 없으면 경고 없이 바로 이동 허용
      localStorage.removeItem('wii_add_item_draft');
      sessionStorage.removeItem('wii_add_item_draft');
      setHasRestoredDraft(false);
      return true;
    });

    return unregister;
  }, [
    registerTabLeaveHandler,
    name,
    description,
    imagePreview,
    imageFile,
    tags,
    expirationDate,
    selectedSpaceId,
    selectedStorageId,
    selectedSectionId
  ]);

  // 안드로이드/토스 뒤로가기 시 취소 핸들러 연동
  useEffect(() => {
    if (!registerBackHandler) return;
    const unregister = registerBackHandler(() => {
      handleCancel();
      return true;
    });
    return unregister;
  }, [registerBackHandler, name, description, imagePreview, tags, expirationDate, selectedSpaceId, selectedStorageId, selectedSectionId]);

  // 브라우저 닫기/새로고침 시 미저장 데이터 이탈 방지 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (checkHasContent() && !isNavigatingAwayRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    name,
    description,
    imagePreview,
    imageFile,
    tags,
    expirationDate,
    selectedSpaceId,
    selectedStorageId,
    selectedSectionId
  ]);

  return (
    <div className="page-transition" style={{ paddingBottom: '24px' }}>
      {/* 헤더 타이틀 */}
      <div style={{ marginBottom: '20px' }}>
        <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Plus size={20} color="var(--toss-blue)" />
          <span>물건 등록</span>
        </h2>
      </div>

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
          marginBottom: '16px',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📝</span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.4' }}>
              이전에 작성 중이던 내용이 복원되었습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tickMedium');
              if (window.confirm('작성 중이던 내용을 모두 지우고 새로 작성하시겠습니까?')) {
                localStorage.removeItem('wii_add_item_draft');
                sessionStorage.removeItem('wii_add_item_draft');
                setName('');
                setDescription('');
                setQuantity(1);
                setTags([]);
                setTagInput('');
                setImageFile(null);
                setImagePreview(null);
                setHasExpiration(false);
                setExpirationDate('');
                setIsPrivate(false);
                setSelectedSpaceId('');
                setSelectedStorageId('');
                setSelectedSectionId('');
                setHasRestoredDraft(false);
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
            새로 쓰기
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 물건 이름 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">물건 이름 *</label>
          <input 
            type="text" 
            className="input-text" 
            placeholder="예: 비상약, 헤어드라이기, 여권"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* 3단계 위치 선택 시스템 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 지정 (3단계)</span>
          
          {/* 1단계: 공간 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>1단계: 공간 *</label>
              <button 
                type="button" 
                onClick={() => handleRedirectToLocationAdd('space')}
                style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <Plus size={14} /> 새 공간 추가
              </button>
            </div>
            {spaces.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>등록된 공간이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {spaces.map(s => {
                  const isSelected = selectedSpaceId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSpaceId(s.id);
                        setSelectedStorageId('');
                        setSelectedSectionId('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}
                    >
                      <EmojiIcon icon={s.icon} size={18} />
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>2단계: 수납처 *</label>
              {selectedSpaceId && (
                <button 
                  type="button" 
                  onClick={() => handleRedirectToLocationAdd('storage')}
                  style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Plus size={14} /> 새 수납처 추가
                </button>
              )}
            </div>
            {!selectedSpaceId ? (
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>먼저 공간을 선택해 주세요.</div>
            ) : availableStorages.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>이 공간에 등록된 수납처가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableStorages.map(st => {
                  const isSelected = selectedStorageId === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setSelectedStorageId(st.id);
                        setSelectedSectionId('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}
                    >
                      {st.image_url ? (
                        <img 
                          src={st.image_url} 
                          alt={st.name} 
                          style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} 
                        />
                      ) : (
                        <EmojiIcon icon={st.icon || '📦'} size={18} />
                      )}
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>3단계: 세부 위치 *</label>
              {selectedStorageId && (
                <button 
                  type="button" 
                  onClick={() => handleRedirectToLocationAdd('section')}
                  style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Plus size={14} /> 새 세부위치 추가
                </button>
              )}
            </div>
            {!selectedStorageId ? (
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>먼저 수납처를 선택해 주세요.</div>
            ) : availableSections.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>이 수납처에 등록된 세부위치가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableSections.map(se => {
                  const isSelected = selectedSectionId === se.id;
                  return (
                    <div
                      key={se.id}
                      onClick={() => setSelectedSectionId(se.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}
                    >
                      {se.image_url ? (
                        <img 
                          src={se.image_url} 
                          alt={se.name} 
                          style={{ 
                            width: '36px', 
                            minHeight: '36px', height: 'auto', 
                            borderRadius: '4px', 
                            objectFit: 'contain',
                            background: '#f8f9fa'
                          }} 
                        />
                      ) : (
                        <span style={{ fontSize: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' }}>📍</span>
                      )}
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                        {se.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 스마트폰 카메라 연동 및 이미지 업로드 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">물건 사진 등록</label>
          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', minHeight: '240px', height: 'auto', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <img 
                src={imagePreview} 
                alt="preview" 
                onClick={() => setIsImagePickerOpen(true)}
                title="탭하여 사진 변경"
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa', cursor: 'pointer' }} 
              />
              <button 
                type="button" 
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => setIsImagePickerOpen(true)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px', height: 'auto', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '8px', background: 'var(--bg-subtle)' }}
            >
              <Camera size={28} color="var(--text-tertiary)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>물건 사진 등록 (카메라 촬영 / 앨범 선택)</span>
            </div>
          )}
        </div>

        {/* 유통기한 등록 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0 }}>유통기한</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={!hasExpiration} 
                onChange={(e) => {
                  setHasExpiration(!e.target.checked);
                  if (e.target.checked) {
                    setExpirationDate('');
                  }
                }} 
                style={{ cursor: 'pointer', width: '15px', minHeight: '15px', height: 'auto', margin: 0 }}
              />
              유통기한 없음 (N/A)
            </label>
          </div>
          
          {hasExpiration ? (
            <input 
              type="date"
              className="input-text"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              style={{ minHeight: '48px', height: 'auto', padding: '0 16px' }}
            />
          ) : (
            <div style={{
              minHeight: '48px', height: 'auto',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              fontSize: '15px',
              fontWeight: '500'
            }}>
              유통기한 정보가 등록되지 않습니다 (N/A)
            </div>
          )}
        </div>

        {/* 개인 물건 설정 (보관소 소유자만 설정 가능) */}
        {isOwner && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              padding: '14px 16px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-medium)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  🔒 개인 물건 (가족 공유 시 숨기기)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  체크하면 나에게만 보이고 가족 참가자에게는 숨겨집니다.
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={isPrivate} 
                onChange={(e) => {
                  triggerHaptic('tickWeak');
                  setIsPrivate(e.target.checked);
                }} 
                style={{ cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0 }}
              />
            </div>
          </div>
        )}

        {/* 수량 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">수량</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              type="button"
              onClick={() => {
                triggerHaptic('basicMedium');
                setQuantity(prev => Math.max(1, prev - 1));
              }}
              style={{ border: 'none', background: 'var(--bg-input)', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' }}
            >
              -
            </button>
            <span style={{ fontSize: '20px', fontWeight: '700', minWidth: '30px', textAlign: 'center' }}>
              {quantity}
            </span>
            <button 
              type="button"
              onClick={() => {
                triggerHaptic('basicMedium');
                setQuantity(prev => prev + 1);
              }}
              style={{ border: 'none', background: 'var(--bg-input)', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' }}
            >
              +
            </button>
          </div>
        </div>

        {/* 태그 등록 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">태그 (쉼표 혹은 엔터로 구분)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {tags.map(t => (
              <span key={t} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}>
                <Tag size={12} /> {t}
                <button type="button" onClick={() => handleRemoveTag(t)} style={{ border: 'none', background: 'none', display: 'flex', cursor: 'pointer' }}>
                  <X size={12} color="var(--toss-blue)" />
                </button>
              </span>
            ))}
          </div>
          <input 
            type="text"
            className="input-text"
            placeholder="태그 입력 후 Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
          />
          {/* 기존 등록된 태그에서 빠른 선택 */}
          {allTags.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                🏷️ 기존 등록된 태그에서 선택
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allTags.map(tag => {
                  const isSelected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tickWeak');
                        if (isSelected) {
                          setTags(prev => prev.filter(t => t !== tag));
                        } else {
                          setTags(prev => [...prev, tag]);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: isSelected ? '700' : '500',
                        border: isSelected ? '1px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#ffffff',
                        color: isSelected ? 'var(--toss-blue)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {isSelected ? <Check size={12} strokeWidth={2.8} /> : <Plus size={12} />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 상세 설명 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">설명 및 메모</label>
          <textarea 
            className="input-text"
            style={{ minHeight: '80px', resize: 'vertical' }}
            placeholder="물건에 대한 설명이나 메모를 남겨보세요."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* 하단 액션 버튼 (취소 및 저장) */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingBottom: '20px' }}>
          <button 
            type="button" 
            onClick={handleCancel}
            className="btn-secondary"
            disabled={isUploading}
            style={{ flex: 1, minHeight: '52px', height: 'auto', fontSize: '16px', fontWeight: '600' }}
          >
            취소
          </button>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isUploading}
            style={{ flex: 1, minHeight: '52px', height: 'auto', fontSize: '16px', fontWeight: '600' }}
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>

      </form>
      
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <ImagePickerBottomSheet
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onImageSelected={handleImageSelected}
        title="물건 사진 등록"
        subtitle="카메라로 직접 촬영하거나 사진 앨범에서 선택해 주세요"
      />
    </div>
  );
};

export default AddTab;
