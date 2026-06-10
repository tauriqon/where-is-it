import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabase';
import { 
  Settings, MapPin, ChevronRight, ChevronDown, ArrowLeft, Plus, Trash2, 
  Link2, CheckCircle2, AlertCircle, Loader2, CheckSquare, Camera, X
} from 'lucide-react';
import EmojiIcon from './EmojiIcon';
import BottomSheet from './BottomSheet';
import { spaceCustomIcons, storageCustomIcons } from '../utils/iconLoader';

// ==========================================
// [공통 데이터] 이모지 옵션 목록 (테마 고도화)
// ==========================================
const SPACE_EMOJI_OPTIONS = [
  '🏠', '🛋️', '🍳', '🛏️', '👗', '🧸', '📚', '💻', '🛁', '🚪', '🧺', '🪴', 
  '🌿', '🚗', '🏋️', '🏢', '⛺', '🍽️', '🎨', '🍿', '🍷', '📦', '🏡', '🌻'
];

const STORAGE_EMOJI_OPTIONS = [
  '📦', '🗄️', '👔', '🥾', '📚', '❄️', '🥫', '🧴', '💊', '🛠️', '🧺', '💍', 
  '🍽️', '🍷', '🧸', '💼', '🔑', '🔌', '🌂', '🪜'
];

const SECTION_EMOJI_OPTIONS = [
  '📍', '🏷️', '🗃️', '📂', '🗂️', '📥', '📤', '🧺', '🪣', '🧳', '🎒', '👛',
  '🥢', '🍴', '🧴', '💊', '🪥', '🧼', '🪞', '💄', '🧩', '🎮', '🔋', '🔌'
];

