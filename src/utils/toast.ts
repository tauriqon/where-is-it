/**
 * 토스(Toss) 스타일의 경량 인앱 플로팅 토스트 유틸리티
 */
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
