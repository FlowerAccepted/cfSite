function getCookie(request, name) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  return cookie
    .split("; ")
    .find(v => v.startsWith(name + "="))
    ?.split("=")[1] ?? null;
}

export async function requireLogin(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/session=([^;]+)/);
  if (!m) return new Response("Unauthorized", { status: 401 });

  const row = await env.DB.prepare(
    "SELECT uid FROM sessions WHERE id=? AND expires_at > ?"
  ).bind(m[1], Date.now()).first();

  if (!row) return new Response("Unauthorized", { status: 401 });

  return row.uid;
}
