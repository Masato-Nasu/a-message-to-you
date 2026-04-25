export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!isAuthenticated(request, env)) {
      return json({ error: '認証が必要です。' }, 401);
    }

    const body = await request.json();
    const imageDataUrl = body?.imageDataUrl;

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY が未設定です。' }, 500);
    }


    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return json({ error: 'imageDataUrl が不正です。' }, 400);
    }

    const prompt = [
      'あなたは「kirei-filter」の画像判定エンジンです。',
      '与えられた画像を見て、自然な整え方を提案してください。',
      '与えられた画像を見て、以下のどれに最も近いかを判断してください。',
      'face, food, design, product, room, other',
      '目的は「主役を壊さず、全体を自然に整える」ことです。',
      '過剰補正は避けてください。',
      '必ずJSONのみを返してください。説明文やコードフェンスは不要です。',
      'JSON schema:',
      '{',
      '  "category": "face|food|design|product|room|other",',
      '  "categoryLabel": "日本語の短い表示名",',
      '  "keyword": "受け取ったキーワードをそのまま返す",',
      '  "subject": "主役の説明を短く",',
      '  "summary": "画像全体をどう捉え、キーワードをどう反映するかを1〜2文で日本語で",',
      '  "direction": "どう整えるべきかを短く",',
      '  "recommendation": "補正のおすすめを短く",',
      '  "caution": "やりすぎ防止の注意を短く",',
      '  "params": {',
      '    "brightness": 1.0,',
      '    "contrast": 1.0,',
      '    "saturation": 1.0,',
      '    "blur": 0.0,',
      '    "warmth": 0.0',
      '  }',
      '}',
      'パラメータの目安:',
      '- brightness: 0.95〜1.12',
      '- contrast: 0.95〜1.16',
      '- saturation: 0.90〜1.18',
      '- blur: 0〜1.4',
      '- warmth: -0.12〜0.12',
      '顔は少し柔らかく、食事は少し温かく、デザインはコントラストと彩度を上げすぎないでください。',
      '室内やプロダクトも自然さ優先です。'
    ].join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return valid JSON only.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: 'low',
                },
              },
            ],
          },
        ],
      }),
    });

    const openaiJson = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return json({ error: openaiJson?.error?.message || 'OpenAI API エラー' }, 500);
    }

    const raw = openaiJson?.choices?.[0]?.message?.content;
    if (!raw) {
      return json({ error: 'OpenAI の返答を読めませんでした。' }, 500);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'JSON の解析に失敗しました。', raw }, 500);
    }

    parsed.params = normalizeParams(parsed.params);
    return json(parsed, 200);
  } catch (error) {
    return json({ error: error?.message || 'unknown error' }, 500);
  }
}

function normalizeParams(params = {}) {
  return {
    brightness: clampNumber(params.brightness, 0.95, 1.12, 1.02),
    contrast: clampNumber(params.contrast, 0.95, 1.16, 1.03),
    saturation: clampNumber(params.saturation, 0.9, 1.18, 1.02),
    blur: clampNumber(params.blur, 0, 1.4, 0.15),
    warmth: clampNumber(params.warmth, -0.12, 0.12, 0.03),
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isAuthenticated(request, env) {
  const expected = String(env.ACCESS_KEYWORD || '').trim();
  if (!expected) return false;
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  return cookies.kf_auth === expected;
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index < 0) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}
