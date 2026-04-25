export async function onRequestGet(context) {
  const authenticated = isAuthenticated(context.request, context.env);
  return new Response(JSON.stringify({ authenticated }), {
    status: 200,
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
