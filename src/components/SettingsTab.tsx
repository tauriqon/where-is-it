import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../supabase';
import { 
  Settings, MapPin, ChevronRight, ChevronDown, ArrowLeft, Plus, Trash2, 
  Link2, CheckCircle2, AlertCircle, Loader2 
} from 'lucide-react';
import EmojiIcon from './EmojiIcon';

interface SettingsTabProps {
  subPage: 'main' | 'manage' | 'add';
  onChangeSubPage: (subPage: 'main' | 'manage' | 'add') => void;
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
    deleteSpace, deleteStorage, deleteSection 
  } = useData();

  const { user, loginWithGroupCode, myOriginalCode } = useAuth();

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

  // 2-3) 세부위치 추가용
  const [locSelectedStorageSpaceId, setLocSelectedStorageSpaceId] = useState('');
  const [locSelectedStorageId, setLocSelectedStorageId] = useState('');
  const [locSectionName, setLocSectionName] = useState('');

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
        const created = await createStorage(locSelectedSpaceId, locStorageName.trim(), locStorageIcon);
        createdId = created.id;
        
        const wantContinue = window.confirm(`"${locStorageName}" 수납처가 추가되었습니다!\n\n이 수납처 안에 세부 위치(3단계: 칸/서랍 등)를 바로 이어서 추가하시겠습니까?`);
        
        setLocStorageName('');
        setLocStorageIcon('📦');
        
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
        const created = await createSection(locSelectedStorageId, locSectionName.trim());
        createdId = created.id;
        
        const wantContinue = window.confirm(`"${locSectionName}" 세부 위치가 추가되었습니다!\n\n같은 수납처 안에 또 다른 세부 위치(칸/서랍 등)를 계속 추가하시겠습니까?`);
        
        setLocSectionName('');
        
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
    } else if (subPage === 'manage') {
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
                where is it . {import.meta.env.VITE_APP_VERSION || 'v00029'}
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
                                  <EmojiIcon icon={st.icon} size={16} />
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
                                      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                        📍 {se.name}
                                      </span>
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
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(8, minmax(36px, 1fr))', 
                    gap: '6px', 
                    padding: '6px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-medium)'
                  }}>
                    {SPACE_EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setLocSpaceIcon(emoji)}
                        style={{
                          fontSize: '20px',
                          border: locSpaceIcon === emoji ? '2px solid var(--toss-blue)' : '1px solid transparent',
                          background: locSpaceIcon === emoji ? '#fff' : 'transparent',
                          borderRadius: '8px',
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <EmojiIcon icon={emoji} size={20} />
                      </button>
                    ))}
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
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, minmax(40px, 1fr))', 
                    gap: '8px', 
                    padding: '6px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-medium)'
                  }}>
                    {STORAGE_EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setLocStorageIcon(emoji)}
                        style={{
                          fontSize: '20px',
                          border: locStorageIcon === emoji ? '2px solid var(--toss-blue)' : '1px solid transparent',
                          background: locStorageIcon === emoji ? '#fff' : 'transparent',
                          borderRadius: '8px',
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <EmojiIcon icon={emoji} size={20} />
                      </button>
                    ))}
                  </div>
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
                                <span>📍</span>
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
    </div>
  );
};

export default SettingsTab;
