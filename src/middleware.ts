import { defineMiddleware } from "astro/middleware";
import { ensureLocalUser, getDatabase } from "./utils/db";
import { getUserFromToken } from "./utils/jwtAuth";

const API_BASE = import.meta.env.PUBLIC_API_BASE?.trim().replace(/\/+$/, "") || "";

async function getRemoteSessionUser(cookieHeader: string | null): Promise<{ loggedIn: true; uid: string } | null> {
  if (!API_BASE || !cookieHeader) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      uid?: string | number;
      username?: string;
      profile?: unknown;
    } | null;
    if (!data?.uid) {
      return null;
    }

    if (data.username) {
      try {
        const db = getDatabase();
        ensureLocalUser(db, {
          uid: String(data.uid),
          username: data.username,
          profile: data.profile ?? {},
        });
      } catch {
        // If local user sync fails, still allow auth to proceed.
      }
    }

    return { loggedIn: true, uid: String(data.uid) };
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const sessionId = ctx.cookies.get("session")?.value;
  const cookieHeader = ctx.request.headers.get("Cookie");

  if (sessionId) {
    // ── Session-based authentication ──────────────────────────────────────
    // Primary auth path: validate the session cookie against the sessions table.
    try {
      const db = getDatabase();
      const row = db
        .prepare(
          "SELECT uid FROM sessions WHERE id = ? AND expires_at > ?"
        )
        .get(sessionId, Date.now()) as { uid: number | string } | undefined;

      if (row) {
        ctx.locals.user = { loggedIn: true, uid: String(row.uid) };
      } else {
        ctx.locals.user = await getRemoteSessionUser(cookieHeader);
      }
    } catch {
      // If local session validation is unavailable, fall back to the remote auth service.
      ctx.locals.user = await getRemoteSessionUser(cookieHeader);
    }
  } else {
    // ── JWT-based authentication ───────────────────────────────────────────
    // Fallback auth path: verify a JWT from the Authorization header or
    // the `jwt` cookie.  This supports API clients and programmatic access
    // that cannot use the session cookie flow.
    const authHeader = ctx.request.headers.get("Authorization");

    const jwtUser = getUserFromToken(authHeader, cookieHeader);
    ctx.locals.user = jwtUser ?? null;
  }

  return next();
});
