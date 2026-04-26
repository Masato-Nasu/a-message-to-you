function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestPost(context) {
  try {
    const configuredPassword = String(context.env.APP_PASSWORD || "").trim();
    if (!configuredPassword) {
      return json({ ok: false, error: "APP_PASSWORD is not configured on Cloudflare." }, 500);
    }

    const body = await context.request.json().catch(() => ({}));
    const password = String(body?.password || "").trim();
    if (!password) {
      return json({ ok: false, error: "Password is required." }, 400);
    }

    if (password !== configuredPassword) {
      return json({ ok: false, error: "Password mismatch." }, 401);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error?.message || "Authentication failed." }, 500);
  }
}
