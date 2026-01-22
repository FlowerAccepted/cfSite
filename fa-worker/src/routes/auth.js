import { hashPassword } from "../utils/crypto";

export async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return new Response("Missing fields", { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const profile = {
    nickname: username,
    avatar: null,
    roles: ["user"]
  };

try {
  await env.DB.prepare(`
    INSERT INTO users (username, password_hash, create_time, profile)
    VALUES (?, ?, ?, json(?))
  `).bind(
    username,
    passwordHash,
    Date.now(),
    JSON.stringify(profile ?? {})
  ).run();

  return new Response("OK");
} catch (e) {
  console.error(e);
  return new Response(
    "DB error: " + (e?.message ?? String(e)),
    { status: 500 }
  );
}


  return new Response("OK");
}
