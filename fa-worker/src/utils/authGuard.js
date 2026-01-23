import * as tools from "./tools.js";

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  return cookie
    .split("; ")
    .find(v => v.startsWith(name + "="))
    ?.split("=")[1];
}

export function requireLogin(request, env) {
  const token = getCookie(request, "token");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = tools.verifyJWT(token, env.JWT_SECRET);
    return payload; // { uid, profile, iat }
  } catch {
    return new Response("Invalid token", { status: 401 });
  }
}
