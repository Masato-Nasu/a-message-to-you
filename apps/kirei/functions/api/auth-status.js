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
  const validKeywords = getValidKeywords(env);
  if (!validKeywords.length) return false;
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  return validKeywords.includes(cookies.kf_auth || '');
}

function getValidKeywords(env) {
  return [env.ACCESS_KEYWORD, env.APP_KEYWORD, env.APP_PASSWORD]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
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
