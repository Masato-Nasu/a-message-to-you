function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getConfiguredKeywords(env) {
  return [env.APP_KEYWORD, env.APP_PASSWORD, env.ACCESS_KEYWORD]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

export async function onRequestPost(context) {
  try {
    const configuredKeywords = getConfiguredKeywords(context.env);
    const body = await context.request.json();
    const inputKeyword = String(body.keyword || '').trim();

    if (!configuredKeywords.length) {
      return json({ ok: false, error: 'APP_KEYWORD / APP_PASSWORD / ACCESS_KEYWORD のいずれかが未設定です。' }, 500);
    }

    if (!configuredKeywords.includes(inputKeyword)) {
      return json({ ok: false, error: 'キーワードが違います。' }, 401);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'hh_auth=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000',
        'Cache-Control': 'no-store',
      },
    });
  } catch (_error) {
    return json({ ok: false, error: 'リクエストを処理できませんでした。' }, 500);
  }
}
