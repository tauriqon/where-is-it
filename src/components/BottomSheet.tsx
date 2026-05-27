import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
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
        <div className="bottom-sheet-drag-handle" onClick={onClose} />
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="h2-title">{title}</h3>
            <button 
              onClick={onClose} 
              style={{ 
                border: 'none', 
                background: 'none', 
                fontSize: '20px', 
                color: 'var(--text-tertiary)', 
                cursor: 'pointer',
                padding: '4px' 
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ paddingBottom: '10px' }}>
          {children}
        </div>
      </div>
    </div>,
    targetContainer
  );
};
export default BottomSheet;
