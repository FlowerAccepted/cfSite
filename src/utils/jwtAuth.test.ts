/**
 * Unit tests for JWT authentication utility
 *
 * Tests cover:
 *   - Token signing and verification
 *   - Token extraction from Authorization header and cookie
 *   - getUserFromToken integration
 *   - Edge cases: expired tokens, tampered tokens, missing fields
 *
 * Requirements: 6.1, 6.3, 7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  signToken,
  verifyToken,
  extractToken,
  getUserFromToken,
} from './jwtAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TEST_UID = '42';

// Ensure a consistent JWT_SECRET during tests
beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests';
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. signToken / verifyToken round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe('signToken + verifyToken round-trip', () => {
  it('returns a non-empty string token', () => {
    const token = signToken(TEST_UID);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('verifyToken returns the correct uid', () => {
    const token = signToken(TEST_UID);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.uid).toBe(TEST_UID);
  });

  it('verifyToken returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('verifyToken returns null for a garbage string', () => {
    expect(verifyToken('not.a.jwt')).toBeNull();
  });

  it('verifyToken returns null for a token signed with a different secret', () => {
    // Sign with a different secret
    process.env.JWT_SECRET = 'other-secret';
    const token = signToken(TEST_UID);

    // Verify with the original secret
    process.env.JWT_SECRET = 'test-secret-for-unit-tests';
    expect(verifyToken(token)).toBeNull();
  });

  it('verifyToken returns null for an expired token', async () => {
    // Sign a token that expires immediately (1ms)
    const token = signToken(TEST_UID, '1ms');

    // Wait a tick to ensure expiry
    await new Promise((r) => setTimeout(r, 10));

    expect(verifyToken(token)).toBeNull();
  });

  it('verifyToken returns null when uid is missing from payload', () => {
    // Manually craft a token without uid using jsonwebtoken
    // We can do this by signing a payload that lacks uid
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'no-uid' }, 'test-secret-for-unit-tests');
    expect(verifyToken(token)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. extractToken
// ─────────────────────────────────────────────────────────────────────────────

describe('extractToken', () => {
  it('extracts token from Authorization: Bearer header', () => {
    const token = 'my.jwt.token';
    expect(extractToken(`Bearer ${token}`, null)).toBe(token);
  });

  it('is case-insensitive for the Bearer prefix', () => {
    const token = 'my.jwt.token';
    expect(extractToken(`bearer ${token}`, null)).toBe(token);
    expect(extractToken(`BEARER ${token}`, null)).toBe(token);
  });

  it('extracts token from jwt cookie', () => {
    const token = 'cookie.jwt.token';
    expect(extractToken(null, `jwt=${token}`)).toBe(token);
  });

  it('extracts jwt cookie when other cookies are present', () => {
    const token = 'cookie.jwt.token';
    expect(extractToken(null, `session=abc123; jwt=${token}; theme=dark`)).toBe(token);
  });

  it('prefers Authorization header over cookie', () => {
    const headerToken = 'header.token';
    const cookieToken = 'cookie.token';
    expect(extractToken(`Bearer ${headerToken}`, `jwt=${cookieToken}`)).toBe(headerToken);
  });

  it('returns null when neither header nor cookie is present', () => {
    expect(extractToken(null, null)).toBeNull();
  });

  it('returns null when Authorization header has no Bearer prefix', () => {
    expect(extractToken('Basic dXNlcjpwYXNz', null)).toBeNull();
  });

  it('returns null when cookie does not contain jwt', () => {
    expect(extractToken(null, 'session=abc123; theme=dark')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(extractToken('', '')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getUserFromToken
// ─────────────────────────────────────────────────────────────────────────────

describe('getUserFromToken', () => {
  it('returns AuthUser with correct uid from Authorization header', () => {
    const token = signToken(TEST_UID);
    const user = getUserFromToken(`Bearer ${token}`, null);
    expect(user).not.toBeNull();
    expect(user!.loggedIn).toBe(true);
    expect(user!.uid).toBe(TEST_UID);
  });

  it('returns AuthUser with correct uid from jwt cookie', () => {
    const token = signToken(TEST_UID);
    const user = getUserFromToken(null, `jwt=${token}`);
    expect(user).not.toBeNull();
    expect(user!.loggedIn).toBe(true);
    expect(user!.uid).toBe(TEST_UID);
  });

  it('returns null when no token is provided', () => {
    expect(getUserFromToken(null, null)).toBeNull();
  });

  it('returns null for an invalid token', () => {
    expect(getUserFromToken('Bearer invalid.token.here', null)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const token = signToken(TEST_UID, '1ms');
    await new Promise((r) => setTimeout(r, 10));
    expect(getUserFromToken(`Bearer ${token}`, null)).toBeNull();
  });

  it('returns null when Authorization header is present but empty', () => {
    expect(getUserFromToken('', null)).toBeNull();
  });

  it('uid in returned AuthUser matches the uid used to sign the token', () => {
    const uids = ['1', '99', '1000', 'user-abc'];
    for (const uid of uids) {
      const token = signToken(uid);
      const user = getUserFromToken(`Bearer ${token}`, null);
      expect(user!.uid).toBe(uid);
    }
  });
});
