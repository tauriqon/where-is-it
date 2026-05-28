import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { Home, Layers, Plus, Search, Link2, CheckCircle2, Settings, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from './supabase';
import HomeTab from './components/HomeTab';
import ExploreTab from './components/ExploreTab';
import AddTab from './components/AddTab';
import SearchTab from './components/SearchTab';
import BottomSheet from './components/BottomSheet';

const APP_VERSION = 'v00007';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, authError, myOriginalCode, loginWithGroupCode } = useAuth();
  const { dbError } = useData();
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'add' | 'search'>('home');
  
  // 연동 및 공유 관련 상태 추가
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 이메일 주소에서 공유 그룹 코드를 간편하게 파싱
  const getGroupCode = (email?: string) => {
    if (!email) return null;
    if (email.endsWith('-wii@gmail.com')) {
      return email.split('-wii@gmail.com')[0];
    }
    if (email.endsWith('@local-group.com')) {
      return email.split('@')[0];
    }
    // 사용자가 실제 이메일을 공유 코드로 입력한 경우, 그 이메일 그대로 반환
    return email;
  };

  const groupCode = getGroupCode(user?.email);

  // 그룹 코드 동기화 처리
  const handleConnectGroupCode = async () => {
    const code = syncCodeInput.trim();
    if (!code) return;
    try {
      setIsSyncing(true);
      setSyncError(null);
      await loginWithGroupCode(code);
      setIsSyncSettingsOpen(false);
      setSyncCodeInput('');
      // 강제 리로드하여 최신 DB 데이터를 Supabase로부터 온전히 새로고침
      forceReload();
    } catch (err: any) {
      console.error('Failed to sync code:', err);
      setSyncError(err.message || '공유 그룹에 연동하지 못했습니다. 코드를 다시 확인해 주세요.');
    } finally {
      setIsSyncing(false);
    }
  };
  
  // 모바일 기기의 강력한 웹뷰 캐시를 완전히 깨고 최신 소스 코드를 불러오도록 주입하는 강제 강도 높은 리로드 헬퍼
  const forceReload = () => {
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
    tab: 'home' | 'explore' | 'add' | 'search', 
    params: any = null
  ) => {
    // 모바일 iOS Safari 등에서 포커스된 인풋이 언마운트될 때 뷰포트 배율이 고착/왜곡되어
    // 화면 크기가 지멋대로 쪼그라드는 브라우저 가상 키보드 버그를 원천 방지하기 위해
    // 탭 전환 직전 포커스된 요소가 있다면 즉시 강제 포커스 아웃(blur) 처리합니다.
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
    setActiveTab(tab);
  };

  const handleClearExploreParams = () => {
    setExploreParams(null);
  };

  // 1. Auth 로딩 중 렌더링
  if (authLoading) {
    return (
      <div className="app-wrapper">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-app)', height: '100%', width: '100%' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--toss-blue-light)', borderTopColor: 'var(--toss-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '600' }}>사용자 세션 확인 중...</span>
        </div>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // 2. Auth 초기 연동 에러 렌더링 (예: Supabase Anonymous Auth 미활성화 시 해결법 제공)
  if (authError && !user) {
    return (
      <div className="app-wrapper">
        <div className="scrollable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', minHeight: '100%', paddingBottom: '30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '48px' }}>🛠️</span>
            <h2 className="h2-title" style={{ marginTop: '16px', fontSize: '20px' }}>Supabase 설정이 필요해요</h2>
          </div>

          <div style={{ background: '#fff2f2', border: '1px solid #ffd1d1', padding: '16px', borderRadius: '12px', color: 'var(--accent-red)', fontSize: '13px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            <strong>Error Details:</strong><br />
            {authError}
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>💡 해결 방법 (익명 로그인 켜기):</p>
            <ol style={{ paddingLeft: '20px' }}>
              <li>Supabase 대시보드 ➔ <strong>Authentication</strong> ➔ <strong>Providers</strong> ➔ <strong>Anonymous</strong> 메뉴로 이동합니다.</li>
              <li><strong>Allow Anonymous Sign-ins</strong> 옵션을 활성화(ON)하고 <strong>Save</strong>를 누릅니다.</li>
              <li>다시 아래의 [다시 시도하기] 버튼을 눌러 연동을 확인합니다.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={() => forceReload()}
              className="btn-primary"
              style={{ height: '52px' }}
            >
              다시 시도하기
            </button>
            
            <button 
              onClick={() => {
                localStorage.setItem('wii_force_sandbox', 'true');
                forceReload();
              }}
              className="btn-secondary"
              style={{ height: '52px' }}
            >
              임시로 Sandbox(로컬) 모드로 실행하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Database 테이블 누락 에러 렌더링 (예: schema.sql 미실행 시 해결법 제공)
  if (dbError && user) {
    return (
      <div className="app-wrapper">
        <div className="scrollable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', minHeight: '100%', paddingBottom: '30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '48px' }}>🛠️</span>
            <h2 className="h2-title" style={{ marginTop: '16px', fontSize: '20px' }}>테이블 생성 확인이 필요해요</h2>
          </div>

          <div style={{ background: '#fff2f2', border: '1px solid #ffd1d1', padding: '16px', borderRadius: '12px', color: 'var(--accent-red)', fontSize: '13px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            <strong>Error Details:</strong><br />
            {dbError}
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
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
              style={{ height: '52px' }}
            >
              다시 불러오기
            </button>
            
            <button 
              onClick={() => {
                localStorage.setItem('wii_force_sandbox', 'true');
                forceReload();
              }}
              className="btn-secondary"
              style={{ height: '52px' }}
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
          <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
            where is it <span style={{ color: 'var(--toss-blue)' }}>.</span>
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Toss Premium UI: 통합 연동 및 공유 관리 단일 알약 버튼 */}
          {groupCode && groupCode !== myOriginalCode ? (
            <button 
              onClick={() => setIsSyncSettingsOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#e8f3ff',
                color: 'var(--toss-blue)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: '0 2px 6px rgba(49, 130, 246, 0.08)',
                maxWidth: '140px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#dbeeff'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#e8f3ff'}
              title={`${groupCode} 공유됨 (연동 설정 보기)`}
            >
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#2cd07e', marginRight: '2px', flexShrink: 0 }} />
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                {groupCode} 공유됨
              </span>
            </button>
          ) : isSupabaseConfigured ? (
            <button 
              onClick={() => setIsSyncSettingsOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#e6f9ee',
                color: '#1f8b4c',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                maxWidth: '140px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d2f6e2'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#e6f9ee'}
              title="실시간 클라우드 (연동 설정 보기)"
            >
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#2cd07e', marginRight: '2px', flexShrink: 0 }} />
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                실시간 클라우드
              </span>
            </button>
          ) : (
            <button 
              onClick={() => setIsSyncSettingsOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f3f4f5',
                color: '#6b7684',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                maxWidth: '140px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e5e8eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f5'}
              title="Sandbox (로컬) (연동 설정 보기)"
            >
              <Settings size={12} style={{ flexShrink: 0 }} />
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                Sandbox (로컬)
              </span>
            </button>
          )}
        </div>
      </header>

      {/* 2. 스크롤 뷰포트 영역 */}
      <main className="scrollable safe-top">
        {activeTab === 'home' && <HomeTab onNavigateTab={handleNavigateTab} />}
        {activeTab === 'explore' && (
          <ExploreTab 
            initialParams={exploreParams} 
            onClearParams={handleClearExploreParams} 
          />
        )}
        {activeTab === 'add' && <AddTab onNavigateTab={handleNavigateTab} />}
        {activeTab === 'search' && <SearchTab onNavigateTab={handleNavigateTab} />}
      </main>

      {/* 3. 하단 네비게이션 탭 바 (Toss Premium CSS) */}
      <nav 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '68px',
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
          <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
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
          <Layers size={22} strokeWidth={activeTab === 'explore' ? 2.5 : 2} />
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
              width: '38px',
              height: '38px',
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
            <Plus size={20} strokeWidth={3} />
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
          <Search size={22} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'search' ? '600' : '400' }}>검색</span>
        </button>

      </nav>

      {/* 4. Toss Style 연동 및 공유 설정 BottomSheet */}
      <BottomSheet 
        isOpen={isSyncSettingsOpen} 
        onClose={() => {
          setIsSyncSettingsOpen(false);
          setSyncError(null);
        }} 
        title="연동 및 공유 설정"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '8px 4px' }}>
          
          {/* Section A: 데이터 보관 방식 선택 */}
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              데이터 보관 모드
            </span>
            <div style={{ display: 'flex', background: '#f3f4f5', padding: '3px', borderRadius: '12px', gap: '2px' }}>
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
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px', lineHeight: '1.4', padding: '0 4px' }}>
              {isSupabaseConfigured 
                ? "💡 모든 기기 간 실시간 동기화가 활성화되어 있습니다."
                : "💡 기기 고유 저장소에 독립적으로 데이터를 보존 중입니다 (실시간 공유 불가)."}
            </p>
          </div>

          {/* Section B: 가족 공유 연동 설정 */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              가족 및 기기 공유
            </span>

            {!isSupabaseConfigured ? (
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: '500' }}>
                  로컬 Sandbox 상태에서는 실시간 기기 연동이 불가능합니다.
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem('wii_force_sandbox');
                    forceReload();
                  }}
                  className="btn-secondary"
                  style={{ height: '40px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  실시간 클라우드 모드로 전환하기
                </button>
              </div>
            ) : groupCode && groupCode !== myOriginalCode ? (
              // ==========================================
              // [Client Mode] 다른 기기 보관함에 동기화 접속 중인 상태
              // ==========================================
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(49, 130, 246, 0.05)', border: '1px solid rgba(49, 130, 246, 0.15)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--toss-blue)' }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: '15px', fontWeight: '700' }}>다른 기기와 동기화 중</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    현재 공유 번호 <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>"{groupCode}"</strong> 기기 보관함에 접속하여 실시간 동기화 중입니다.
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', borderTop: '1px solid rgba(49, 130, 246, 0.1)', paddingTop: '8px', marginTop: '4px' }}>
                    내가 작성하거나 수정한 내용이 연결된 상대 기기에도 실시간 반영됩니다.
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (window.confirm('공유 동기화를 종료하고 원래 내 고유 보관함으로 돌아가시겠습니까?')) {
                      try {
                        setIsSyncing(true);
                        await loginWithGroupCode(myOriginalCode);
                        setIsSyncSettingsOpen(false);
                        forceReload();
                      } catch (err: any) {
                        alert('원래 보관함으로 돌아가지 못했습니다: ' + err.message);
                      } finally {
                        setIsSyncing(false);
                      }
                    }
                  }}
                  className="btn-secondary"
                  style={{ height: '48px', fontSize: '13px', color: 'var(--accent-red)', borderColor: '#ffd1d1', background: '#fff2f2' }}
                >
                  공유 접속 종료 (내 보관함으로 복귀)
                </button>
              </div>
            ) : (
              // ==========================================
              // [Host Mode] 원래 내 보관함 상태 (기본적으로 항상 기기 고유 코드 활성화)
              // ==========================================
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. 나의 고유 공유 번호 표시 카드 (Toss Premium) */}
                <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>
                      나의 실시간 공유 코드
                    </span>
                    <strong style={{ fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                      {groupCode}
                    </strong>
                  </div>
                  
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    가족이나 다른 기기(스마트폰/PC)에 위 코드를 입력하면 내 보관 목록에 실시간 접속하여 동기화할 수 있습니다!
                  </span>

                  <button
                    onClick={() => {
                      if (groupCode) {
                        navigator.clipboard.writeText(groupCode);
                        alert(`공유 코드 "${groupCode}"가 복사되었습니다. 가족에게 전달해 함께 연동해 보세요!`);
                      }
                    }}
                    className="btn-secondary"
                    style={{ height: '40px', fontSize: '12px', background: '#fff', border: '1px solid #e5e8eb' }}
                  >
                    공유 코드 복사하기
                  </button>
                </div>

                {/* 2. 다른 기기 코드로 접속하기 영역 (Divider 포함) */}
                <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700' }}>
                    다른 기기의 공유 코드로 접속하기
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={syncCodeInput}
                        onChange={(e) => {
                          setSyncCodeInput(e.target.value);
                          setSyncError(null);
                        }}
                        placeholder="접속할 공유 코드 입력 (예: wii-123456)"
                        className="input-field"
                        style={{
                          paddingRight: '40px',
                          fontSize: '14px',
                          height: '48px',
                          fontWeight: '600'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && syncCodeInput.trim() && !isSyncing) {
                            handleConnectGroupCode();
                          }
                        }}
                      />
                      <Link2 size={16} style={{ position: 'absolute', right: '14px', color: 'var(--text-tertiary)' }} />
                    </div>
                  </div>

                  {syncError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff2f2', border: '1px solid #ffd1d1', padding: '12px', borderRadius: '10px', color: 'var(--accent-red)', fontSize: '12px' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{syncError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleConnectGroupCode}
                    disabled={!syncCodeInput.trim() || isSyncing}
                    className="btn-primary"
                    style={{
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: (!syncCodeInput.trim() || isSyncing) ? 0.6 : 1,
                      cursor: (!syncCodeInput.trim() || isSyncing) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSyncing ? (
                      <>
                        <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        상대 보관함 연결 중...
                      </>
                    ) : (
                      "상대 보관함에 동기화 접속하기"
                    )}
                  </button>
                </div>

              </div>
            )}
          </div>
          {/* 기기 전체 초기화 (세션 고착 대비용) & 버전 표시 */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (window.confirm('기기의 모든 공유 설정과 고유 번호를 완전 삭제하고 공장 초기화하시겠습니까? (현재 세션 및 로컬 저장소가 모두 비워지고 새로운 보관함이 발급됩니다)')) {
                  localStorage.clear(); // clear all localStorage caches
                  forceReload();
                }
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}
            >
              🔄 기기 공유 세션 및 데이터 전체 초기화 (처음 상태로)
            </button>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: '600', opacity: 0.7, letterSpacing: '0.5px', marginTop: '2px' }}>
              where is it . {APP_VERSION}
            </span>
          </div>
          
        </div>
      </BottomSheet>

    </div>
  );
};

function App() {
  React.useEffect(() => {
    // 터치 지원 기기(스마트폰, 태블릿 등) 혹은 화면 가로 폭이 768px 이하인 소형 모바일 뷰포트는
    // 무조건 데스크톱 시뮬레이터에서 배제하고 100% 모바일 풀 스크린으로 렌더링되도록 차단합니다.
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
