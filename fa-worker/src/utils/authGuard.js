function getCookie(request, name) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  return cookie
    .split("; ")
    .find(v => v.startsWith(name + "="))
    ?.split("=")[1] ?? null;
}

export async function requireLogin(request, env) {
  const sessionId = getCookie(request, "session");
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    "SELECT uid FROM sessions WHERE id = ?"
  ).bind(sessionId).first();

  return row?.uid ?? null;
}
