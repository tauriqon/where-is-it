import React from 'react';
import { useData } from '../contexts/DataContext';
import { Plus, Search, Archive, ChevronRight } from 'lucide-react';

interface HomeTabProps {
  onNavigateTab: (tab: 'home' | 'explore' | 'add' | 'search', params?: any) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigateTab }) => {
  const { spaces, storages, sections, items, loading } = useData();

  // 공간에 등록된 총 물건 개수 계산
  const getSpaceItemCount = (spaceId: string) => {
    // 1단계 공간 아래의 모든 수납처 ID 찾기
    const spaceStorages = storages.filter((st) => st.space_id === spaceId).map((st) => st.id);
    // 수납처 아래의 모든 세부위치 ID 찾기
    const storageSections = sections.filter((se) => spaceStorages.includes(se.storage_id)).map((se) => se.id);
    // 세부위치에 속한 물건들 카운트
    return items.filter((it) => storageSections.includes(it.section_id)).length;
  };

  // 최근 등록된 물건 찾기 (최신순 4개)
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  // 물건의 전체 경로 구하기 (예: "안방 > 옷장 > 첫째 서랍")
  const getItemPath = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return '알 수 없는 세부위치';

    const storage = storages.find((st) => st.id === section.storage_id);
    if (!storage) return section.name;

    const space = spaces.find((sp) => sp.id === storage.space_id);
    if (!space) return `${storage.name} > ${section.name}`;

    return `${space.icon} ${space.name} > ${storage.name} > ${section.name}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--toss-blue-light)', borderTopColor: 'var(--toss-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>데이터 불러오는 중...</span>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {/* 웰컴 배너 */}
      <div style={{ marginBottom: '24px', padding: '4px 0' }}>
        <h1 className="h1-title" style={{ fontWeight: '800', marginBottom: '8px' }}>
          어디 뒀더라? 🔍
        </h1>
        <p className="body-desc" style={{ color: 'var(--text-secondary)' }}>
          {items.length > 0 ? (
            <>집안에 <strong>{items.length}개</strong>의 소중한 물건들이 안전하게 보관되어 있어요.</>
          ) : (
            "집안 물건들의 위치를 3단계로 명확히 기록해보세요!"
          )}
        </p>
      </div>

      {/* 퀵 서치 카드 */}
      <div 
        onClick={() => onNavigateTab('search')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--bg-input)',
          padding: '16px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          marginBottom: '28px',
          transition: 'background var(--transition-fast)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e9ebed'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
      >
        <Search size={20} color="var(--text-tertiary)" />
        <span style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>어떤 물건을 찾고 계신가요?</span>
      </div>

      {/* 공간 그리드 섹션 */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="h2-title" style={{ fontSize: '18px' }}>공간 둘러보기</h2>
          <span className="text-small" style={{ fontWeight: '500' }}>총 {spaces.length}개</span>
        </div>

        {spaces.length === 0 ? (
          <div 
            onClick={() => onNavigateTab('add')}
            style={{
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Plus size={24} color="var(--text-tertiary)" />
            <div>
              <p style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>등록된 공간이 없어요</p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>여기클릭 후 새로운 공간과 첫 물건을 등록해보세요!</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            {spaces.map((space) => {
              const count = getSpaceItemCount(space.id);
              return (
                <div
                  key={space.id}
                  className="toss-card toss-card-interactive"
                  style={{ margin: 0, padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}
                  onClick={() => onNavigateTab('explore', { spaceId: space.id })}
                >
                  <div style={{ fontSize: '28px' }}>{space.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {space.name}
                    </h3>
                    <span className="badge badge-blue" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                      물건 {count}개
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 최근 등록한 물건 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="h2-title" style={{ fontSize: '18px' }}>최근 등록한 물건</h2>
          {items.length > 4 && (
            <button 
              onClick={() => onNavigateTab('explore')}
              style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              전체 보기 <ChevronRight size={16} />
            </button>
          )}
        </div>

        {recentItems.length === 0 ? (
          <div 
            style={{
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Archive size={32} strokeWidth={1.5} />
            <span style={{ fontSize: '14px' }}>등록된 물건이 아직 없습니다.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentItems.map((item) => (
              <div 
                key={item.id}
                className="toss-card toss-card-interactive"
                style={{ 
                  margin: 0, 
                  padding: '12px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: '12px' 
                }}
                onClick={() => onNavigateTab('explore', { spaceId: null, storageId: null, sectionId: item.section_id, selectedItemId: item.id })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', background: '#eee' }} 
                    />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      📦
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </h4>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {getItemPath(item.section_id)}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default HomeTab;
