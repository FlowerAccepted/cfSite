/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
    const row = await env.fa_cf_site
      .prepare("SELECT 1 AS ok")
      .first();

    return new Response(
      JSON.stringify(row),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};

