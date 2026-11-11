import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { showToast } from '../utils/toast';

const INTERSTITIAL_AD_GROUP_ID = import.meta.env.VITE_INTERSTITIAL_AD_GROUP_ID || 'ait.v2.live.41b1a3be69b94e33';
const REWARDED_AD_GROUP_ID = import.meta.env.VITE_REWARDED_AD_GROUP_ID || 'test-rewarded-ad';

// 로컬 스토리지 키 관리
const STORAGE_KEYS = {
  SAVE_EDIT_COUNT: 'wii_ad_save_edit_count',
  SEARCH_VIEW_COUNT: 'wii_ad_search_view_count',
  LAST_SHOWN_TIME: 'wii_ad_last_shown_time',
} as const;

// 광고 정책 상수
const MIN_ITEMS_FOR_ADS = 30; // 30개 이상 보관 시 노출 대상
const SAVE_EDIT_FREQUENCY = 5; // 등록/수정 5회마다 1회
const SEARCH_VIEW_FREQUENCY = 7; // 검색상세 7회마다 1회
const COOLDOWN_MS = 5 * 60 * 1000; // 최소 5분 시간 쿨다운 (300,000ms)

/**
 * 안전한 로컬 스토리지 숫자 읽기
 */
const getStoredNumber = (key: string, defaultValue: number = 0): number => {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? parseInt(val, 10) || defaultValue : defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * 안전한 로컬 스토리지 숫자 저장
 */
const setStoredNumber = (key: string, value: number): void => {
  try {
    localStorage.setItem(key, value.toString());
  } catch (e) {
    console.warn(`[Ads] Failed to save ${key} to localStorage:`, e);
  }
};

/**
 * 전면 광고 송출 코어 로직
 * - 5분 쿨다운 검증
 * - 사전 안내 토스트 노출 후 1초 대기 (사용자 UX 보호)
 * - 토스 SDK를 통한 전면 광고 재생 및 완료 대기
 */
const showInterstitialCore = async (reason: string): Promise<boolean> => {
  const now = Date.now();
  const lastShownTime = getStoredNumber(STORAGE_KEYS.LAST_SHOWN_TIME, 0);

  // 1. 5분 시간 쿨다운 검증
  if (now - lastShownTime < COOLDOWN_MS) {
    const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastShownTime)) / 1000);
    console.log(`[Ads] Cooldown active (${remainingSec}s remaining). Skipping ad for: ${reason}`);
    return false;
  }

  const isSupported = typeof GoogleAdMob !== 'undefined' && 
                      GoogleAdMob?.showAppsInTossAdMob?.isSupported && 
                      GoogleAdMob.showAppsInTossAdMob.isSupported();

  // 2. 광고 실행 전 사용자에게 부드러운 사전 안내 토스트 노출 (돌발 팝업 방지 UX)
  showToast('💡 30개 이상 보관 중: 잠시 후 안내 광고가 표시됩니다.', 2200, 'info');

  // 사용자가 안내를 자연스럽게 인지할 수 있도록 1초 대기
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 쿨다운 시작 시점 기록 (사용자 피로도 방지를 위해 광고 요청 시점부터 즉시 쿨다운 적용)
  setStoredNumber(STORAGE_KEYS.LAST_SHOWN_TIME, Date.now());

  if (!isSupported) {
    console.log(`[Ads] AdMob not supported in this environment (${reason}). Showing simulated interstitial ad.`);
    showToast('📺 [광고 시뮬레이션] 30개 초과 무료 보관 안내 광고가 정상 완료되었습니다.', 2500, 'success');
    return true;
  }

  return new Promise((resolve) => {
    try {
      // 1. 광고 미리 불러오기 (지원 시)
      if (GoogleAdMob.loadAppsInTossAdMob?.isSupported?.()) {
        GoogleAdMob.loadAppsInTossAdMob({
          options: { adGroupId: INTERSTITIAL_AD_GROUP_ID },
          onEvent: (event) => console.log('[Ads] Interstitial Load Event:', event.type),
          onError: (err) => console.warn('[Ads] Interstitial Load Error:', err)
        });
      }

      // 2. 광고 재생
      GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: INTERSTITIAL_AD_GROUP_ID },
        onEvent: (event) => {
          console.log('[Ads] Interstitial Event:', event.type);
          if (event.type === 'dismissed' || event.type === 'failedToShow') {
            resolve(event.type === 'dismissed');
          }
        },
        onError: (err) => {
          console.warn('[Ads] Interstitial error showing:', err);
          resolve(false);
        }
      });
    } catch (e) {
      console.error('[Ads] Interstitial ad crash:', e);
      resolve(false);
    }
  });
};

/**
 * [정책 1] 물건 등록 및 수정 시 광고 트리거
 * - 보관 물건 30개 이상 보유 시에만 활성화
 * - 등록/수정 5회마다 1회 노출
 * - 직전 광고 노출 후 5분 쿨다운 필수 충족
 */
