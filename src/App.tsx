import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { Home, Layers, Plus, Search, CheckCircle2, Settings } from 'lucide-react';
import { isSupabaseConfigured } from './supabase';
import HomeTab from './components/HomeTab';
import ExploreTab from './components/ExploreTab';
import AddTab from './components/AddTab';
import SearchTab from './components/SearchTab';
import SettingsTab from './components/SettingsTab';
import BottomSheet from './components/BottomSheet';
import { graniteEvent, closeView, generateHapticFeedback } from '@apps-in-toss/web-framework';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'v00083';

const isTossInApp = typeof window !== 'undefined' && (
  window.navigator.userAgent.toLowerCase().includes('toss') ||
  new URLSearchParams(window.location.search).get('platform') === 'toss'
);

export const triggerHaptic = (
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

const AppContent: React.FC = () => {
  const { user, loading: authLoading, authError, activeGroup, myGroups, switchActiveGroup } = useAuth();
  const { dbError } = useData();
  
  // 5대 탭 통합 정의
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'add' | 'search' | 'settings'>(() => {
    return (localStorage.getItem('wii_active_tab') as any) || 'home';
  });
  
  // 설정 탭 내부의 하브 페이지 상태 관리 ('main' | 'manage' | 'add' | 'icons' | 'sync' | 'expiration' | 'reset')
  const [settingsSubPage, setSettingsSubPage] = useState<'main' | 'manage' | 'add' | 'icons' | 'sync' | 'expiration' | 'reset'>(() => {
    return (localStorage.getItem('wii_settings_subpage') as any) || 'main';
  });

  const handleSettingsSubPageChange = (subPage: 'main' | 'manage' | 'add' | 'icons' | 'sync' | 'expiration' | 'reset') => {
    setSettingsSubPage(subPage);
    localStorage.setItem('wii_settings_subpage', subPage);
  };

  // 연동 및 공유 관련 상태 (헤더 알약용 퀵모달)
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  const groupCode = activeGroup?.code || null;
  
  // 종료 확인 모달 관련 상태
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const handleBackAction = () => {
    if (activeTab === 'settings' && settingsSubPage !== 'main') {
      handleSettingsSubPageChange('main');
      return;
    }
    if (activeTab !== 'home') {
      handleNavigateTab('home');
      return;
    }
    triggerHaptic('error');
    setIsExitModalOpen(true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let unsubscription: (() => void) | null = null;
    try {
      unsubscription = graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          handleBackAction();
        },
        onError: (err: any) => {
          console.error('Toss SDK backEvent error:', err);
        }
      });
    } catch (e) {
      console.warn('Toss SDK not available or failed to register backEvent:', e);
    }

    return () => {
      if (unsubscription) {
        try {
          unsubscription();
        } catch (e) {
          console.error('Toss SDK unsubscription error:', e);
        }
      }
    };
  }, [activeTab, settingsSubPage]);
  
  const forceReload = (resetTab = false) => {
    if (resetTab) {
      localStorage.setItem('wii_active_tab', 'home');
      localStorage.setItem('wii_settings_subpage', 'main');
    }
    const url = new URL(window.location.href);
    url.searchParams.set('t', Date.now().toString());
    window.location.href = url.toString();
  };
  
  // 탭 간 데이터 전달용 파라미터 상태
  const [exploreParams, setExploreParams] = useState<{
    spaceId?: string | null;
    storageId?: string | null;
    sectionId?: string | null;
    selectedItemId?: string | null;
  } | null>(null);

  const handleNavigateTab = (
    tab: 'home' | 'explore' | 'add' | 'search' | 'settings', 
    params: any = null
  ) => {
    triggerHaptic('basicMedium');
    // 모바일 포커스 아웃 버그 강제 차단
    if (document.activeElement && 'blur' in document.activeElement) {
      try {
        (document.activeElement as HTMLElement).blur();
      } catch (e) {
        console.error('Focus blur error:', e);
      }
    }

    if (tab === 'explore' && params) {
      setExploreParams(params);
    }

    let sub = 'main';
    // 설정 탭 내부 서브 라우팅 연계
    if (tab === 'settings') {
      if (params && params.subPage) {
        sub = params.subPage;
        setSettingsSubPage(params.subPage);
      } else {
        setSettingsSubPage('main');
      }
    }

    setActiveTab(tab);
    localStorage.setItem('wii_active_tab', tab);
    localStorage.setItem('wii_settings_subpage', sub);
  };

  const handleClearExploreParams = () => {
    setExploreParams(null);
  };

  // 1. Auth 로딩 중 렌더링 (초기 세션 확인 시에만 전체 화면 로딩을 띄움)
  if (authLoading && !user) {
    return (
      <div className="app-wrapper">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-app)', height: '100%', width: '100%' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--toss-blue-light)', borderTopColor: 'var(--toss-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '17px', color: 'var(--text-secondary)', fontWeight: '600' }}>사용자 세션 확인 중...</span>
        </div>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // 2. Auth 초기 연동 에러 렌더링 (익명 로그인 유도)
  if (authError && !user) {
    return (
      <div className="app-wrapper">
        <div className="scrollable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', minHeight: '100%', paddingBottom: '30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '53px' }}>🛠️</span>
            <h2 className="h2-title" style={{ marginTop: '16px', fontSize: '22px' }}>Supabase 설정이 필요해요</h2>
          </div>

          <div style={{ background: '#fff2f2', border: '1px solid #ffd1d1', padding: '16px', borderRadius: '12px', color: 'var(--accent-red)', fontSize: '14px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            <strong>Error Details:</strong><br />
            {authError}
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>💡 해결 방법 (익명 로그인 켜기):</p>
            <ol style={{ paddingLeft: '20px' }}>
              <li>Supabase 대시보드 ➔ <strong>Authentication</strong> ➔ <strong>Providers</strong> ➔ <strong>Anonymous</strong> 메뉴로 이동합니다.</li>
              <li><strong>Allow Anonymous Sign-ins</strong> 옵션을 활성화(ON)하고 <strong>Save</strong>를 누릅니다.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={() => forceReload()}
              className="btn-primary"
              style={{ minHeight: '52px', height: 'auto' }}
            >
              다시 시도하기
            </button>
            
            <button 
              onClick={() => {
                localStorage.setItem('wii_force_sandbox', 'true');
                forceReload(true);
              }}
              className="btn-secondary"
              style={{ minHeight: '52px', height: 'auto' }}
            >
              임시로 Sandbox(로컬) 모드로 실행하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Database 테이블 누락 에러 렌더링 (SQL Editor 유도)
  if (dbError && user) {
    return (
      <div className="app-wrapper">
        <div className="scrollable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', minHeight: '100%', paddingBottom: '30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '53px' }}>🛠️</span>
            <h2 className="h2-title" style={{ marginTop: '16px', fontSize: '22px' }}>테이블 생성 확인이 필요해요</h2>
          </div>

          <div style={{ background: '#fff2f2', border: '1px solid #ffd1d1', padding: '16px', borderRadius: '12px', color: 'var(--accent-red)', fontSize: '14px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            <strong>Error Details:</strong><br />
            {dbError}
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>💡 해결 방법 (SQL Editor 실행):</p>
            <ol style={{ paddingLeft: '20px' }}>
              <li>루트 폴더의 <strong>[supabase/schema.sql]</strong> 파일 내용을 전체 복사합니다.</li>
              <li>Supabase 대시보드 ➔ <strong>SQL Editor</strong>로 이동하여 새로운 Query 창을 엽니다.</li>
              <li>복사한 내용을 붙여넣고 <strong>Run</strong>을 눌러 실행합니다.</li>
              <li>완료 후 아래의 [다시 불러오기] 버튼을 눌러 연동을 확인합니다.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={() => forceReload()}
              className="btn-primary"
              style={{ minHeight: '52px', height: 'auto' }}
            >
              다시 불러오기
            </button>
            
            <button 
              onClick={() => {
                localStorage.setItem('wii_force_sandbox', 'true');
                forceReload(true);
              }}
              className="btn-secondary"
              style={{ minHeight: '52px', height: 'auto' }}
            >
              임시로 Sandbox(로컬) 모드로 실행하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      
      {/* 1. 최상단 앱 상태 헤더 */}
      {!isTossInApp && (
        <header 
          style={{
            padding: '16px 20px 8px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-app)',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
              where is it <span style={{ color: 'var(--toss-blue)' }}>?</span>
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Toss Premium UI: 통합 연동 및 공유 관리 단일 알약 버튼 */}
            {activeGroup && user && activeGroup.owner_id !== user.id ? (
              <button 
                onClick={() => handleNavigateTab('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#e8f3ff',
                  color: 'var(--toss-blue)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: '0 2px 6px rgba(49, 130, 246, 0.08)',
                  maxWidth: '140px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dbeeff'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e8f3ff'}
                title={`${groupCode} 공유됨 (설정 탭으로 이동)`}
              >
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#2cd07e', marginRight: '2px', flexShrink: 0 }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  {groupCode} 공유됨
                </span>
              </button>
            ) : isSupabaseConfigured ? (
              <button 
                onClick={() => handleNavigateTab('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#e6f9ee',
                  color: '#1f8b4c',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  maxWidth: '140px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d2f6e2'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e6f9ee'}
                title="실시간 클라우드 (설정 탭으로 이동)"
              >
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#2cd07e', marginRight: '2px', flexShrink: 0 }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  실시간 클라우드
                </span>
              </button>
            ) : (
              <button 
                onClick={() => handleNavigateTab('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#f3f4f5',
                  color: '#6b7684',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  maxWidth: '140px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e8eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f5'}
                title="Sandbox (로컬) (설정 탭으로 이동)"
              >
                <Settings size={12} style={{ flexShrink: 0 }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  Sandbox (로컬)
                </span>
              </button>
            )}
          </div>
        </header>
      )}
 
      {/* 2. 스크롤 뷰포트 영역 */}
      <main className="scrollable safe-top">
        {activeTab === 'home' && <HomeTab onNavigateTab={handleNavigateTab} />}
        {activeTab === 'explore' && (
          <ExploreTab 
            initialParams={exploreParams} 
            onClearParams={handleClearExploreParams} 
            onZoomImage={setZoomedImageUrl}
          />
        )}
        {activeTab === 'add' && <AddTab onNavigateTab={handleNavigateTab} />}
        {activeTab === 'search' && (
          <SearchTab 
            onNavigateTab={handleNavigateTab} 
            onZoomImage={setZoomedImageUrl}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab 
            subPage={settingsSubPage}
            onChangeSubPage={handleSettingsSubPageChange}
            onNavigateTab={handleNavigateTab}
          />
        )}
      </main>
 
      {/* 3. 하단 네비게이션 탭 바 (Toss Premium CSS - 5대 탭 배치) */}
      <nav 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          minHeight: '68px', height: 'auto',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100
        }}
      >
        {/* 홈 탭 */}
        <button
          onClick={() => handleNavigateTab('home')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: activeTab === 'home' ? 'var(--toss-blue)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            flex: 1,
            transition: 'color var(--transition-fast)'
          }}
        >
          <Home size={20} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'home' ? '600' : '400' }}>홈</span>
        </button>
 
        {/* 탐색 탭 */}
        <button
          onClick={() => handleNavigateTab('explore')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: activeTab === 'explore' ? 'var(--toss-blue)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            flex: 1,
            transition: 'color var(--transition-fast)'
          }}
        >
          <Layers size={20} strokeWidth={activeTab === 'explore' ? 2.5 : 2} />
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'explore' ? '600' : '400' }}>위치 탐색</span>
        </button>
 
        {/* 등록 탭 */}
        <button
          onClick={() => handleNavigateTab('add')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: activeTab === 'add' ? 'var(--toss-blue)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            flex: 1,
            transition: 'color var(--transition-fast)'
          }}
        >
          <div 
            style={{
              width: '36px',
              minHeight: '36px', height: 'auto',
              borderRadius: '50%',
              background: activeTab === 'add' ? 'var(--toss-blue)' : 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeTab === 'add' ? '#fff' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
              boxShadow: activeTab === 'add' ? '0 4px 12px rgba(49, 130, 246, 0.3)' : 'none'
            }}
          >
            <Plus size={18} strokeWidth={3} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'add' ? '600' : '400', marginTop: '-2px' }}>등록</span>
        </button>
 
        {/* 검색 탭 */}
        <button
          onClick={() => handleNavigateTab('search')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: activeTab === 'search' ? 'var(--toss-blue)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            flex: 1,
            transition: 'color var(--transition-fast)'
          }}
        >
          <Search size={20} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'search' ? '600' : '400' }}>검색</span>
        </button>

        {/* 설정 탭 */}
        <button
          onClick={() => handleNavigateTab('settings')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: activeTab === 'settings' ? 'var(--toss-blue)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            flex: 1,
            transition: 'color var(--transition-fast)'
          }}
        >
          <Settings size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'settings' ? '600' : '400' }}>설정</span>
        </button>
 
      </nav>
 
      <BottomSheet 
        isOpen={isSyncSettingsOpen} 
        onClose={() => {
          setIsSyncSettingsOpen(false);
        }} 
        title="연동 및 공유 설정"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '8px 4px' }}>
          
          <div>
            <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              데이터 보관 모드
            </span>
            <div style={{ display: 'flex', background: '#f3f4f5', padding: '3px', borderRadius: '12px', gap: '2px', marginBottom: '12px' }}>
              <button
                onClick={() => {
                  if (!isSupabaseConfigured) {
                    if (window.confirm('실시간 클라우드 모드로 전환하시겠습니까?\n\n※ 데이터를 안전하게 백업하고 여러 기기에서 실시간 동기화 및 공유를 사용할 수 있게 됩니다.')) {
                      localStorage.removeItem('wii_force_sandbox');
                      forceReload();
                    }
                  }
                }}
                disabled={isSupabaseConfigured}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
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
                    if (window.confirm('오프라인 전용 Sandbox(로컬) 모드로 전환하시겠습니까?\n\n※ 로컬 Sandbox의 데이터는 브라우저 삭제 시 소실 위험이 있는 "체험용 임시 데이터"입니다. 집안의 중요한 물건 위치를 오래 안전하게 관리하시려면 실시간 클라우드 모드를 사용해 주세요.')) {
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
                  fontSize: '14px',
                  fontWeight: '600',
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
            
            {/* 데이터 보관 모드 주의 및 안내 배너 */}
            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-medium)',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                💡 데이터 보관 모드 안내
              </p>
              <p style={{ margin: 0 }}>
                집안의 중요한 물건 위치를 오래 보관하고 안전하게 관리하시려면, 로컬 Sandbox는 <strong>"앱이 어떻게 작동하는지 체험해 보는 테스트 모드"</strong> 정도로 생각하시고 실제 사용 시에는 <strong>실시간 클라우드 모드</strong>를 사용해 주세요.
              </p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              가족 및 기기 공유
            </span>
 
            {!isSupabaseConfigured ? (
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', textAlign: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: '500' }}>
                  로컬 Sandbox 상태에서는 실시간 기기 연동이 불가능합니다.
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem('wii_force_sandbox');
                    forceReload();
                  }}
                  className="btn-secondary"
                  style={{ minHeight: '40px', height: 'auto', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  실시간 클라우드 모드로 전환하기
                </button>
              </div>
            ) : activeGroup && user && activeGroup.owner_id !== user.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(49, 130, 246, 0.05)', border: '1px solid rgba(49, 130, 246, 0.15)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--toss-blue)' }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: '17px', fontWeight: '700' }}>다른 기기와 동기화 중</span>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    현재 공유 번호 <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>"{groupCode}"</strong> 기기 보관함에 접속하여 실시간 동기화 중입니다.
                  </div>
                </div>
 
                <button
                  onClick={async () => {
                    if (window.confirm('공유 동기화를 종료하고 원래 내 고유 보관함으로 돌아가시겠습니까?')) {
                      try {
                        const defaultGroup = myGroups.find(g => g.owner_id === user.id);
                        if (defaultGroup) {
                          await switchActiveGroup(defaultGroup.id);
                        } else {
                          throw new Error('내 고유 보관함을 찾을 수 없습니다.');
                        }
                        setIsSyncSettingsOpen(false);
                        forceReload();
                      } catch (err: any) {
                        alert('원래 보관함으로 돌아가지 못했습니다: ' + err.message);
                      }
                    }
                  }}
                  className="btn-secondary"
                  style={{ minHeight: '48px', height: 'auto', fontSize: '14px', color: 'var(--accent-red)', borderColor: '#ffd1d1', background: '#fff2f2' }}
                >
                  공유 접속 종료 (내 보관함으로 복귀)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>
                      나의 실시간 공유 코드
                    </span>
                    <strong style={{ fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                      {groupCode}
                    </strong>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (groupCode) {
                        navigator.clipboard.writeText(groupCode);
                        alert(`공유 코드 "${groupCode}"가 복사되었습니다. 가족에게 전달해 함께 연동해 보세요!`);
                      }
                    }}
                    className="btn-secondary"
                    style={{ minHeight: '40px', height: 'auto', fontSize: '14px', background: '#fff', border: '1px solid #e5e8eb' }}
                  >
                    공유 코드 복사하기
                  </button>
                </div>
 
                <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>
                    다른 기기의 공유 코드로 접속하기
                  </span>
                  
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    가족 공유 보관소에 가입 신청을 하고 소유자의 승인을 받아서 연동할 수 있습니다.
                  </p>

                  <button
                    onClick={() => {
                      setIsSyncSettingsOpen(false);
                      setActiveTab('settings');
                      setSettingsSubPage('sync');
                    }}
                    className="btn-primary"
                    style={{
                      minHeight: '48px', height: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    공유 보관소 가입 신청/관리 바로가기
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (window.confirm('기기의 모든 공유 설정과 고유 번호를 완전 삭제하고 공장 초기화하시겠습니까? (로컬 저장소가 모두 비워지고 새로운 보관함이 발급됩니다)')) {
                  localStorage.clear();
                  forceReload(true);
                }
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
            >
              🔄 기기 공유 세션 및 데이터 전체 초기화 (처음 상태로)
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', opacity: 0.7, letterSpacing: '0.5px', marginTop: '2px' }}>
              where is it . {APP_VERSION}
            </span>
          </div>
          
        </div>
      </BottomSheet>
 
      {/* 4. 토스 미니앱 전용 종료 확인 모달 */}
      {isExitModalOpen && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.48)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
          onClick={() => setIsExitModalOpen(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '320px',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px 20px 24px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              animation: 'tossModalPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '28px', wordBreak: 'keep-all', lineHeight: '1.4' }}>
              어디 뒀더라?를 종료할까요?
            </span>
            
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                onClick={() => {
                  triggerHaptic('basicMedium');
                  setIsExitModalOpen(false);
                }}
                className="btn-secondary"
                style={{
                  flex: 1,
                  minHeight: '48px', height: 'auto',
                  background: '#f2f4f6',
                  color: 'var(--text-secondary)',
                  borderRadius: '14px',
                  border: 'none',
                  fontSize: '17px',
                  fontWeight: '600',
                  margin: 0,
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
              <button 
                onClick={() => {
                  triggerHaptic('basicMedium');
                  try {
                    closeView();
                  } catch (e) {
                    console.warn('Failed to call closeView:', e);
                    setIsExitModalOpen(false);
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: '48px', height: 'auto',
                  background: '#ff4d4f',
                  color: '#ffffff',
                  borderRadius: '14px',
                  border: 'none',
                  fontSize: '17px',
                  fontWeight: '600',
                  margin: 0,
                  cursor: 'pointer'
                }}
              >
                종료하기
              </button>
            </div>
          </div>
          <style>{`
            @keyframes tossModalPop {
              from { transform: scale(0.9) translateY(10px); opacity: 0; }
              to { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {zoomedImageUrl && (
        <div 
          onClick={() => setZoomedImageUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            backdropFilter: 'blur(4px)'
          }}
        >
          <img 
            src={zoomedImageUrl} 
            alt="Magnified View" 
            style={{
              maxWidth: '95%',
              maxHeight: '85%',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4)',
              animation: 'tossModalPop var(--transition-bounce) forwards'
            }} 
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImageUrl(null);
            }}
            style={{
              position: 'absolute',
              top: 'max(20px, env(safe-area-inset-top))',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.25)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
 
function App() {
  React.useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (window.matchMedia('(max-width: 768px)').matches) ||
                     (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
    
    if (!isMobile) {
      document.body.classList.add('desktop-simulator');
    } else {
      document.body.classList.remove('desktop-simulator');
    }
    
    return () => {
      document.body.classList.remove('desktop-simulator');
    };
  }, []);
 
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
 
export default App;



