// Supabase Edge Function: recognize-item
// 클라이언트 번들에 Gemini API 키를 노출하지 않고 서버리스 프록시로 안전하게 물건 이름/태그를 인식합니다.
//
// 배포 및 환경 변수 설정 방법:
// 1. Supabase Dashboard -> Edge Functions -> Secrets (또는 CLI):
//    GEMINI_API_KEY=<Google AI Studio에서 발급한 새 API 키>
// 2. 배포:
//    supabase functions deploy recognize-item

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_LENGTH = 1_500_000; // 약 1.1MB 바이너리 상한 (512px JPEG는 보통 40~80KB)
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

// 인스턴스 메모리 기반 서버측 보조 Rate Limit (유저당 일일 20회 / 3초 버스트 쿨다운)
const SERVER_DAILY_LIMIT = 20;
const SERVER_COOLDOWN_MS = 3_000;
const rateLimitStore = new Map<string, { date: string; count: number; lastAt: number }>();

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const checkServerRateLimit = (userId: string): { allowed: boolean; reason?: string } => {
  const now = Date.now();
  const today = getTodayKey();
  const entry = rateLimitStore.get(userId);

  if (!entry || entry.date !== today) {
    rateLimitStore.set(userId, { date: today, count: 1, lastAt: now });
    return { allowed: true };
  }

  if (now - entry.lastAt < SERVER_COOLDOWN_MS) {
    return { allowed: false, reason: 'COOLDOWN' };
  }

  if (entry.count >= SERVER_DAILY_LIMIT) {
    return { allowed: false, reason: 'DAILY_LIMIT' };
  }

  entry.count += 1;
  entry.lastAt = now;
  return { allowed: true };
};

const parseAndSanitizeGeminiResponse = (rawText: string): { name: string | null; tags: string[] } | null => {
  let parsed: Record<string, unknown> | null = null;

  // 1) 기본 JSON 파싱 (마크다운 코드블록 제거 후 시도)
  try {
    const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(rawText.slice(start, end + 1));
      } catch {
        // fallback below
      }
    }
  }

  // 2) 정규식 기반 정밀 추출 폴백
  if (!parsed || typeof parsed !== 'object') {
    const nameMatch =
      rawText.match(/"?name"?\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i) ||
      rawText.match(/"?name"?\s*:\s*([^,}\]\r\n]+)/i);
    const extractedName = nameMatch ? nameMatch[1].replace(/["'}]/g, '').trim() : null;

    const tagsMatch = rawText.match(/"?tags"?\s*:\s*\[([\s\S]*?)(\]|$)/i);
    let extractedTags: string[] = [];
    if (tagsMatch && tagsMatch[1]) {
      extractedTags = tagsMatch[1]
        .split(',')
        .map((t) => t.replace(/["'[\]{}]/g, '').trim())
        .filter((t) => t.length > 0 && t !== '없음');
    }

    if (extractedName || extractedTags.length > 0) {
      parsed = { name: extractedName, tags: extractedTags };
    }
  }

  if (!parsed) {
    const cleanFallback = rawText.replace(/["'`.\n\r]/g, '').trim();
    if (!cleanFallback.includes('{') && !cleanFallback.includes(':') && !cleanFallback.includes('[')) {
      return { name: cleanFallback || null, tags: [] };
    }
    return null;
  }

  // 3) 이름 정제
  let cleanName = typeof parsed.name === 'string' ? parsed.name : null;
  if (cleanName) {
    cleanName = cleanName.replace(/["'`.\n\r]/g, '').trim();
    if (cleanName.includes(':')) {
      cleanName = cleanName.split(':')[1].trim();
    }
    cleanName = cleanName.replace(/[{}[\]]/g, '').trim();
    if (cleanName.endsWith('입니다')) {
      cleanName = cleanName.replace(/입니다$/, '').trim();
    }
    if (cleanName === '없음' || cleanName === '알 수 없음') {
      cleanName = null;
    }
  }

  // 4) 태그 정제
  let cleanTags: string[] = [];
  if (Array.isArray(parsed.tags)) {
    cleanTags = parsed.tags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.replace(/["'`#\n\r{}[\]]/g, '').trim())
      .filter((t) => t.length > 0 && t !== '없음')
      .slice(0, 5);
  }

  return {
    name: cleanName || null,
    tags: cleanTags,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Supabase 세션 JWT 검증 (미인증 외부 호출 차단)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'INVALID_SESSION' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. 서버측 보조 Rate Limit 검사
    const limitCheck = checkServerRateLimit(user.id);
    if (!limitCheck.allowed) {
      return new Response(JSON.stringify({ error: limitCheck.reason || 'RATE_LIMITED' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. 비공개 GEMINI_API_KEY 확인
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!geminiApiKey) {
      console.error('[recognize-item] GEMINI_API_KEY secret is not configured.');
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY_NOT_CONFIGURED' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. 요청 페이로드 검증
    const body = await req.json();
    const base64Data = typeof body?.base64Data === 'string' ? body.base64Data : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    const rawExistingTags: unknown[] = Array.isArray(body?.existingTags) ? body.existingTags : [];
    const existingTags = rawExistingTags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 20))
      .slice(0, 30);

    if (!base64Data || base64Data.length > MAX_BASE64_LENGTH) {
      return new Response(JSON.stringify({ error: 'INVALID_IMAGE_PAYLOAD' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return new Response(JSON.stringify({ error: 'UNSUPPORTED_MIME_TYPE' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Gemini 공식 고속 모델 호출 (x-goog-api-key 헤더 사용)
    const existingTagsHint =
      existingTags.length > 0
        ? `사용자의 기존 태그 목록: [${existingTags.join(', ')}]. 기존 태그 목록 중 어울리는 것이 있다면 우선 활용하고, 필요시 어울리는 새 태그를 1~2개 추가해줘.`
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
마크다운 코드블록(\`\`\`json) 없이 오직 유효한 순수 JSON만 출력해.`,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
      },
    };

    let geminiData: Record<string, unknown> | null = null;
    let usedModel: string | null = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiApiKey,
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (response.ok) {
          geminiData = await response.json();
          usedModel = modelName;
          break;
        } else {
          console.warn(`[recognize-item] ${modelName} returned status:`, response.status);
        }
      } catch (err) {
        console.warn(`[recognize-item] ${modelName} request failed:`, err);
      }
    }

    if (!geminiData) {
      return new Response(JSON.stringify({ error: 'UPSTREAM_GEMINI_FAILED' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidates = geminiData.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const rawText = candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return new Response(JSON.stringify({ name: null, tags: [], model: usedModel }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = parseAndSanitizeGeminiResponse(rawText) ?? { name: null, tags: [] };
    return new Response(JSON.stringify({ ...result, model: usedModel }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[recognize-item] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
