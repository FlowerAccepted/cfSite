import * as auth from './routes/auth.js';

function withCors(res, origin) {
  const r = new Response(res.body, res);
  if (origin) {
    r.headers.set('Access-Control-Allow-Origin', origin);
    r.headers.set('Vary', 'Origin');
  }
  r.headers.set('Access-Control-Allow-Credentials', 'true');
  return r;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const path = url.pathname.replace(/\/$/, '');

    /* ===== CORS 预检 ===== */
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Credentials': 'true',
          'Vary': 'Origin',
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
    else
      res = new Response('Not Found', { status: 404 });

    return withCors(res, origin);
  },
};
