import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../supabase';
import { 
  Settings, MapPin, ChevronRight, ChevronDown, ArrowLeft, Plus, Trash2, Edit2, 
  Link2, CheckCircle2, AlertCircle, Loader2, Camera, X, RotateCcw,
  Cloud, Bell, AlertTriangle
} from 'lucide-react';
import EmojiIcon from './EmojiIcon';
import BottomSheet from './BottomSheet';
import { spaceCustomIcons, storageCustomIcons } from '../utils/iconLoader';
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

// ==========================================
// [공통 데이터] 이모지 옵션 목록 (테마 고도화)
// ==========================================
const SPACE_EMOJI_OPTIONS = [
  '🏠', '🛋️', '🍳', '🛏️', '👗', '🧸', '📚', '💻', '🛁', '🛀🏻', '🚪', '🧺', '🪴', 
  '🌿', '🚗', '🏋️', '🏢', '⛺', '🍽️', '🎨', '🍿', '🍷', '📦', '🏡', '🌻'
];

const STORAGE_EMOJI_OPTIONS = [
  '📦', '🗄️', '👔', '🥾', '📚', '❄️', '🥫', '🧴', '💊', '🛠️', '🧺', '💍', 
  '🍽️', '🍷', '🧸', '💼', '🔑', '🔌', '🌂', '🪜'
];


