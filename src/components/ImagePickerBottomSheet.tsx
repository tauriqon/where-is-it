import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { openCamera, fetchAlbumPhotos, generateHapticFeedback } from '@apps-in-toss/web-framework';

interface ImagePickerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (file: File) => void;
  title?: string;
  subtitle?: string;
}

// Data URI를 안전하게 File 객체로 변환하는 유틸리티
function dataUriToFile(dataUri: string, filename: string): File {
  try {
    const arr = dataUri.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || arr[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.warn('[ImagePicker] DataURI to File fallback used:', err);
    return new File([], filename, { type: 'image/jpeg' });
  }
}

export const ImagePickerBottomSheet: React.FC<ImagePickerBottomSheetProps> = ({
  isOpen,
  onClose,
  onImageSelected,
  title = '사진 등록',
  subtitle = '등록 방식을 선택해 주세요 (파일 선택 배제)'
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const triggerHaptic = (type: 'selection' | 'success' | 'error') => {
    try {
      generateHapticFeedback({ type });
    } catch {
      // Ignore if not in Toss WebView
    }
  };

  // 1. 카메라로 직접 촬영
  const handleCameraClick = async () => {
    triggerHaptic('selection');
    try {
      // 토스 네이티브 카메라 시도
      const res = await openCamera({ base64: true });
      if (res && res.dataUri) {
        const file = dataUriToFile(res.dataUri, `camera_${Date.now()}.jpg`);
        triggerHaptic('success');
        onImageSelected(file);
        onClose();
        return;
      }
    } catch (err) {
      console.log('[ImagePicker] Native openCamera failed, fallback to capture input:', err);
    }
    // 웹뷰/브라우저 fallback: capture="environment"로 파일 탐색창 없이 카메라 즉시 실행
    cameraInputRef.current?.click();
  };

  // 2. 사진 앨범(보관함)에서 선택
  const handleAlbumClick = async () => {
    triggerHaptic('selection');
    try {
      // 토스 네이티브 사진첩 시도 (Toss 앱 내 전용 앨범 피커가 열리며 '파일에서 선택' 메뉴 없음)
      const res = await fetchAlbumPhotos({ maxCount: 1, base64: true });
      if (res && res.length > 0 && res[0].dataUri) {
        const file = dataUriToFile(res[0].dataUri, `album_${Date.now()}.jpg`);
        triggerHaptic('success');
        onImageSelected(file);
        onClose();
        return;
      }
    } catch (err) {
      console.log('[ImagePicker] Native fetchAlbumPhotos failed, fallback to standard input:', err);
    }
    // 웹뷰/브라우저 fallback: 표준 앨범 파일 인풋
    albumInputRef.current?.click();
  };

  // HTML5 파일 인풋 change 핸들러
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일(사진)만 등록 가능합니다.');
        e.target.value = '';
        return;
      }
      triggerHaptic('success');
      onImageSelected(file);
      onClose();
    }
    e.target.value = '';
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: '16px 20px calc(24px + env(safe-area-inset-bottom, 12px)) 20px',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div 
          style={{
            width: '40px',
            height: '4px',
            background: '#e5e8eb',
            borderRadius: '2px',
            margin: '0 auto 4px auto'
          }} 
        />

        {/* 상단 타이틀 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#191f28' }}>{title}</h3>
            {subtitle && (
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#8b95a1' }}>{subtitle}</p>
            )}
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: '#f2f4f6',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} color="#4e5968" />
          </button>
        </div>

        {/* 선택 버튼 목록 (카메라 촬영 & 사진 앨범 2가지만 제공) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          {/* 1. 카메라 촬영 버튼 */}
          <button
            type="button"
            onClick={handleCameraClick}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#f8f9fa',
              border: '1.5px solid #e5e8eb',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s'
            }}
          >
            <div 
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#e8f3ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Camera size={22} color="#3182f6" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#191f28' }}>카메라로 직접 촬영</div>
              <div style={{ fontSize: '12px', color: '#8b95a1', marginTop: '2px' }}>카메라를 열어 실시간으로 사진을 찍습니다</div>
            </div>
          </button>

          {/* 2. 사진 앨범(보관함) 선택 버튼 */}
          <button
            type="button"
            onClick={handleAlbumClick}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#f8f9fa',
              border: '1.5px solid #e5e8eb',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s'
            }}
          >
            <div 
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#edf7ed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ImageIcon size={22} color="#2e7d32" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#191f28' }}>사진 앨범(보관함)에서 선택</div>
              <div style={{ fontSize: '12px', color: '#8b95a1', marginTop: '2px' }}>스마트폰 갤러리에 저장된 사진을 불러옵니다</div>
            </div>
          </button>
        </div>

        {/* 취소 버튼 */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            height: '46px',
            background: '#f2f4f6',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            color: '#4e5968',
            cursor: 'pointer',
            marginTop: '4px'
          }}
        >
          취소
        </button>

        {/* 숨김 처리된 웹뷰 Fallback 파일 인풋들 */}
        {/* 카메라 전용: capture="environment"로 파일 탐색창 없이 카메라 즉시 실행 */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        {/* 앨범 전용 인풋 */}
        <input
          ref={albumInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </div>
    </div>
  );
};
