import * as auth from "./routes/auth.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/register")
      return auth.handleRegister(request, env);
    if (request.method === "POST" && url.pathname === "/api/login")
      return auth.handleLogin(request, env);
    if (request.method === "POST" && url.pathname === "/api/change-password")
      return auth.handleChangePassword(request, env);
    if (request.method === "POST" && url.pathname === "/api/update-profile")
      return auth.handleUpdateProfile(request, env);
    return new Response("Not Found", { status: 404 });
  }
};

