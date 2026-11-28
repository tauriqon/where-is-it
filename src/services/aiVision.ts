/**
 * AI Vision 기반 사진 속 물건 대표 이름 및 스마트 태그 자동 추천 서비스
 *
 * 보안 및 중앙 한도 아키텍처 (v1.1.0-b00293):
 * - 클라이언트 번들에 Gemini API 키를 일절 포함하지 않고,
 *   Supabase Edge Function('recognize-item') 프록시를 통해 서버사이드에서 안전하게 호출합니다.
 * - 일일 허용 횟수(AI_DAILY_LIMIT)는 Supabase Edge Function Secrets에서 중앙 제어하므로
 *   앱 재빌드·심사 없이 서버 설정만으로 한도를 즉시 변경할 수 있습니다.
 * - 클라이언트는 네트워크 낭비 방지용 5초 연타 쿨다운만 수행합니다.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { showToast } from '../utils/toast';

export interface AiRecognitionResult {
  name: string | null;
  tags: string[];
  model?: string | null;
  elapsedMs?: number;
}

const AI_COOLDOWN_MS = 5000;
const LAST_CALL_STORAGE_KEY = 'wii_ai_vision_last_call_at';

let lastCallTimestampMem = 0;

const getLastCallTimestamp = (): number => {
  try {
    const raw = localStorage.getItem(LAST_CALL_STORAGE_KEY);
    const stored = raw ? parseInt(raw, 10) || 0 : 0;
    return Math.max(lastCallTimestampMem, stored);
  } catch {
    return lastCallTimestampMem;
  }
};

const recordCallTimestamp = (): void => {
  const now = Date.now();
  lastCallTimestampMem = now;
  try {
    localStorage.setItem(LAST_CALL_STORAGE_KEY, String(now));
  } catch {
    // ignore storage errors
  }
};

/**
 * 클라이언트 연타 방지 5초 쿨다운 검사
 */
const checkClientCooldown = (): boolean => {
  const now = Date.now();
  const lastCall = getLastCallTimestamp();
  if (now - lastCall < AI_COOLDOWN_MS) {
    showToast('잠시 후 다시 시도해 주세요. (AI 분석 5초 간격 제한)', 2500, 'info');
    return false;
  }
  return true;
};

/**
 * AI Vision 기능 사용 가능 여부
 * - Supabase Edge Function 프록시 연결 가능 여부로 판별합니다.
 */
export const isAiVisionConfigured = (): boolean => {
  return Boolean(isSupabaseConfigured && supabase);
};

/**
 * AI 분석 전용 초경량 이미지 리사이저
 * - 원본(5~10MB)을 512px 수준의 JPEG(약 30~50KB)로 압축하여
 * - 네트워크 전송 속도를 1초 이내로 단축하고 토큰 낭비를 원천 차단합니다.
 */
export const resizeImageForAI = async (
  file: File,
  maxSize: number = 512
): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let triedDataUrlFallback = false;
    let objectUrl: string | null = URL.createObjectURL(file);

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
        objectUrl = null;
      }
    };

    img.onload = () => {
      cleanup();
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context not available'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 80% 퀄리티 JPEG로 경량화 인코딩
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.split(',')[1];
        resolve({ base64Data, mimeType: 'image/jpeg' });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      cleanup();
      if (!triedDataUrlFallback) {
        triedDataUrlFallback = true;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            img.src = reader.result;
          } else {
            reject(err);
          }
        };
        reader.onerror = () => reject(err);
        reader.readAsDataURL(file);
        return;
      }
      reject(err);
    };

    img.src = objectUrl;
  });
};

/**
 * 사진 속 물건의 대표 이름 및 추천 태그(2~3개)를 Supabase Edge Function 프록시로 안전하게 분석
 * @param file 사진 파일
 * @param existingTags 사용자가 이미 등록해 둔 기존 태그 목록 (우선 재활용 유도)
 */
export const recognizeItemAndTags = async (
  file: File,
  existingTags: string[] = []
): Promise<AiRecognitionResult | null> => {
  if (!isSupabaseConfigured || !supabase) {
    console.info('[aiVision] Supabase가 설정되지 않아 사진 인식을 건너뜁니다.');
    return null;
  }

  if (!checkClientCooldown()) {
    return null;
  }

  try {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { base64Data, mimeType } = await resizeImageForAI(file, 512);

    recordCallTimestamp();

    const { data, error } = await supabase.functions.invoke('recognize-item', {
      body: {
        base64Data,
        mimeType,
        existingTags: existingTags.slice(0, 30),
      },
    });

    const elapsedMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
    );

    if (error) {
      const ctx = (error as { context?: Response })?.context;
      const status = ctx?.status;
      if (status === 429) {
        let errorCode = '';
        let serverLimit: number | undefined;
        try {
          const errBody = await ctx?.json();
          errorCode = errBody?.error || '';
          serverLimit = typeof errBody?.limit === 'number' ? errBody.limit : undefined;
        } catch {
          // ignore parse failure
        }

        if (errorCode === 'DAILY_LIMIT') {
          const limitLabel = serverLimit ? `(${serverLimit}회)` : '';
          showToast(
            `오늘의 AI 추천 횟수${limitLabel}를 모두 사용했어요. 직접 입력해 주세요.`,
            3200,
            'warning'
          );
        } else {
          showToast(
            'AI 분석 요청이 잠시 제한되었어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.',
            3000,
            'warning'
          );
        }
      } else {
        console.warn('[aiVision] Edge Function 호출 실패:', error);
      }
      return null;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    const cleanName =
      typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name.trim()
        : null;

    const cleanTags = Array.isArray(data.tags)
      ? data.tags
          .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t: string) => t.trim())
      : [];

    const usedModel =
      typeof data.model === 'string' && data.model.trim().length > 0
        ? data.model.trim()
        : null;

    return {
      name: cleanName,
      tags: cleanTags,
      model: usedModel,
      elapsedMs,
    };
  } catch (err) {
    console.warn('[aiVision] 이미지 분석 중 오류 발생:', err);
    return null;
  }
};

/**
 * 하위 호환성용 래퍼 함수 (이름만 반환)
 */
export const recognizeItemFromImage = async (file: File): Promise<string | null> => {
  const result = await recognizeItemAndTags(file);
  return result?.name || null;
};
