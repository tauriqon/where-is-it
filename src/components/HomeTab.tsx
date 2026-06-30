import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Search, Archive, ChevronRight } from 'lucide-react';

// 유통기한 D-Day 계산 함수
const getDDay = (expirationDate: string) => {
  const exp = new Date(expirationDate);
  const today = new Date();
  exp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

interface HomeTabProps {
  onNavigateTab: (tab: 'home' | 'explore' | 'add' | 'search', params?: any) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigateTab }) => {
  const { spaces, storages, sections, items, loading } = useData();

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wii_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 3));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 최근 등록된 물건 찾기 (최신순 3개)
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  // 최근 수정된 물건 찾기 (최근 3개)
  const recentlyUpdatedItems = [...items]
    .filter((it) => it.updated_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);

  // 유통기한 도래 및 만료 물건 필터링 및 잔여일 기준 정렬
  const notifyDays = (() => {
    const saved = localStorage.getItem('wii_expiration_notify_days');
    return saved ? parseInt(saved, 10) : 7;
  })();

  const expirationImminentItems = [...items]
    .filter(it => it.expiration_date && getDDay(it.expiration_date) <= notifyDays)
    .sort((a, b) => {
      const ddayA = getDDay(a.expiration_date!);
      const ddayB = getDDay(b.expiration_date!);
      return ddayA - ddayB;
    });

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', height: 'auto', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--toss-blue-light)', borderTopColor: 'var(--toss-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>데이터 불러오는 중...</span>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {/* 웰컴 배너 */}
      <div style={{ marginBottom: '20px', padding: '4px 0' }}>
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

      {/* 보관 통계 위젯 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px', 
        background: '#fff', 
        border: '1px solid var(--border-medium)', 
        borderRadius: 'var(--radius-md)', 
        padding: '16px 12px', 
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
      }}>
        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: '600' }}>총 물건 종류</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--toss-blue)' }}>{items.length}종</div>
        </div>
        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: '600' }}>보관 공간</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{spaces.length}곳</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: '600' }}>등록된 수납처</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{storages.length}개</div>
        </div>
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
          marginBottom: recentSearches.length > 0 ? '12px' : '28px',
          transition: 'background var(--transition-fast)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e9ebed'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
      >
        <Search size={20} color="var(--text-tertiary)" />
        <span style={{ color: 'var(--text-tertiary)', fontSize: '17px' }}>어떤 물건을 찾고 계신가요?</span>
      </div>

      {/* 최근 검색어 태그 */}
      {recentSearches.length > 0 && (
        <div style={{ marginBottom: '28px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '700' }}>최근 검색어</span>
          {recentSearches.map(term => (
            <span 
              key={term}
              onClick={() => {
                sessionStorage.setItem('wii_search_keyword', term);
                onNavigateTab('search');
              }}
              className="badge badge-gray"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: 'var(--border-light)', color: 'var(--text-secondary)', fontWeight: '600' }}
            >
              {term}
            </span>
          ))}
        </div>
      )}

      {/* 유통기한 도래 물건 (임박 또는 만료) */}
      {expirationImminentItems.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 className="h2-title" style={{ fontSize: '20px', margin: 0 }}>유통기한 도래 물건</h2>
              <span style={{ 
                background: 'var(--accent-red)', 
                color: '#fff', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                borderRadius: '50%', 
                width: '20px', 
                minHeight: '20px', height: 'auto', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {expirationImminentItems.length}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expirationImminentItems.map((item) => {
              const dday = getDDay(item.expiration_date!);
              const badgeColor = dday < 0 ? 'var(--accent-red)' : 'rgba(255, 149, 0, 1)';
              const badgeBg = dday < 0 ? 'var(--accent-red-light)' : 'rgba(255, 149, 0, 0.1)';
              const badgeBorder = dday < 0 ? 'none' : '1px solid rgba(255,149,0,0.2)';
              
              return (
                <div 
                  key={item.id}
                  className="toss-card toss-card-interactive"
                  style={{ 
                    margin: 0, 
                    padding: '12px 16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    gap: '12px',
                    borderColor: dday < 0 ? 'rgba(240, 68, 85, 0.25)' : 'var(--border-medium)'
                  }}
                  onClick={() => onNavigateTab('explore', { spaceId: null, storageId: null, sectionId: item.section_id, selectedItemId: item.id })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'contain', background: '#f8f9fa' }} 
                      />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                        📦
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <h4 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </h4>
                        {item.quantity > 1 && (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {getItemPath(item.section_id)}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      color: badgeColor, 
                      background: badgeBg, 
                      border: badgeBorder,
                      padding: '3px 8px', 
                      borderRadius: '6px'
                    }}>
                      {dday === 0 ? 'D-Day' : dday < 0 ? `만료 (D+${Math.abs(dday)})` : `D-${dday}`}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      기한: {item.expiration_date}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 최근 등록한 물건 */}
      <div style={{ marginBottom: recentlyUpdatedItems.length > 0 ? '32px' : '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="h2-title" style={{ fontSize: '20px' }}>최근 등록한 물건</h2>
          {items.length > 3 && (
            <button 
              onClick={() => onNavigateTab('explore')}
              style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontWeight: '600', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
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
            <span style={{ fontSize: '15px' }}>등록된 물건이 아직 없습니다.</span>
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
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'contain', background: '#f8f9fa' }} 
                    />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                      📦
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <h4 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </h4>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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

      {/* 최근 수정한 물건 */}
      {recentlyUpdatedItems.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="h2-title" style={{ fontSize: '20px' }}>최근 수정한 물건</h2>
            {items.length > 3 && (
              <button 
                onClick={() => onNavigateTab('explore')}
                style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontWeight: '600', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                전체 보기 <ChevronRight size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentlyUpdatedItems.map((item) => (
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
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'contain', background: '#f8f9fa' }} 
                    />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                      📦
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <h4 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </h4>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {getItemPath(item.section_id)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {new Date(item.updated_at).toLocaleDateString()}
                  </span>
                  <ChevronRight size={16} color="var(--text-tertiary)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default HomeTab;
