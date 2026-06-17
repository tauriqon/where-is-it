import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Camera, Plus, X, Tag, Loader2, Sparkles } from 'lucide-react';
import EmojiIcon from './EmojiIcon';

interface AddTabProps {
  onNavigateTab: (tab: 'home' | 'explore' | 'add' | 'search' | 'settings', params?: any) => void;
}

export const AddTab: React.FC<AddTabProps> = ({ onNavigateTab }) => {
  const { 
    spaces, storages, sections, 
    createItem, uploadImage 
  } = useData();

  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // [1] 새 물건 등록 관련 상태
  // ==========================================
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedStorageId, setSelectedStorageId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  
  // 이미지 업로드 상태
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 필터링된 셀렉트박스 옵션
  const availableStorages = storages.filter(st => st.space_id === selectedSpaceId);
  const availableSections = sections.filter(se => se.storage_id === selectedStorageId);

  // ==========================================
  // [드래프트 보존 메커니즘] 세션 스토리지 자동 연동
  // ==========================================
  // 1) 마운트 시 드래프트 불러오기
  useEffect(() => {
    const saved = sessionStorage.getItem('wii_add_item_draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.name) setName(draft.name);
        if (draft.description) setDescription(draft.description);
        if (draft.quantity) setQuantity(draft.quantity);
        if (draft.tags) setTags(draft.tags);
        if (draft.selectedSpaceId) setSelectedSpaceId(draft.selectedSpaceId);
        if (draft.selectedStorageId) setSelectedStorageId(draft.selectedStorageId);
        if (draft.selectedSectionId) setSelectedSectionId(draft.selectedSectionId);
        if (draft.imagePreview) setImagePreview(draft.imagePreview);
      } catch (e) {
        console.error('Failed to parse item draft:', e);
      }
    }
  }, []);

  // 2) 값이 변경될 때마다 자동 저장 수행
  useEffect(() => {
    const draft = {
      name,
      description,
      quantity,
      tags,
      selectedSpaceId,
      selectedStorageId,
      selectedSectionId,
      imagePreview
    };
    sessionStorage.setItem('wii_add_item_draft', JSON.stringify(draft));
  }, [name, description, quantity, tags, selectedSpaceId, selectedStorageId, selectedSectionId, imagePreview]);

  // ==========================================
  // [핸들러] 이미지 선택 및 프리뷰 처리
  // ==========================================
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 태그 추가
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags(prev => [...prev, trimmed]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // ==========================================
  // [리다이렉트 핸들러] 설정 탭의 새 위치 추가로 이동
  // ==========================================
  const handleRedirectToLocationAdd = (type: 'space' | 'storage' | 'section') => {
    // 1) 복귀할 타겟 페이지 기록
    sessionStorage.setItem('wii_location_add_redirect', 'add');
    
    // 2) 설정 페이지에 넘겨줄 보관위치 타입 매개변수 기록
    sessionStorage.setItem(
      'wii_settings_navigate_params',
      JSON.stringify({ locationType: type })
    );

    // 3) 설정 탭의 추가 페이지로 강제 네비게이션
    onNavigateTab('settings', { subPage: 'add' });
  };

  // ==========================================
  // [제출] 물건 등록 완료
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('물건 이름을 입력해 주세요.');
      return;
    }
    if (!selectedSectionId) {
      alert('세부 보관 위치까지 모두 선택해 주세요.');
      return;
    }

    try {
      setIsUploading(true);
      let uploadedUrl = '';
      
      if (imageFile) {
        uploadedUrl = await uploadImage(imageFile);
      }

      await createItem(
        selectedSectionId,
        name.trim(),
        description.trim() || undefined,
        uploadedUrl || undefined,
        quantity,
        tags
      );

      // 성공 시 드래프트 소거
      sessionStorage.removeItem('wii_add_item_draft');

      alert('물건이 성공적으로 등록되었습니다!');
      setName('');
      setDescription('');
      setQuantity(1);
      setTags([]);
      setImageFile(null);
      setImagePreview(null);
      
      // Explore 탭으로 이동
      onNavigateTab('explore', { sectionId: selectedSectionId });
    } catch (err: any) {
      console.error(err);
      alert('등록 중 에러가 발생했습니다: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="page-transition">
      {/* 최상단 타이틀 */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="h1-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          새 물건 등록 <Sparkles size={22} color="var(--toss-blue)" />
        </h1>
        <p className="body-desc" style={{ color: 'var(--text-secondary)' }}>
          보관할 물건의 위치와 정보를 기록해 두세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 물건 이름 */}
        <div className="form-group">
          <label className="form-label">물건 이름 *</label>
          <input 
            type="text" 
            className="input-text" 
            placeholder="예: 비상약, 헤어드라이기, 여권"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* 3단계 위치 선택 시스템 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 지정 (3단계)</span>
          
          {/* 1단계: 공간 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>1단계: 공간 *</label>
              <button 
                type="button" 
                onClick={() => handleRedirectToLocationAdd('space')}
                style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <Plus size={14} /> 새 공간 추가
              </button>
            </div>
            {spaces.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>등록된 공간이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {spaces.map(s => {
                  const isSelected = selectedSpaceId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSpaceId(s.id);
                        setSelectedStorageId('');
                        setSelectedSectionId('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
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

          {/* 2단계: 수납처 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>2단계: 수납처 *</label>
              {selectedSpaceId && (
                <button 
                  type="button" 
                  onClick={() => handleRedirectToLocationAdd('storage')}
                  style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Plus size={14} /> 새 수납처 추가
                </button>
              )}
            </div>
            {!selectedSpaceId ? (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>먼저 공간을 선택해 주세요.</div>
            ) : availableStorages.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>이 공간에 등록된 수납처가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableStorages.map(st => {
                  const isSelected = selectedStorageId === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setSelectedStorageId(st.id);
                        setSelectedSectionId('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
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
          </div>

          {/* 3단계: 세부위치 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>3단계: 세부 위치 *</label>
              {selectedStorageId && (
                <button 
                  type="button" 
                  onClick={() => handleRedirectToLocationAdd('section')}
                  style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Plus size={14} /> 새 세부위치 추가
                </button>
              )}
            </div>
            {!selectedStorageId ? (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>먼저 수납처를 선택해 주세요.</div>
            ) : availableSections.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '8px 4px' }}>이 수납처에 등록된 세부위치가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableSections.map(se => {
                  const isSelected = selectedSectionId === se.id;
                  return (
                    <div
                      key={se.id}
                      onClick={() => setSelectedSectionId(se.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--toss-blue)' : 'var(--border-medium)',
                        background: isSelected ? 'var(--toss-blue-light)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}
                    >
                      {se.image_url ? (
                        <img 
                          src={se.image_url} 
                          alt={se.name} 
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            borderRadius: '4px', 
                            objectFit: 'contain',
                            background: '#f8f9fa'
                          }} 
                        />
                      ) : (
                        <span>📍</span>
                      )}
                      <span style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--toss-blue)' : 'var(--text-primary)' }}>
                        {se.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 스마트폰 카메라 연동 및 이미지 업로드 */}
        <div className="form-group">
          <label className="form-label">물건 사진 등록</label>
          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button 
                type="button" 
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', gap: '8px', background: 'var(--bg-subtle)' }}
            >
              <Camera size={28} color="var(--text-tertiary)" />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>사진 찍기 또는 라이브러리 선택</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleImageChange}
              />
            </div>
          )}
        </div>

        {/* 수량 */}
        <div className="form-group">
          <label className="form-label">수량</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              type="button"
              onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
              style={{ border: 'none', background: 'var(--bg-input)', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}
            >
              -
            </button>
            <span style={{ fontSize: '18px', fontWeight: '700', minWidth: '30px', textAlign: 'center' }}>
              {quantity}
            </span>
            <button 
              type="button"
              onClick={() => setQuantity(prev => prev + 1)}
              style={{ border: 'none', background: 'var(--bg-input)', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}
            >
              +
            </button>
          </div>
        </div>

        {/* 태그 등록 */}
        <div className="form-group">
          <label className="form-label">태그 (쉼표 혹은 엔터로 구분)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {tags.map(t => (
              <span key={t} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}>
                <Tag size={12} /> {t}
                <button type="button" onClick={() => handleRemoveTag(t)} style={{ border: 'none', background: 'none', display: 'flex', cursor: 'pointer' }}>
                  <X size={12} color="var(--toss-blue)" />
                </button>
              </span>
            ))}
          </div>
          <input 
            type="text"
            className="input-text"
            placeholder="태그 입력 후 Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
          />
        </div>

        {/* 상세 설명 */}
        <div className="form-group">
          <label className="form-label">메모 및 세부 정보</label>
          <textarea 
            className="input-text"
            style={{ minHeight: '80px', resize: 'vertical' }}
            placeholder="물건에 대한 세부 메모를 남겨보세요."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* 제출 버튼 */}
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={isUploading}
          style={{ marginTop: '10px', height: '56px' }}
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              물건 등록 중...
            </>
          ) : (
            '물건 기록 완료'
          )}
        </button>

      </form>
      
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AddTab;