export const triggerSaveEditAd = async (totalItemCount: number): Promise<boolean> => {
  if (totalItemCount < MIN_ITEMS_FOR_ADS) {
    return false;
  }

  const currentCount = getStoredNumber(STORAGE_KEYS.SAVE_EDIT_COUNT, 0) + 1;
  setStoredNumber(STORAGE_KEYS.SAVE_EDIT_COUNT, currentCount);

  console.log(`[Ads] Save/Edit action counted: ${currentCount} (trigger at multiple of ${SAVE_EDIT_FREQUENCY})`);

  if (currentCount % SAVE_EDIT_FREQUENCY === 0) {
    return await showInterstitialCore(`Save/Edit #${currentCount}`);
  }
  return false;
};

/**
 * [정책 2] 검색 결과 상세 조회 시 광고 트리거
 * - 보관 물건 30개 이상 보유 시에만 활성화
 * - 검색 상세 조회 7회마다 1회 노출
 * - 직전 광고 노출 후 5분 쿨다운 필수 충족
 */
export const triggerSearchViewAd = async (totalItemCount: number): Promise<boolean> => {
  if (totalItemCount < MIN_ITEMS_FOR_ADS) {
    return false;
  }

  const currentCount = getStoredNumber(STORAGE_KEYS.SEARCH_VIEW_COUNT, 0) + 1;
  setStoredNumber(STORAGE_KEYS.SEARCH_VIEW_COUNT, currentCount);

  console.log(`[Ads] Search View action counted: ${currentCount} (trigger at multiple of ${SEARCH_VIEW_FREQUENCY})`);

  if (currentCount % SEARCH_VIEW_FREQUENCY === 0) {
    return await showInterstitialCore(`Search View #${currentCount}`);
  }
  return false;
};

/**
 * 하위 호환성을 위한 기존 triggerInterstitialAd 래퍼
 */
export const triggerInterstitialAd = async (): Promise<boolean> => {
  return triggerSaveEditAd(MIN_ITEMS_FOR_ADS);
};

/**
 * 가족 공유 활성화를 위해 보상형 동영상 광고를 재생합니다.
 */
export const triggerRewardedAd = async (onSuccess: () => void): Promise<void> => {
  const isSupported = typeof GoogleAdMob !== 'undefined' && 
                      GoogleAdMob?.showAppsInTossAdMob?.isSupported && 
                      GoogleAdMob.showAppsInTossAdMob.isSupported();

  // 1. 토스 SDK 미지원 환경이거나 아직 토스 콘솔 광고 그룹 ID가 등록되지 않은 테스트 모드일 때
  const isTestAdGroup = REWARDED_AD_GROUP_ID.startsWith('test-');

  if (!isSupported || isTestAdGroup) {
    console.log('[Ads] AdMob test mode active. Triggering test rewarded ad dialog.');
    const confirmWatch = window.confirm(
      '🎬 [보상형 광고 테스트 모드]\n\n토스 콘솔 정식 광고 ID 등록 전 테스트입니다.\n30초 동영상 광고 시청을 완료하고 24시간 동안 가족 공유 기능을 해금하시겠습니까?'
    );
    if (confirmWatch) {
      alert('🎉 광고 시청 완료! 24시간 동안 가족 공유 기능이 해금되었습니다.');
      onSuccess();
    }
    return;
  }

  // 2. 실토스 앱 SDK 연동
  try {
    if (GoogleAdMob.loadAppsInTossAdMob?.isSupported?.()) {
      GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (event) => console.log('[Ads] Rewarded Load Event:', event.type),
        onError: (err) => console.warn('[Ads] Rewarded Load Error:', err)
      });
    }
  } catch (err) {
    console.warn('[Ads] Failed to preload rewarded ad:', err);
  }

  return new Promise((resolve) => {
    let rewarded = false;

    GoogleAdMob.showAppsInTossAdMob({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        console.log('[Ads] Rewarded Event:', event.type);
        if (event.type === 'userEarnedReward') {
          rewarded = true;
        } else if (event.type === 'dismissed') {
          if (rewarded) {
            onSuccess();
          } else {
            alert('⚠️ 동영상 광고를 끝까지 시청해야 보상이 지급됩니다.');
          }
          resolve();
        } else if (event.type === 'failedToShow') {
          console.warn('[Ads] Rewarded ad failed to show, fallback auto-grant reward for UX.');
          alert('🎬 [테스트 모드] 광고가 송출되어 24시간 해금이 적용되었습니다.');
          onSuccess();
          resolve();
        }
      },
      onError: (err) => {
        console.error('[Ads] Rewarded ad error:', err);
        alert('🎬 [테스트 모드] 광고 시청 완료 처리되어 24시간 해금이 적용되었습니다.');
        onSuccess();
        resolve();
      }
    });
  });
};
