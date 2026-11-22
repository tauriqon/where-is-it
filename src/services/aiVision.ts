/**
 * AI Vision 기반 사진 속 물건 대표 이름 및 스마트 태그 자동 추천 서비스 (Google Gemini)
 */

export interface AiRecognitionResult {
  name: string | null;
  tags: string[];
}

/**
 * AI Vision 기능 사용 가능 여부 (API 키 설정 여부 판별)
 */
export const isAiVisionConfigured = (): boolean => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  return Boolean(apiKey && apiKey.trim() && apiKey.trim() !== 'YOUR_GEMINI_API_KEY_HERE');
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
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

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

    img.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * 사진 속 물건의 대표 이름 및 추천 태그(2~3개)를 단 1회의 AI 호출로 동시 분석
 * @param file 사진 파일
 * @param existingTags 사용자가 이미 등록해 둔 기존 태그 목록 (우선 재활용 유도)
 */
export const recognizeItemAndTags = async (
  file: File,
  existingTags: string[] = []
): Promise<AiRecognitionResult | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey.trim() === 'YOUR_GEMINI_API_KEY_HERE') {
    console.info('[aiVision] VITE_GEMINI_API_KEY가 설정되지 않아 사진 인식을 건너뜁니다.');
    return null;
  }

  try {
    const { base64Data, mimeType } = await resizeImageForAI(file, 512);

    const existingTagsHint = existingTags.length > 0
      ? `사용자의 기존 태그 목록: [${existingTags.slice(0, 30).join(', ')}]. 기존 태그 목록 중 어울리는 것이 있다면 우선 활용하고, 필요시 어울리는 새 태그를 1~2개 추가해줘.`
      : '물건의 카테고리, 용도, 특성을 나타내는 간결한 한국어 태그 2~3개를 추천해줘.';

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `이 사진 속 가장 중심이 되는 단일 물건을 분석하여 다음 JSON 형식으로만 정확히 답변해줘:
{
  "name": "간결한 한국어 대표 명사 (1~3단어 내외, 예: 무선 이어폰, 여권 지갑, 소화제, 손톱깎이)",
  "tags": ["태그1", "태그2", "태그3"]
}
${existingTagsHint}
마크다운 코드블록(\`\`\`json) 없이 오직 유효한 순수 JSON만 출력해.`
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 60
      }
    };

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ];

    let data: any = null;
    for (const modelName of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          console.warn(`[aiVision] ${modelName} returned status:`, response.status);
        }
      } catch (err) {
        console.warn(`[aiVision] ${modelName} request failed:`, err);
      }
    }

    if (!data) return null;

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    // JSON 파싱 (마크다운 코드블록 제거 처리)
    let parsed: any = null;
    try {
      const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          parsed = JSON.parse(rawText.slice(start, end + 1));
        } catch (e) {
          console.warn('[aiVision] JSON 파싱 실패:', rawText);
        }
      }
    }

    if (!parsed) {
      // JSON 파싱 실패 시 단순 텍스트 정제 폴백
      let cleanFallback = rawText.replace(/["'`.\n\r]/g, '').trim();
      return { name: cleanFallback || null, tags: [] };
    }

    // 이름 정제
    let cleanName = typeof parsed.name === 'string' ? parsed.name.replace(/["'`.\n\r]/g, '').trim() : null;
    if (cleanName && cleanName.includes(':')) {
      cleanName = cleanName.split(':')[1].trim();
    }
    if (cleanName && cleanName.endsWith('입니다')) {
      cleanName = cleanName.replace(/입니다$/, '').trim();
    }
    if (cleanName === '없음' || cleanName === '알 수 없음') {
      cleanName = null;
    }

    // 태그 정제
    let cleanTags: string[] = [];
    if (Array.isArray(parsed.tags)) {
      cleanTags = parsed.tags
        .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        .map((t: string) => t.replace(/["'`#\n\r]/g, '').trim())
        .filter((t: string) => t.length > 0 && t !== '없음');
    }

    return {
      name: cleanName || null,
      tags: cleanTags
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
