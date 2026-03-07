import * as tools from '../utils/tools.js';
import { requireLogin } from '../utils/authGuard.js';

async function ensureUserProfilesTable(env) {
	await env.DB.prepare(
		`
		CREATE TABLE IF NOT EXISTS user_profiles (
			uid INTEGER PRIMARY KEY,
			nickname TEXT,
			avatar TEXT,
			bio TEXT,
			intro TEXT,
			links TEXT,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
		)
		`,
	).run();
}

function parseJsonSafe(value, fallback) {
	try {
		return value ? JSON.parse(value) : fallback;
	} catch {
		return fallback;
	}
}

async function readProfileFromD1(env, uid) {
	await ensureUserProfilesTable(env);
	const row = await env.DB.prepare(
		`
		SELECT nickname, avatar, bio, intro, links
		FROM user_profiles
		WHERE uid=?
		`,
	)
		.bind(uid)
		.first();

	if (!row) return null;

	return {
		nickname: row.nickname ?? undefined,
		avatar: row.avatar ?? undefined,
		bio: row.bio ?? undefined,
		intro: row.intro ?? undefined,
		links: parseJsonSafe(row.links, undefined),
	};
}

async function upsertProfileToD1(env, uid, profile) {
	await ensureUserProfilesTable(env);
	await env.DB.prepare(
		`
		INSERT INTO user_profiles (uid, nickname, avatar, bio, intro, links, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(uid) DO UPDATE SET
			nickname=excluded.nickname,
			avatar=excluded.avatar,
			bio=excluded.bio,
			intro=excluded.intro,
			links=excluded.links,
			updated_at=excluded.updated_at
		`,
	)
		.bind(
			uid,
			profile.nickname ?? null,
			profile.avatar ?? null,
			profile.bio ?? null,
			profile.intro ?? null,
			profile.links === undefined ? null : JSON.stringify(profile.links),
			Date.now(),
		)
		.run();
}

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

		const row = await env.DB.prepare(`SELECT uid FROM users WHERE username=?`).bind(username).first();
		if (row?.uid) {
			await upsertProfileToD1(env, row.uid, profile);
		}

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

	const { nickname, avatar, bio, intro, links } = body;

	const row = await env.DB.prepare(`SELECT profile FROM users WHERE uid=?`).bind(uid).first();

	if (!row) {
		return new Response('User not found', { status: 404 });
	}

	const profileFromUsers = parseJsonSafe(row.profile, {});
	const profileFromD1 = await readProfileFromD1(env, uid);
	let profile = { ...profileFromUsers, ...(profileFromD1 || {}) };

	if (nickname !== undefined) profile.nickname = nickname;
	if (avatar !== undefined) profile.avatar = avatar;
	if (bio !== undefined) profile.bio = bio;
	if (intro !== undefined) profile.intro = intro;
	if (links !== undefined) profile.links = links;

	await upsertProfileToD1(env, uid, profile);
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

	const profileFromUsers = parseJsonSafe(user.profile, {});
	const profileFromD1 = (await readProfileFromD1(env, uid)) || profileFromUsers;
	const profile = { ...profileFromUsers, ...profileFromD1 };

	// Backfill once so old users instantly get persistent D1 profile rows.
	await upsertProfileToD1(env, uid, profile);

	return new Response(
		JSON.stringify({
			uid: user.uid,
			username: user.username,
			profile,
		}),
		{ headers: { 'Content-Type': 'application/json' } },
	);
}
