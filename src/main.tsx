import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { showCustomAlert } from './utils/toast'

// 브라우저 기본 alert('https://... 페이지 내용:')을 차단하고 토스 스타일 인앱 모달로 대체
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    void showCustomAlert(String(message ?? ''));
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

