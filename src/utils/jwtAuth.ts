/**
 * JWT Authentication Utility
 *
 * Provides functions to verify JWT tokens and extract user information.
 * Supports tokens from:
 *   1. Authorization header: `Bearer <token>`
 *   2. Cookie: `jwt=<token>`
 *
 * The JWT payload is expected to contain a `uid` field (user identifier).
 *
 * Requirements: 6.1, 6.3, 7.5
 */

import jwt from 'jsonwebtoken';

/**
 * The shape of the JWT payload used by this application.
 */
export interface JwtPayload {
  /** User unique identifier */
  uid: string;
  /** Standard JWT issued-at claim */
  iat?: number;
  /** Standard JWT expiration claim */
  exp?: number;
}

/**
 * Authenticated user info extracted from a JWT token.
 */
export interface AuthUser {
  loggedIn: true;
  uid: string;
}

/**
 * Retrieve the JWT secret from environment variables.
 * Falls back to a development-only placeholder when the variable is absent
 * so that the server still starts in local dev without crashing.
 *
 * In production, JWT_SECRET **must** be set to a strong random value.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Warn loudly in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[jwtAuth] JWT_SECRET is not set. Using an insecure fallback. ' +
          'Set JWT_SECRET in your environment for production use.'
      );
    }
    return 'dev-insecure-fallback-secret';
  }
  return secret;
}

/**
 * Verify a JWT token string and return the decoded payload.
 *
 * @param token - Raw JWT string (without "Bearer " prefix)
 * @returns Decoded payload if valid, or `null` if invalid / expired
 */
export function verifyToken(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Ensure the payload contains a uid field
    if (!decoded.uid || typeof decoded.uid !== 'string') {
      return null;
    }

    return decoded;
  } catch {
    // Token is invalid, expired, or tampered with
    return null;
  }
}

/**
 * Sign a new JWT token for the given user UID.
 *
 * @param uid - User identifier to embed in the token
 * @param expiresIn - Token lifetime (default: 7 days)
 * @returns Signed JWT string
 */
export function signToken(uid: string, expiresIn: string | number = '7d'): string {
  const secret = getJwtSecret();
  const payload: JwtPayload = { uid };
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * Extract a JWT token from an HTTP request's Authorization header or cookie.
 *
 * Checks in this order:
 *   1. `Authorization: Bearer <token>` header
 *   2. `jwt` cookie value
 *
 * @param headers - Request headers object (standard `Headers` or plain record)
 * @param cookieHeader - Raw `Cookie` header string (optional)
 * @returns Raw token string, or `null` if not found
 */
export function extractToken(
  authorizationHeader: string | null | undefined,
  cookieHeader: string | null | undefined
): string | null {
  // 1. Try Authorization header
  if (authorizationHeader) {
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  // 2. Try jwt cookie
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)jwt=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1].trim());
    }
  }

  return null;
}

/**
 * Verify a JWT from request headers/cookies and return the authenticated user.
 *
 * @param authorizationHeader - Value of the `Authorization` request header
 * @param cookieHeader - Value of the `Cookie` request header
 * @returns `AuthUser` if the token is valid, or `null` otherwise
 */
export function getUserFromToken(
  authorizationHeader: string | null | undefined,
  cookieHeader: string | null | undefined
): AuthUser | null {
  const token = extractToken(authorizationHeader, cookieHeader);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return { loggedIn: true, uid: payload.uid };
}
