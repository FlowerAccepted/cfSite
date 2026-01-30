import { defineMiddleware } from "astro/middleware";

export const onRequest = defineMiddleware(async (ctx, next) => {
  const token = ctx.cookies.get("token")?.value;
  ctx.locals.user = token ? { loggedIn: true } : null;
  return next();
});
