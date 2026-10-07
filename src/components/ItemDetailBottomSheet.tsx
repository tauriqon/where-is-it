import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRight, Trash2, Tag, Calendar, Camera, X } from 'lucide-react';
import BottomSheet from './BottomSheet';
import EmojiIcon from './EmojiIcon';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { getExpirationBadgeInfo } from '../utils/expiration';

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

interface ItemDetailBottomSheetProps {
  isOpen: boolean;
  itemId: string | null;
  onClose: () => void;
  onZoomImage?: (url: string | null) => void;
  onNavigateToLocation?: (sectionId: string) => void;
  registerBackHandler?: (handler: () => boolean) => () => void;
}

export const ItemDetailBottomSheet: React.FC<ItemDetailBottomSheetProps> = ({
  isOpen,
  itemId,
  onClose,
  onZoomImage,
  onNavigateToLocation,
  registerBackHandler,
}) => {
  const { 
    spaces, storages, sections, items,
    deleteItem, updateItem, uploadImage 
  } = useData();
  const { user, activeGroup } = useAuth();
  const isOwner = user?.id === activeGroup?.owner_id;

  const editFileInputRef = useRef<HTMLInputElement>(null);

  // 수정 상태 관리
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
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editHasExpiration, setEditHasExpiration] = useState(false);
  const [editExpirationDate, setEditExpirationDate] = useState('');

  // 시트가 닫히거나 itemId가 바뀌면 수정 모드 해제
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
    }
  }, [isOpen, itemId]);

  // 안드로이드 / 토스 뒤로가기 연동
  useEffect(() => {
    if (!registerBackHandler || !isOpen) return;

    const unregister = registerBackHandler(() => {
      if (isEditing) {
        setIsEditing(false);
        return true;
      }
      onClose();
      return true;
    });

    return unregister;
  }, [registerBackHandler, isOpen, isEditing, onClose]);

  const currentItem = items.find(i => i.id === itemId);
  const section = currentItem ? sections.find(s => s.id === currentItem.section_id) : null;
  const storage = section ? storages.find(st => st.id === section.storage_id) : null;
  const hasSectionImage = !!section?.image_url;
  const hasStorageImage = !!storage?.image_url;

  // 물건의 전체 경로 구하기 (예: "안방 > 옷장 > 첫째 서랍")
  const getItemPath = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return '알 수 없는 세부위치';

    const st = storages.find((s) => s.id === sec.storage_id);
    if (!st) return sec.name;

    const sp = spaces.find((s) => s.id === st.space_id);
    if (!sp) return `${st.name} > ${sec.name}`;

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle', flexWrap: 'wrap' }}>
        <EmojiIcon icon={sp.icon} size={12} style={{ marginRight: '2px' }} />
        <span>{sp.name}</span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>&gt;</span>
        <span>{st.name}</span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>&gt;</span>
        <span>{sec.name}</span>
      </span>
    );
  };

  const handleStartEdit = () => {
    if (!currentItem) return;
    setEditName(currentItem.name);
    setEditDesc(currentItem.description || '');
    setEditQty(currentItem.quantity);
    setEditTags(currentItem.tags || []);
    setEditTagInput('');
    
    const sec = sections.find(s => s.id === currentItem.section_id);
    if (sec) {
      setEditSectionId(sec.id);
      const st = storages.find(s => s.id === sec.storage_id);
      if (st) {
        setEditStorageId(st.id);
        setEditSpaceId(st.space_id);
      }
    }
    
    setEditImageFile(null);
    setEditImagePreview(currentItem.image_url || null);
    setEditExpirationDate(currentItem.expiration_date || '');
    setEditHasExpiration(!!currentItem.expiration_date);
    setEditIsPrivate(currentItem.is_private || false);
    setIsEditing(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('이 물건을 삭제하시겠습니까?')) {
      try {
        onClose();
        await deleteItem(id);
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
        section_id: editSectionId,
        quantity: editQty,
        description: editDesc.trim(),
        tags: editTags,
        image_url: finalImageUrl,
        expiration_date: editHasExpiration && editExpirationDate ? editExpirationDate : undefined,
        is_private: editIsPrivate
      });

      triggerHaptic('success');
      setIsEditing(false);
    } catch (err: any) {
      triggerHaptic('error');
      alert('수정 실패: ' + err.message);
    } finally {
      setIsUpdatingItem(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setIsEditing(false);
        onClose();
      }}
      title={
        isEditing ? "물건 정보 수정" : (
          currentItem ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 className="h2-title" style={{ margin: 0, fontSize: '20px', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                {currentItem.name}
              </h3>
              {currentItem.is_private && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--toss-blue)', background: 'var(--toss-blue-light)', border: '1px solid rgba(49, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                  🔒 개인
                </span>
              )}
            </div>
          ) : "물건 상세 정보"
        )
      }
    >
      {currentItem && (
        isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 물건 이름 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '14px' }}>물건 이름 *</label>
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
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 수정</span>
              
              {/* 1단계: 공간 */}
              <div>
                <label className="form-label" style={{ fontSize: '14px', marginBottom: '6px' }}>1단계: 공간 *</label>
                {spaces.length === 0 ? (
                  <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 공간이 없습니다.</div>
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
                            fontSize: '14px',
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
                <label className="form-label" style={{ fontSize: '14px', marginBottom: '6px' }}>2단계: 수납처 *</label>
                {!editSpaceId ? (
                  <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>먼저 공간을 선택해 주세요.</div>
                ) : storages.filter(st => st.space_id === editSpaceId).length === 0 ? (
                  <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>이 공간에 등록된 수납처가 없습니다.</div>
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
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                            background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            userSelect: 'none',
                            fontSize: '14px',
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                          }}
                        >
                          📦 {st.name}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3단계: 세부 위치 */}
              <div>
                <label className="form-label" style={{ fontSize: '14px', marginBottom: '6px' }}>3단계: 세부 위치 *</label>
                {!editStorageId ? (
                  <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>먼저 수납처를 선택해 주세요.</div>
                ) : sections.filter(sec => sec.storage_id === editStorageId).length === 0 ? (
                  <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>이 수납처에 등록된 세부 위치가 없습니다.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {sections.filter(sec => sec.storage_id === editStorageId).map(sec => {
                      const isSelected = editSectionId === sec.id;
                      return (
                        <div
                          key={sec.id}
                          onClick={() => setEditSectionId(sec.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                            background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            userSelect: 'none',
                            fontSize: '14px',
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                          }}
                        >
                          📍 {sec.name}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* 물건 사진 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '14px' }}>물건 사진 수정</label>
              {editImagePreview ? (
                <div style={{ position: 'relative', width: '100%', minHeight: '240px', height: 'auto', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
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
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100px', height: 'auto', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '8px', background: 'var(--bg-subtle)' }}
                >
                  <Camera size={24} color="var(--text-tertiary)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>사진 찍기 또는 이미지 선택</span>
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
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic('basicMedium');
                    setEditQty(prev => Math.max(1, prev - 1));
                  }}
                  style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}
                >
                  -
                </button>
                <span style={{ fontSize: '18px', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>
                  {editQty}
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic('basicMedium');
                    setEditQty(prev => prev + 1);
                  }}
                  style={{ border: 'none', background: 'var(--bg-input)', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* 유통기한 수정 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '14px', margin: 0 }}>유통기한 수정</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={!editHasExpiration} 
                    onChange={(e) => {
                      setEditHasExpiration(!e.target.checked);
                      if (e.target.checked) {
                        setEditExpirationDate('');
                      }
                    }} 
                    style={{ cursor: 'pointer', width: '13px', minHeight: '13px', height: 'auto', margin: 0 }}
                  />
                  유통기한 없음 (N/A)
                </label>
              </div>
              {editHasExpiration ? (
                <input 
                  type="date"
                  className="input-text"
                  value={editExpirationDate}
                  onChange={(e) => setEditExpirationDate(e.target.value)}
                  style={{ minHeight: '40px', height: 'auto', padding: '0 12px', fontSize: '15px' }}
                />
              ) : (
                <div style={{
                  minHeight: '40px', height: 'auto',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  유통기한 정보 없음 (N/A)
                </div>
              )}
            </div>

            {/* 개인 물건 설정 (소유자 전용) */}
            {isOwner && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>🔒 개인 물건 (가족 공유 시 숨기기)</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>체크하면 나에게만 보이고 가족 참가자에게는 숨겨집니다.</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={editIsPrivate}
                    onChange={(e) => {
                      triggerHaptic('tickWeak');
                      setEditIsPrivate(e.target.checked);
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                  />
                </div>
              </div>
            )}

            {/* 태그 등록 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '14px' }}>태그</label>
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
                style={{ minHeight: '40px', height: 'auto', padding: '0 12px', fontSize: '15px' }}
                placeholder="태그 입력 후 Enter"
                value={editTagInput}
                onChange={(e) => setEditTagInput(e.target.value)}
                onKeyDown={handleAddEditTag}
              />
            </div>

            {/* 메모 및 설명 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '14px' }}>설명 및 메모</label>
              <textarea 
                className="input-text" 
                style={{ minHeight: '60px', resize: 'vertical', padding: '10px 12px', fontSize: '15px' }}
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
                style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0 }}
              >
                취소
              </button>
              <button 
                type="button" 
                onClick={handleSaveEdit} 
                className="btn-primary"
                disabled={isUpdatingItem || !editName.trim() || !editSectionId}
                style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0 }}
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
                onClick={() => onZoomImage && onZoomImage(currentItem.image_url || null)}
                style={{ width: '100%', minHeight: '240px', height: 'auto', borderRadius: 'var(--radius-md)', objectFit: 'contain', background: '#f8f9fa', cursor: onZoomImage ? 'zoom-in' : 'default' }}
              />
            ) : (
              <div style={{ width: '100%', minHeight: '140px', height: 'auto', borderRadius: 'var(--radius-md)', background: 'var(--toss-blue-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '44px' }}>📦</span>
                <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>등록된 사진이 없습니다</span>
              </div>
            )}

            {/* 설명 및 메모 */}
            {currentItem.description && (
              <p className="body-desc" style={{ color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {currentItem.description}
              </p>
            )}

            {/* 보관 위치 경로 (인터랙티브 바로가기 카드) */}
            <div 
              onClick={() => {
                if (onNavigateToLocation && currentItem) {
                  triggerHaptic('basicMedium');
                  onNavigateToLocation(currentItem.section_id);
                }
              }}
              className={onNavigateToLocation ? "toss-card-interactive" : ""}
              style={{ 
                background: 'var(--bg-subtle)', 
                border: '1px solid var(--border-medium)', 
                borderRadius: 'var(--radius-sm)', 
                padding: '14px',
                cursor: onNavigateToLocation ? 'pointer' : 'default',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="text-small" style={{ fontWeight: '600' }}>보관 위치</span>
                {onNavigateToLocation && (
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--toss-blue)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    위치 바로가기
                    <ChevronRight size={14} />
                  </span>
                )}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                {getItemPath(currentItem.section_id)}
              </div>
              {(hasSectionImage || hasStorageImage) && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  {hasStorageImage && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>📦 {storage?.name} 사진</span>
                      <img 
                        src={storage?.image_url} 
                        alt={storage?.name} 
                        onClick={(e) => {
                          if (onZoomImage) {
                            e.stopPropagation();
                            onZoomImage(storage?.image_url || null);
                          }
                        }}
                        style={{ width: '100%', minHeight: '100px', height: 'auto', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-medium)', cursor: onZoomImage ? 'zoom-in' : 'default' }} 
                      />
                    </div>
                  )}
                  {hasSectionImage && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>📍 {section?.name} 사진</span>
                      <img 
                        src={section?.image_url} 
                        alt={section?.name} 
                        onClick={(e) => {
                          if (onZoomImage) {
                            e.stopPropagation();
                            onZoomImage(section?.image_url || null);
                          }
                        }}
                        style={{ width: '100%', minHeight: '100px', height: 'auto', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-medium)', cursor: onZoomImage ? 'zoom-in' : 'default' }} 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 수량 정보 표시 */}
            <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 0', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>보관 수량</span>
              <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {currentItem.quantity}개
              </span>
            </div>

            {/* 유통기한 정보 표시 */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>유통기한</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '17px', fontWeight: '700', color: currentItem.expiration_date ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {currentItem.expiration_date ? currentItem.expiration_date : 'N/A'}
                </span>
                {currentItem.expiration_date && (
                  (() => {
                    const badge = getExpirationBadgeInfo(currentItem.expiration_date);
                    return (
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: badge.color, 
                        background: badge.bg, 
                        border: badge.border, 
                        padding: '2px 8px', 
                        borderRadius: '4px'
                      }}>
                        {badge.label}
                      </span>
                    );
                  })()
                )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} /> 등록일: {new Date(currentItem.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* 액션 관리 영역 (수정 및 삭제 버튼) */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={handleStartEdit}
                className="btn-primary"
                style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0 }}
              >
                수정하기
              </button>
              <button
                onClick={() => handleDeleteItem(currentItem.id)}
                className="btn-secondary"
                style={{ flex: 1, minHeight: '48px', height: 'auto', padding: 0, background: 'var(--accent-red-light)', color: 'var(--accent-red)', border: 'none' }}
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
  );
};

export default ItemDetailBottomSheet;
