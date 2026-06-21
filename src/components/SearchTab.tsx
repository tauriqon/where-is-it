import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Search, Tag, X, ChevronRight, Archive, Clock, Calendar, Camera, Trash2 } from 'lucide-react';
import type { Item } from '../types';
import BottomSheet from './BottomSheet';
import EmojiIcon from './EmojiIcon';

interface SearchTabProps {
  onNavigateTab?: (tab: 'home' | 'explore' | 'add' | 'search', params?: any) => void;
}

// 한글 초성 추출 함수
const getChosung = (str: string) => {
  const cho = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code > -1 && code < 11172) {
      result += cho[Math.floor(code / 588)];
    } else {
      result += str.charAt(i);
    }
  }
  return result.toLowerCase();
};

export const SearchTab: React.FC<SearchTabProps> = () => {
  const { items, spaces, storages, sections, deleteItem, updateItem, uploadImage } = useData();
  
  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // 물건 상세 모달 상태
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 물건 수정 상태 관리
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editSpaceId, setEditSpaceId] = useState('');
  const [editStorageId, setEditStorageId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);

  // 로컬스토리지에서 최근 검색어 가져오기 및 세션 스토리지 자동 검색 키워드 확인
  useEffect(() => {
    const stored = localStorage.getItem('wii_recent_searches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }

    try {
      const keyword = sessionStorage.getItem('wii_search_keyword');
      if (keyword) {
        setQuery(keyword);
        sessionStorage.removeItem('wii_search_keyword');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 검색어 입력 시 실시간 매칭
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const isChosungQuery = /^[ㄱ-ㅎ\s]+$/.test(trimmed);

    const filtered = items.filter(item => {
      // 1. 이름 매칭 (일반/초성)
      const name = item.name.toLowerCase();
      const nameMatch = name.includes(trimmed);
      const chosungMatch = isChosungQuery && getChosung(item.name).includes(trimmed);
      
      // 2. 설명 매칭
      const descMatch = item.description?.toLowerCase().includes(trimmed) || false;
      
      // 3. 태그 매칭
      const tagMatch = item.tags.some(tag => tag.toLowerCase().includes(trimmed));

      return nameMatch || chosungMatch || descMatch || tagMatch;
    });

    setResults(filtered);
  }, [query, items]);

  // 최근 검색어 추가 및 검색 실행
  const handleSearchSubmit = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;

    setQuery(term);

    // 중복 제거 및 최근 5개 유지
    setRecentSearches(prev => {
      const updated = [term, ...prev.filter(t => t !== term)].slice(0, 5);
      localStorage.setItem('wii_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(t => t !== termToRemove);
      localStorage.setItem('wii_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

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

  // 모든 등록된 태그 구하기 (추천 태그용)
  const allTags = Array.from(new Set(items.flatMap(it => it.tags))).slice(0, 8);

  const currentItem = items.find(i => i.id === viewItemId);

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('이 물건을 삭제하시겠습니까?')) {
      try {
        setIsDetailOpen(false);
        await deleteItem(id);
        setViewItemId(null);
        alert('삭제가 완료되었습니다.');
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    }
  };



  const handleAddEditTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = editTagInput.trim();
      if (trimmed && !editTags.includes(trimmed)) {
        setEditTags(prev => [...prev, trimmed]);
        setEditTagInput('');
      }
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartEdit = () => {
    if (!currentItem) return;
    setEditName(currentItem.name);
    setEditDesc(currentItem.description || '');
    setEditQty(currentItem.quantity);
    setEditTags(currentItem.tags || []);
    setEditTagInput('');
    
    const section = sections.find(s => s.id === currentItem.section_id);
    if (section) {
      setEditSectionId(section.id);
      const storage = storages.find(st => st.id === section.storage_id);
      if (storage) {
        setEditStorageId(storage.id);
        setEditSpaceId(storage.space_id);
      }
    }
    
    setEditImageFile(null);
    setEditImagePreview(currentItem.image_url || null);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!currentItem) return;
    if (!editName.trim()) {
      alert('물건 이름을 입력해 주세요.');
      return;
    }
    if (!editSectionId) {
      alert('보관할 세부 위치를 지정해 주세요.');
      return;
    }

    try {
      setIsUpdatingItem(true);
      let finalImageUrl = currentItem.image_url || '';

      if (editImageFile) {
        finalImageUrl = await uploadImage(editImageFile);
      } else if (!editImagePreview) {
        finalImageUrl = '';
      }

      await updateItem(currentItem.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        quantity: editQty,
        tags: editTags,
        section_id: editSectionId,
        image_url: finalImageUrl || undefined
      });

      setIsEditing(false);
      alert('물건 정보가 수정되었습니다.');
    } catch (err: any) {
      console.error(err);
      alert('수정 중 에러가 발생했습니다: ' + err.message);
    } finally {
      setIsUpdatingItem(false);
    }
  };

  return (
    <div className="page-transition">
      
      {/* 고정 검색 필드 */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-app)', paddingBottom: '16px', zIndex: 10 }}>
        <h1 className="h1-title" style={{ marginBottom: '16px' }}>검색</h1>
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="input-text"
            style={{ paddingLeft: '48px', paddingRight: query ? '40px' : '16px', height: '52px' }}
            placeholder="물건명, 초성(예: ㅇㅍ), 태그, 설명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(query)}
          />
          <Search size={20} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px' }} />
          
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: '14px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}
            >
              <X size={18} color="var(--text-tertiary)" />
            </button>
          )}
        </div>
      </div>

      {/* 검색 결과 목록 */}
      {query.trim() ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>
            검색 결과 {results.length}개
          </div>

          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Archive size={36} strokeWidth={1.5} />
              <span>일치하는 물건을 찾지 못했습니다.<br />초성이나 태그를 다시 확인해 보세요.</span>
            </div>
          ) : (
            results.map(item => (
              <div
                key={item.id}
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => {
                  handleSearchSubmit(query); // 최근 검색어 추가
                  setViewItemId(item.id);
                  setIsDetailOpen(true);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain', background: '#f8f9fa' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      📦
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </h4>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px' }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {getItemPath(item.section_id)}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>
            ))
          )}

        </div>
      ) : (
        /* 초기 기본 뷰: 최근 검색어 & 추천 태그 */
        <div>
          {/* 최근 검색어 */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>최근 검색어</span>
                <button
                  onClick={() => { setRecentSearches([]); localStorage.removeItem('wii_recent_searches'); }}
                  style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer' }}
                >
                  전체 삭제
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                {recentSearches.map(term => (
                  <div
                    key={term}
                    onClick={() => handleSearchSubmit(term)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                      <Clock size={16} color="var(--text-tertiary)" />
                      <span style={{ fontSize: '15px' }}>{term}</span>
                    </div>
                    <button
                      onClick={(e) => handleClearRecentSearch(term, e)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                    >
                      <X size={14} color="var(--text-tertiary)" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 추천 태그 */}
          {allTags.length > 0 && (
            <div>
              <label className="form-label">자주 찾는 태그</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleSearchSubmit(tag)}
                    style={{
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-subtle)',
                      padding: '8px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  >
                    <Tag size={12} color="var(--toss-blue)" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 물건 상세 바텀시트 */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setViewItemId(null); setIsEditing(false); }}
        title={isEditing ? "물건 정보 수정" : "물건 상세 정보"}
      >
        {currentItem && (
          isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 물건 이름 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '13px' }}>물건 이름 *</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="예: 비상약, 헤어드라이기"
                  required
                />
              </div>

              {/* 3단계 위치 지능형 선택 시스템 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 수정</span>
                
                {/* 1단계: 공간 */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px' }}>1단계: 공간 *</label>
                  {spaces.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>등록된 공간이 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {spaces.map(s => {
                        const isSelected = editSpaceId === s.id;
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              setEditSpaceId(s.id);
                              setEditStorageId('');
                              setEditSectionId('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none',
                              fontSize: '13px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                            }}
                          >
                            <EmojiIcon icon={s.icon} size={16} />
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
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
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px' }}>2단계: 수납처 *</label>
                  {!editSpaceId ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>먼저 공간을 선택해 주세요.</div>
                  ) : storages.filter(st => st.space_id === editSpaceId).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>이 공간에 등록된 수납처가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {storages.filter(st => st.space_id === editSpaceId).map(st => {
                        const isSelected = editStorageId === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              setEditStorageId(st.id);
                              setEditSectionId('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none',
                              fontSize: '13px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                            }}
                          >
                            <EmojiIcon icon={st.icon} size={16} />
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
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
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px' }}>3단계: 세부 위치 *</label>
                  {!editStorageId ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>먼저 수납처를 선택해 주세요.</div>
                  ) : sections.filter(se => se.storage_id === editStorageId).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>이 수납처에 등록된 세부위치가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {sections.filter(se => se.storage_id === editStorageId).map(se => {
                        const isSelected = editSectionId === se.id;
                        return (
                           <div
                            key={se.id}
                            onClick={() => setEditSectionId(se.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                              background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              userSelect: 'none',
                              fontSize: '13px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                            }}
                          >
                            {se.image_url ? (
                              <img 
                                src={se.image_url} 
                                alt={se.name} 
                                style={{ 
                                  width: '32px', 
                                  height: '32px', 
                                  borderRadius: '3px', 
                                  objectFit: 'contain',
                                  background: '#f8f9fa'
                                }} 
                              />
                            ) : (
                              <span style={{ fontSize: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>📍</span>
                            )}
                            <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                              {se.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 사진 등록/변경 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '13px' }}>물건 사진 수정</label>
                {editImagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <img src={editImagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa' }} />
                    <button 
                      type="button" 
                      onClick={() => { setEditImageFile(null); setEditImagePreview(null); }}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={14} color="#fff" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => editFileInputRef.current?.click()}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '8px', background: 'var(--bg-subtle)' }}
                  >
                    <Camera size={24} color="var(--text-tertiary)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>사진 찍기 또는 이미지 선택</span>
                    <input 
                      ref={editFileInputRef}
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleEditImageChange}
                    />
                  </div>
                )}
              </div>

              {/* 수량 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>수량</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    type="button"
                    onClick={() => setEditQty(prev => Math.max(1, prev - 1))}
                    style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '16px', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>
                    {editQty}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setEditQty(prev => prev + 1)}
                    style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 태그 등록 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '13px' }}>태그</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {editTags.map(t => (
                    <span key={t} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                      <Tag size={10} /> {t}
                      <button type="button" onClick={() => handleRemoveEditTag(t)} style={{ border: 'none', background: 'none', display: 'flex', cursor: 'pointer' }}>
                        <X size={10} color="var(--toss-blue)" />
                      </button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text"
                  className="input-text"
                  style={{ height: '40px', padding: '0 12px', fontSize: '14px' }}
                  placeholder="태그 입력 후 Enter"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={handleAddEditTag}
                />
              </div>

              {/* 메모 및 설명 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '13px' }}>설명 및 메모</label>
                <textarea 
                  className="input-text"
                  style={{ minHeight: '60px', resize: 'vertical', padding: '10px 12px', fontSize: '14px' }}
                  placeholder="설명을 남겨보세요."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className="btn-secondary"
                  style={{ flex: 1, height: '48px', padding: 0 }}
                >
                  취소
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveEdit} 
                  className="btn-primary"
                  disabled={isUpdatingItem || !editName.trim() || !editSectionId}
                  style={{ flex: 1, height: '48px', padding: 0 }}
                >
                  {isUpdatingItem ? '저장 중...' : '수정 완료'}
                </button>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 이미지 */}
              {currentItem.image_url ? (
                <img
                  src={currentItem.image_url}
                  alt={currentItem.name}
                  style={{ width: '100%', height: '240px', borderRadius: 'var(--radius-md)', objectFit: 'contain', background: '#f8f9fa' }}
                />
              ) : (
                <div style={{ width: '100%', height: '140px', borderRadius: 'var(--radius-md)', background: 'var(--toss-blue-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '40px' }}>📦</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>등록된 사진이 없습니다</span>
                </div>
              )}

              {/* 타이틀 및 설명 */}
              <div>
                <h2 className="h2-title" style={{ fontSize: '20px', marginBottom: '6px' }}>{currentItem.name}</h2>
                <p className="body-desc" style={{ color: 'var(--text-secondary)' }}>
                  {currentItem.description || '작성된 설명이 없습니다.'}
                </p>
              </div>

              {/* 보관 위치 경로 */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div className="text-small" style={{ marginBottom: '6px', fontWeight: '600' }}>보관 위치</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  {getItemPath(currentItem.section_id)}
                </div>
              </div>

              {/* 수량 정보 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 0', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>보관 수량</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {currentItem.quantity}개
                </span>
              </div>

              {/* 태그 목록 */}
              {currentItem.tags && currentItem.tags.length > 0 && (
                <div>
                  <div className="text-small" style={{ marginBottom: '8px', fontWeight: '600' }}>태그</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {currentItem.tags.map(tag => (
                      <span key={tag} className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 메타정보 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> 등록일: {new Date(currentItem.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* 액션 관리 영역 (수정 및 삭제를 프리미엄 2열 버튼으로 재구성) */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={handleStartEdit}
                  className="btn-primary"
                  style={{ flex: 1, height: '48px', padding: 0 }}
                >
                  수정하기
                </button>
                <button
                  onClick={() => handleDeleteItem(currentItem.id)}
                  className="btn-secondary"
                  style={{ flex: 1, height: '48px', padding: 0, background: 'var(--accent-red-light)', color: 'var(--accent-red)', border: 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#ffd1d1'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-red-light)'}
                >
                  <Trash2 size={16} /> 삭제하기
                </button>
              </div>

            </div>
          )
        )}
      </BottomSheet>
    </div>
  );
};
export default SearchTab;
