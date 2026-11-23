import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Plus, X, Tag, Loader2, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import EmojiIcon from './EmojiIcon';
import { ImagePickerBottomSheet } from './ImagePickerBottomSheet';
import { ENABLE_FAMILY_SYNC } from '../version';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { showToast } from '../utils/toast';
import { recognizeItemAndTags, isAiVisionConfigured } from '../services/aiVision';
import { compressImage } from '../utils/imageCompressor';

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
  const { user, activeGroup, isOwner: authIsOwner, activeGroupMembers } = useAuth();
  const isOwner = Boolean(authIsOwner || (activeGroup && user && (activeGroup.owner_id === user.id || activeGroupMembers?.some(m => m.user_id === user.id && m.role === 'owner'))));

  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // [1] 새 물건 등록 관련 상태
  // ==========================================
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // 마지막 사용 위치 로컬스토리지 헬퍼
  const getLastUsedLocation = () => {
    try {
      const saved = localStorage.getItem('wii_last_used_location');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(() => {
    try {
      const savedDraft = localStorage.getItem('wii_add_item_draft') || sessionStorage.getItem('wii_add_item_draft');
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d.selectedSpaceId) return d.selectedSpaceId;
      }
      const lastLoc = getLastUsedLocation();
      if (lastLoc?.spaceId) return lastLoc.spaceId;
    } catch {}
    return '';
  });

  const [selectedStorageId, setSelectedStorageId] = useState<string>(() => {
    try {
      const savedDraft = localStorage.getItem('wii_add_item_draft') || sessionStorage.getItem('wii_add_item_draft');
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d.selectedStorageId) return d.selectedStorageId;
      }
      const lastLoc = getLastUsedLocation();
      if (lastLoc?.storageId) return lastLoc.storageId;
    } catch {}
    return '';
  });

  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => {
    try {
      const savedDraft = localStorage.getItem('wii_add_item_draft') || sessionStorage.getItem('wii_add_item_draft');
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d.selectedSectionId) return d.selectedSectionId;
      }
      const lastLoc = getLastUsedLocation();
      if (lastLoc?.sectionId) return lastLoc.sectionId;
    } catch {}
    return '';
  });
  const [isPrivate, setIsPrivate] = useState(false);

  // 비동기 AI 분석 중 사용자가 이름을 타이핑했는지 즉시 감지하기 위한 Ref
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // 비동기 AI 분석 중 사용자가 등록한 태그가 있는지 감지하기 위한 Ref
  const tagsRef = useRef(tags);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  
  // 이미지 업로드 상태
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, _setImagePreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const setImagePreview = (newUrl: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(previewUrlRef.current);
      } catch (e) {}
    }
    previewUrlRef.current = newUrl;
    _setImagePreview(newUrl);
  };

  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrlRef.current);
        } catch (e) {}
      }
    };
  }, []);

  const [isUploading, setIsUploading] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  const handleImageSelected = async (file: File) => {
    // 1) 모바일 WebKit 메모리 초과 방지: 고용량 이미지(카메라 원본 등) 선제적 압축
    let optimizedFile = file;
    if (file.size > 250 * 1024) {
      try {
        optimizedFile = await compressImage(file, 1024, 1024, 0.8);
      } catch (e) {
        console.warn('Image pre-compression failed:', e);
      }
    }
    setImageFile(optimizedFile);
    const objectUrl = URL.createObjectURL(optimizedFile);
    setImagePreview(objectUrl);

    // [AI 물건 이름 & 태그 자동 인식] 이름이 비어있거나 태그가 비어있는 경우 동시 분석 실행
    const shouldDetectName = !nameRef.current.trim();
    const shouldDetectTags = tagsRef.current.length === 0;

    if ((shouldDetectName || shouldDetectTags) && isAiVisionConfigured()) {
      setIsAnalyzingImage(true);
      try {
        const result = await recognizeItemAndTags(optimizedFile, allTags);
        if (result) {
          let appliedName = false;
          let addedTagsCount = 0;

          // 1) 물건 이름 자동 반영 (사용자가 아직 입력하지 않은 경우에만)
          if (result.name && !nameRef.current.trim()) {
            setName(result.name);
            appliedName = true;
          }

          // 2) 스마트 추천 태그 자동 반영 (중복 제거 후 병합)
          if (result.tags && result.tags.length > 0) {
            const currentTagsSet = new Set(tagsRef.current);
            const newTagsToAdd = result.tags.filter(t => !currentTagsSet.has(t));
            if (newTagsToAdd.length > 0) {
              addedTagsCount = newTagsToAdd.length;
              setTags(prev => Array.from(new Set([...prev, ...newTagsToAdd])));
            }
          }

          // 3) 햅틱 및 토스트 피드백
          if (appliedName || addedTagsCount > 0) {
            triggerHaptic('success');
            if (appliedName && addedTagsCount > 0) {
              showToast(`🤖 사진 분석: "${result.name}" 및 추천 태그 ${addedTagsCount}개가 자동 입력되었습니다.`, 3000, 'success');
            } else if (appliedName) {
              showToast(`🤖 사진 분석: "${result.name}"(으)로 자동 입력되었습니다.`, 3000, 'success');
            } else if (addedTagsCount > 0) {
              showToast(`🤖 사진 분석: 추천 태그 ${addedTagsCount}개가 자동 추가되었습니다.`, 3000, 'success');
            }
          }
        }
      } catch (err) {
        console.warn('AI recognition failed:', err);
      } finally {
        setIsAnalyzingImage(false);
      }
    }
  };

  // 유통기한 관련 상태
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');

  // 취소 및 제출 중 탭 가드 중복 확인 방지 플래그
  const isNavigatingAwayRef = useRef(false);

  // 작성 중인 내용이 있는지 판별 (위치 정보 제외, 사용자가 직접 입력한 물건 데이터 기준)
  const checkHasContent = () => {
    return Boolean(
      name.trim() || 
      description.trim() || 
      imagePreview || 
      imageFile ||
      tags.length > 0 || 
      expirationDate
    );
  };

  // 동일 이름 공간 중복 방어 렌더링
  const displaySpaces = useMemo(() => {
    const seenNames = new Set<string>();
    return spaces.filter(sp => {
      const key = (sp.name || '').trim().toLowerCase();
      if (!key) return true;
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
  }, [spaces]);

  // 필터링된 셀렉트박스 옵션 (동명 공간 수납처 통합 매핑)
  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);
  const sameNameSpaceIds = selectedSpace
    ? spaces.filter(s => (s.name || '').trim().toLowerCase() === (selectedSpace.name || '').trim().toLowerCase()).map(s => s.id)
    : (selectedSpaceId ? [selectedSpaceId] : []);
  const availableStorages = storages.filter(st => sameNameSpaceIds.includes(st.space_id));
  const availableSections = sections.filter(se => se.storage_id === selectedStorageId);
  const selectedStorage = availableStorages.find(st => st.id === selectedStorageId);
  const selectedSection = availableSections.find(se => se.id === selectedSectionId);

  // 기존 등록된 태그 목록 (검색 필터링 및 선택된 항목 우선 정렬)
  const displayExistingTags = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    let list = allTags;
    if (query) {
      list = list.filter(t => t.toLowerCase().includes(query));
    }
    // 선택된 태그가 맨 앞에 오도록 정렬 (쉽게 확인 및 토글 가능)
    return [...list].sort((a, b) => {
      const aSel = tags.includes(a);
      const bSel = tags.includes(b);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return 0;
    });
  }, [allTags, tagInput, tags]);

  // 드롭다운 열림 상태
  const [isSpaceDropdownOpen, setIsSpaceDropdownOpen] = useState(false);
  const [isStorageDropdownOpen, setIsStorageDropdownOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);

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

  // 2) 값이 변경될 때마다 자동 저장 수행 (물건 세부 내용이 있을 때만 드래프트 저장)
  useEffect(() => {
    if (isNavigatingAwayRef.current) return;
    const hasDraftContent = Boolean(
      name.trim() || 
      description.trim() || 
      tags.length > 0 || 
      expirationDate || 
      imagePreview
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
  }, [name, description, quantity, tags, selectedSpaceId, selectedStorageId, selectedSectionId, hasExpiration, expirationDate, isPrivate, imagePreview]);

  // 3) 3단계 위치가 선택될 때마다 마지막 사용 위치로 즉시 자동 기억
  useEffect(() => {
    if (selectedSpaceId && selectedStorageId && selectedSectionId) {
      try {
        localStorage.setItem('wii_last_used_location', JSON.stringify({
          spaceId: selectedSpaceId,
          storageId: selectedStorageId,
          sectionId: selectedSectionId
        }));
      } catch (e) {
        console.error('Failed to save last used location:', e);
      }
    }
  }, [selectedSpaceId, selectedStorageId, selectedSectionId]);

  // 4) 데이터 로드 완료 후 기억된 위치의 유효성 검증 (삭제된 위치인 경우 자동 리셋)
  useEffect(() => {
    if (spaces.length > 0 && selectedSpaceId) {
      const exists = spaces.some(s => s.id === selectedSpaceId);
      if (!exists) {
        setSelectedSpaceId('');
        setSelectedStorageId('');
        setSelectedSectionId('');
        localStorage.removeItem('wii_last_used_location');
      }
    }
  }, [spaces, selectedSpaceId]);

  useEffect(() => {
    if (storages.length > 0 && selectedStorageId) {
      const exists = storages.some(st => st.id === selectedStorageId);
      if (!exists) {
        setSelectedStorageId('');
        setSelectedSectionId('');
      }
    }
  }, [storages, selectedStorageId]);

  useEffect(() => {
    if (sections.length > 0 && selectedSectionId) {
      const exists = sections.some(se => se.id === selectedSectionId);
      if (!exists) {
        setSelectedSectionId('');
      }
    }
  }, [sections, selectedSectionId]);

  // ==========================================
  // [핸들러] 이미지 선택 및 프리뷰 처리
  // ==========================================
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let optimizedFile = file;
      if (file.size > 250 * 1024) {
        try {
          optimizedFile = await compressImage(file, 1024, 1024, 0.8);
        } catch (err) {
          console.warn('Image pre-compression failed:', err);
        }
      }
      setImageFile(optimizedFile);
      const objectUrl = URL.createObjectURL(optimizedFile);
      setImagePreview(objectUrl);
    }
  };

  // 태그 추가
  const commitTagInput = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setTagInput('');
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTagInput();
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

  // 화면 최상단(Top) 부드러운 스크롤 이동 헬퍼
  const scrollToTop = () => {
    // 1) 포커스 해제 (모바일 브라우저가 버튼/인풋 포커스로 스크롤을 유지하는 현상 방지)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const performScroll = () => {
      const scrollContainer = document.querySelector('main.scrollable') 
                           || document.querySelector('main') 
                           || document.querySelector('.scrollable');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // React 렌더링 완료 전/후 다단계 호출로 모바일/웹 전체에서 확실하게 최상단 이동
    performScroll();
    requestAnimationFrame(performScroll);
    setTimeout(performScroll, 80);
    setTimeout(performScroll, 200);
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

      const uncommittedTag = tagInput.trim();
      const finalTags = (uncommittedTag && !tags.includes(uncommittedTag))
        ? [...tags, uncommittedTag]
        : tags;

      await createItem(
        selectedSectionId,
        name.trim(),
        description.trim() || undefined,
        uploadedUrl || undefined,
        quantity,
        finalTags,
        hasExpiration ? (expirationDate || null) : null,
        isOwner ? isPrivate : false
      );

      // 1) 마지막 사용 위치 영구 기억
      localStorage.setItem('wii_last_used_location', JSON.stringify({
        spaceId: selectedSpaceId,
        storageId: selectedStorageId,
        sectionId: selectedSectionId
      }));

      // 2) 성공 시 드래프트 소거
      localStorage.removeItem('wii_add_item_draft');
      sessionStorage.removeItem('wii_add_item_draft');
      setHasRestoredDraft(false);

      const registeredItemName = name.trim();
      triggerHaptic('success');
      showToast(`🎉 "${registeredItemName}" 등록 완료! 같은 위치에 다음 물건을 바로 등록할 수 있어요.`, 3500, 'success');

      // 3) 물건 세부 정보만 초기화 (선택된 위치 3단계는 그대로 유지!)
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

      // 4) 최상단(Top)으로 부드럽게 스크롤하여 다음 물건 등록 준비
      scrollToTop();
    } catch (err: any) {
      console.error(err);
      alert('등록 중 에러가 발생했습니다: ' + err.message);
    } finally {
      setIsUploading(false);
      setTimeout(scrollToTop, 100);
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 물건 이름 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">물건 이름 *</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input 
              ref={nameInputRef}
              type="text" 
              className="input-text" 
              placeholder={isAnalyzingImage ? "🤖 AI가 사진 속 물건과 추천 태그를 인식하고 있어요..." : "예: 비상약, 헤어드라이기, 여권"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ paddingRight: (name || isAnalyzingImage) ? '40px' : '14px' }}
              required
            />
            {name && !isAnalyzingImage && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tickWeak');
                  setName('');
                  nameInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'var(--text-tertiary)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#fff',
                  transition: 'opacity 0.15s ease'
                }}
                title="전체 지우기"
              >
                <X size={12} strokeWidth={2.8} />
              </button>
            )}
            {isAnalyzingImage && (
              <div style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Loader2 size={18} className="animate-spin" color="var(--toss-blue)" />
              </div>
            )}
          </div>
        </div>

        {/* 스마트폰 카메라 연동 및 이미지 업로드 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>물건 사진 등록</label>
            <span style={{ 
              fontSize: '12px', 
              color: 'var(--toss-blue)', 
              fontWeight: '600', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px',
              background: 'var(--toss-blue-light)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              <Sparkles size={12} /> 스마트 이름 & 태그 자동 입력
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
            사진을 찍거나 올리면 AI가 물건 이름과 추천 태그를 자동으로 입력해 드려요.
          </p>
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
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px', height: 'auto', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '8px', background: 'var(--bg-subtle)', padding: '16px' }}
            >
              <Camera size={28} color="var(--text-tertiary)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                물건 사진 등록 (카메라 촬영 / 앨범 선택)
              </span>
              <span style={{ fontSize: '12px', color: 'var(--toss-blue)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={12} /> 사진 등록 시 물건 이름과 태그가 자동 입력됩니다
              </span>
            </div>
          )}
        </div>

        {/* 3단계 위치 선택 시스템 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 지정 (3단계)</span>
            {selectedSection && (
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--toss-blue)', 
                background: 'var(--toss-blue-light)', 
                padding: '2px 8px', 
                borderRadius: '10px', 
                fontWeight: '600' 
              }}>
                이전 위치 기억됨
              </span>
            )}
          </div>
          
          {/* 1단계: 공간 */}
          <div>
            <div style={{ marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>1단계: 공간 *</label>
            </div>

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
                  minHeight: '44px', height: 'auto', 
                  padding: '0 12px', 
                  background: '#fff', 
                  border: isSpaceDropdownOpen ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)', 
                  borderRadius: 'var(--radius-sm)', 
                  cursor: 'pointer', 
                  fontSize: '15px',
                  boxShadow: isSpaceDropdownOpen ? '0 0 0 3px rgba(49, 130, 246, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedSpace ? (
                    <>
                      <EmojiIcon icon={selectedSpace.icon} size={18} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedSpace.name}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>공간을 선택하세요</span>
                  )}
                </div>
                <ChevronDown 
                  size={18} 
                  color="var(--text-tertiary)" 
                  style={{ 
                    transform: isSpaceDropdownOpen ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s ease' 
                  }} 
                />
              </div>

              {isSpaceDropdownOpen && (
                <>
                  <div 
                    onClick={() => setIsSpaceDropdownOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: 'calc(100% + 4px)', 
                    left: 0, 
                    right: 0, 
                    background: '#fff', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: 'var(--radius-sm)', 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', 
                    zIndex: 1000, 
                    maxHeight: '220px', 
                    overflowY: 'auto' 
                  }}>
                    {displaySpaces.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: '14px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        등록된 공간이 없습니다.
                      </div>
                    ) : (
                      displaySpaces.map(s => {
                        const isSelected = selectedSpaceId === s.id;
                        return (
                          <div 
                            key={s.id} 
                            onClick={() => {
                              setSelectedSpaceId(s.id); 
                              setSelectedStorageId(''); 
                              setSelectedSectionId('');
                              setIsSpaceDropdownOpen(false);
                            }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              padding: '12px 14px', 
                              cursor: 'pointer', 
                              fontSize: '15px',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              borderBottom: '1px solid var(--border-subtle)'
                            }}
                            className="dropdown-option-hover"
                          >
                            <EmojiIcon icon={s.icon} size={18} />
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {s.name}
                            </span>
                            {isSelected && (
                              <Check size={16} color="var(--toss-blue)" style={{ marginLeft: 'auto' }} />
                            )}
                          </div>
                        );
                      })
                    )}
                    <div 
                      onClick={() => {
                        setIsSpaceDropdownOpen(false);
                        handleRedirectToLocationAdd('space');
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px', 
                        padding: '12px', 
                        cursor: 'pointer', 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: 'var(--toss-blue)',
                        background: '#f8faff',
                        borderTop: '1px solid var(--border-subtle)'
                      }}
                    >
                      <Plus size={16} /> 새 공간 추가하기
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2단계: 수납처 */}
          <div>
            <div style={{ marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>2단계: 수납처 *</label>
            </div>

            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => {
                  if (!selectedSpaceId) return;
                  setIsStorageDropdownOpen(!isStorageDropdownOpen);
                  setIsSpaceDropdownOpen(false);
                  setIsSectionDropdownOpen(false);
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  width: '100%', 
                  minHeight: '44px', height: 'auto', 
                  padding: '0 12px', 
                  background: selectedSpaceId ? '#fff' : 'var(--bg-subtle)', 
                  border: isStorageDropdownOpen ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)', 
                  borderRadius: 'var(--radius-sm)', 
                  cursor: selectedSpaceId ? 'pointer' : 'not-allowed', 
                  opacity: selectedSpaceId ? 1 : 0.65,
                  fontSize: '15px',
                  boxShadow: isStorageDropdownOpen ? '0 0 0 3px rgba(49, 130, 246, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedStorage ? (
                    <>
                      {selectedStorage.image_url ? (
                        <img 
                          src={selectedStorage.image_url} 
                          alt={selectedStorage.name} 
                          style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} 
                        />
                      ) : (
                        <EmojiIcon icon={selectedStorage.icon || '📦'} size={18} />
                      )}
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedStorage.name}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {!selectedSpaceId ? '먼저 공간을 선택해 주세요' : '수납처를 선택하세요'}
                    </span>
                  )}
                </div>
                <ChevronDown 
                  size={18} 
                  color="var(--text-tertiary)" 
                  style={{ 
                    transform: isStorageDropdownOpen ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s ease' 
                  }} 
                />
              </div>

              {isStorageDropdownOpen && selectedSpaceId && (
                <>
                  <div 
                    onClick={() => setIsStorageDropdownOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: 'calc(100% + 4px)', 
                    left: 0, 
                    right: 0, 
                    background: '#fff', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: 'var(--radius-sm)', 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', 
                    zIndex: 1000, 
                    maxHeight: '220px', 
                    overflowY: 'auto' 
                  }}>
                    {availableStorages.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: '14px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        이 공간에 등록된 수납처가 없습니다.
                      </div>
                    ) : (
                      availableStorages.map(st => {
                        const isSelected = selectedStorageId === st.id;
                        return (
                          <div 
                            key={st.id} 
                            onClick={() => {
                              setSelectedStorageId(st.id); 
                              setSelectedSectionId('');
                              setIsStorageDropdownOpen(false);
                            }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              padding: '12px 14px', 
                              cursor: 'pointer', 
                              fontSize: '15px',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              borderBottom: '1px solid var(--border-subtle)'
                            }}
                            className="dropdown-option-hover"
                          >
                            {st.image_url ? (
                              <img 
                                src={st.image_url} 
                                alt={st.name} 
                                style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} 
                              />
                            ) : (
                              <EmojiIcon icon={st.icon || '📦'} size={18} />
                            )}
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {st.name}
                            </span>
                            {isSelected && (
                              <Check size={16} color="var(--toss-blue)" style={{ marginLeft: 'auto' }} />
                            )}
                          </div>
                        );
                      })
                    )}
                    <div 
                      onClick={() => {
                        setIsStorageDropdownOpen(false);
                        handleRedirectToLocationAdd('storage');
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px', 
                        padding: '12px', 
                        cursor: 'pointer', 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: 'var(--toss-blue)',
                        background: '#f8faff',
                        borderTop: '1px solid var(--border-subtle)'
                      }}
                    >
                      <Plus size={16} /> 새 수납처 추가하기
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3단계: 세부위치 */}
          <div>
            <div style={{ marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>3단계: 세부 위치 *</label>
            </div>

            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => {
                  if (!selectedStorageId) return;
                  setIsSectionDropdownOpen(!isSectionDropdownOpen);
                  setIsSpaceDropdownOpen(false);
                  setIsStorageDropdownOpen(false);
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  width: '100%', 
                  minHeight: '44px', height: 'auto', 
                  padding: '0 12px', 
                  background: selectedStorageId ? '#fff' : 'var(--bg-subtle)', 
                  border: isSectionDropdownOpen ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)', 
                  borderRadius: 'var(--radius-sm)', 
                  cursor: selectedStorageId ? 'pointer' : 'not-allowed', 
                  opacity: selectedStorageId ? 1 : 0.65,
                  fontSize: '15px',
                  boxShadow: isSectionDropdownOpen ? '0 0 0 3px rgba(49, 130, 246, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedSection ? (
                    <>
                      {selectedSection.image_url ? (
                        <img 
                          src={selectedSection.image_url} 
                          alt={selectedSection.name} 
                          style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} 
                        />
                      ) : (
                        <EmojiIcon icon={selectedSection.icon || '📍'} size={18} />
                      )}
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedSection.name}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {!selectedStorageId ? '먼저 수납처를 선택해 주세요' : '세부위치를 선택하세요'}
                    </span>
                  )}
                </div>
                <ChevronDown 
                  size={18} 
                  color="var(--text-tertiary)" 
                  style={{ 
                    transform: isSectionDropdownOpen ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s ease' 
                  }} 
                />
              </div>

              {isSectionDropdownOpen && selectedStorageId && (
                <>
                  <div 
                    onClick={() => setIsSectionDropdownOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: 'calc(100% + 4px)', 
                    left: 0, 
                    right: 0, 
                    background: '#fff', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: 'var(--radius-sm)', 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', 
                    zIndex: 1000, 
                    maxHeight: '220px', 
                    overflowY: 'auto' 
                  }}>
                    {availableSections.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: '14px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        이 수납처에 등록된 세부위치가 없습니다.
                      </div>
                    ) : (
                      availableSections.map(se => {
                        const isSelected = selectedSectionId === se.id;
                        return (
                          <div 
                            key={se.id} 
                            onClick={() => {
                              setSelectedSectionId(se.id); 
                              setIsSectionDropdownOpen(false);
                            }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              padding: '12px 14px', 
                              cursor: 'pointer', 
                              fontSize: '15px',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              borderBottom: '1px solid var(--border-subtle)'
                            }}
                            className="dropdown-option-hover"
                          >
                            {se.image_url ? (
                              <img 
                                src={se.image_url} 
                                alt={se.name} 
                                style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} 
                              />
                            ) : (
                              <EmojiIcon icon={se.icon || '📍'} size={18} />
                            )}
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {se.name}
                            </span>
                            {isSelected && (
                              <Check size={16} color="var(--toss-blue)" style={{ marginLeft: 'auto' }} />
                            )}
                          </div>
                        );
                      })
                    )}
                    <div 
                      onClick={() => {
                        setIsSectionDropdownOpen(false);
                        handleRedirectToLocationAdd('section');
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px', 
                        padding: '12px', 
                        cursor: 'pointer', 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: 'var(--toss-blue)',
                        background: '#f8faff',
                        borderTop: '1px solid var(--border-subtle)'
                      }}
                    >
                      <Plus size={16} /> 새 세부위치 추가하기
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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
        {ENABLE_FAMILY_SYNC && isOwner && (
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input 
                ref={tagInputRef}
                type="text"
                className="input-text"
                placeholder="태그 입력 (Enter 또는 추가)"
                enterKeyHint="done"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                style={{ width: '100%', minHeight: '46px', height: '46px', paddingLeft: '14px', paddingRight: tagInput ? '38px' : '14px', fontSize: '15px' }}
              />
              {tagInput && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    triggerHaptic('tickWeak');
                    setTagInput('');
                    tagInputRef.current?.focus();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerHaptic('tickWeak');
                    setTagInput('');
                    tagInputRef.current?.focus();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    setTagInput('');
                  }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'var(--text-tertiary)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#fff'
                  }}
                  title="전체 지우기"
                >
                  <X size={12} strokeWidth={2.8} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tickWeak');
                commitTagInput();
              }}
              disabled={!tagInput.trim()}
              className="btn-secondary"
              style={{
                width: 'auto',
                minWidth: '68px',
                minHeight: '46px',
                height: '46px',
                padding: '0 16px',
                flexShrink: 0,
                fontWeight: '700',
                fontSize: '14px',
                borderRadius: 'var(--radius-xs)',
                margin: 0,
                opacity: !tagInput.trim() ? 0.45 : 1
              }}
            >
              추가
            </button>
          </div>
          {/* 기존 등록된 태그에서 빠른 선택 */}
          {allTags.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                  🏷️ 기존 등록된 태그에서 선택 ({allTags.length})
                </span>
                {allTags.length > 8 && !tagInput.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tickWeak');
                      setIsTagsExpanded(prev => !prev);
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--toss-blue)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    {isTagsExpanded ? (
                      <>간략히 <ChevronUp size={13} /></>
                    ) : (
                      <>전체보기 ({allTags.length}) <ChevronDown size={13} /></>
                    )}
                  </button>
                )}
              </div>

              {tagInput.trim() ? (
                // 검색어가 입력된 경우: 매칭되는 기존 태그만 표시 (최대 135px 스크롤)
                displayExistingTags.length > 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px', 
                    maxHeight: '135px', 
                    overflowY: 'auto',
                    padding: '6px 8px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    {displayExistingTags.map(tag => {
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
                              setTagInput(''); // 검색 입력창 자동 초기화
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
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', padding: '4px 2px' }}>
                    일치하는 기존 태그가 없습니다. [추가]를 누르면 새 태그로 등록됩니다.
                  </div>
                )
              ) : (
                // 검색어가 없는 기본 상태
                isTagsExpanded ? (
                  // 전체 펼침: 스크롤 박스로 다량 태그 안전 대응
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px', 
                    maxHeight: '135px', 
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    {displayExistingTags.map(tag => {
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
                ) : (
                  // 간략히 보기: 상위 8개 태그 + 더보기 뱃지
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {displayExistingTags.slice(0, 8).map(tag => {
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
                    {allTags.length > 8 && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tickWeak');
                          setIsTagsExpanded(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '6px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: '1px dashed var(--toss-blue)',
                          background: 'rgba(49, 130, 246, 0.05)',
                          color: 'var(--toss-blue)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        +{allTags.length - 8}개 더보기
                      </button>
                    )}
                  </div>
                )
              )}
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
        subtitle="사진을 등록하면 AI가 물건 이름과 태그를 스마트하게 자동 입력해 드려요"
      />
    </div>
  );
};

export default AddTab;
