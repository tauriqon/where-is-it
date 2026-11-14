import { Analytics, Review } from '@apps-in-toss/web-framework';

/**
 * 로컬 스토리지 키
 */
const STORAGE_KEYS = {
  ITEMS_CREATED_COUNT: 'wii_analytics_items_created_count',
  LAST_REVIEW_REQUEST_TIME: 'wii_analytics_last_review_request_time',
  REVIEW_REQUESTED_COUNT: 'wii_analytics_review_requested_count',
} as const;

const getStoredNumber = (key: string, defaultValue: number = 0): number => {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? parseInt(val, 10) || defaultValue : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStoredNumber = (key: string, value: number): void => {
  try {
    localStorage.setItem(key, value.toString());
  } catch (e) {
    console.warn(`[Analytics] Failed to save ${key}:`, e);
  }
};

/**
 * 토스 분석 이벤트 로깅 코어 함수
 */
export const trackEvent = async (log_name: string, params: Record<string, any> = {}): Promise<void> => {
  try {
    if (typeof Analytics !== 'undefined' && Analytics?.log) {
      await Analytics.log({
        log_type: 'event',
        log_name,
        params: {
          ...params,
          timestamp: Date.now(),
        },
      });
      console.log(`[Analytics] 📊 Event sent to Toss: "${log_name}"`, params);
    } else {
      console.log(`[Analytics:DEV] Event: "${log_name}"`, params);
    }
  } catch (err) {
    console.warn(`[Analytics] Failed to send event "${log_name}":`, err);
  }
};

/**
 * 토스 공식 인앱 리뷰(별점/평가) 요청 함수
 * - 물건 등록이나 검색 성공 등 기분 좋은 시점에 호출
 * - 과도한 팝업 방지를 위해 최소 14일 쿨다운 및 생성 횟수 기반 트리거
 */
export const requestInAppReview = async (reason: string = 'milestone', force: boolean = false): Promise<boolean> => {
  try {
    const isSupported = typeof Review !== 'undefined' && 
                        Review?.request?.isSupported && 
                        Review.request.isSupported();

    const now = Date.now();
    const lastRequestTime = getStoredNumber(STORAGE_KEYS.LAST_REVIEW_REQUEST_TIME, 0);
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    // 14일 이내에 이미 요청한 적이 있다면 스킵 (단, 설정에서 직접 누른 경우 force=true로 바이패스)
    if (!force && (now - lastRequestTime < FOURTEEN_DAYS_MS)) {
      console.log(`[Review] Review request cooldown active. Skipping (reason: ${reason})`);
      return false;
    }

    // 자동 마일스톤 트리거인 경우에만 쿨다운 타이머 갱신 (수동 클릭은 방해하지 않음)
    if (!force) {
      setStoredNumber(STORAGE_KEYS.LAST_REVIEW_REQUEST_TIME, now);
    }
    const requestCount = getStoredNumber(STORAGE_KEYS.REVIEW_REQUESTED_COUNT, 0) + 1;
    setStoredNumber(STORAGE_KEYS.REVIEW_REQUESTED_COUNT, requestCount);

    console.log(`[Review] ⭐ Requesting Toss In-App Review (${reason}, attempt #${requestCount})`);

    // 토스 분석에 리뷰 요청 트리거 이벤트도 함께 기록
    trackEvent('review_prompt_triggered', { reason, attempt: requestCount });

    if (!isSupported) {
      console.log('[Review] Toss Review.request is not supported in this environment (Dev/Web).');
      return false;
    }

    await Review.request();
    console.log('[Review] Toss Review.request completed successfully.');
    return true;
  } catch (err) {
    console.warn('[Review] Failed to execute Review.request:', err);
    return false;
  }
};

/**
 * [전환 지표 1] 물건 등록 완료 이벤트 추적
 * - 토스 콘솔 핵심 전환 지표: 'item_created'
 * - 등록 횟수에 따라 자연스러운 인앱 리뷰 유도
 */
export const trackItemCreated = async (itemName: string, hasExpiration: boolean = false): Promise<void> => {
  const currentCount = getStoredNumber(STORAGE_KEYS.ITEMS_CREATED_COUNT, 0) + 1;
  setStoredNumber(STORAGE_KEYS.ITEMS_CREATED_COUNT, currentCount);

  // 1. 토스 콘솔 전환 이벤트 전송 (핵심 지표)
  await trackEvent('item_created', {
    item_name: itemName,
    has_expiration: hasExpiration,
    total_created_count: currentCount,
  });

  // 2. 적절한 마일스톤(1번째, 3번째, 7번째 등록 완료) 시 인앱 리뷰 요청
  if (currentCount === 1 || currentCount === 3 || currentCount === 7) {
    // 사용자가 등록 완료 토스트와 화면 전환을 기분 좋게 확인한 후 1.2초 뒤 리뷰 바텀시트 요청
    setTimeout(() => {
      requestInAppReview(`item_created_count_${currentCount}`);
    }, 1200);
  }
};

/**
 * [전환 지표 2] 물건 검색 완료 이벤트 추적
 * - 유저가 검색창에서 물건을 검색하고 결과를 확인했을 때
 */
export const trackItemSearched = async (query: string, resultCount: number): Promise<void> => {
  if (!query || query.trim().length === 0) return;

  await trackEvent('item_searched', {
    query: query.trim(),
    result_count: resultCount,
  });

  // 검색 결과가 존재하여 성공적으로 물건을 찾은 경우 (만족도 높은 순간)
  if (resultCount > 0) {
    // 5회 검색 성공 시에도 리뷰 유도 기회 검토
    const searchSuccessCount = getStoredNumber('wii_analytics_search_success_count', 0) + 1;
    setStoredNumber('wii_analytics_search_success_count', searchSuccessCount);

    if (searchSuccessCount === 4) {
      setTimeout(() => {
        requestInAppReview('search_success_milestone');
      }, 1500);
    }
  }
};

/**
 * [전환 지표 3] 소비기한 / D-day 카드 확인 이벤트 추적
 */
export const trackExpiryViewed = async (impendingCount: number): Promise<void> => {
  await trackEvent('expiry_viewed', {
    impending_count: impendingCount,
  });
};
