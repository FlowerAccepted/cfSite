/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// index.js
/**
 * Cloudflare Worker 主入口（统一使用 import * as auth）
 */

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

