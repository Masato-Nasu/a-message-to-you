export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'kf_auth=; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
    },
  });
}
