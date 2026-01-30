import * as tools from '../utils/tools.js';
import { requireLogin } from '../utils/authGuard.js';

/* ================= 注册 ================= */
export async function handleRegister(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { username, password } = body;
	if (!username || !password) {
		return new Response('Missing fields', { status: 400 });
	}

	const passwordError = tools.chkPassword(password);
	if (passwordError) {
		return new Response(passwordError, { status: 400 });
	}

	const { hash, salt } = await tools.hashPassword(password);
	const profile = { nickname: username, avatar: null, roles: ['user'] };

	try {
		await env.DB.prepare(
			`
      INSERT INTO users (username, password_hash, password_salt, create_time, profile)
      VALUES (?, ?, ?, ?, json(?))
      `,
		)
			.bind(username, hash, salt, Date.now(), JSON.stringify(profile))
			.run();

		return new Response('OK');
	} catch (e) {
		console.error(e);
		return new Response('DB error', { status: 500 });
	}
}

/* ================= 登录 ================= */
export async function handleLogin(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { username, password } = body;
	if (!username || !password) {
		return new Response('Missing fields', { status: 400 });
	}

	const user = await env.DB.prepare(
		`
    SELECT uid, password_hash, password_salt, profile
    FROM users WHERE username=?
    `,
	)
		.bind(username)
		.first();

	if (!user) {
		return new Response('Invalid username or password', { status: 401 });
	}

	const ok = await tools.verifyPassword(password, user.password_salt, user.password_hash);

	if (!ok) {
		return new Response('Invalid username or password', { status: 401 });
	}

	const sessionId = crypto.randomUUID();
	const expiresAt = Date.now() + 7 * 24 * 3600 * 1000;

	await env.DB.prepare(
		`
    INSERT INTO sessions (id, uid, expires_at)
    VALUES (?, ?, ?)
    `,
	)
		.bind(sessionId, user.uid, expiresAt)
		.run();

	return new Response(JSON.stringify({ ok: true, profile: JSON.parse(user.profile) }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': `session=${sessionId}; ` + `HttpOnly; Path=/; ` + `SameSite=None; Secure`,
		},
	});
}

/* ================= 改密码 ================= */
export async function handleChangePassword(request, env) {
	const uid = await requireLogin(request, env);
	if (uid instanceof Response) return uid;

	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { oldPassword, newPassword } = body;
	if (!oldPassword || !newPassword) {
		return new Response('Missing fields', { status: 400 });
	}

	const user = await env.DB.prepare(
		`
    SELECT password_hash, password_salt
    FROM users WHERE uid=?
    `,
	)
		.bind(uid)
		.first();

	if (!user) {
		return new Response('User not found', { status: 404 });
	}

	const ok = await tools.verifyPassword(oldPassword, user.password_salt, user.password_hash);

	if (!ok) {
		return new Response('Old password incorrect', { status: 401 });
	}

	const passwordError = tools.chkPassword(newPassword);
	if (passwordError) {
		return new Response(passwordError, { status: 400 });
	}

	const { hash, salt } = await tools.hashPassword(newPassword);

	await env.DB.prepare(
		`
    UPDATE users
    SET password_hash=?, password_salt=?
    WHERE uid=?
    `,
	)
		.bind(hash, salt, uid)
		.run();

	return new Response('Password updated');
}

/* ================= 更新资料 ================= */
export async function handleUpdateProfile(request, env) {
	const uid = await requireLogin(request, env);
	if (uid instanceof Response) return uid;

	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { nickname, avatar, bio, links } = body;

	const row = await env.DB.prepare(`SELECT profile FROM users WHERE uid=?`).bind(uid).first();

	if (!row) {
		return new Response('User not found', { status: 404 });
	}

	let profile = {};
	try {
		profile = row.profile ? JSON.parse(row.profile) : {};
	} catch {}

	if (nickname !== undefined) profile.nickname = nickname;
	if (avatar !== undefined) profile.avatar = avatar;
	if (bio !== undefined) profile.bio = bio;
	if (links !== undefined) profile.links = links;

	await env.DB.prepare(`UPDATE users SET profile=json(?) WHERE uid=?`).bind(JSON.stringify(profile), uid).run();

	return new Response(JSON.stringify(profile), {
		headers: { 'Content-Type': 'application/json' },
	});
}

/* ================= 登出 ================= */
export async function handleLogout(request, env) {
	const cookie = request.headers.get('Cookie') || '';
	const m = cookie.match(/session=([^;]+)/);

	if (m) {
		await env.DB.prepare(`DELETE FROM sessions WHERE id=?`).bind(m[1]).run();
	}

	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0',
			'Content-Type': 'application/json',
		},
	});
}

/* ================= 当前用户 ================= */
export async function handleMe(request, env) {
	const uid = await requireLogin(request, env);
	if (uid instanceof Response) return uid;

	const user = await env.DB.prepare(
		`
    SELECT uid, username, profile
    FROM users WHERE uid=?
    `,
	)
		.bind(uid)
		.first();

	if (!user) {
		return new Response('User not found', { status: 404 });
	}

	return new Response(
		JSON.stringify({
			uid: user.uid,
			username: user.username,
			profile: JSON.parse(user.profile),
		}),
		{ headers: { 'Content-Type': 'application/json' } },
	);
}
