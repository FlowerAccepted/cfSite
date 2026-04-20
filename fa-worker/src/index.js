import * as auth from './routes/auth.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseAllowedOrigins(env = {}) {
  const raw = String(env.CORS_ALLOW_ORIGINS || env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return new Set(raw);
}

function normalizeOrigin(origin) {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isAllowedOrigin(request, origin, allowedOrigins) {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const requestUrl = new URL(request.url);
  const requestOrigin = normalizeOrigin(requestUrl.origin);
  if (normalized === requestOrigin) return true;

  try {
    const originUrl = new URL(normalized);
    if (isLoopbackHost(requestUrl.hostname) && isLoopbackHost(originUrl.hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return allowedOrigins.has(normalized);
}

function withCors(res, origin, allowed) {
  const r = new Response(res.body, res);

  if (origin && allowed) {
    r.headers.set('Access-Control-Allow-Origin', origin);
    r.headers.set('Access-Control-Allow-Credentials', 'true');
  } else {
    r.headers.delete('Access-Control-Allow-Origin');
    r.headers.delete('Access-Control-Allow-Credentials');
  }

  r.headers.set('Vary', 'Origin');
  return r;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigins = parseAllowedOrigins(env);
    const originAllowed = isAllowedOrigin(request, origin, allowedOrigins);

    if (origin && !originAllowed) {
      return new Response('Origin not allowed', {
        status: 403,
        headers: { Vary: 'Origin' },
      });
    }

    if (WRITE_METHODS.has(request.method) && !originAllowed) {
      return new Response('CSRF blocked', {
        status: 403,
        headers: { Vary: 'Origin' },
      });
    }

    const path = url.pathname.replace(/\/$/, '');

    /* ===== CORS 预检 ===== */
    if (request.method === 'OPTIONS') {
      if (!originAllowed) {
        return new Response('Origin not allowed', {
          status: 403,
          headers: { Vary: 'Origin' },
        });
      }

      return new Response(null, {
        status: 204,
        headers: {
          ...(origin
            ? {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
              }
            : {}),
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          Vary: 'Origin',
        },
      });
    }

    let res;

    if (request.method === 'POST' && path === '/api/login')
      res = await auth.handleLogin(request, env);
    else if (request.method === 'POST' && path === '/api/register')
      res = await auth.handleRegister(request, env);
    else if (request.method === 'POST' && path === '/api/change-password')
      res = await auth.handleChangePassword(request, env);
    else if (request.method === 'POST' && path === '/api/update-profile')
      res = await auth.handleUpdateProfile(request, env);
    else if (request.method === 'POST' && path === '/api/logout')
      res = await auth.handleLogout(request, env);
    else if (request.method === 'GET' && path === '/api/me')
      res = await auth.handleMe(request, env);
    else if (request.method === 'GET' && (path === '' || path === '/'))
      res = new Response('OK');
    else
      res = new Response('Not Found', { status: 404 });

    return withCors(res, origin, originAllowed);
  },
};
