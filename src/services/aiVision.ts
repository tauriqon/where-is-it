/**
 * AI Vision 기반 사진 속 물건 대표 이름 자동 인식 서비스 (Google Gemini 1.5 Flash)
 */

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
 * 사진 속 물건의 대표 명사를 Gemini 1.5 Flash AI로 분석하여 반환
 * - 이름이 이미 있는 경우 호출하지 않음
 * - 간결한 한국어 대표 명사(1~3단어)만 추출
 */
export const recognizeItemFromImage = async (file: File): Promise<string | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey.trim() === 'YOUR_GEMINI_API_KEY_HERE') {
    console.info('[aiVision] VITE_GEMINI_API_KEY가 설정되지 않아 사진 인식 건너뜁니다.');
    return null;
  }

  try {
    const { base64Data, mimeType } = await resizeImageForAI(file, 512);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "이 사진에서 가장 중심이 되는 물건이 무엇인지 한글 대표 명사 단어(1~3단어 내외, 예: '무선 이어폰', '소화제', '여권 지갑', '손톱깎이', '스마트폰 거치대' 등) 딱 하나만 군더더기 없이 출력해줘. 마침표, 따옴표, 설명이나 문장 부호 없이 오직 물건 이름만 답변해."
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
        maxOutputTokens: 20
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

    // 따옴표, 마침표, 줄바꿈 등 특수기호 정제
    let cleanName = rawText.replace(/["'`.\n\r]/g, '').trim();

    // 혹시 '물건 이름은 ~입니다'와 같이 문장으로 답했을 경우 대비 정제
    if (cleanName.includes(':')) {
      cleanName = cleanName.split(':')[1].trim();
    }
    if (cleanName.endsWith('입니다')) {
      cleanName = cleanName.replace(/입니다$/, '').trim();
    }

    return cleanName || null;
  } catch (err) {
    console.warn('[aiVision] 이미지 분석 중 오류 발생:', err);
    return null;
  }
};
