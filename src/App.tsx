import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { Home, Layers, Plus, Search, Database, HardDrive, LogOut } from 'lucide-react';
import { isSupabaseConfigured } from './supabase';
import HomeTab from './components/HomeTab';
import ExploreTab from './components/ExploreTab';
import AddTab from './components/AddTab';
import SearchTab from './components/SearchTab';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, authError, logout } = useAuth();
  const { dbError } = useData();
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'add' | 'search'>('home');
  
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
          {/* DB 연동 상태 통합 토글 버튼 (공간 확보 및 가로 흔들림 차단) */}
          {isSupabaseConfigured ? (
            <button 
              onClick={() => {
                if (window.confirm('임시 Sandbox(로컬 오프라인) 모드로 전환하시겠습니까?')) {
                  localStorage.setItem('wii_force_sandbox', 'true');
                  forceReload();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--accent-green-light)',
                color: 'var(--accent-green)',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d2f8e2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-green-light)'}
              title="클릭하여 Sandbox(로컬) 모드로 전환"
            >
              <Database size={12} /> Supabase 🔄
            </button>
          ) : (
            <button 
              onClick={() => {
                if (window.confirm('Supabase(실시간 클라우드 DB) 모드로 다시 연결하시겠습니까?')) {
                  localStorage.removeItem('wii_force_sandbox');
                  forceReload();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-input)',
                color: 'var(--text-secondary)',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e5e8eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
              title="클릭하여 Supabase 다시 연결"
            >
              <HardDrive size={12} /> Sandbox ➔
            </button>
          )}

          {/* 익명 로그아웃/초기화 버튼 (개발용) */}
          {user && (
            <button
              onClick={() => {
                if (window.confirm('기기의 보관 데이터를 모두 초기화하고 세션을 비우시겠습니까?')) {
                  logout().then(() => forceReload());
                }
              }}
              style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: '4px' }}
              title="기기 세션 초기화"
            >
              <LogOut size={16} />
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

    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
