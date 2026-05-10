/**
 * Authentication Middleware
 *
 * Provides helper functions for protecting routes that require authentication
 * or authorization. This module wraps the JWT authentication utilities and
 * provides a consistent interface for use in Astro pages and API routes.
 *
 * The primary authentication flow is handled by `/src/middleware.ts` which
 * populates `Astro.locals.user` for every request. This module provides
 * additional utilities for:
 *   - Verifying a user is authenticated (for protected routes)
 *   - Verifying a user owns a resource (for authorization checks)
 *   - Extracting and verifying JWT tokens directly
 *
 * Requirements: 6.1, 6.3, 7.5
 */

import { verifyToken, extractToken, signToken } from '../utils/jwtAuth';
import type { JwtPayload, AuthUser } from '../utils/jwtAuth';

export type { JwtPayload, AuthUser };

/**
 * Result of an authentication check.
 */
export interface AuthResult {
  /** Whether the user is authenticated */
  authenticated: boolean;
  /** The authenticated user, if any */
  user: AuthUser | null;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Result of an authorization check.
 */
export interface AuthzResult {
  /** Whether the user is authorized */
  authorized: boolean;
  /** HTTP status code to return if not authorized */
  statusCode: 401 | 403;
  /** Error message if authorization failed */
  error: string;
}

/**
 * Verify a JWT token from an HTTP request's Authorization header or cookie.
 *
 * This is the core authentication function used by the middleware and
 * individual route handlers.
 *
 * @param authorizationHeader - Value of the `Authorization` request header
 * @param cookieHeader - Value of the `Cookie` request header
 * @returns AuthResult indicating whether the user is authenticated
 */
export function verifyAuth(
  authorizationHeader: string | null | undefined,
  cookieHeader: string | null | undefined
): AuthResult {
  const token = extractToken(authorizationHeader, cookieHeader);

  if (!token) {
    return {
      authenticated: false,
      user: null,
      error: 'No authentication token provided',
    };
  }

  const payload = verifyToken(token);

  if (!payload) {
    return {
      authenticated: false,
      user: null,
      error: 'Invalid or expired authentication token',
    };
  }

  return {
    authenticated: true,
    user: { loggedIn: true, uid: payload.uid },
  };
}

/**
 * Check if a user is authenticated from the Astro locals context.
 *
 * Use this in Astro page frontmatter to guard protected routes:
 *
 * ```typescript
 * const authCheck = requireAuth(Astro.locals.user);
 * if (!authCheck.authenticated) {
 *   return Astro.redirect('/login');
 * }
 * ```
 *
 * @param user - The user from `Astro.locals.user`
 * @returns AuthResult indicating whether the user is authenticated
 */
export function requireAuth(
  user: { loggedIn: true; uid: string } | null | undefined
): AuthResult {
  if (!user || !user.loggedIn) {
    return {
      authenticated: false,
      user: null,
      error: 'Authentication required',
    };
  }

  return {
    authenticated: true,
    user: { loggedIn: true, uid: user.uid },
  };
}

/**
 * Check if a user is authorized to perform an operation on a resource.
 *
 * Authorization requires:
 *   1. The user is authenticated (has a valid session/token)
 *   2. The user owns the resource (their UID matches the resource's owner UID)
 *
 * Returns 401 if the user is not authenticated, 403 if authenticated but
 * not the owner.
 *
 * @param user - The authenticated user (from `Astro.locals.user`)
 * @param resourceOwnerUid - The UID of the resource owner
 * @returns AuthzResult indicating whether the user is authorized
 */
export function requireOwnership(
  user: { loggedIn: true; uid: string } | null | undefined,
  resourceOwnerUid: string
): AuthzResult {
  // Not authenticated at all → 401 Unauthorized
  if (!user || !user.loggedIn) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Authentication required to perform this action',
    };
  }

  // Authenticated but not the owner → 403 Forbidden
  if (user.uid !== resourceOwnerUid) {
    return {
      authorized: false,
      statusCode: 403,
      error: 'You do not have permission to perform this action',
    };
  }

  return {
    authorized: true,
    statusCode: 401, // Not used when authorized is true
    error: '',
  };
}

/**
 * Sign a new JWT token for the given user UID.
 *
 * Re-exported from jwtAuth for convenience so callers only need to import
 * from this module.
 *
 * @param uid - User identifier to embed in the token
 * @param expiresIn - Token lifetime (default: 7 days)
 * @returns Signed JWT string
 */
export { signToken, verifyToken, extractToken };
