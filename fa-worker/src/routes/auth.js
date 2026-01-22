import * as crypto from "../utils/crypto.js";

export async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { username, password } = body;
  if (!username || !password) return new Response("Missing fields", { status: 400 });

  const passwordHash = await crypto.hashPassword(password);
  const profile = { nickname: username, avatar: null, roles: ["user"] };

  try {
    await env.DB.prepare(`
      INSERT INTO users (username, password_hash, create_time, profile)
      VALUES (?, ?, ?, json(?))
    `)
    .bind(username, passwordHash, Date.now(), JSON.stringify(profile))
    .run();

    return new Response("OK");
  } catch (e) {
    console.error(e);
    return new Response("DB error: " + (e?.message ?? String(e)), { status: 500 });
  }
}

export async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { username, password } = body;
  if (!username || !password) return new Response("Missing fields", { status: 400 });

  const passwordHash = await crypto.hashPassword(password);

  const user = await env.DB.prepare(`
    SELECT uid, profile
    FROM users
    WHERE username = ? AND password_hash = ?
  `)
  .bind(username, passwordHash)
  .first();

  if (!user) return new Response("Invalid username or password", { status: 401 });

  const profile = user.profile ? JSON.parse(user.profile) : {};

  // 生成 JWT
  const token = crypto.signJWT({ uid: user.uid, profile, iat: Math.floor(Date.now() / 1000) }, env.JWT_SECRET);

  return new Response(JSON.stringify({ success: true, token, profile }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `token=${token}; HttpOnly; Path=/; SameSite=Strict`
    }
  });
}

export async function handleChangePassword(request, env) {
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { username, oldPassword, newPassword } = body;
  if (!username || !oldPassword || !newPassword) return new Response("Missing fields", { status: 400 });

  const oldHash = await crypto.hashPassword(oldPassword);

  // 查询用户
  const user = await env.DB.prepare(`
    SELECT uid
    FROM users
    WHERE username = ? AND password_hash = ?
  `)
  .bind(username, oldHash)
  .first();

  if (!user) return new Response("Old password incorrect", { status: 401 });

  const newHash = await crypto.hashPassword(newPassword);

  try {
    await env.DB.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE uid = ?
    `)
    .bind(newHash, user.uid)
    .run();

    return new Response("Password updated", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("DB error: " + (e?.message ?? String(e)), { status: 500 });
  }
}
