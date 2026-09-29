import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, subtitle, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Stacking Context 탈출을 위해 모바일 폰 래퍼(.app-wrapper) 하단에 포털로 강제 주입
  const targetContainer = document.querySelector('.app-wrapper') || document.body;

  return createPortal(
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        {/* 고정 상단 헤더 영역 (스크롤되지 않음) */}
        <div className="bottom-sheet-header">
          <div className="bottom-sheet-drag-handle" onClick={onClose} />
          {title && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {typeof title === 'string' ? (
                  <h3 className="h2-title" style={{ margin: 0, fontSize: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </h3>
                ) : (
                  title
                )}
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="bottom-sheet-close-btn"
                aria-label="닫기"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
          )}
          {subtitle && (
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="bottom-sheet-body">
          {children}
        </div>
      </div>
    </div>,
    targetContainer
  );
};
export default BottomSheet;
