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

export interface CustomAlertOptions {
  title?: string;
  buttonText?: string;
}

export interface CustomConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

/**
 * 토스(Toss) 스타일의 커스텀 인앱 Alert 모달
 * 브라우저 기본 alert('https://... 페이지 내용:')을 대체하여 깔끔한 모달 제공
 */
export const showCustomAlert = (
  message: string,
  options?: CustomAlertOptions
): Promise<void> => {
  if (typeof document === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    safeHaptic('tap');
    const { title = '알림', buttonText = '확인' } = options || {};

    const overlay = document.createElement('div');
    overlay.className = 'wii-custom-alert-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #ffffff;
      width: 100%;
      max-width: 320px;
      border-radius: 24px;
      padding: 24px 20px 20px 20px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
      transform: scale(0.92) translateY(8px);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.style.cssText = `
        margin: 0 0 10px 0;
        font-size: 17px;
        font-weight: 700;
        color: #191f28;
        letter-spacing: -0.3px;
      `;
      titleEl.textContent = title;
      card.appendChild(titleEl);
    }

    const msgEl = document.createElement('p');
    msgEl.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 14.5px;
      line-height: 1.5;
      color: #4e5968;
      white-space: pre-line;
      word-break: keep-all;
    `;
    msgEl.textContent = message;
    card.appendChild(msgEl);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `
      width: 100%;
      padding: 13px 0;
      background: #3182f6;
      color: #ffffff;
      border: none;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      transition: transform 0.1s ease, background 0.15s ease;
    `;
    btn.textContent = buttonText;

    btn.onmousedown = () => { btn.style.transform = 'scale(0.97)'; };
    btn.onmouseup = () => { btn.style.transform = 'scale(1)'; };
    btn.ontouchstart = () => { btn.style.transform = 'scale(0.97)'; };
    btn.ontouchend = () => { btn.style.transform = 'scale(1)'; };

    let isClosed = false;
    const close = () => {
      if (isClosed) return;
      isClosed = true;
      safeHaptic('tap');
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.92) translateY(8px)';
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 200);
    };

    btn.onclick = close;
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        window.removeEventListener('keydown', handleKeyDown);
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      card.style.transform = 'scale(1) translateY(0)';
      btn.focus();
    });
  });
};

/**
 * 토스(Toss) 스타일의 커스텀 인앱 Confirm 모달
 * 브라우저 기본 confirm('https://... 페이지 내용:')을 대체하여 비동기 Promise<boolean> 제공
 */
export const showCustomConfirm = (
  message: string,
  options?: CustomConfirmOptions
): Promise<boolean> => {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    safeHaptic('tap');
    const {
      title = '확인',
      confirmText = '확인',
      cancelText = '취소',
      isDanger = false
    } = options || {};

    const overlay = document.createElement('div');
    overlay.className = 'wii-custom-confirm-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #ffffff;
      width: 100%;
      max-width: 320px;
      border-radius: 24px;
      padding: 24px 20px 20px 20px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
      transform: scale(0.92) translateY(8px);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.style.cssText = `
        margin: 0 0 10px 0;
        font-size: 17px;
        font-weight: 700;
        color: #191f28;
        letter-spacing: -0.3px;
      `;
      titleEl.textContent = title;
      card.appendChild(titleEl);
    }

    const msgEl = document.createElement('p');
    msgEl.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 14.5px;
      line-height: 1.5;
      color: #4e5968;
      white-space: pre-line;
      word-break: keep-all;
    `;
    msgEl.textContent = message;
    card.appendChild(msgEl);

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      width: 100%;
      display: flex;
      gap: 10px;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 13px 0;
      background: #f2f4f6;
      color: #4e5968;
      border: none;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: transform 0.1s ease, background 0.15s ease;
    `;
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    const confirmBg = isDanger ? '#ff3b30' : '#3182f6';
    confirmBtn.style.cssText = `
      flex: 1;
      padding: 13px 0;
      background: ${confirmBg};
      color: #ffffff;
      border: none;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      transition: transform 0.1s ease, background 0.15s ease;
    `;
    confirmBtn.textContent = confirmText;

    const setupBtnEvents = (b: HTMLElement) => {
      b.onmousedown = () => { b.style.transform = 'scale(0.97)'; };
      b.onmouseup = () => { b.style.transform = 'scale(1)'; };
      b.ontouchstart = () => { b.style.transform = 'scale(0.97)'; };
      b.ontouchend = () => { b.style.transform = 'scale(1)'; };
    };
    setupBtnEvents(cancelBtn);
    setupBtnEvents(confirmBtn);

    let isClosed = false;
    const closeWith = (result: boolean) => {
      if (isClosed) return;
      isClosed = true;
      safeHaptic('tap');
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.92) translateY(8px)';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    cancelBtn.onclick = () => closeWith(false);
    confirmBtn.onclick = () => closeWith(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', handleKeyDown);
        closeWith(false);
      } else if (e.key === 'Enter') {
        window.removeEventListener('keydown', handleKeyDown);
        closeWith(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    card.appendChild(btnContainer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      card.style.transform = 'scale(1) translateY(0)';
      confirmBtn.focus();
    });
  });
};

