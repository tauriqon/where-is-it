/**
 * 토스(Toss) 스타일의 경량 인앱 플로팅 토스트 및 5초 실행 취소(Undo) 유틸리티
 */

const safeHaptic = (type: 'tap' | 'success' | 'warning' = 'tap') => {
  try {
    const toss = (typeof window !== 'undefined' ? (window as any).toss : null);
    if (toss?.haptic?.trigger) {
      toss.haptic.trigger(type === 'success' ? 'success' : 'tap');
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(type === 'success' ? [30, 50, 30] : 15);
    }
  } catch (e) {
    // ignore
  }
};

export const showToast = (
  message: string,
  duration: number = 2500,
  type: 'info' | 'success' | 'warning' = 'info'
) => {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('wii-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'wii-toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: calc(85px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      width: 90%;
      max-width: 420px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'warning' ? '#ff3b30' : type === 'success' ? '#3182f6' : '#191f28';

  toast.style.cssText = `
    background: ${bg};
    color: #ffffff;
    padding: 12px 18px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    text-align: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    opacity: 0;
    transform: translateY(12px) scale(0.96);
    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    word-break: keep-all;
  `;
  toast.textContent = message;

  container.appendChild(toast);

  // 애니메이션 시작
  requestAnimationFrame(() => {
    toast.style.opacity = '0.96';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  // 설정 시간 후 자동 페이드아웃 및 제거
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px) scale(0.96)';
    setTimeout(() => {
      toast.remove();
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
};

export interface UndoToastOptions {
  message: string;
  duration?: number; // 기본값 5000ms
  undoButtonText?: string; // 기본값 '실행 취소'
  onUndo: () => void | Promise<void>;
  onCommit?: () => void | Promise<void>;
}

let activeUndoSession: {
  commitNow: () => void;
  element: HTMLElement;
  timerId: any;
  countdownId: any;
} | null = null;

// 브라우저 닫기/새로고침 시 대기 중인 삭제 확정(Commit) 처리
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (activeUndoSession) {
      activeUndoSession.commitNow();
    }
  });
}

/**
 * 토스 스타일의 5초 삭제 실행 취소(Undo) 플로팅 토스트
 * 탭 한 번으로 즉시 취소하거나 5초 경과 시 자동 확정(Commit)
 */
export const showUndoToast = (options: UndoToastOptions) => {
  if (typeof document === 'undefined') return;

  const {
    message,
    duration = 5000,
    undoButtonText = '실행 취소',
    onUndo,
    onCommit,
  } = options;

  // 1. 만약 이전의 실행 취소 토스트가 아직 대기 중이라면 즉시 확정(Commit) 처리 후 교체
  if (activeUndoSession) {
    activeUndoSession.commitNow();
  }

  let container = document.getElementById('wii-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'wii-toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: calc(85px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      width: 90%;
      max-width: 420px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: #191f28;
    color: #ffffff;
    padding: 10px 14px 10px 16px;
    border-radius: 18px;
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1.4;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    opacity: 0;
    transform: translateY(12px) scale(0.96);
    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    word-break: keep-all;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    pointer-events: auto;
    overflow: hidden;
    position: relative;
  `;

  // Left Text Area
  const textArea = document.createElement('div');
  textArea.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  `;

  const iconSpan = document.createElement('span');
  iconSpan.textContent = '🗑️';
  iconSpan.style.cssText = `font-size: 15px; flex-shrink: 0;`;

  const msgSpan = document.createElement('span');
  msgSpan.style.cssText = `
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #f2f4f6;
    font-weight: 500;
    font-size: 13.5px;
  `;
  msgSpan.textContent = message;

  let remainingSec = Math.ceil(duration / 1000);
  const countdownSpan = document.createElement('span');
  countdownSpan.style.cssText = `
    font-size: 11.5px;
    color: #8b95a1;
    font-weight: 600;
    flex-shrink: 0;
  `;
  countdownSpan.textContent = `(${remainingSec}초)`;

  textArea.appendChild(iconSpan);
  textArea.appendChild(msgSpan);
  textArea.appendChild(countdownSpan);

  // Right Undo Button
  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.textContent = undoButtonText;
  undoBtn.style.cssText = `
    background: #3182f6;
    color: #ffffff;
    border: none;
    padding: 7px 13px;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(49, 130, 246, 0.4);
    transition: transform 0.15s ease, background 0.15s ease;
  `;

  undoBtn.onmousedown = () => { undoBtn.style.transform = 'scale(0.95)'; };
  undoBtn.onmouseup = () => { undoBtn.style.transform = 'scale(1)'; };
  undoBtn.ontouchstart = () => { undoBtn.style.transform = 'scale(0.95)'; };
  undoBtn.ontouchend = () => { undoBtn.style.transform = 'scale(1)'; };

  // Bottom Progress line
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: #3182f6;
    width: 100%;
    transition: width ${duration}ms linear;
  `;

  toast.appendChild(textArea);
  toast.appendChild(undoBtn);
  toast.appendChild(progressBar);
  container.appendChild(toast);

  // Animation start
  requestAnimationFrame(() => {
    toast.style.opacity = '0.98';
    toast.style.transform = 'translateY(0) scale(1)';
    requestAnimationFrame(() => {
      progressBar.style.width = '0%';
    });
  });

  let isHandled = false;

  const cleanupDOM = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px) scale(0.96)';
    setTimeout(() => {
      toast.remove();
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    }, 280);
  };

  const doCommit = async () => {
    if (isHandled) return;
    isHandled = true;
    clearInterval(countdownId);
    clearTimeout(timerId);
    if (activeUndoSession?.element === toast) {
      activeUndoSession = null;
    }
    cleanupDOM();
    try {
      if (onCommit) await onCommit();
    } catch (err) {
      console.warn('[UndoToast] Error committing deletion:', err);
    }
  };

  const doUndo = async () => {
    if (isHandled) return;
    isHandled = true;
    safeHaptic('success');
    clearInterval(countdownId);
    clearTimeout(timerId);
    if (activeUndoSession?.element === toast) {
      activeUndoSession = null;
    }
    cleanupDOM();
    try {
      await onUndo();
      showToast('삭제를 취소했습니다.', 2000, 'success');
    } catch (err) {
      console.warn('[UndoToast] Error executing undo:', err);
      showToast('실행 취소 중 오류가 발생했습니다.', 2500, 'warning');
    }
  };

  undoBtn.onclick = (e) => {
    e.stopPropagation();
    doUndo();
  };

  // 1초마다 카운트다운 텍스트 갱신
  const countdownId = setInterval(() => {
    remainingSec -= 1;
    if (remainingSec > 0) {
      countdownSpan.textContent = `(${remainingSec}초)`;
    } else {
      clearInterval(countdownId);
    }
  }, 1000);

  const timerId = setTimeout(() => {
    doCommit();
  }, duration);

  activeUndoSession = {
    commitNow: doCommit,
    element: toast,
    timerId,
    countdownId,
  };
};
