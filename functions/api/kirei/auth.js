export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {}

  const submitted = String(body?.keyword || '').trim();
  const validKeywords = getValidKeywords(env);

  if (!validKeywords.length) {
    return json({ error: 'APP_PASSWORD / APP_KEYWORD / ACCESS_KEYWORD のいずれかが未設定です。' }, 500);
  }

  if (!submitted || !validKeywords.includes(submitted)) {
    return json({ error: '認証に失敗しました。' }, 401);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookieHeader(submitted),
    },
  });
}

function getValidKeywords(env) {
  return [env.ACCESS_KEYWORD, env.APP_KEYWORD, env.APP_PASSWORD]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function cookieHeader(value) {
  const maxAge = 60 * 60 * 24 * 365;
  return `kf_auth=${encodeURIComponent(value)}; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
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
