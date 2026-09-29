// src/utils/expiration.ts

/**
 * 유통기한 기준 D-Day(남은 일수)를 계산합니다.
 * - 반환값 > 0: 남은 일수 (예: 3 -> 3일 남음)
 * - 반환값 = 0: 오늘 만료
 * - 반환값 < 0: 만료된 일수 (예: -3 -> 3일 지남)
 */
export const getDDay = (expirationDate: string): number => {
  const exp = new Date(expirationDate);
  const today = new Date();
  exp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export interface ExpirationBadgeInfo {
  dday: number;
  label: string;
  color: string;
  bg: string;
  border: string;
  isExpired: boolean;
  isImminent: boolean;
}

/**
 * 1안: 한글 자연어 기반의 직관적인 유통기한 뱃지 정보를 반환합니다.
 * - 지남 (dday < 0): "🚨 N일 지남" (빨간색)
 * - 당일 (dday === 0): "⚠️ 오늘까지" (빨간색)
 * - 1일 남음 (dday === 1): "⏰ 내일까지" (선명한 주황색)
 * - 임박 (1 < dday <= notifyDays): "N일 남음" (주황색)
 * - 여유 (dday > notifyDays): "N일 남음" (차분한 그레이)
 */
export const getExpirationBadgeInfo = (
  expirationDate: string,
  customNotifyDays?: number
): ExpirationBadgeInfo => {
  const dday = getDDay(expirationDate);
  const notifyDays = customNotifyDays ?? (() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('wii_expiration_notify_days') : null;
    return saved ? parseInt(saved, 10) : 7;
  })();

  const isExpired = dday < 0;
  const isImminent = dday >= 0 && dday <= notifyDays;

  let label = '';
  let color = 'var(--text-secondary)';
  let bg = 'var(--bg-input)';
  let border = '1px solid var(--border-medium)';

  if (isExpired) {
    label = `🚨 ${Math.abs(dday)}일 지남`;
    color = 'var(--accent-red)';
    bg = 'var(--accent-red-light)';
    border = 'none';
  } else if (dday === 0) {
    label = '⚠️ 오늘까지';
    color = 'var(--accent-red)';
    bg = 'var(--accent-red-light)';
    border = '1px solid rgba(240, 68, 85, 0.2)';
  } else if (dday === 1) {
    label = '⏰ 내일까지';
    color = 'rgba(255, 120, 0, 1)';
    bg = 'rgba(255, 149, 0, 0.12)';
    border = '1px solid rgba(255, 149, 0, 0.25)';
  } else if (isImminent) {
    label = `${dday}일 남음`;
    color = 'rgba(255, 140, 0, 1)';
    bg = 'rgba(255, 149, 0, 0.1)';
    border = '1px solid rgba(255, 149, 0, 0.2)';
  } else {
    label = `${dday}일 남음`;
    color = 'var(--text-secondary)';
    bg = 'var(--bg-input)';
    border = '1px solid var(--border-medium)';
  }

  return {
    dday,
    label,
    color,
    bg,
    border,
    isExpired,
    isImminent
  };
};