interface SettingsTabProps {
  subPage: 'main' | 'manage' | 'add' | 'icons';
  onChangeSubPage: (subPage: 'main' | 'manage' | 'add' | 'icons') => void;
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
    uploadImage
  } = useData();

  const { user, loginWithGroupCode, myOriginalCode } = useAuth();

  const customSpaceIcons = Object.keys(spaceCustomIcons);
  const customStorageIcons = Object.keys(storageCustomIcons);

  // 파일 입력 Refs
  const storageFileInputRef = useRef<HTMLInputElement>(null);
  const sectionFileInputRef = useRef<HTMLInputElement>(null);

  // 로컬스토리지에서 노출 비활성화된 아이콘 정보 로드
  const [disabledSpaceIcons, setDisabledSpaceIcons] = useState<string[]>(() => {
    const saved = localStorage.getItem('wii_disabled_space_icons');
    return saved ? JSON.parse(saved) : [];
  });

  const [disabledStorageIcons, setDisabledStorageIcons] = useState<string[]>(() => {
    const saved = localStorage.getItem('wii_disabled_storage_icons');
    return saved ? JSON.parse(saved) : [];
  });

  const [disabledSectionIcons, setDisabledSectionIcons] = useState<string[]>(() => {
    const saved = localStorage.getItem('wii_disabled_section_icons');
    return saved ? JSON.parse(saved) : [];
  });

  // 사용자가 직접 업로드한 커스텀 아이콘 리스트
  const [uploadedIcons, setUploadedIcons] = useState<{ id: string; name: string; url: string }[]>(() => {
    const saved = localStorage.getItem('wii_user_uploaded_icons');
    return saved ? JSON.parse(saved) : [];
  });

  const [isUploading, setIsUploading] = useState(false);

  // Supabase 클라우드 모드일 때 스토리지에서 업로드된 아이콘 목록 가져오기
  useEffect(() => {
    const fetchCloudIcons = async () => {
      const client = supabase;
      if (isSupabaseConfigured && client) {
        try {
          const { data, error } = await client.storage.from('item-images').list('custom-icons');
          if (error) {
            console.error('Failed to list cloud custom icons:', error);
            return;
          }
          if (data && data.length > 0) {
            const cloudIconsParsed = data.map(file => {
              const { data: { publicUrl } } = client.storage.from('item-images').getPublicUrl(`custom-icons/${file.name}`);
              return {
                id: file.id || file.name,
                name: file.name.substring(file.name.indexOf('-') + 1), // 타임스탬프 접두사 제거
                url: publicUrl
              };
            });
            
            // 로컬스토리지는 계속 보존하면서 클라우드 파일들과 병합 (URL 기준 중복 방지)
            setUploadedIcons(prev => {
              const combined = [...prev];
              cloudIconsParsed.forEach(ci => {
                if (!combined.some(item => item.url === ci.url)) {
                  combined.push(ci);
                }
              });
              localStorage.setItem('wii_user_uploaded_icons', JSON.stringify(combined));
              return combined;
            });
          }
        } catch (e) {
          console.error('Error fetching cloud icons:', e);
        }
      }
    };
    fetchCloudIcons();
  }, []);

  const handleUploadIcon = async (file: File) => {
    try {
      setIsUploading(true);
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const uniqueName = `${Date.now()}-${cleanFileName}`;
      
      let imageUrl = '';
      if (isSupabaseConfigured && supabase) {
        // 클라우드 업로드
        const { error } = await supabase.storage
          .from('item-images')
          .upload(`custom-icons/${uniqueName}`, file);
        if (error) throw error;
        
        const { data } = supabase.storage
          .from('item-images')
          .getPublicUrl(`custom-icons/${uniqueName}`);
        imageUrl = data.publicUrl;
      } else {
        // 로컬 Base64 변환 및 압축
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX_WIDTH = 200; // 아이콘 크기이므로 작게 축소
              const scale = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scale;
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (e) => reject(e);
          };
          reader.onerror = (error) => reject(error);
        });
      }

      const newIcon = {
        id: uniqueName,
        name: file.name,
        url: imageUrl
      };

      const next = [newIcon, ...uploadedIcons];
      setUploadedIcons(next);
      localStorage.setItem('wii_user_uploaded_icons', JSON.stringify(next));
      
      alert('새 아이콘이 업로드되었습니다.');
    } catch (err: any) {
      console.error(err);
      alert('아이콘 업로드 실패: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteUploadedIcon = async (url: string) => {
    if (!window.confirm('이 업로드된 아이콘을 완전히 삭제하시겠습니까?')) return;
    
    try {
      if (isSupabaseConfigured && supabase && url.includes('/custom-icons/')) {
        const parts = url.split('/custom-icons/');
        if (parts.length > 1) {
          const fileName = parts[1];
          const { error } = await supabase.storage
            .from('item-images')
            .remove([`custom-icons/${fileName}`]);
          if (error) {
            console.error('Failed to remove from cloud storage:', error);
          }
        }
      }
      
      const next = uploadedIcons.filter(item => item.url !== url);
      setUploadedIcons(next);
      localStorage.setItem('wii_user_uploaded_icons', JSON.stringify(next));
      
      // 비활성화 목록 정리
      if (disabledSpaceIcons.includes(url)) {
        const updated = disabledSpaceIcons.filter(u => u !== url);
        setDisabledSpaceIcons(updated);
        localStorage.setItem('wii_disabled_space_icons', JSON.stringify(updated));
      }
      if (disabledStorageIcons.includes(url)) {
        const updated = disabledStorageIcons.filter(u => u !== url);
        setDisabledStorageIcons(updated);
        localStorage.setItem('wii_disabled_storage_icons', JSON.stringify(updated));
      }
      if (disabledSectionIcons.includes(url)) {
        const updated = disabledSectionIcons.filter(u => u !== url);
        setDisabledSectionIcons(updated);
        localStorage.setItem('wii_disabled_section_icons', JSON.stringify(updated));
      }
      
      alert('아이콘이 삭제되었습니다.');
    } catch (err: any) {
      console.error(err);
      alert('아이콘 삭제 실패: ' + err.message);
    }
  };

  const handleToggleSpaceIcon = (path: string) => {
    const next = disabledSpaceIcons.includes(path)
      ? disabledSpaceIcons.filter(p => p !== path)
      : [...disabledSpaceIcons, path];
    setDisabledSpaceIcons(next);
    localStorage.setItem('wii_disabled_space_icons', JSON.stringify(next));
  };

  const handleToggleStorageIcon = (path: string) => {
    const next = disabledStorageIcons.includes(path)
      ? disabledStorageIcons.filter(p => p !== path)
      : [...disabledStorageIcons, path];
    setDisabledStorageIcons(next);
    localStorage.setItem('wii_disabled_storage_icons', JSON.stringify(next));
  };

  const handleToggleSectionIcon = (path: string) => {
    const next = disabledSectionIcons.includes(path)
      ? disabledSectionIcons.filter(p => p !== path)
      : [...disabledSectionIcons, path];
    setDisabledSectionIcons(next);
    localStorage.setItem('wii_disabled_section_icons', JSON.stringify(next));
  };

  // 실제로 선택창(BottomSheet)에 노출할 활성화된 아이콘/이모지 필터링
  const allSpaceIcons = [
    ...customSpaceIcons,
    ...uploadedIcons.map(item => item.url),
    ...SPACE_EMOJI_OPTIONS
  ];
  const visibleSpaceIcons = allSpaceIcons.filter(path => !disabledSpaceIcons.includes(path));

  const allStorageIcons = [
    ...customStorageIcons,
    ...uploadedIcons.map(item => item.url),
    ...STORAGE_EMOJI_OPTIONS
  ];
  const visibleStorageIcons = allStorageIcons.filter(path => !disabledStorageIcons.includes(path));

  const allSectionIcons = [
    ...uploadedIcons.map(item => item.url),
    ...SECTION_EMOJI_OPTIONS
  ];
  const visibleSectionIcons = allSectionIcons.filter(path => !disabledSectionIcons.includes(path));



  // ==========================================
  // 1. [Main Page] 연동 및 공유 관련 상태
  // ==========================================
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const getGroupCode = (email?: string) => {
    if (!email) return null;
    if (email.endsWith('-wii@gmail.com')) return email.split('-wii@gmail.com')[0];
    if (email.endsWith('@local-group.com')) return email.split('@')[0];
    return email;
  };

  const groupCode = getGroupCode(user?.email);

  const handleConnectGroupCode = async () => {
    const code = syncCodeInput.trim();
    if (!code) return;
    try {
      setIsSyncing(true);
      setSyncError(null);
      await loginWithGroupCode(code);
      setSyncCodeInput('');
      // 강제 리로드하여 최신 DB 데이터를 Supabase로부터 온전히 새로고침
      const url = new URL(window.location.href);
      url.searchParams.set('t', Date.now().toString());
      window.location.href = url.toString();
    } catch (err: any) {
      console.error('Failed to sync code:', err);
      setSyncError(err.message || '공유 그룹에 연동하지 못했습니다. 코드를 다시 확인해 주세요.');
    } finally {
      setIsSyncing(false);
    }
  };

  const forceReload = () => {
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
  const [locSectionIcon, setLocSectionIcon] = useState('📍');
  const [isSectionIconSheetOpen, setIsSectionIconSheetOpen] = useState(false);

  // 노출 아이콘 관리용 현재 선택 탭
  const [activeIconsTab, setActiveIconsTab] = useState<'space' | 'storage' | 'section'>('space');

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

        let imageUrl: string | undefined = undefined;
        if (locSectionImageFile) {
          imageUrl = await uploadImage(locSectionImageFile);
        }

        const created = await createSection(locSelectedStorageId, locSectionName.trim(), locSectionIcon, imageUrl);
        createdId = created.id;
        
        const wantContinue = window.confirm(`"${locSectionName}" 세부 위치가 추가되었습니다!\n\n같은 수납처 안에 또 다른 세부 위치(칸/서랍 등)를 계속 추가하시겠습니까?`);
        
        setLocSectionName('');
        setLocSectionIcon('📍');
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
        // 일반 관리 목록 화면으로 복귀
        onChangeSubPage('manage');
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
    if (window.confirm(`"${name}" 공간을 삭제하시겠습니까?\n(하위의 모든 수납처, 세부 위치 및 등록된 물건들이 전면 파괴되며 복구가 불가능합니다!)`)) {
      try {
        await deleteSpace(id);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    }
  };

  const handleDeleteStorage = async (id: string, name: string) => {
    if (window.confirm(`"${name}" 수납처를 삭제하시겠습니까?\n(수납처 내부의 칸/서랍 구조와 물건이 함께 영구 삭제됩니다!)`)) {
      try {
        await deleteStorage(id);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    }
  };

  const handleDeleteSection = async (id: string, name: string) => {
    if (window.confirm(`"${name}" 세부 위치를 삭제하시겠습니까?\n(이 칸에 들어있는 모든 물건 목록이 함께 영구 삭제됩니다!)`)) {
      try {
        await deleteSection(id);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
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
    } else if (subPage === 'manage' || subPage === 'icons') {
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Category A: 보관 환경 관리 */}
            <div style={{ background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
              <span style={{ display: 'block', padding: '16px 20px 8px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.5px' }}>
                보관 환경 설정
              </span>
              
              <div 
                onClick={() => onChangeSubPage('manage')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--toss-blue-light)', color: 'var(--toss-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>보관위치 관리</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>공간, 수납처, 칸/서랍 추가 및 일괄 삭제</span>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>

              <div 
                onClick={() => onChangeSubPage('icons')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--toss-blue-light)', color: 'var(--toss-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckSquare size={18} />
                  </div>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>노출 아이콘 관리</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>1단계(공간) 및 2단계(수납처) 설정 시 선택할 아이콘 활성화</span>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>
            </div>

            {/* Category B: 실시간 기기 동기화 제어 센터 (기존 BottomSheet 기능 통합화) */}
            <div style={{ background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '18px', overflow: 'hidden', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  실시간 다기기 동기화
                </span>
                
                {/* 데이터 보관 모드 선택 */}
                <div style={{ display: 'flex', background: '#f3f4f5', padding: '3px', borderRadius: '12px', gap: '2px', marginBottom: '12px' }}>
                  <button
                    onClick={() => {
                      if (!isSupabaseConfigured) {
                        localStorage.removeItem('wii_force_sandbox');
                        forceReload();
                      }
                    }}
                    disabled={isSupabaseConfigured}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isSupabaseConfigured ? 'default' : 'pointer',
                      background: isSupabaseConfigured ? '#fff' : 'transparent',
                      color: isSupabaseConfigured ? 'var(--toss-blue)' : '#6b7684',
                      boxShadow: isSupabaseConfigured ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    ☁️ 실시간 클라우드
                  </button>
                  <button
                    onClick={() => {
                      if (isSupabaseConfigured) {
                        if (window.confirm('오프라인 전용 Sandbox(로컬) 모드로 전환하시겠습니까?')) {
                          localStorage.setItem('wii_force_sandbox', 'true');
                          forceReload();
                        }
                      }
                    }}
                    disabled={!isSupabaseConfigured}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: !isSupabaseConfigured ? 'default' : 'pointer',
                      background: !isSupabaseConfigured ? '#fff' : 'transparent',
                      color: !isSupabaseConfigured ? 'var(--text-primary)' : '#6b7684',
                      boxShadow: !isSupabaseConfigured ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    💾 로컬 Sandbox
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.4', padding: '0 4px' }}>
                  {isSupabaseConfigured 
                    ? "☁️ Supabase PostgreSQL 실시간 동기화가 가동 중입니다."
                    : "💾 기기 단독 보관 상태입니다 (공유 기능 활성화 불가)."}
                </p>
              </div>

              {/* 가족 공유 연동 폼 */}
              <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '16px' }}>
                {!isSupabaseConfigured ? (
                  <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      로컬 Sandbox 모드에서는 동기화 접속이 불가능합니다.
                    </span>
                    <button
                      onClick={() => {
                        localStorage.removeItem('wii_force_sandbox');
                        forceReload();
                      }}
                      className="btn-secondary"
                      style={{ height: '36px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0 16px' }}
                    >
                      실시간 클라우드로 전환
                    </button>
                  </div>
                ) : groupCode && groupCode !== myOriginalCode ? (
                  /* Client 동기화 연동 접속 상태 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: 'rgba(49, 130, 246, 0.04)', border: '1px solid rgba(49, 130, 246, 0.12)', padding: '14px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--toss-blue)' }}>
                        <CheckCircle2 size={16} />
                        <span style={{ fontSize: '14px', fontWeight: '700' }}>동기화 연동 완료</span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        공유 그룹 코드 <strong style={{ color: 'var(--text-primary)' }}>"{groupCode}"</strong> 님 보관함에 접속하여 실시간 연동 중입니다.
                      </span>
                    </div>

                    <button
                      onClick={async () => {
                        if (window.confirm('동기화를 종료하고 원래 내 고유 보관함으로 복귀하시겠습니까?')) {
                          try {
                            setIsSyncing(true);
                            await loginWithGroupCode(myOriginalCode);
                            forceReload();
                          } catch (err: any) {
                            alert('원래 보관함으로 돌아가지 못했습니다: ' + err.message);
                          } finally {
                            setIsSyncing(false);
                          }
                        }
                      }}
                      className="btn-secondary"
                      style={{ height: '44px', fontSize: '13px', color: 'var(--accent-red)', borderColor: '#ffd1d1', background: '#fff2f2' }}
                    >
                      동기화 접속 종료 (내 원래 보관함으로)
                    </button>
                  </div>
                ) : (
                  /* Host 나의 공유 보관소 코드 제공 및 다른기기 연동 폼 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 나의 고유 연동코드 */}
                    <div style={{ background: '#f8f9fa', padding: '14px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block' }}>나의 공유 코드</span>
                        <strong style={{ fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '0.5px', marginTop: '2px', display: 'block' }}>{groupCode}</strong>
                      </div>
                      <button
                        onClick={() => {
                          if (groupCode) {
                            navigator.clipboard.writeText(groupCode);
                            alert(`공유 코드 "${groupCode}"가 복사되었습니다. 가족 기기에 등록해 보세요!`);
                          }
                        }}
                        style={{ border: 'none', background: 'var(--toss-blue-light)', color: 'var(--toss-blue)', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        코드 복사
                      </button>
                    </div>

                    {/* 타기기 연동 접속 입력 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>상대방 보관소와 연동하기</span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={syncCodeInput}
                          onChange={(e) => { setSyncCodeInput(e.target.value); setSyncError(null); }}
                          placeholder="상대방 공유 코드 입력 (wii-xxxxxx)"
                          className="input-text"
                          style={{ paddingRight: '40px', fontSize: '13px', height: '46px', fontWeight: '600' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && syncCodeInput.trim() && !isSyncing) handleConnectGroupCode();
                          }}
                        />
                        <Link2 size={16} style={{ position: 'absolute', right: '14px', color: 'var(--text-tertiary)' }} />
                      </div>
                      
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
                        style={{ height: '46px', opacity: (!syncCodeInput.trim() || isSyncing) ? 0.6 : 1 }}
                      >
                        {isSyncing ? '상대 보관소 동기화 중...' : '상대 보관소 동기화 접속하기'}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* Factory Reset & Version */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
              <button
                onClick={() => {
                  if (window.confirm('기기의 모든 저장소 캐시와 연동 세션을 지우고 공장 초기화하시겠습니까? (새 보관함이 발급됩니다)')) {
                    localStorage.clear();
                    forceReload();
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}
              >
                🔄 기기 모든 캐시 및 세션 완전 초기화
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: '600', opacity: 0.6 }}>
                where is it . {import.meta.env.VITE_APP_VERSION || 'v00035'}
              </span>
            </div>

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
                                    <img src={st.image_url} alt={st.name} style={{ width: '16px', height: '16px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
                                  ) : (
                                    <EmojiIcon icon={st.icon} size={16} />
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
                                          <img src={se.image_url} alt={se.name} style={{ width: '14px', height: '14px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} />
                                        ) : (
                                          <EmojiIcon icon={se.icon || '📍'} size={14} style={{ flexShrink: 0 }} />
                                        )}
                                        <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                          {se.name}
                                        </span>
                                      </div>
                                      <button 
                                        onClick={() => handleDeleteSection(se.id, se.name)}
                                        style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                      >
                                        <Trash2 size={12} />
                                      </button>
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
                  {locStorageImagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <img src={locStorageImagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => { setLocStorageImageFile(null); setLocStorageImagePreview(null); }}
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
                      <input 
                        ref={storageFileInputRef}
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleStorageImageChange}
                      />
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
                                  <img src={se.image_url} alt={se.name} style={{ width: '12px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                                ) : (
                                  <EmojiIcon icon={se.icon || '📍'} size={12} />
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

                {/* 세부위치 아이콘 선택 */}
                <div>
                  <label className="form-label">세부위치 아이콘 선택</label>
                  <div 
                    onClick={() => setIsSectionIconSheetOpen(true)}
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
                      <EmojiIcon icon={locSectionIcon} size={26} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>아이콘 변경</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>눌러서 이쁜 아이콘이나 이모지를 선택하세요.</span>
                    </div>
                    <ChevronRight size={16} color="var(--text-tertiary)" />
                  </div>
                </div>

                {/* 세부위치 사진 등록/변경 */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px' }}>세부위치 사진 등록</label>
                  {locSectionImagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <img src={locSectionImagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => { setLocSectionImageFile(null); setLocSectionImagePreview(null); }}
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
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>세부위치 사진 찍기 또는 이미지 등록 (선택)</span>
                      <input 
                        ref={sectionFileInputRef}
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleSectionImageChange}
                      />
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

      {/* =========================================================================
          [4] 노출 아이콘 관리 페이지 (subPage === 'icons')
         ========================================================================= */}
      {subPage === 'icons' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <button 
              onClick={handleBackArrow}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="h2-title" style={{ margin: 0 }}>노출 아이콘 관리</h2>
          </div>

          <p className="body-desc" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            1단계(공간), 2단계(수납처) 및 3단계(세부위치) 설정 시 선택할 수 있는 아이콘을 활성화합니다.
          </p>

          {/* 공간/수납처/세부위치 노출 아이콘 탭 선택기 */}
          <div style={{ display: 'flex', background: '#f3f4f5', padding: '3px', borderRadius: '12px', gap: '2px', marginBottom: '16px' }}>
            {(['space', 'storage', 'section'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveIconsTab(tab)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeIconsTab === tab ? '#fff' : 'transparent',
                  color: activeIconsTab === tab ? 'var(--toss-blue)' : '#6b7684',
                  boxShadow: activeIconsTab === tab ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {tab === 'space' && '공간 (1단계)'}
                {tab === 'storage' && '수납처 (2단계)'}
                {tab === 'section' && '세부위치 (3단계)'}
              </button>
            ))}
          </div>

          {/* 새 아이콘 업로드 섹션 */}
          <div style={{ 
            background: '#fff', 
            border: '1px solid var(--border-medium)', 
            borderRadius: '16px', 
            padding: '16px', 
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              나만의 커스텀 아이콘 등록 (모든 단계 공유)
            </span>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              background: 'var(--toss-blue-light)', 
              color: 'var(--toss-blue)', 
              padding: '12px 24px', 
              borderRadius: '12px', 
              fontSize: '14px', 
              fontWeight: '700', 
              cursor: 'pointer',
              width: '100%',
              maxWidth: '280px',
              transition: 'opacity 0.2s',
              opacity: isUploading ? 0.6 : 1,
              pointerEvents: isUploading ? 'none' : 'auto'
            }}>
              <Plus size={16} /> 
              {isUploading ? '업로드 중...' : '새 아이콘 업로드'}
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadIcon(e.target.files[0]);
                  }
                }} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            {/* 1. 업로드된 아이콘 그룹 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700' }}>업로드된 아이콘</span>
              {uploadedIcons.length === 0 ? (
                <div style={{ padding: '24px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-medium)', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  업로드된 아이콘이 없습니다. 위 버튼으로 아이콘을 업로드해보세요!
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', 
                  gap: '10px'
                }}>
                  {uploadedIcons.map(item => {
                    const path = item.url;
                    const isActive = activeIconsTab === 'space'
                      ? !disabledSpaceIcons.includes(path)
                      : activeIconsTab === 'storage'
                        ? !disabledStorageIcons.includes(path)
                        : !disabledSectionIcons.includes(path);

                    const handleToggle = () => {
                      if (activeIconsTab === 'space') handleToggleSpaceIcon(path);
                      else if (activeIconsTab === 'storage') handleToggleStorageIcon(path);
                      else handleToggleSectionIcon(path);
                    };

                    return (
                      <div 
                        key={item.id}
                        onClick={handleToggle}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '12px 8px',
                          background: '#fff',
                          border: isActive ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                          borderRadius: '16px',
                          position: 'relative',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {/* Delete button (only for user uploaded) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUploadedIcon(path);
                          }}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: '#f2f4f6',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--accent-red)',
                            zIndex: 2
                          }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>

                        {/* Icon Display */}
                        <div style={{
                          width: '38px',
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--bg-subtle)',
                          borderRadius: '10px',
                          border: '1px solid var(--border-subtle)',
                          marginBottom: '8px'
                        }}>
                          <EmojiIcon icon={path} size={24} />
                        </div>

                        {/* Toggle Checkbox */}
                        <span style={{ fontSize: '11px', color: isActive ? 'var(--toss-blue)' : 'var(--text-secondary)', fontWeight: isActive ? '600' : '400', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input 
                            type="checkbox"
                            checked={isActive}
                            readOnly
                            style={{ width: '12px', height: '12px', accentColor: 'var(--toss-blue)', cursor: 'pointer' }}
                          />
                          선택
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. 기본 내장 아이콘 그룹 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700' }}>기본 내장 아이콘</span>
              {(() => {
                const builtInIcons = activeIconsTab === 'space'
                  ? [...customSpaceIcons, ...SPACE_EMOJI_OPTIONS]
                  : activeIconsTab === 'storage'
                    ? [...customStorageIcons, ...STORAGE_EMOJI_OPTIONS]
                    : SECTION_EMOJI_OPTIONS;

                return (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', 
                    gap: '10px'
                  }}>
                    {builtInIcons.map(path => {
                      const isActive = activeIconsTab === 'space'
                        ? !disabledSpaceIcons.includes(path)
                        : activeIconsTab === 'storage'
                          ? !disabledStorageIcons.includes(path)
                          : !disabledSectionIcons.includes(path);

                      const handleToggle = () => {
                        if (activeIconsTab === 'space') handleToggleSpaceIcon(path);
                        else if (activeIconsTab === 'storage') handleToggleStorageIcon(path);
                        else handleToggleSectionIcon(path);
                      };

                      return (
                        <div 
                          key={path}
                          onClick={handleToggle}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '12px 8px',
                            background: '#fff',
                            border: isActive ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                            borderRadius: '16px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {/* Icon Display */}
                          <div style={{
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--bg-subtle)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                            marginBottom: '8px'
                          }}>
                            <EmojiIcon icon={path} size={24} />
                          </div>

                          {/* Toggle Checkbox */}
                          <span style={{ fontSize: '11px', color: isActive ? 'var(--toss-blue)' : 'var(--text-secondary)', fontWeight: isActive ? '600' : '400', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                              type="checkbox"
                              checked={isActive}
                              readOnly
                              style={{ width: '12px', height: '12px', accentColor: 'var(--toss-blue)', cursor: 'pointer' }}
                            />
                            선택
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          <button
            onClick={() => onChangeSubPage('main')}
            className="btn-primary"
            style={{ height: '52px' }}
          >
            설정 완료
          </button>
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

      {/* 7. 세부위치 아이콘 선택 바텀시트 모달 */}
      <BottomSheet
        isOpen={isSectionIconSheetOpen}
        onClose={() => setIsSectionIconSheetOpen(false)}
        title="세부위치 아이콘 선택"
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
              <EmojiIcon icon={locSectionIcon} size={40} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>현재 선택됨</span>
          </div>

          {/* 활성화된 전체 아이콘 영역 */}
          {visibleSectionIcons.length > 0 ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {visibleSectionIcons.map(path => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setLocSectionIcon(path);
                      setIsSectionIconSheetOpen(false);
                    }}
                    style={{
                      border: locSectionIcon === path ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                      background: locSectionIcon === path ? 'var(--toss-blue-light)' : '#fff',
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
    </div>
  );
};

export default SettingsTab;