interface SettingsTabProps {
  subPage: 'main' | 'manage' | 'add' | 'icons' | 'sync' | 'expiration' | 'reset';
  onChangeSubPage: (subPage: 'main' | 'manage' | 'add' | 'icons' | 'sync' | 'expiration' | 'reset') => void;
  onNavigateTab: (tab: 'home' | 'explore' | 'add' | 'search' | 'settings', params?: any) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ 
  subPage, 
  onChangeSubPage, 
  onNavigateTab 
}) => {
  const { 
    spaces, storages, sections, 
    createSpace, createStorage, createSection,
    deleteSpace, deleteStorage, deleteSection,
    updateSpace, updateStorage, updateSection,
    uploadImage
  } = useData();

  const { 
    user, activeGroup, myGroups, 
    myRequests, incomingRequests, 
    activeGroupMembers,
    submitJoinRequest, cancelJoinRequest, 
    approveRequest, rejectRequest, 
    switchActiveGroup, leaveGroup,
    updateMyNickname
  } = useAuth();

  const customSpaceIcons = Object.keys(spaceCustomIcons);
  const customStorageIcons = Object.keys(storageCustomIcons);


  // 파일 입력 Refs
  const storageFileInputRef = useRef<HTMLInputElement>(null);
  const sectionFileInputRef = useRef<HTMLInputElement>(null);

  // 실제로 선택창(BottomSheet)에 노출할 아이콘/이모지 목록 (폴더내 리소스 + 기본이모지 전체)
  const visibleSpaceIcons = [
    ...customSpaceIcons,
    ...SPACE_EMOJI_OPTIONS
  ];

  const visibleStorageIcons = [
    ...customStorageIcons,
    ...STORAGE_EMOJI_OPTIONS
  ];




  // ==========================================
  // 1. [Main Page] 연동 및 공유 관련 상태
  // ==========================================
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [myNicknameInput, setMyNicknameInput] = useState('');

  // 내 호칭 정보 가져와서 인풋 상태 동기화
  const myMemberInfo = activeGroupMembers.find(m => m.user_id === user?.id);
  const myNickname = myMemberInfo?.user_name || '';

  useEffect(() => {
    if (myNickname) {
      setMyNicknameInput(myNickname);
    } else {
      setMyNicknameInput('');
    }
  }, [myNickname]);

  // 데이터 보관 모드 안내 토글 상태
  const [showModeInfo, setShowModeInfo] = useState(false);
  const modeInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeInfoRef.current && !modeInfoRef.current.contains(event.target as Node)) {
        setShowModeInfo(false);
      }
    };
    if (showModeInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModeInfo]);

  // 유통기한 알림 기준일 상태 및 변경 핸들러
  const [notifyDays, setNotifyDays] = useState<number>(() => {
    const saved = localStorage.getItem('wii_expiration_notify_days');
    return saved ? parseInt(saved, 10) : 7;
  });

  const [tempNotifyDays, setTempNotifyDays] = useState<string>(() => {
    const saved = localStorage.getItem('wii_expiration_notify_days');
    return saved || '7';
  });

  const handleNotifyDaysChange = (days: number) => {
    setNotifyDays(days);
    setTempNotifyDays(days.toString());
    localStorage.setItem('wii_expiration_notify_days', days.toString());
  };

  const groupCode = activeGroup?.code || null;

  const handleConnectGroupCode = async () => {
    const code = syncCodeInput.trim();
    if (!code) return;

    // 현재 설정되어 있는 호칭을 가져와 신청에 사용 (없으면 기본값 '가족')
    const currentNickname = activeGroupMembers.find(m => m.user_id === user?.id)?.user_name || '가족';

    try {
      setIsSyncing(true);
      setSyncError(null);
      await submitJoinRequest(code, currentNickname);
      setSyncCodeInput('');
      alert('가족 보관소에 가입을 신청했습니다. 소유자의 승인을 기다려 주세요!');
      forceReload();
    } catch (err: any) {
      console.error('Failed to sync code:', err);
      setSyncError(err.message || '공유 그룹에 연동하지 못했습니다. 코드를 다시 확인해 주세요.');
    } finally {
      setIsSyncing(false);
    }
  };

  const forceReload = (resetTab = false) => {
    if (resetTab) {
      localStorage.setItem('wii_active_tab', 'home');
      localStorage.setItem('wii_settings_subpage', 'main');
    }
    const url = new URL(window.location.href);
    url.searchParams.set('t', Date.now().toString());
    window.location.href = url.toString();
  };

  // ==========================================
  // 2. [Add Location Page] 보관위치 등록 상태
  // ==========================================
  const [locationType, setLocationType] = useState<'space' | 'storage' | 'section'>('space');
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);

  // 2-1) 공간 추가용
  const [locSpaceName, setLocSpaceName] = useState('');
  const [locSpaceIcon, setLocSpaceIcon] = useState('🏠');

  // 2-2) 수납처 추가용
  const [locSelectedSpaceId, setLocSelectedSpaceId] = useState('');
  const [locStorageName, setLocStorageName] = useState('');
  const [locStorageIcon, setLocStorageIcon] = useState('📦');
  const [locStorageImageFile, setLocStorageImageFile] = useState<File | null>(null);
  const [locStorageImagePreview, setLocStorageImagePreview] = useState<string | null>(null);

  // 아이콘 선택용 바텀시트 모달 상태
  const [isSpaceIconSheetOpen, setIsSpaceIconSheetOpen] = useState(false);
  const [isStorageIconSheetOpen, setIsStorageIconSheetOpen] = useState(false);

  // 2-3) 세부위치 추가용
  const [locSelectedStorageSpaceId, setLocSelectedStorageSpaceId] = useState('');
  const [locSelectedStorageId, setLocSelectedStorageId] = useState('');
  const [locSectionName, setLocSectionName] = useState('');
  const [locSectionImageFile, setLocSectionImageFile] = useState<File | null>(null);
  const [locSectionImagePreview, setLocSectionImagePreview] = useState<string | null>(null);

  // 노출 아이콘 관리용 현재 선택 탭

  // 이미지 입력 이벤트 핸들러
  const handleStorageImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocStorageImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocStorageImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSectionImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocSectionImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocSectionImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 2-4) 보관위치 관리 아코디언 토글 상태
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
  const [expandedStorages, setExpandedStorages] = useState<Record<string, boolean>>({});

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces(prev => ({ ...prev, [spaceId]: !prev[spaceId] }));
  };

  const toggleStorage = (storageId: string) => {
    setExpandedStorages(prev => ({ ...prev, [storageId]: !prev[storageId] }));
  };

  // ==========================================
  // 3. [Edit Location] 보관위치 수정 상태 및 핸들러
  // ==========================================
  const [isEditLocationSheetOpen, setIsEditLocationSheetOpen] = useState(false);
  const [editLocType, setEditLocType] = useState<'space' | 'storage' | 'section'>('space');
  const [editLocId, setEditLocId] = useState('');
  const [editLocName, setEditLocName] = useState('');
  const [editLocIcon, setEditLocIcon] = useState('🏠');
  const [editLocImageFile, setEditLocImageFile] = useState<File | null>(null);
  const [editLocImagePreview, setEditLocImagePreview] = useState<string | null>(null);
  const [editLocOriginalImagePreview, setEditLocOriginalImagePreview] = useState<string | null>(null);
  const [isSavingLocEdit, setIsSavingLocEdit] = useState(false);

  const isPhotoChanged = editLocOriginalImagePreview !== null && (editLocImageFile !== null || editLocImagePreview !== editLocOriginalImagePreview);
  const [isEditSpaceIconSheetOpen, setIsEditSpaceIconSheetOpen] = useState(false);
  const [isEditStorageIconSheetOpen, setIsEditStorageIconSheetOpen] = useState(false);
  const editStorageFileInputRef = useRef<HTMLInputElement>(null);
  const editSectionFileInputRef = useRef<HTMLInputElement>(null);

  const handleEditStorageImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditLocImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditLocImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditSectionImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditLocImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditLocImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartEditLocation = (type: 'space' | 'storage' | 'section', id: string) => {
    setEditLocType(type);
    setEditLocId(id);
    setEditLocImageFile(null);
    setEditLocImagePreview(null);
    setEditLocOriginalImagePreview(null);
    
    if (type === 'space') {
      const space = spaces.find(s => s.id === id);
      if (space) {
        setEditLocName(space.name);
        setEditLocIcon(space.icon);
        setIsEditLocationSheetOpen(true);
      }
    } else if (type === 'storage') {
      const storage = storages.find(st => st.id === id);
      if (storage) {
        setEditLocName(storage.name);
        setEditLocIcon(storage.icon);
        setEditLocImagePreview(storage.image_url || null);
        setEditLocOriginalImagePreview(storage.image_url || null);
        setIsEditLocationSheetOpen(true);
      }
    } else if (type === 'section') {
      const section = sections.find(se => se.id === id);
      if (section) {
        setEditLocName(section.name);
        setEditLocImagePreview(section.image_url || null);
        setEditLocOriginalImagePreview(section.image_url || null);
        setIsEditLocationSheetOpen(true);
      }
    }
  };

  const handleSaveLocationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLocName.trim()) return;

    if (editLocImageFile) {
      const confirmed = window.confirm('사진을 변경하시겠습니까?');
      if (!confirmed) {
        return;
      }
    }

    setIsSavingLocEdit(true);

    try {
      if (editLocType === 'space') {
        await updateSpace(editLocId, {
          name: editLocName.trim(),
          icon: editLocIcon
        });
      } else if (editLocType === 'storage') {
        let imageUrl: string | undefined = undefined;
        if (editLocImageFile) {
          imageUrl = await uploadImage(editLocImageFile);
        } else if (editLocImagePreview) {
          imageUrl = editLocImagePreview;
        }
        await updateStorage(editLocId, {
          name: editLocName.trim(),
          icon: editLocIcon,
          image_url: imageUrl
        });
      } else if (editLocType === 'section') {
        let imageUrl: string | undefined = undefined;
        if (editLocImageFile) {
          imageUrl = await uploadImage(editLocImageFile);
        } else if (editLocImagePreview) {
          imageUrl = editLocImagePreview;
        }

        if (!imageUrl) {
          alert('세부위치 사진은 필수입니다. 사진을 등록해 주세요.');
          setIsSavingLocEdit(false);
          return;
        }

        await updateSection(editLocId, {
          name: editLocName.trim(),
          image_url: imageUrl
        });
      }
      setIsEditLocationSheetOpen(false);
      alert('보관위치 수정이 완료되었습니다.');
      onNavigateTab('home');
    } catch (err: any) {
      console.error(err);
      alert('보관위치 수정에 실패했습니다: ' + err.message);
    } finally {
      setIsSavingLocEdit(false);
    }
  };

  const availableStoragesForSectionLoc = storages.filter(st => st.space_id === locSelectedStorageSpaceId);

  // 외부(AddTab 등)에서 호출 시 전달된 파라미터 수신 처리
  useEffect(() => {
    const savedParams = sessionStorage.getItem('wii_settings_navigate_params');
    if (savedParams) {
      try {
        const params = JSON.parse(savedParams);
        if (params.locationType) {
          setLocationType(params.locationType);
          // 공간/수납처 미리 선택 보정
          const draftStr = sessionStorage.getItem('wii_add_item_draft');
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            if (draft.selectedSpaceId) {
              setLocSelectedSpaceId(draft.selectedSpaceId);
              setLocSelectedStorageSpaceId(draft.selectedSpaceId);
            }
            if (draft.selectedStorageId) {
              setLocSelectedStorageId(draft.selectedStorageId);
            }
          }
        }
        sessionStorage.removeItem('wii_settings_navigate_params');
      } catch (e) {
        console.error(e);
      }
    }
  }, [subPage]);

  // 보관위치 등록 실행 핸들러
  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLocation(true);

    try {
      let createdId = '';
      if (locationType === 'space') {
        if (!locSpaceName.trim()) return;
        const created = await createSpace(locSpaceName.trim(), locSpaceIcon);
        createdId = created.id;
        
        const wantContinue = window.confirm(`"${locSpaceName}" 공간이 추가되었습니다!\n\n이 공간 안에 수납처(2단계: 수납장/서랍 등)를 바로 이어서 추가하시겠습니까?`);
        
        setLocSpaceName('');
        setLocSpaceIcon('🏠');
        
        // 새로 추가된 공간을 리스트에서 바로 볼 수 있도록 미리 확장 상태로 둡니다.
        setExpandedSpaces(prev => ({ ...prev, [createdId]: true }));
        
        if (wantContinue) {
          setLocSelectedSpaceId(createdId);
          setLocationType('storage');
          setIsSubmittingLocation(false);
          return;
        }
      } 
      else if (locationType === 'storage') {
        if (!locSelectedSpaceId) {
          alert('소속할 상위 공간을 선택해 주세요.');
          setIsSubmittingLocation(false);
          return;
        }
        if (!locStorageName.trim()) return;

        let imageUrl: string | undefined = undefined;
        if (locStorageImageFile) {
          imageUrl = await uploadImage(locStorageImageFile);
        }

        const created = await createStorage(locSelectedSpaceId, locStorageName.trim(), locStorageIcon, imageUrl);
        createdId = created.id;
        
        const wantContinue = window.confirm(`"${locStorageName}" 수납처가 추가되었습니다!\n\n이 수납처 안에 세부 위치(3단계: 칸/서랍 등)를 바로 이어서 추가하시겠습니까?`);
        
        setLocStorageName('');
        setLocStorageIcon('📦');
        setLocStorageImageFile(null);
        setLocStorageImagePreview(null);
        
        // 새로 추가된 수납처와 부모 공간을 목록에서 즉시 확인할 수 있게 확장 상태로 둡니다.
        setExpandedSpaces(prev => ({ ...prev, [locSelectedSpaceId]: true }));
        setExpandedStorages(prev => ({ ...prev, [createdId]: true }));
        
        if (wantContinue) {
          setLocSelectedStorageSpaceId(locSelectedSpaceId);
          setLocSelectedStorageId(createdId);
          setLocationType('section');
          setIsSubmittingLocation(false);
          return;
        }
      } 
      else if (locationType === 'section') {
        if (!locSelectedStorageId) {
          alert('소속할 상위 수납처를 선택해 주세요.');
          setIsSubmittingLocation(false);
          return;
        }
        if (!locSectionName.trim()) return;

        if (!locSectionImageFile) {
          alert('세부위치 사진을 등록해 주세요.');
          setIsSubmittingLocation(false);
          return;
        }

        let imageUrl: string | undefined = undefined;
        if (locSectionImageFile) {
          imageUrl = await uploadImage(locSectionImageFile);
        }

        const created = await createSection(locSelectedStorageId, locSectionName.trim(), undefined, imageUrl);
        createdId = created.id;
        
        const wantContinue = window.confirm(`"${locSectionName}" 세부 위치가 추가되었습니다!\n\n같은 수납처 안에 또 다른 세부 위치(칸/서랍 등)를 계속 추가하시겠습니까?`);
        
        setLocSectionName('');
        setLocSectionImageFile(null);
        setLocSectionImagePreview(null);
        
        // 새로 추가된 세부위치의 부모 공간과 수납처를 확장합니다.
        setExpandedSpaces(prev => ({ ...prev, [locSelectedStorageSpaceId]: true }));
        setExpandedStorages(prev => ({ ...prev, [locSelectedStorageId]: true }));
        
        if (wantContinue) {
          setIsSubmittingLocation(false);
          return;
        }
      }

      // 복귀 라우팅 처리 (AddTab에서 강제 이동해온 경우인지 판별)
      const redirectTab = sessionStorage.getItem('wii_location_add_redirect');
      if (redirectTab === 'add') {
        sessionStorage.removeItem('wii_location_add_redirect');
        
        // 새로 생성된 보관 구조 ID를 AddTab의 폼 드래프트에 주입하여
        // 돌아갔을 때 사용자 클릭 없이 자동 선택되도록 지원합니다.
        const draftStr = sessionStorage.getItem('wii_add_item_draft');
        if (draftStr) {
          try {
            const draft = JSON.parse(draftStr);
            if (locationType === 'space') {
              draft.selectedSpaceId = createdId;
              draft.selectedStorageId = '';
              draft.selectedSectionId = '';
            } else if (locationType === 'storage') {
              draft.selectedSpaceId = locSelectedSpaceId;
              draft.selectedStorageId = createdId;
              draft.selectedSectionId = '';
            } else if (locationType === 'section') {
              draft.selectedSpaceId = locSelectedStorageSpaceId;
              draft.selectedStorageId = locSelectedStorageId;
              draft.selectedSectionId = createdId;
            }
            sessionStorage.setItem('wii_add_item_draft', JSON.stringify(draft));
          } catch (err) {
            console.error('Draft auto-injection failed:', err);
          }
        }
        
        // 새물건 등록 탭으로 복귀
        onNavigateTab('add');
      } else {
        // 일반 등록 완료 시 홈화면으로 복귀
        alert('위치 등록이 완료되어 홈 화면으로 이동합니다.');
        onNavigateTab('home');
      }
    } catch (err: any) {
      console.error(err);
      alert('보관위치 생성에 실패했습니다: ' + err.message);
    } finally {
      setIsSubmittingLocation(false);
    }
  };

  // ==========================================
  // [삭제] 공간/수납처/세부위치 삭제 처리
  // ==========================================
  const handleDeleteSpace = async (id: string, name: string) => {
    const input = window.prompt(
      `"${name}" 공간을 삭제하시겠습니까?\n하위의 모든 수납처, 세부위치 및 물건들이 영구 삭제되며 복구할 수 없습니다!\n\n삭제하려면 공간 이름 ["${name}"]을(를) 그대로 입력해 주세요.`
    );
    if (input === null) return; // 취소 버튼 클릭 시 종료
    if (input.trim() === name.trim()) {
      try {
        await deleteSpace(id);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    } else {
      alert('공간 이름이 일치하지 않아 삭제가 취소되었습니다.');
    }
  };

  const handleDeleteStorage = async (id: string, name: string) => {
    const input = window.prompt(
      `"${name}" 수납처를 삭제하시겠습니까?\n하위의 모든 세부위치 및 물건들이 영구 삭제되며 복구할 수 없습니다!\n\n삭제하려면 수납처 이름 ["${name}"]을(를) 그대로 입력해 주세요.`
    );
    if (input === null) return;
    if (input.trim() === name.trim()) {
      try {
        await deleteStorage(id);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    } else {
      alert('수납처 이름이 일치하지 않아 삭제가 취소되었습니다.');
    }
  };

  const handleDeleteSection = async (id: string, name: string) => {
    const input = window.prompt(
      `"${name}" 세부 위치를 삭제하시겠습니까?\n이 위치에 들어있는 모든 물건 목록이 영구 삭제되며 복구할 수 없습니다!\n\n삭제하려면 세부위치 이름 ["${name}"]을(를) 그대로 입력해 주세요.`
    );
    if (input === null) return;
    if (input.trim() === name.trim()) {
      try {
        await deleteSection(id);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    } else {
      alert('세부 위치 이름이 일치하지 않아 삭제가 취소되었습니다.');
    }
  };

  // 뒤로가기 버튼 처리
  const handleBackArrow = () => {
    const redirectTab = sessionStorage.getItem('wii_location_add_redirect');
    if (subPage === 'add' && redirectTab === 'add') {
      sessionStorage.removeItem('wii_location_add_redirect');
      onNavigateTab('add');
    } else if (subPage === 'add') {
      onChangeSubPage('manage');
    } else if (subPage === 'manage' || subPage === 'sync' || subPage === 'expiration' || subPage === 'reset') {
      onChangeSubPage('main');
    }
  };

  return (
    <div className="page-transition">
      {/* =========================================================================
          [1] 설정 메인 홈 페이지 (subPage === 'main')
         ========================================================================= */}
      {subPage === 'main' && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 className="h1-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              설정 <Settings size={22} color="var(--toss-blue)" />
            </h1>
            <p className="body-desc" style={{ color: 'var(--text-secondary)' }}>
              보관 환경 구조 및 기기 동기화를 편리하게 관리합니다.
            </p>
          </div>

          {/* Menu List Container */}
          <div style={{ background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column' }}>
            {/* 1. 보관위치 관리 */}
            <div 
              onClick={() => onChangeSubPage('manage')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-light)',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--toss-blue-light)', color: 'var(--toss-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>보관위치 관리</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>공간, 수납처, 칸/서랍 추가 및 일괄 삭제</span>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-tertiary)" />
            </div>

            {/* 2. 실시간 다기기 동기화 */}
            <div 
              onClick={() => onChangeSubPage('sync')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-light)',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(49, 196, 141, 0.1)', color: 'rgb(49, 196, 141)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Cloud size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>가족 동기화</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>기기 동기화 및 가족 공유 연동 설정</span>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-tertiary)" />
            </div>

            {/* 3. 유통기한 알림 설정 */}
            <div 
              onClick={() => onChangeSubPage('expiration')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-light)',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: 'rgb(245, 158, 11)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bell size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>유통기한 알림 설정</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>유통기한 미리알림 기준일 설정</span>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-tertiary)" />
            </div>

            {/* 4. 애플리케이션 초기화 */}
            <div 
              onClick={() => onChangeSubPage('reset')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>애플리케이션 초기화</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>공장 초기화 및 앱 버전 정보</span>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-tertiary)" />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          [1-1] 실시간 다기기 동기화 페이지 (subPage === 'sync')
         ========================================================================= */}
      {subPage === 'sync' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button 
              onClick={handleBackArrow}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="h2-title" style={{ margin: 0 }}>가족 동기화</h2>
          </div>

          <p className="body-desc" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            가족 동기화를 통해 여러 기기에서 실시간 동기화 및 공유를 사용하도록 설정합니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
              {!isSupabaseConfigured && (
                <div>
                  {(() => {
                    const hasSupabaseKeys = !!import.meta.env.VITE_SUPABASE_URL && 
                      import.meta.env.VITE_SUPABASE_URL.trim() !== '' && 
                      !import.meta.env.VITE_SUPABASE_URL.includes('your-project-id') &&
                      !!import.meta.env.VITE_SUPABASE_ANON_KEY && 
                      import.meta.env.VITE_SUPABASE_ANON_KEY.trim() !== '' && 
                      !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('your-anon-key');

                    return hasSupabaseKeys ? (
                      /* 임시 Sandbox 모드 경고 및 복귀 버튼 */
                      <div style={{ background: '#fff2f2', padding: '16px', borderRadius: '14px', border: '1px solid #ffd1d1', color: 'var(--accent-red)', fontSize: '13px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ fontWeight: '700' }}>⚠️ 임시 Sandbox (로컬) 모드로 동작 중입니다.</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          데이터 유실을 방지하고 가족 동기화를 사용하려면 실시간 클라우드 모드로 복귀해 주세요.
                        </span>
                        <button
                          onClick={() => {
                            localStorage.removeItem('wii_force_sandbox');
                            forceReload();
                          }}
                          className="btn-secondary"
                          style={{ height: '36px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0 16px', margin: '0 auto' }}
                        >
                          실시간 클라우드로 복귀
                        </button>
                      </div>
                    ) : (
                      /* 환경변수 미설정으로 인한 로컬 Sandbox 안내 */
                      <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.5' }}>
                        💾 <strong>로컬 Sandbox 모드로 동작 중입니다.</strong><br/>
                        기기 자체 보관 상태이며, 기기 분실이나 브라우저 캐시 삭제 시 데이터가 모두 유실될 수 있습니다.
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 가족 공유 연동 폼 */}
              {isSupabaseConfigured && (
                <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* 1. 현재 선택된 워크스페이스 정보 */}
                    <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-medium)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                            {activeGroup && user && activeGroup.owner_id === user.id ? '내 보관소 공유 코드' : '참여 중인 보관소 공유 코드'}
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            fontWeight: '700', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            background: activeGroup && user && activeGroup.owner_id === user.id ? 'var(--toss-blue-light)' : '#e8f5e9', 
                            color: activeGroup && user && activeGroup.owner_id === user.id ? 'var(--toss-blue)' : '#2e7d32' 
                          }}>
                            {activeGroup && user && activeGroup.owner_id === user.id ? '소유자' : '멤버'}
                          </span>
                        </div>
                        <strong style={{ fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '0.5px', marginTop: '4px', display: 'block' }}>
                          {groupCode}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            if (groupCode) {
                              triggerHaptic('basicMedium');
                              navigator.clipboard.writeText(groupCode);
                              alert(`공유 코드 "${groupCode}"가 복사되었습니다. 가족 기기에 등록해 보세요!`);
                            }
                          }}
                          style={{ border: 'none', background: 'var(--toss-blue-light)', color: 'var(--toss-blue)', padding: '8px 14px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          코드 복사
                        </button>
                        <button
                          onClick={() => {
                            if (groupCode) {
                              triggerHaptic('basicMedium');
                              const shareText = `[어디 뒀더라?] 우리 집 보관함 공유 코드입니다.\n코드: ${groupCode}\n\n토스앱에서 위 코드를 복사하여 가족 보관함에 참여해 보세요!`;
                              
                              if (typeof navigator !== 'undefined' && navigator.share) {
                                navigator.share({
                                  title: '어디 뒀더라? 보관함 초대',
                                  text: shareText,
                                }).catch((err) => console.log('Share failed:', err));
                              } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                navigator.clipboard.writeText(shareText);
                                alert('초대 메시지 문구가 복사되었습니다! 카카오톡 등 원하는 대화방을 열어 붙여넣어 공유해 보세요.');
                              } else {
                                alert(`공유 코드: ${groupCode}`);
                              }
                            }
                          }}
                          style={{ border: 'none', background: 'var(--bg-input)', color: 'var(--text-secondary)', padding: '8px 14px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          공유하기
                        </button>
                      </div>
                    </div>

                    {/* 1-2. 현재 보관소의 가족 멤버 목록 */}
                    {activeGroupMembers.length > 0 && (
                      <div style={{ background: '#fff', border: '1px solid var(--border-medium)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '700', letterSpacing: '0.5px' }}>
                          현재 보관소의 가족 멤버
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {activeGroupMembers.map(member => (
                            <div 
                              key={member.id} 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                background: member.user_id === user?.id ? 'var(--toss-blue-light)' : 'var(--bg-subtle)', 
                                color: member.user_id === user?.id ? 'var(--toss-blue)' : 'var(--text-primary)', 
                                padding: '6px 12px', 
                                borderRadius: '10px', 
                                fontSize: '12.5px',
                                fontWeight: '600',
                                border: '1px solid ' + (member.user_id === user?.id ? 'rgba(49, 130, 246, 0.15)' : 'var(--border-subtle)')
                              }}
                            >
                              <span>{member.user_name || '이름 없음'}</span>
                              <span style={{ 
                                fontSize: '9px', 
                                padding: '1px 4px', 
                                borderRadius: '4px', 
                                background: member.role === 'owner' ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0,0,0,0.05)', 
                                color: member.role === 'owner' ? '#ff9500' : 'var(--text-secondary)' 
                              }}>
                                {member.role === 'owner' ? '소유자' : '멤버'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 1-3. 내 호칭/이름 설정 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>내 호칭 / 이름 변경</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={myNicknameInput}
                          onChange={(e) => setMyNicknameInput(e.target.value)}
                          placeholder="현재 보관소에서 사용할 호칭 입력 (예: 엄마, 첫째)"
                          className="input-text"
                          style={{ fontSize: '13px', height: '42px', fontWeight: '600' }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && myNicknameInput.trim() && !isSyncing) {
                              try {
                                setIsSyncing(true);
                                await updateMyNickname(myNicknameInput);
                                alert('호칭이 저장되었습니다!');
                                forceReload();
                              } catch (err: any) {
                                alert('저장 실패: ' + err.message);
                              } finally {
                                setIsSyncing(false);
                              }
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            try {
                              setIsSyncing(true);
                              await updateMyNickname(myNicknameInput);
                              alert('호칭이 저장되었습니다!');
                              forceReload();
                            } catch (err: any) {
                              alert('저장 실패: ' + err.message);
                            } finally {
                              setIsSyncing(false);
                            }
                          }}
                          disabled={isSyncing || !myNicknameInput.trim()}
                          className="btn-primary"
                          style={{ width: '80px', height: '42px', margin: 0, flexShrink: 0, fontSize: '13px' }}
                        >
                          저장
                        </button>
                      </div>
                    </div>

                    {/* 2. 워크스페이스 목록 & 전환기 */}
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
                        내 보관소 목록 (워크스페이스 전환)
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myGroups.map((g) => {
                          const isCurrent = activeGroup?.id === g.id;
                          const isOwner = user && g.owner_id === user.id;
                          return (
                            <div 
                              key={g.id}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: isCurrent ? 'rgba(49, 130, 246, 0.04)' : '#fff', 
                                border: isCurrent ? '1.5px solid var(--toss-blue)' : '1px solid var(--border-medium)', 
                                padding: '14px 16px', 
                                borderRadius: '14px',
                                transition: 'all var(--transition-fast)'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                    {g.code}
                                  </span>
                                  <span style={{ 
                                    fontSize: '9px', 
                                    fontWeight: '700', 
                                    padding: '1px 5px', 
                                    borderRadius: '6px', 
                                    background: isOwner ? 'rgba(49, 130, 246, 0.08)' : '#f1f3f5', 
                                    color: isOwner ? 'var(--toss-blue)' : 'var(--text-secondary)' 
                                  }}>
                                    {isOwner ? '내 보관함' : '가족 공유'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'block' }}>
                                  생성일: {new Date(g.created_at).toLocaleDateString()}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isCurrent ? (
                                  <span style={{ 
                                    fontSize: '12px', 
                                    fontWeight: '700', 
                                    color: 'var(--toss-blue)', 
                                    background: 'var(--toss-blue-light)', 
                                    padding: '6px 12px', 
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <CheckCircle2 size={14} /> 사용 중
                                  </span>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await switchActiveGroup(g.id);
                                        forceReload();
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    }}
                                    style={{ border: '1px solid var(--border-medium)', background: '#fff', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                                  >
                                    전환
                                  </button>
                                )}

                                {!isOwner && (
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`"${g.code}" 보관소에서 퇴장하시겠습니까?\n\n※ 퇴장 후에도 해당 보관소 공유 코드를 통해 언제든 다시 참가하실 수 있습니다.`)) {
                                        try {
                                          setIsSyncing(true);
                                          await leaveGroup(g.id);
                                          alert('보관소 퇴장이 완료되었습니다.');
                                          forceReload();
                                        } catch (err: any) {
                                          alert('퇴장에 실패했습니다: ' + err.message);
                                        } finally {
                                          setIsSyncing(false);
                                        }
                                      }
                                    }}
                                    style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '6px', cursor: 'pointer', display: 'flex', transition: 'color var(--transition-fast)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                    title="보관소 나가기"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2-2. 받은 가입 신청 (소유자 승인) */}
                    {incomingRequests.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          보관소 가입 신청 (승인 대기)
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {incomingRequests.map((req) => {
                            const targetGroup = myGroups.find(g => g.id === req.group_id);
                            const groupName = targetGroup ? targetGroup.code : '알 수 없음';
                            return (
                              <div
                                key={req.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: '#fff',
                                  border: '1px solid var(--border-medium)',
                                  padding: '14px 16px',
                                  borderRadius: '14px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                      {req.requester_name}
                                    </span>
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '700',
                                      padding: '1px 5px',
                                      borderRadius: '6px',
                                      background: 'rgba(49, 130, 246, 0.08)',
                                      color: 'var(--toss-blue)'
                                    }}>
                                      가입 신청
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                                    대상 보관소: <strong style={{ color: 'var(--text-primary)' }}>{groupName}</strong>
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={async () => {
                                      try {
                                        setIsSyncing(true);
                                        await approveRequest(req.id);
                                        alert(`"${req.requester_name}" 님의 가입 신청을 승인했습니다.`);
                                      } catch (err: any) {
                                        alert('승인 실패: ' + err.message);
                                      } finally {
                                        setIsSyncing(false);
                                      }
                                    }}
                                    disabled={isSyncing}
                                    style={{
                                      border: 'none',
                                      background: 'var(--toss-blue)',
                                      color: '#fff',
                                      padding: '8px 14px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    승인
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`"${req.requester_name}" 님의 가입 신청을 거절하시겠습니까?`)) {
                                        try {
                                          setIsSyncing(true);
                                          await rejectRequest(req.id);
                                          alert('가입 신청을 거절했습니다.');
                                        } catch (err: any) {
                                          alert('거절 실패: ' + err.message);
                                        } finally {
                                          setIsSyncing(false);
                                        }
                                      }
                                    }}
                                    disabled={isSyncing}
                                    style={{
                                      border: '1px solid var(--border-medium)',
                                      background: '#fff',
                                      color: 'var(--text-secondary)',
                                      padding: '8px 14px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    거절
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2-3. 내가 신청한 보관소 (승인 대기 중) */}
                    {myRequests.filter(r => r.status === 'pending').length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          내가 신청한 보관소 (승인 대기 중)
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {myRequests.filter(r => r.status === 'pending').map((req) => (
                            <div
                              key={req.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#f8f9fa',
                                border: '1px solid var(--border-medium)',
                                padding: '14px 16px',
                                borderRadius: '14px'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                    승인 대기 중
                                  </span>
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    padding: '1px 5px',
                                    borderRadius: '6px',
                                    background: '#fff3cd',
                                    color: '#856404'
                                  }}>
                                    대기중
                                  </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                                  신청한 호칭: <strong style={{ color: 'var(--text-primary)' }}>{req.requester_name}</strong>
                                </span>
                              </div>
                              <button
                                onClick={async () => {
                                  if (window.confirm('가입 신청을 취소하시겠습니까?')) {
                                    try {
                                      setIsSyncing(true);
                                      await cancelJoinRequest(req.id);
                                      alert('가입 신청이 취소되었습니다.');
                                    } catch (err: any) {
                                      alert('취소 실패: ' + err.message);
                                    } finally {
                                      setIsSyncing(false);
                                    }
                                  }
                                }}
                                disabled={isSyncing}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: 'var(--text-tertiary)',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  transition: 'color var(--transition-fast)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                              >
                                신청 취소
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. 새로운 보관소 참여하기 */}
                    <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>새로운 공유 보관소 참여하기</span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>공유 코드</span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={syncCodeInput}
                            onChange={(e) => { setSyncCodeInput(e.target.value); setSyncError(null); }}
                            placeholder="가족의 공유 코드 입력 (wii-xxxxxx)"
                            className="input-text"
                            style={{ paddingRight: '40px', fontSize: '13px', height: '46px', fontWeight: '600' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && syncCodeInput.trim() && !isSyncing) handleConnectGroupCode();
                            }}
                          />
                          <Link2 size={16} style={{ position: 'absolute', right: '14px', color: 'var(--text-tertiary)' }} />
                        </div>
                      </div>

                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '-4px', display: 'block', lineHeight: '1.4' }}>
                        * 현재 보관소에 설정된 내 호칭(<strong>"{myNickname || '소유자'}"</strong>)으로 가입 신청이 전송됩니다.
                      </span>
                      
                      {syncError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff2f2', border: '1px solid #ffd1d1', padding: '10px', borderRadius: '10px', color: 'var(--accent-red)', fontSize: '11px' }}>
                          <AlertCircle size={14} style={{ flexShrink: 0 }} />
                          <span>{syncError}</span>
                        </div>
                      )}

                      <button
                        onClick={handleConnectGroupCode}
                        disabled={!syncCodeInput.trim() || isSyncing}
                        className="btn-primary"
                        style={{ height: '46px', marginTop: '4px', opacity: (!syncCodeInput.trim() || isSyncing) ? 0.6 : 1 }}
                      >
                        {isSyncing ? '보관소 참여 신청 중...' : '공유 보관소 참여 신청하기'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          [1-2] 유통기한 알림 설정 페이지 (subPage === 'expiration')
         ========================================================================= */}
      {subPage === 'expiration' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button 
              onClick={handleBackArrow}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="h2-title" style={{ margin: 0 }}>유통기한 알림 설정</h2>
          </div>

          <p className="body-desc" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            유통기한 임박 물건을 감지할 기준일을 설정합니다.
          </p>

          <div style={{ background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
            <div>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                알림 기간 수정
              </span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                유통기한 미리알림 기간
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '12px', lineHeight: '1.4' }}>
                등록된 물건의 유통기한이 임박했을 때 며칠 전에 알려줄지(목록 D-Day 경고 기준) 설정합니다.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="number"
                min="1"
                max="365"
                value={tempNotifyDays}
                onChange={(e) => setTempNotifyDays(e.target.value)}
                className="input-text"
                style={{ width: '80px', height: '40px', padding: '0 10px', textAlign: 'center', fontSize: '14px', margin: 0 }}
              />
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginRight: '8px' }}>일 전</span>
              <button
                onClick={() => {
                  const val = parseInt(tempNotifyDays, 10);
                  if (!isNaN(val) && val >= 1 && val <= 365) {
                    handleNotifyDaysChange(val);
                    alert(`유통기한 미리알림 기간이 ${val}일 전으로 수정되었습니다.`);
                    onNavigateTab('home');
                  } else {
                    alert('1일부터 365일까지의 올바른 숫자를 입력해 주세요.');
                  }
                }}
                disabled={tempNotifyDays === notifyDays.toString()}
                className="btn-primary"
                style={{ 
                  height: '40px', 
                  padding: '0 16px', 
                  fontSize: '13px', 
                  margin: 0, 
                  width: 'auto',
                  opacity: tempNotifyDays === notifyDays.toString() ? 0.5 : 1,
                  cursor: tempNotifyDays === notifyDays.toString() ? 'not-allowed' : 'pointer'
                }}
              >
                수정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          [1-3] 애플리케이션 초기화 페이지 (subPage === 'reset')
         ========================================================================= */}
      {subPage === 'reset' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button 
              onClick={handleBackArrow}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="h2-title" style={{ margin: 0 }}>애플리케이션 초기화</h2>
          </div>

          <p className="body-desc" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            애플리케이션의 상태를 초기화하거나 버전 정보를 확인합니다.
          </p>

          <div style={{ background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
            <div>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                기기 캐시 및 세션 데이터 초기화
              </span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                공장 초기화 진행
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', lineHeight: '1.5' }}>
                기기의 모든 로컬 저장소 캐시와 연동 세션을 초기화하고 처음 상태로 되돌립니다. 초기화 시 새로운 고유 보관함이 발급됩니다.
              </span>
            </div>

            <button
              onClick={() => {
                if (window.confirm('기기의 모든 저장소 캐시와 연동 세션을 지우고 공장 초기화하시겠습니까? (새 보관함이 발급됩니다)')) {
                  localStorage.clear();
                  forceReload(true);
                }
              }}
              className="btn-primary"
              style={{ height: '46px', background: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: '#fff', margin: 0 }}
            >
              🔄 기기 모든 캐시 및 세션 완전 초기화
            </button>
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '600', opacity: 0.8 }}>
              where is it . {import.meta.env.VITE_APP_VERSION || 'v00079'}
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          [2] 보관위치 일괄 편집 및 관리 페이지 (subPage === 'manage')
         ========================================================================= */}
      {subPage === 'manage' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button 
              onClick={handleBackArrow}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="h2-title" style={{ margin: 0 }}>보관위치 관리</h2>
          </div>

          <p className="body-desc" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            공간 구조를 계층별로 관리하고 삭제합니다.
          </p>

          {/* Floating/Action Button for location add */}
          <button
            onClick={() => {
              sessionStorage.setItem('wii_location_add_redirect', 'manage');
              onChangeSubPage('add');
            }}
            className="btn-primary"
            style={{ marginBottom: '24px', height: '48px', gap: '6px' }}
          >
            <Plus size={16} /> 새 보관위치 추가
          </button>

          {/* Hierarchical Structure List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {spaces.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', color: 'var(--text-tertiary)' }}>
                등록된 공간이 존재하지 않습니다.
              </div>
            ) : (
              spaces.map(s => {
                const innerStorages = storages.filter(st => st.space_id === s.id);
                return (
                  <div 
                    key={s.id}
                    style={{
                      background: '#fff',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '16px',
                      padding: '16px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.01)'
                    }}
                  >
                    {/* Space Row (Level 1) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: (innerStorages.length > 0 && expandedSpaces[s.id]) ? '1px dashed var(--border-subtle)' : 'none', paddingBottom: (innerStorages.length > 0 && expandedSpaces[s.id]) ? '12px' : '0' }}>
                      <div 
                        onClick={() => toggleSpace(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, userSelect: 'none' }}
                      >
                        {innerStorages.length > 0 ? (
                          expandedSpaces[s.id] ? <ChevronDown size={16} color="var(--text-secondary)" /> : <ChevronRight size={16} color="var(--text-secondary)" />
                        ) : (
                          <div style={{ width: '16px' }} />
                        )}
                        <EmojiIcon icon={s.icon} size={20} />
                        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {s.name} 
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>(공간)</span>
                          {innerStorages.length > 0 && !expandedSpaces[s.id] && (
                            <span style={{ fontSize: '11px', color: 'var(--toss-blue)', marginLeft: '8px', fontWeight: '600', background: 'var(--toss-blue-light)', padding: '2px 6px', borderRadius: '8px' }}>
                              {innerStorages.length}
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // 공간 접기/펼치기 트리거 방지
                            setLocSelectedSpaceId(s.id);
                            setLocationType('storage');
                            onChangeSubPage('add');
                          }}
                          style={{
                            border: 'none',
                            background: 'var(--toss-blue-light)',
                            color: 'var(--toss-blue)',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            transition: 'opacity var(--transition-fast)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          <Plus size={12} /> 수납처 추가
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditLocation('space', s.id);
                          }}
                          style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '6px', cursor: 'pointer', display: 'flex', transition: 'color var(--transition-fast)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--toss-blue)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // 공간 접기/펼치기 트리거 방지
                            handleDeleteSpace(s.id, s.name);
                          }}
                          style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '6px', cursor: 'pointer', display: 'flex', transition: 'color var(--transition-fast)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Storages List (Level 2) */}
                    {innerStorages.length > 0 && expandedSpaces[s.id] && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', paddingLeft: '12px' }}>
                        {innerStorages.map(st => {
                          const innerSections = sections.filter(se => se.storage_id === st.id);
                          return (
                            <div 
                              key={st.id} 
                              style={{ 
                                background: 'var(--bg-subtle)', 
                                padding: '12px', 
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: (innerSections.length > 0 && expandedStorages[st.id]) ? '1px solid var(--border-medium)' : 'none', paddingBottom: (innerSections.length > 0 && expandedStorages[st.id]) ? '8px' : '0' }}>
                                <div 
                                  onClick={() => toggleStorage(st.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1, userSelect: 'none' }}
                                >
                                  {innerSections.length > 0 ? (
                                    expandedStorages[st.id] ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />
                                  ) : (
                                    <div style={{ width: '14px' }} />
                                  )}
                                  {st.image_url ? (
                                    <img src={st.image_url} alt={st.name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                                  ) : (
                                    <EmojiIcon icon={st.icon} size={32} />
                                  )}
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                    {st.name} 
                                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>(수납처)</span>
                                    {innerSections.length > 0 && !expandedStorages[st.id] && (
                                      <span style={{ fontSize: '10px', color: '#2e7d32', marginLeft: '6px', fontWeight: '600', background: '#e8f5e9', padding: '1px 5px', borderRadius: '6px' }}>
                                        {innerSections.length}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); // 수납처 접기/펼치기 트리거 방지
                                      setLocSelectedStorageSpaceId(s.id);
                                      setLocSelectedStorageId(st.id);
                                      setLocationType('section');
                                      onChangeSubPage('add');
                                    }}
                                    style={{
                                      border: 'none',
                                      background: '#e8f5e9',
                                      color: '#2e7d32',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      padding: '4px 8px',
                                      borderRadius: '12px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      transition: 'opacity var(--transition-fast)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                  >
                                    <Plus size={12} /> 세부위치 추가
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditLocation('storage', st.id);
                                    }}
                                    style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '4px', cursor: 'pointer', display: 'flex' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--toss-blue)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation(); // 수납처 접기/펼치기 트리거 방지
                                      handleDeleteStorage(st.id, st.name);
                                    }}
                                    style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '4px', cursor: 'pointer', display: 'flex' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Sections List (Level 3) */}
                              {innerSections.length > 0 && expandedStorages[st.id] && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', paddingLeft: '8px' }}>
                                  {innerSections.map(se => (
                                    <div 
                                      key={se.id} 
                                      style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        background: '#fff', 
                                        padding: '8px 10px', 
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-medium)'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                        {se.image_url ? (
                                          <img src={se.image_url} alt={se.name} style={{ width: '28px', height: '28px', borderRadius: '3px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                                        ) : (
                                          <EmojiIcon icon={se.icon || '📍'} size={28} style={{ flexShrink: 0 }} />
                                        )}
                                        <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                          {se.name}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button 
                                          onClick={() => handleStartEditLocation('section', se.id)}
                                          style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--toss-blue)'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteSection(se.id, se.name)}
                                          style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          [3] 새 보관위치 등록 및 추가 폼 페이지 (subPage === 'add')
         ========================================================================= */}
      {subPage === 'add' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button 
              onClick={handleBackArrow}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="h2-title" style={{ margin: 0 }}>새 보관위치 추가</h2>
          </div>

          <p className="body-desc" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            새로운 공간이나 수납장, 칸 구조를 구조화하여 생성합니다.
          </p>

          <form onSubmit={handleLocationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 위치 종류 지정 셀렉트 버튼 */}
            <div>
              <label className="form-label">보관위치 단계 선택</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['space', 'storage', 'section'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLocationType(type)}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: locationType === type ? 'var(--toss-blue)' : 'var(--border-medium)',
                      background: locationType === type ? 'var(--toss-blue-light)' : 'var(--bg-app)',
                      color: locationType === type ? 'var(--toss-blue)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      textAlign: 'center'
                    }}
                  >
                    {type === 'space' && '🏠 1단계: 공간'}
                    {type === 'storage' && '📦 2단계: 수납처'}
                    {type === 'section' && '📍 3단계: 세부위치'}
                  </button>
                ))}
              </div>
            </div>

            {/* Form A: 공간(Space) 추가 */}
            {locationType === 'space' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">공간 이름 *</label>
                  <input 
                    type="text" 
                    className="input-text"
                    placeholder="예: 드레스룸, 베란다, 서재, 대피소"
                    value={locSpaceName}
                    onChange={(e) => setLocSpaceName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">공간 아이콘 선택</label>
                  <div 
                    onClick={() => setIsSpaceIconSheetOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: '#fff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      border: '1px solid var(--border-medium)'
                    }}>
                      <EmojiIcon icon={locSpaceIcon} size={26} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>아이콘 변경</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>눌러서 이쁜 아이콘이나 이모지를 선택하세요.</span>
                    </div>
                    <ChevronRight size={16} color="var(--text-tertiary)" />
                  </div>
                </div>
                
                {/* 등록된 공간 목록 표시 */}
                {spaces.length > 0 && (
                  <div style={{ background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                      등록된 공간 ({spaces.length}개)
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {spaces.map(s => (
                        <span key={s.id} style={{ fontSize: '12px', background: '#fff', border: '1px solid var(--border-medium)', padding: '4px 8px', borderRadius: '8px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <EmojiIcon icon={s.icon} size={12} />
                          <span style={{ fontWeight: '500' }}>{s.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form B: 수납처(Storage) 추가 */}
            {locationType === 'storage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">소속할 상위 공간 지정 *</label>
                  {spaces.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>등록된 공간이 없습니다. 1단계 공간을 먼저 생성하세요.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                      {spaces.map(s => {
                        const isSelected = locSelectedSpaceId === s.id;
                        return (
                          <div
                            key={s.id}
                            onClick={() => setLocSelectedSpaceId(s.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none'
                            }}
                          >
                            <EmojiIcon icon={s.icon} size={18} />
                            <span style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {s.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 등록된 수납처 목록 표시 */}
                  {(() => {
                    const existingStorages = storages.filter(st => st.space_id === locSelectedSpaceId);
                    if (locSelectedSpaceId && existingStorages.length > 0) {
                      return (
                        <div style={{ background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)', marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                            등록된 수납처 ({existingStorages.length}개)
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {existingStorages.map(st => (
                              <span key={st.id} style={{ fontSize: '12px', background: '#fff', border: '1px solid var(--border-medium)', padding: '4px 8px', borderRadius: '8px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <EmojiIcon icon={st.icon} size={12} />
                                <span style={{ fontWeight: '500' }}>{st.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">수납처 이름 *</label>
                  <input 
                    type="text" 
                    className="input-text"
                    placeholder="예: 옷장 행거, 싱크대 상부장, 정리 리빙박스"
                    value={locStorageName}
                    onChange={(e) => setLocStorageName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">수납처 아이콘 선택</label>
                  <div 
                    onClick={() => setIsStorageIconSheetOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: '#fff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      border: '1px solid var(--border-medium)'
                    }}>
                      <EmojiIcon icon={locStorageIcon} size={26} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>아이콘 변경</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>눌러서 이쁜 아이콘이나 이모지를 선택하세요.</span>
                    </div>
                    <ChevronRight size={16} color="var(--text-tertiary)" />
                  </div>
                </div>

                {/* 수납처 사진 등록/변경 */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px' }}>수납처 사진 등록</label>
                  <input 
                    ref={storageFileInputRef}
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={handleStorageImageChange}
                  />
                  {locStorageImagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer' }}>
                      <img 
                        src={locStorageImagePreview} 
                        alt="preview" 
                        onClick={() => storageFileInputRef.current?.click()}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa' }} 
                      />
                      <div 
                        onClick={() => storageFileInputRef.current?.click()}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0,0,0,0.5)',
                          color: '#fff',
                          fontSize: '11px',
                          textAlign: 'center',
                          padding: '4px 0',
                          fontWeight: 'bold',
                          pointerEvents: 'none'
                        }}
                      >
                        사진 터치하여 변경
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setLocStorageImageFile(null); setLocStorageImagePreview(null); }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
                      >
                        <X size={14} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => storageFileInputRef.current?.click()}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '6px', background: 'var(--bg-subtle)' }}
                    >
                      <Camera size={20} color="var(--text-tertiary)" />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>수납처 사진 찍기 또는 이미지 등록 (선택)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form C: 세부위치(Section) 추가 */}
            {locationType === 'section' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">1단계: 소속할 공간 선택 *</label>
                  {spaces.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>등록된 공간이 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                      {spaces.map(s => {
                        const isSelected = locSelectedStorageSpaceId === s.id;
                        return (
                          <div
                            key={s.id}
                            onClick={() => { setLocSelectedStorageSpaceId(s.id); setLocSelectedStorageId(''); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none'
                            }}
                          >
                            <EmojiIcon icon={s.icon} size={18} />
                            <span style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {s.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">2단계: 소속할 수납처 선택 *</label>
                  {!locSelectedStorageSpaceId ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>먼저 공간을 선택해 주세요.</div>
                  ) : availableStoragesForSectionLoc.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>이 공간에 등록된 수납처가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                      {availableStoragesForSectionLoc.map(st => {
                        const isSelected = locSelectedStorageId === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => setLocSelectedStorageId(st.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none'
                            }}
                          >
                            <EmojiIcon icon={st.icon} size={18} />
                            <span style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {st.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 등록된 세부 위치 목록 표시 */}
                  {(() => {
                    const existingSections = sections.filter(se => se.storage_id === locSelectedStorageId);
                    if (locSelectedStorageId && existingSections.length > 0) {
                      return (
                        <div style={{ background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)', marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                            등록된 세부 위치 ({existingSections.length}개)
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {existingSections.map(se => (
                              <span key={se.id} style={{ fontSize: '12px', background: '#fff', border: '1px solid var(--border-medium)', padding: '4px 8px', borderRadius: '8px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {se.image_url ? (
                                  <img src={se.image_url} alt={se.name} style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'contain', background: '#f8f9fa' }} />
                                ) : (
                                  <EmojiIcon icon={se.icon || '📍'} size={24} />
                                )}
                                <span style={{ fontWeight: '500' }}>{se.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">3단계: 새 세부 위치 이름 *</label>
                  <input 
                    type="text" 
                    className="input-text"
                    placeholder="예: 세 번째 칸, 아래 서랍, 수납 바구니 안쪽"
                    value={locSectionName}
                    onChange={(e) => setLocSectionName(e.target.value)}
                    required
                  />
                </div>

                {/* 세부위치 사진 등록/변경 */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px' }}>세부위치 사진 등록 *</label>
                  <input 
                    ref={sectionFileInputRef}
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={handleSectionImageChange}
                  />
                  {locSectionImagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer' }}>
                      <img 
                        src={locSectionImagePreview} 
                        alt="preview" 
                        onClick={() => sectionFileInputRef.current?.click()}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa' }} 
                      />
                      <div 
                        onClick={() => sectionFileInputRef.current?.click()}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0,0,0,0.5)',
                          color: '#fff',
                          fontSize: '11px',
                          textAlign: 'center',
                          padding: '4px 0',
                          fontWeight: 'bold',
                          pointerEvents: 'none'
                        }}
                      >
                        사진 터치하여 변경
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setLocSectionImageFile(null); setLocSectionImagePreview(null); }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
                      >
                        <X size={14} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => sectionFileInputRef.current?.click()}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '6px', background: 'var(--bg-subtle)' }}
                    >
                      <Camera size={20} color="var(--text-tertiary)" />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>세부위치 사진 찍기 또는 이미지 등록 (필수)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={isSubmittingLocation}
                style={{ flex: 1, height: '56px' }}
              >
                {isSubmittingLocation ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    보관위치 생성 중...
                  </>
                ) : (
                  '보관 위치 생성'
                )}
              </button>
              <button 
                type="button"
                className="btn-secondary"
                onClick={handleBackArrow}
                disabled={isSubmittingLocation}
                style={{ flex: 1, height: '56px' }}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}



      {/* 5. 공간 아이콘 선택 바텀시트 모달 */}
      <BottomSheet
        isOpen={isSpaceIconSheetOpen}
        onClose={() => setIsSpaceIconSheetOpen(false)}
        title="공간 아이콘 선택"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 큰 미리보기 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            background: 'var(--bg-subtle)',
            borderRadius: '16px',
            border: '1px solid var(--border-medium)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#fff',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-medium)'
            }}>
              <EmojiIcon icon={locSpaceIcon} size={40} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>현재 선택됨</span>
          </div>

          {/* 활성화된 전체 아이콘 영역 */}
          {visibleSpaceIcons.length > 0 ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {visibleSpaceIcons.map(path => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setLocSpaceIcon(path);
                      setIsSpaceIconSheetOpen(false);
                    }}
                    style={{
                      border: locSpaceIcon === path ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                      background: locSpaceIcon === path ? 'var(--toss-blue-light)' : '#fff',
                      borderRadius: '12px',
                      height: '56px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <EmojiIcon icon={path} size={28} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-medium)', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', lineHeight: '1.5' }}>
                선택 가능한 아이콘이 없습니다.<br/>
                설정 ➔ [노출 아이콘 관리]에서 노출할 아이콘을 활성화해 주세요.
              </span>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* 6. 수납처 아이콘 선택 바텀시트 모달 */}
      <BottomSheet
        isOpen={isStorageIconSheetOpen}
        onClose={() => setIsStorageIconSheetOpen(false)}
        title="수납처 아이콘 선택"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 큰 미리보기 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            background: 'var(--bg-subtle)',
            borderRadius: '16px',
            border: '1px solid var(--border-medium)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#fff',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-medium)'
            }}>
              <EmojiIcon icon={locStorageIcon} size={40} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>현재 선택됨</span>
          </div>

          {/* 활성화된 전체 아이콘 영역 */}
          {visibleStorageIcons.length > 0 ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {visibleStorageIcons.map(path => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setLocStorageIcon(path);
                      setIsStorageIconSheetOpen(false);
                    }}
                    style={{
                      border: locStorageIcon === path ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                      background: locStorageIcon === path ? 'var(--toss-blue-light)' : '#fff',
                      borderRadius: '12px',
                      height: '56px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <EmojiIcon icon={path} size={28} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-medium)', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', lineHeight: '1.5' }}>
                선택 가능한 아이콘이 없습니다.<br/>
                설정 ➔ [노출 아이콘 관리]에서 노출할 아이콘을 활성화해 주세요.
              </span>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* 4. 보관위치 수정 바텀시트 모달 */}
      <BottomSheet
        isOpen={isEditLocationSheetOpen}
        onClose={() => {
          if (!isSavingLocEdit) {
            setIsEditLocationSheetOpen(false);
          }
        }}
        title={
          editLocType === 'space' ? '공간 수정' :
          editLocType === 'storage' ? '수납처 수정' : '세부위치 수정'
        }
      >
        <form onSubmit={handleSaveLocationEdit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">이름 *</label>
            <input 
              type="text" 
              className="input-text"
              placeholder={
                editLocType === 'space' ? '예: 드레스룸, 베란다' :
                editLocType === 'storage' ? '예: 옷장 행거, 싱크대 상부장' : '예: 세 번째 칸, 아래 서랍'
              }
              value={editLocName}
              onChange={(e) => setEditLocName(e.target.value)}
              required
            />
          </div>

          {/* 공간/수납처일 때만 아이콘 선택 UI */}
          {(editLocType === 'space' || editLocType === 'storage') && (
            <div>
              <label className="form-label">아이콘 선택</label>
              <div 
                onClick={() => {
                  if (editLocType === 'space') {
                    setIsEditSpaceIconSheetOpen(true);
                  } else {
                    setIsEditStorageIconSheetOpen(true);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'var(--bg-subtle)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-medium)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  border: '1px solid var(--border-medium)'
                }}>
                  <EmojiIcon icon={editLocIcon} size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>아이콘 변경</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>눌러서 이쁜 아이콘이나 이모지를 선택하세요.</span>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </div>
            </div>
          )}

          {/* 수납처/세부위치일 때만 사진 업로드 UI */}
          {editLocType === 'storage' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '13px' }}>수납처 사진 등록/변경</label>
              <input 
                ref={editStorageFileInputRef}
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleEditStorageImageChange}
              />
              {editLocImagePreview ? (
                <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer' }}>
                  <img 
                    src={editLocImagePreview} 
                    alt="preview" 
                    onClick={() => editStorageFileInputRef.current?.click()}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa' }} 
                  />
                  <div 
                    onClick={() => editStorageFileInputRef.current?.click()}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      fontSize: '11px',
                      textAlign: 'center',
                      padding: '4px 0',
                      fontWeight: 'bold',
                      pointerEvents: 'none'
                    }}
                  >
                    사진 터치하여 변경
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setEditLocImageFile(null); setEditLocImagePreview(null); }}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
                  >
                    <X size={14} color="#fff" />
                  </button>
                  {isPhotoChanged && (
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setEditLocImageFile(null); setEditLocImagePreview(editLocOriginalImagePreview); }}
                      style={{ position: 'absolute', top: '44px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
                      title="이전 사진으로 복귀"
                    >
                      <RotateCcw size={14} color="#fff" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => editStorageFileInputRef.current?.click()}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '6px', background: 'var(--bg-subtle)' }}
                >
                  <Camera size={20} color="var(--text-tertiary)" />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>수납처 사진 찍기 또는 이미지 등록 (선택)</span>
                </div>
              )}
              {editLocImagePreview === null && editLocOriginalImagePreview !== null && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setEditLocImageFile(null); setEditLocImagePreview(editLocOriginalImagePreview); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: 'var(--toss-blue)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontWeight: '600'
                    }}
                  >
                    <RotateCcw size={12} />
                    이전 사진으로 복귀
                  </button>
                </div>
              )}
            </div>
          )}

          {editLocType === 'section' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '13px' }}>세부위치 사진 등록/변경 *</label>
              <input 
                ref={editSectionFileInputRef}
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleEditSectionImageChange}
              />
              {editLocImagePreview ? (
                <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer' }}>
                  <img 
                    src={editLocImagePreview} 
                    alt="preview" 
                    onClick={() => editSectionFileInputRef.current?.click()}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa' }} 
                  />
                  <div 
                    onClick={() => editSectionFileInputRef.current?.click()}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      fontSize: '11px',
                      textAlign: 'center',
                      padding: '4px 0',
                      fontWeight: 'bold',
                      pointerEvents: 'none'
                    }}
                  >
                    사진 터치하여 변경
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setEditLocImageFile(null); setEditLocImagePreview(null); }}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
                  >
                    <X size={14} color="#fff" />
                  </button>
                  {isPhotoChanged && (
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setEditLocImageFile(null); setEditLocImagePreview(editLocOriginalImagePreview); }}
                      style={{ position: 'absolute', top: '44px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
                      title="이전 사진으로 복귀"
                    >
                      <RotateCcw size={14} color="#fff" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => editSectionFileInputRef.current?.click()}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '6px', background: 'var(--bg-subtle)' }}
                >
                  <Camera size={20} color="var(--text-tertiary)" />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>세부위치 사진 찍기 또는 이미지 등록 (필수)</span>
                </div>
              )}
              {editLocImagePreview === null && editLocOriginalImagePreview !== null && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setEditLocImageFile(null); setEditLocImagePreview(editLocOriginalImagePreview); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: 'var(--toss-blue)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontWeight: '600'
                    }}
                  >
                    <RotateCcw size={12} />
                    이전 사진으로 복귀
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isSavingLocEdit}
              style={{ flex: 1, height: '56px' }}
            >
              {isSavingLocEdit ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  저장 중...
                </>
              ) : (
                '수정 완료'
              )}
            </button>
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => setIsEditLocationSheetOpen(false)}
              disabled={isSavingLocEdit}
              style={{ flex: 1, height: '56px' }}
            >
              취소
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* 5-2. 수정용 공간 아이콘 선택 바텀시트 모달 */}
      <BottomSheet
        isOpen={isEditSpaceIconSheetOpen}
        onClose={() => setIsEditSpaceIconSheetOpen(false)}
        title="공간 아이콘 선택"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 큰 미리보기 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            background: 'var(--bg-subtle)',
            borderRadius: '16px',
            border: '1px solid var(--border-medium)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#fff',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-medium)'
            }}>
              <EmojiIcon icon={editLocIcon} size={40} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>현재 선택됨</span>
          </div>

          {/* 활성화된 전체 아이콘 영역 */}
          {visibleSpaceIcons.length > 0 ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {visibleSpaceIcons.map(path => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setEditLocIcon(path);
                      setIsEditSpaceIconSheetOpen(false);
                    }}
                    style={{
                      border: editLocIcon === path ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                      background: editLocIcon === path ? 'var(--toss-blue-light)' : '#fff',
                      borderRadius: '12px',
                      height: '56px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <EmojiIcon icon={path} size={28} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-medium)', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', lineHeight: '1.5' }}>
                선택 가능한 아이콘이 없습니다.
              </span>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* 6-2. 수정용 수납처 아이콘 선택 바텀시트 모달 */}
      <BottomSheet
        isOpen={isEditStorageIconSheetOpen}
        onClose={() => setIsEditStorageIconSheetOpen(false)}
        title="수납처 아이콘 선택"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 큰 미리보기 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            background: 'var(--bg-subtle)',
            borderRadius: '16px',
            border: '1px solid var(--border-medium)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#fff',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-medium)'
            }}>
              <EmojiIcon icon={editLocIcon} size={40} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>현재 선택됨</span>
          </div>

          {/* 활성화된 전체 아이콘 영역 */}
          {visibleStorageIcons.length > 0 ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {visibleStorageIcons.map(path => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setEditLocIcon(path);
                      setIsEditStorageIconSheetOpen(false);
                    }}
                    style={{
                      border: editLocIcon === path ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                      background: editLocIcon === path ? 'var(--toss-blue-light)' : '#fff',
                      borderRadius: '12px',
                      height: '56px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <EmojiIcon icon={path} size={28} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-medium)', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', lineHeight: '1.5' }}>
                선택 가능한 아이콘이 없습니다.
              </span>
            </div>
          )}
        </div>
      </BottomSheet>

    </div>
  );
};

export default SettingsTab;
