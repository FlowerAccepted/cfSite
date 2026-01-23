import * as auth from "./routes/auth.js";

function withCors(res, origin) {
  const r = new Response(res.body, res);
  r.headers.set("Access-Control-Allow-Origin", origin ?? "*");
  r.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  r.headers.set("Access-Control-Allow-Credentials", "true");
  return r;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const path = url.pathname.replace(/\/$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin ?? "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true"
        }
      });
    }

    let res;

    if (request.method === "POST" && path === "/api/login")
      res = await auth.handleLogin(request, env);
    else if (request.method === "POST" && path === "/api/register")
      res = await auth.handleRegister(request, env);
    else if (request.method === "POST" && path === "/api/change-password")
      res = await auth.handleChangePassword(request, env);
    else if (request.method === "POST" && path === "/api/update-profile")
      res = await auth.handleUpdateProfile(request, env);
    else
      res = new Response("Not Found", { status: 404 });

    return withCors(res, origin);
  }
};
