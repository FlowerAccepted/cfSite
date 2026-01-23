import * as tools from "../utils/tools.js";
import { requireLogin } from "../utils/authGuard.js";

export async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { username, password } = body;
  if (!username || !password) return new Response("Missing fields", { status: 400 });

  const passwordError = tools.chkPassword(password);
  if (passwordError)
    return new Response(passwordError, { status: 400 });

  const passwordHash = await tools.hashPassword(password);
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

  const passwordHash = await tools.hashPassword(password);

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
  const token = tools.signJWT({ uid: user.uid, profile, iat: Math.floor(Date.now() / 1000) }, env.JWT_SECRET);

  return new Response(JSON.stringify({ success: true, token, profile }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `token=${token}; HttpOnly; Path=/; SameSite=Lax`
    }
  });
}

export async function handleChangePassword(request, env) {
  const auth = requireLogin(request, env);
  if (auth instanceof Response) return auth;

  const { uid } = auth;

  let body;
  try { body = await request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const { oldPassword, newPassword } = body;
  if (!oldPassword || !newPassword)
    return new Response("Missing fields", { status: 400 });

  const oldHash = await crypto.hashPassword(oldPassword);

  const user = await env.DB.prepare(`
    SELECT uid FROM users
    WHERE uid = ? AND password_hash = ?
  `).bind(uid, oldHash).first();

  if (!user) return new Response("Old password incorrect", { status: 401 });

  const passwordError = crypto.chkPassword(newPassword);
  if (passwordError) return new Response(passwordError, { status: 400 });

  const newHash = await crypto.hashPassword(newPassword);

  await env.DB.prepare(`
    UPDATE users SET password_hash = ?
    WHERE uid = ?
  `).bind(newHash, uid).run();

  return new Response("Password updated");
}

export async function handleUpdateProfile(request, env) {
  const uid = requireLogin(request, env);
  if (uid instanceof Response) return uid;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { nickname, avatar, bio, links } = body;

  // 读取旧 profile
  const row = await env.DB.prepare(`
    SELECT profile FROM users WHERE uid = ?
  `).bind(uid).first();

  if (!row) return new Response("User not found", { status: 404 });

  let profile = {};
  try {
    profile = row.profile ? JSON.parse(row.profile) : {};
  } catch {
    profile = {};
  }

  // 字段级 merge（兼容未来字段）
  if (nickname !== undefined) profile.nickname = nickname;
  if (avatar !== undefined) profile.avatar = avatar;
  if (bio !== undefined) profile.bio = bio;
  if (links !== undefined) profile.links = links;

  await env.DB.prepare(`
    UPDATE users SET profile = json(?)
    WHERE uid = ?
  `).bind(JSON.stringify(profile), uid).run();

  return new Response(JSON.stringify(profile), {
    headers: { "Content-Type": "application/json" }
  });
}
