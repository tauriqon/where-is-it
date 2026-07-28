import { GoogleAdMob } from '@apps-in-toss/web-framework';

const INTERSTITIAL_AD_GROUP_ID = import.meta.env.VITE_INTERSTITIAL_AD_GROUP_ID || 'test-interstitial-ad';
const REWARDED_AD_GROUP_ID = import.meta.env.VITE_REWARDED_AD_GROUP_ID || 'test-rewarded-ad';

// 쿨다운 카운터 (광고가 너무 자주 나오는 것을 피하기 위함)
let interstitialCount = 0;

/**
 * 30개 물건 초과 유저가 핵심 액션을 할 때 간헐적으로 전면 광고를 송출합니다.
 */
export const triggerInterstitialAd = async (): Promise<boolean> => {
  interstitialCount++;
  // 3회 액션마다 1회 광고 송출
  if (interstitialCount % 3 !== 0) {
    console.log(`[Ads] Interstitial ad cooldown active (${interstitialCount % 3}/3)`);
    return false;
  }

  const isSupported = typeof GoogleAdMob !== 'undefined' && 
                      GoogleAdMob?.showAppsInTossAdMob?.isSupported && 
                      GoogleAdMob.showAppsInTossAdMob.isSupported();

  if (!isSupported) {
    console.log('[Ads] AdMob not supported in this environment. Showing simulated interstitial ad.');
    // 브라우저 환경에서는 얼럿으로 시뮬레이션
    alert('📺 [광고 시뮬레이션] 30개 물건 초과 등록/수정으로 인해 전면 광고가 실행되었습니다.');
    return true;
  }

  return new Promise((resolve) => {
    try {
      // 1. 광고 미리 불러오기 (비동기)
      if (GoogleAdMob.loadAppsInTossAdMob?.isSupported()) {
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
    if (GoogleAdMob.loadAppsInTossAdMob?.isSupported()) {
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
