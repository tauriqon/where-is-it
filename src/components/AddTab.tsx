import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Camera, Plus, X, Tag, Loader2, Sparkles } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface AddTabProps {
  onNavigateTab: (tab: 'home' | 'explore' | 'add' | 'search', params?: any) => void;
}

export const AddTab: React.FC<AddTabProps> = ({ onNavigateTab }) => {
  const { 
    spaces, storages, sections, 
    createSpace, createStorage, createSection, createItem, uploadImage 
  } = useData();

  // 파일 입력 Ref 선언 ( label 터치 오류 차단용 )
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폼 필드 상태
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

  // 인라인 신규 생성 모달 상태
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceIcon, setNewSpaceIcon] = useState('🏠');

  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [newStorageName, setNewStorageName] = useState('');
  const [newStorageIcon, setNewStorageIcon] = useState('📦');

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // 필터링된 셀렉트박스 옵션
  const availableStorages = storages.filter(st => st.space_id === selectedSpaceId);
  const availableSections = sections.filter(se => se.storage_id === selectedStorageId);

  // 이모지 옵션 목록
  const EMOJI_OPTIONS = ['🏠', '🍳', '🛏️', '👔', '📺', '📦', '❄️', '📚', '🧸', '🚗', '💊', '🔑', '🎒', '工具', '🍔', '🎨'];

  // 이미지 선택 및 프리뷰 처리
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

  // 신규 공간 인라인 생성
  const handleCreateSpaceInline = async () => {
    if (!newSpaceName.trim()) return;
    try {
      const created = await createSpace(newSpaceName.trim(), newSpaceIcon);
      setSelectedSpaceId(created.id);
      setIsSpaceModalOpen(false);
      setNewSpaceName('');
    } catch (err) {
      console.error(err);
    }
  };

  // 신규 수납처 인라인 생성
  const handleCreateStorageInline = async () => {
    if (!newStorageName.trim() || !selectedSpaceId) return;
    try {
      const created = await createStorage(selectedSpaceId, newStorageName.trim(), newStorageIcon);
      setSelectedStorageId(created.id);
      setIsStorageModalOpen(false);
      setNewStorageName('');
    } catch (err) {
      console.error(err);
    }
  };

  // 신규 세부위치 인라인 생성
  const handleCreateSectionInline = async () => {
    if (!newSectionName.trim() || !selectedStorageId) return;
    try {
      const created = await createSection(selectedStorageId, newSectionName.trim());
      setSelectedSectionId(created.id);
      setIsSectionModalOpen(false);
      setNewSectionName('');
    } catch (err) {
      console.error(err);
    }
  };

  // 물건 제출
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

      // 성공 후 청소 및 이동
      alert('물건이 성공적으로 등록되었습니다!');
      setName('');
      setDescription('');
      setQuantity(1);
      setTags([]);
      setImageFile(null);
      setImagePreview(null);
      
      // Explore 탭으로 바로 이동해서 등록된 곳을 비춰줌!
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

        {/* 3단계 위치 지능형 선택 시스템 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>📍 보관할 위치 지정 (3단계)</span>
          
          {/* 1단계: 공간 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>1단계: 공간 *</label>
              <button 
                type="button" 
                onClick={() => setIsSpaceModalOpen(true)}
                style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <Plus size={14} /> 새 공간 추가
              </button>
            </div>
            <select 
              className="input-text"
              style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', height: '48px', padding: '0 12px' }}
              value={selectedSpaceId}
              onChange={(e) => { setSelectedSpaceId(e.target.value); setSelectedStorageId(''); setSelectedSectionId(''); }}
              required
            >
              <option value="">공간을 선택하세요</option>
              {spaces.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </div>

          {/* 2단계: 수납처 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>2단계: 수납처 *</label>
              {selectedSpaceId && (
                <button 
                  type="button" 
                  onClick={() => setIsStorageModalOpen(true)}
                  style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Plus size={14} /> 새 수납처 추가
                </button>
              )}
            </div>
            <select 
              className="input-text"
              style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', height: '48px', padding: '0 12px' }}
              value={selectedStorageId}
              onChange={(e) => { setSelectedStorageId(e.target.value); setSelectedSectionId(''); }}
              disabled={!selectedSpaceId}
              required
            >
              <option value="">{!selectedSpaceId ? '먼저 공간을 선택하세요' : '수납처를 선택하세요'}</option>
              {availableStorages.map(st => (
                <option key={st.id} value={st.id}>{st.icon} {st.name}</option>
              ))}
            </select>
          </div>

          {/* 3단계: 세부위치 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>3단계: 세부 위치 *</label>
              {selectedStorageId && (
                <button 
                  type="button" 
                  onClick={() => setIsSectionModalOpen(true)}
                  style={{ border: 'none', background: 'none', color: 'var(--toss-blue)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Plus size={14} /> 새 세부위치 추가
                </button>
              )}
            </div>
            <select 
              className="input-text"
              style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', height: '48px', padding: '0 12px' }}
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedStorageId}
              required
            >
              <option value="">{!selectedStorageId ? '먼저 수납처를 선택하세요' : '세부위치를 선택하세요'}</option>
              {availableSections.map(se => (
                <option key={se.id} value={se.id}>{se.name}</option>
              ))}
            </select>
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

      {/* =========================================================================
          인라인 생성 바텀시트
         ========================================================================= */}
      
      {/* 1. 새 공간 추가 바텀시트 */}
      <BottomSheet 
        isOpen={isSpaceModalOpen} 
        onClose={() => setIsSpaceModalOpen(false)}
        title="새로운 공간 생성"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">공간 이름</label>
            <input 
              type="text" 
              className="input-text"
              placeholder="예: 서재, 다용도실, 창고"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">대표 아이콘</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '10px', maxHeight: '110px', overflowY: 'auto', padding: '4px' }}>
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewSpaceIcon(emoji)}
                  style={{
                    fontSize: '22px',
                    border: newSpaceIcon === emoji ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                    background: newSpaceIcon === emoji ? 'var(--toss-blue-light)' : 'var(--bg-app)',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="button" 
            className="btn-primary"
            onClick={handleCreateSpaceInline}
            disabled={!newSpaceName.trim()}
          >
            공간 생성하기
          </button>
        </div>
      </BottomSheet>

      {/* 2. 새 수납처 추가 바텀시트 */}
      <BottomSheet 
        isOpen={isStorageModalOpen} 
        onClose={() => setIsStorageModalOpen(false)}
        title="새로운 수납처 생성"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--toss-blue-light)', padding: '10px', borderRadius: '8px' }}>
            선택된 공간 <strong>[{spaces.find(s => s.id === selectedSpaceId)?.name}]</strong> 내부에 수납처를 생성합니다.
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">수납처 이름</label>
            <input 
              type="text" 
              className="input-text"
              placeholder="예: 싱크대 하부장, 대형 수납 박스, 책상 서랍"
              value={newStorageName}
              onChange={(e) => setNewStorageName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">아이콘</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '10px', padding: '4px' }}>
              {['📦', '🗄️', '💼', '👔', '🥾', '🧴', '💄', '🧸'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewStorageIcon(emoji)}
                  style={{
                    fontSize: '22px',
                    border: newStorageIcon === emoji ? '2px solid var(--toss-blue)' : '1px solid var(--border-medium)',
                    background: newStorageIcon === emoji ? 'var(--toss-blue-light)' : 'var(--bg-app)',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="button" 
            className="btn-primary"
            onClick={handleCreateStorageInline}
            disabled={!newStorageName.trim()}
          >
            수납처 생성하기
          </button>
        </div>
      </BottomSheet>

      {/* 3. 새 세부위치 추가 바텀시트 */}
      <BottomSheet 
        isOpen={isSectionModalOpen} 
        onClose={() => setIsSectionModalOpen(false)}
        title="새로운 세부 위치 생성"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--toss-blue-light)', padding: '10px', borderRadius: '8px' }}>
            수납처 <strong>[{storages.find(st => st.id === selectedStorageId)?.name}]</strong> 내부에 칸/서랍을 생성합니다.
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">세부 위치 이름</label>
            <input 
              type="text" 
              className="input-text"
              placeholder="예: 첫 번째 칸, 왼쪽 서랍, 수납 케이스 A"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
            />
          </div>

          <button 
            type="button" 
            className="btn-primary"
            onClick={handleCreateSectionInline}
            disabled={!newSectionName.trim()}
          >
            세부 위치 생성하기
          </button>
        </div>
      </BottomSheet>
      
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
