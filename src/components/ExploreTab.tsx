import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { ChevronRight, ChevronLeft, Trash2, Tag, Calendar, Camera, X } from 'lucide-react';
import BottomSheet from './BottomSheet';
import EmojiIcon from './EmojiIcon';
import { getCustomIconUrl } from '../utils/iconLoader';

interface ExploreTabProps {
  initialParams?: {
    spaceId?: string | null;
    storageId?: string | null;
    sectionId?: string | null;
    selectedItemId?: string | null;
  } | null;
  onClearParams?: () => void;
}

export const ExploreTab: React.FC<ExploreTabProps> = ({ initialParams, onClearParams }) => {
  const { 
    spaces, storages, sections, items, loading,
    deleteItem, updateItem, uploadImage 
  } = useData();

  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // 탐색 상태 관리
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  
  // 물건 상세 바텀시트 상태
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

  // 외부(Home/Search 등)에서 파라미터가 유입될 때 상태 동기화
  useEffect(() => {
    if (initialParams) {
      if (initialParams.sectionId) {
        const section = sections.find(se => se.id === initialParams.sectionId);
        if (section) {
          setSelectedSectionId(section.id);
          const storage = storages.find(st => st.id === section.storage_id);
          if (storage) {
            setSelectedStorageId(storage.id);
            setSelectedSpaceId(storage.space_id);
          }
        }
      } else if (initialParams.spaceId) {
        setSelectedSpaceId(initialParams.spaceId);
        setSelectedStorageId(null);
        setSelectedSectionId(null);
      }

      if (initialParams.selectedItemId) {
        setViewItemId(initialParams.selectedItemId);
        setIsDetailOpen(true);
      }

      // 파라미터 소비 후 초기화
      if (onClearParams) onClearParams();
    }
  }, [initialParams, sections, storages, onClearParams]);

  // 엔티티 매핑
  const currentSpace = spaces.find(s => s.id === selectedSpaceId);
  const currentStorage = storages.find(s => s.id === selectedStorageId);
  const currentSection = sections.find(s => s.id === selectedSectionId);
  const currentItem = items.find(i => i.id === viewItemId);

  // 현재 필터링된 목록들
  const filteredStorages = storages.filter(st => st.space_id === selectedSpaceId);
  const filteredSections = sections.filter(se => se.storage_id === selectedStorageId);
  const filteredItems = items.filter(it => it.section_id === selectedSectionId);

  // 뒤로가기 제어
  const handleBack = () => {
    if (selectedSectionId) {
      setSelectedSectionId(null);
    } else if (selectedStorageId) {
      setSelectedStorageId(null);
    } else if (selectedSpaceId) {
      setSelectedSpaceId(null);
    }
  };



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

  const handleAdjustQuantity = async (amount: number) => {
    if (!currentItem) return;
    const newQty = Math.max(1, currentItem.quantity + amount);
    await updateItem(currentItem.id, { quantity: newQty });
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

  const getFullLocationPath = (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return '';
    const st = storages.find(s => s.id === sec.storage_id);
    if (!st) return sec.name;
    const sp = spaces.find(s => s.id === st.space_id);
    if (!sp) return `${st.name} > ${sec.name}`;
    return `${sp.icon} ${sp.name} > ${st.name} > ${sec.name}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--toss-blue-light)', borderTopColor: 'var(--toss-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>공간 탐색 중...</span>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {/* 브레드크럼 & 헤더 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span 
            onClick={() => { setSelectedSpaceId(null); setSelectedStorageId(null); setSelectedSectionId(null); }}
            style={{ fontSize: '14px', color: selectedSpaceId ? 'var(--toss-blue)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: selectedSpaceId ? '600' : '400' }}
          >
            전체
          </span>
          {selectedSpaceId && (
            <>
              <ChevronRight size={14} color="var(--text-tertiary)" />
              <span 
                onClick={() => { setSelectedStorageId(null); setSelectedSectionId(null); }}
                style={{
                  fontSize: '14px',
                  color: selectedStorageId ? 'var(--toss-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: selectedStorageId ? '600' : '400',
                  maxWidth: '90px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}
                title={currentSpace?.name}
              >
                <EmojiIcon icon={currentSpace?.icon || ''} size={14} style={{ marginRight: '4px' }} /> {currentSpace?.name}
              </span>
            </>
          )}
          {selectedStorageId && (
            <>
              <ChevronRight size={14} color="var(--text-tertiary)" />
              <span 
                onClick={() => setSelectedSectionId(null)}
                style={{
                  fontSize: '14px',
                  color: selectedSectionId ? 'var(--toss-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: selectedSectionId ? '600' : '400',
                  maxWidth: '90px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}
                title={currentStorage?.name}
              >
                <EmojiIcon icon={currentStorage?.icon || ''} size={14} style={{ marginRight: '4px' }} /> {currentStorage?.name}
              </span>
            </>
          )}
          {selectedSectionId && (
            <>
              <ChevronRight size={14} color="var(--text-tertiary)" />
              <span 
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  fontWeight: '600',
                  maxWidth: '90px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}
                title={currentSection?.name}
              >
                {currentSection?.image_url ? (
                  <img 
                    src={currentSection.image_url} 
                    alt={currentSection.name} 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '2px', 
                      objectFit: 'contain', 
                      background: '#f8f9fa',
                      marginRight: '4px',
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }} 
                  />
                ) : (
                  <EmojiIcon icon={currentSection?.icon || '📍'} size={28} style={{ marginRight: '4px' }} />
                )}
                {currentSection?.name}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(selectedSpaceId || selectedStorageId || selectedSectionId) && (
            <button 
              onClick={handleBack}
              style={{ border: 'none', background: 'var(--bg-input)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={20} color="var(--text-primary)" />
            </button>
          )}
          <h1 className="h1-title" style={{ fontSize: '22px' }}>
            {!selectedSpaceId && '공간 선택'}
            {selectedSpaceId && !selectedStorageId && `${currentSpace?.name}의 수납처`}
            {selectedStorageId && !selectedSectionId && `${currentStorage?.name}의 세부위치`}
            {selectedSectionId && `${currentSection?.name}의 물건 목록`}
          </h1>
        </div>
      </div>

      {/* 탐색 콘텐츠 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* LEVEL 1: 공간 선택 */}
        {!selectedSpaceId && (
          spaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              공간이 존재하지 않습니다.<br />물건 추가 탭에서 새 공간을 생성해보세요!
            </div>
          ) : (
            spaces.map(space => (
              <div 
                key={space.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}
                onClick={() => setSelectedSpaceId(space.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <EmojiIcon icon={space.icon} size={24} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: '600', fontSize: '16px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{space.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    수납처 {storages.filter(st => st.space_id === space.id).length}개
                  </span>
                  <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            ))
          )
        )}

        {/* LEVEL 2: 수납처 선택 */}
        {selectedSpaceId && !selectedStorageId && (
          filteredStorages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              등록된 수납처가 없습니다.<br />하단 플러스 버튼을 클릭해 첫 물건과 함께 수납처를 등록해보세요!
            </div>
          ) : (
            filteredStorages.map(storage => (
              <div 
                key={storage.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}
                onClick={() => setSelectedStorageId(storage.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {storage.image_url ? (
                    <img src={storage.image_url} alt={storage.name} style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                  ) : (
                    <EmojiIcon icon={storage.icon} size={48} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: '600', fontSize: '16px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{storage.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    세부위치 {sections.filter(se => se.storage_id === storage.id).length}개
                  </span>
                  <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            ))
          )
        )}

        {/* LEVEL 3: 세부위치 선택 */}
        {selectedStorageId && !selectedSectionId && (
          filteredSections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              등록된 세부위치가 없습니다.<br />첫 물건을 등록하면서 세부위치(예: 서랍칸)를 추가해보세요!
            </div>
          ) : (
            filteredSections.map(section => (
              <div 
                key={section.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}
                onClick={() => setSelectedSectionId(section.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {section.image_url ? (
                    <img src={section.image_url} alt={section.name} style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'contain', background: '#f8f9fa', flexShrink: 0 }} />
                  ) : (
                    <EmojiIcon icon={section.icon || '📍'} size={48} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: '600', fontSize: '16px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{section.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    물건 {items.filter(it => it.section_id === section.id).length}개
                  </span>
                  <ChevronRight size={18} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            ))
          )
        )}

        {/* LEVEL 4: 물건 목록 */}
        {selectedSectionId && (
          filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
              이 위치에 저장된 물건이 없습니다.<br />하단 '추가' 탭에서 이 위치를 선택해 물건을 저장해보세요!
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                className="toss-card toss-card-interactive"
                style={{ margin: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => { setViewItemId(item.id); setIsDetailOpen(true); }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--toss-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      📦
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: '600' }}>{item.name}</h4>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px' }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>
            ))
          )
        )}

      </div>

      {/* 물건 상세정보 바텀시트 */}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 수정</span>
                
                {/* 1단계: 공간 */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>1단계: 공간 *</label>
                  <select 
                    className="input-text"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', height: '40px', padding: '0 10px', fontSize: '14px' }}
                    value={editSpaceId}
                    onChange={(e) => { setEditSpaceId(e.target.value); setEditStorageId(''); setEditSectionId(''); }}
                    required
                  >
                    <option value="">공간을 선택하세요</option>
                    {spaces.map(s => (
                      <option key={s.id} value={s.id}>
                        {getCustomIconUrl(s.icon) ? '🏠' : s.icon} {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2단계: 수납처 */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>2단계: 수납처 *</label>
                  <select 
                    className="input-text"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', height: '40px', padding: '0 10px', fontSize: '14px' }}
                    value={editStorageId}
                    onChange={(e) => { setEditStorageId(e.target.value); setEditSectionId(''); }}
                    disabled={!editSpaceId}
                    required
                  >
                    <option value="">{!editSpaceId ? '공간을 선택하세요' : '수납처를 선택하세요'}</option>
                    {storages.filter(st => st.space_id === editSpaceId).map(st => (
                      <option key={st.id} value={st.id}>
                        {getCustomIconUrl(st.icon) ? '📦' : st.icon} {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3단계: 세부위치 */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>3단계: 세부 위치 *</label>
                  <select 
                    className="input-text"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', height: '40px', padding: '0 10px', fontSize: '14px' }}
                    value={editSectionId}
                    onChange={(e) => setEditSectionId(e.target.value)}
                    disabled={!editStorageId}
                    required
                  >
                    <option value="">{!editStorageId ? '수납처를 선택하세요' : '세부위치를 선택하세요'}</option>
                    {sections.filter(se => se.storage_id === editStorageId).map(se => (
                      <option key={se.id} value={se.id}>{se.name}</option>
                    ))}
                  </select>
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

              {/* 보관 위치 경로 (Breadcrumb Card) */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <div className="text-small" style={{ marginBottom: '6px', fontWeight: '600' }}>보관 위치</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  {getFullLocationPath(currentItem.section_id)}
                </div>
              </div>

              {/* 수량 관리 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 0' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>보관 수량</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    onClick={() => handleAdjustQuantity(-1)}
                    style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '16px', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>
                    {currentItem.quantity}
                  </span>
                  <button 
                    onClick={() => handleAdjustQuantity(1)}
                    style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
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
export default ExploreTab;
