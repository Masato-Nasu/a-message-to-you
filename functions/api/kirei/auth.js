export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {}

  const submitted = String(body?.keyword || '').trim();
  const expected = String(env.ACCESS_KEYWORD || '').trim();

  if (!expected) {
    return json({ error: 'ACCESS_KEYWORD が未設定です。' }, 500);
  }

  if (submitted !== expected) {
    return json({ error: '認証に失敗しました。' }, 401);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookieHeader(expected),
    },
  });
}

function cookieHeader(expected) {
  const secure = 'Secure; ';
  const maxAge = 60 * 60 * 24 * 365;
  return `kf_auth=${encodeURIComponent(expected)}; ${secure}HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
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
