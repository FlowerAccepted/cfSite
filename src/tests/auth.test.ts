/**
 * Integration tests for authentication and authorization
 *
 * Tests cover:
 *   - JWT token verification (authenticated vs unauthenticated access)
 *   - Route protection logic (editor pages require auth)
 *   - Article ownership authorization (edit/delete require ownership)
 *   - 401 vs 403 error distinction
 *   - requireAuth and requireOwnership middleware helpers
 *
 * Requirements: 6.1, 6.3, 7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArticleService } from '../services/articleService';
import { CategoryService } from '../services/categoryService';
import { createTestDatabase } from '../utils/db';
import { signToken, verifyToken, extractToken, getUserFromToken } from '../utils/jwtAuth';
import { requireAuth, requireOwnership, verifyAuth } from '../middleware/auth';
import { ForbiddenError, UnauthorizedError } from '../types/errors';
import type Database from 'better-sqlite3';
import type { CreateArticleInput } from '../types/article';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test setup
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database;
let articleService: ArticleService;
let categoryService: CategoryService;

const AUTHOR_UID = '1';
const OTHER_UID = '2';

function createTestUser(uid: string, username: string): void {
  db.prepare(`
    INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(uid), username, 'hash', 'salt', Date.now(), '{}');
}

function makeArticle(
  overrides: Partial<CreateArticleInput> & { title: string }
): ReturnType<ArticleService['createArticle']> {
  return articleService.createArticle({
    content: 'Default content',
    authorUid: AUTHOR_UID,
    categories: [],
    published: false,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. JWT token verification — Requirement 6.1
// ─────────────────────────────────────────────────────────────────────────────

describe('JWT token verification (Requirement 6.1)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-auth-integration';
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser(AUTHOR_UID, 'alice');
    createTestUser(OTHER_UID, 'bob');
  });

  afterEach(() => {
    db.close();
    delete process.env.JWT_SECRET;
  });

  it('valid JWT token is verified and returns user UID', () => {
    const token = signToken(AUTHOR_UID);
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.uid).toBe(AUTHOR_UID);
  });

  it('invalid JWT token returns null', () => {
    const payload = verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('expired JWT token returns null', async () => {
    const token = signToken(AUTHOR_UID, '1ms');
    await new Promise((r) => setTimeout(r, 10));

    const payload = verifyToken(token);
    expect(payload).toBeNull();
  });

  it('token signed with wrong secret returns null', () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'wrong-secret';
    const token = signToken(AUTHOR_UID);

    process.env.JWT_SECRET = originalSecret;
    const payload = verifyToken(token);
    expect(payload).toBeNull();
  });

  it('getUserFromToken returns AuthUser for valid Bearer token', () => {
    const token = signToken(AUTHOR_UID);
    const user = getUserFromToken(`Bearer ${token}`, null);

    expect(user).not.toBeNull();
    expect(user!.loggedIn).toBe(true);
    expect(user!.uid).toBe(AUTHOR_UID);
  });

  it('getUserFromToken returns AuthUser for valid jwt cookie', () => {
    const token = signToken(AUTHOR_UID);
    const user = getUserFromToken(null, `jwt=${token}`);

    expect(user).not.toBeNull();
    expect(user!.uid).toBe(AUTHOR_UID);
  });

  it('getUserFromToken returns null when no token is provided', () => {
    const user = getUserFromToken(null, null);
    expect(user).toBeNull();
  });

  it('getUserFromToken returns null for invalid token', () => {
    const user = getUserFromToken('Bearer bad.token', null);
    expect(user).toBeNull();
  });

  it('extractToken prefers Authorization header over cookie', () => {
    const headerToken = 'header-token';
    const cookieToken = 'cookie-token';
    const extracted = extractToken(`Bearer ${headerToken}`, `jwt=${cookieToken}`);
    expect(extracted).toBe(headerToken);
  });

  it('extractToken returns null when neither header nor cookie is present', () => {
    expect(extractToken(null, null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. requireAuth middleware helper — Requirement 6.1
// ─────────────────────────────────────────────────────────────────────────────

describe('requireAuth middleware helper (Requirement 6.1)', () => {
  it('returns authenticated=true for a valid logged-in user', () => {
    const user = { loggedIn: true as const, uid: AUTHOR_UID };
    const result = requireAuth(user);

    expect(result.authenticated).toBe(true);
    expect(result.user).not.toBeNull();
    expect(result.user!.uid).toBe(AUTHOR_UID);
  });

  it('returns authenticated=false for null user (unauthenticated)', () => {
    const result = requireAuth(null);

    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns authenticated=false for undefined user', () => {
    const result = requireAuth(undefined);

    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
  });

  it('authenticated result contains the correct uid', () => {
    const user = { loggedIn: true as const, uid: '42' };
    const result = requireAuth(user);

    expect(result.user!.uid).toBe('42');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. verifyAuth from request headers — Requirement 6.1
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyAuth from request headers (Requirement 6.1)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-auth-integration';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('returns authenticated=true for valid Bearer token in Authorization header', () => {
    const token = signToken(AUTHOR_UID);
    const result = verifyAuth(`Bearer ${token}`, null);

    expect(result.authenticated).toBe(true);
    expect(result.user!.uid).toBe(AUTHOR_UID);
  });

  it('returns authenticated=true for valid jwt cookie', () => {
    const token = signToken(AUTHOR_UID);
    const result = verifyAuth(null, `jwt=${token}`);

    expect(result.authenticated).toBe(true);
    expect(result.user!.uid).toBe(AUTHOR_UID);
  });

  it('returns authenticated=false when no token is provided', () => {
    const result = verifyAuth(null, null);

    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns authenticated=false for invalid token', () => {
    const result = verifyAuth('Bearer invalid.token', null);

    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns authenticated=false for expired token', async () => {
    const token = signToken(AUTHOR_UID, '1ms');
    await new Promise((r) => setTimeout(r, 10));

    const result = verifyAuth(`Bearer ${token}`, null);

    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. requireOwnership authorization helper — Requirement 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('requireOwnership authorization helper (Requirement 6.3)', () => {
  it('returns authorized=true when user owns the resource', () => {
    const user = { loggedIn: true as const, uid: AUTHOR_UID };
    const result = requireOwnership(user, AUTHOR_UID);

    expect(result.authorized).toBe(true);
  });

  it('returns authorized=false with 403 when user does not own the resource', () => {
    const user = { loggedIn: true as const, uid: OTHER_UID };
    const result = requireOwnership(user, AUTHOR_UID);

    expect(result.authorized).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toBeTruthy();
  });

  it('returns authorized=false with 401 when user is null (unauthenticated)', () => {
    const result = requireOwnership(null, AUTHOR_UID);

    expect(result.authorized).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBeTruthy();
  });

  it('returns authorized=false with 401 when user is undefined', () => {
    const result = requireOwnership(undefined, AUTHOR_UID);

    expect(result.authorized).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('distinguishes 401 (unauthenticated) from 403 (unauthorized)', () => {
    const unauthResult = requireOwnership(null, AUTHOR_UID);
    const forbiddenResult = requireOwnership(
      { loggedIn: true, uid: OTHER_UID },
      AUTHOR_UID
    );

    expect(unauthResult.statusCode).toBe(401);
    expect(forbiddenResult.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Article edit authorization — Requirement 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Article edit authorization (Requirement 6.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser(AUTHOR_UID, 'alice');
    createTestUser(OTHER_UID, 'bob');
  });

  afterEach(() => {
    db.close();
  });

  it('author can edit their own article', () => {
    const article = makeArticle({ title: 'My Article' });

    const updated = articleService.updateArticle(
      article.id,
      { title: 'Updated Title' },
      AUTHOR_UID
    );

    expect(updated.title).toBe('Updated Title');
  });

  it('non-author cannot edit article — throws ForbiddenError (403)', () => {
    const article = makeArticle({ title: 'Protected Article' });

    expect(() =>
      articleService.updateArticle(article.id, { title: 'Hacked' }, OTHER_UID)
    ).toThrow(ForbiddenError);
  });

  it('unauthenticated user (empty uid) cannot edit article — throws ForbiddenError', () => {
    const article = makeArticle({ title: 'Protected Article' });

    expect(() =>
      articleService.updateArticle(article.id, { title: 'Hacked' }, '')
    ).toThrow(ForbiddenError);
  });

  it('article content is unchanged after a failed unauthorized edit', () => {
    const article = makeArticle({
      title: 'Original Title',
      content: 'Original content',
    });

    try {
      articleService.updateArticle(article.id, { title: 'Hacked' }, OTHER_UID);
    } catch {
      // expected ForbiddenError
    }

    const found = articleService.getArticleById(article.id);
    expect(found!.title).toBe('Original Title');
    expect(found!.content).toBe('Original content');
  });

  it('ForbiddenError has the correct error code', () => {
    const article = makeArticle({ title: 'Protected' });

    try {
      articleService.updateArticle(article.id, { title: 'Hacked' }, OTHER_UID);
      expect.fail('Expected ForbiddenError');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe('FORBIDDEN');
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Article delete authorization — Requirement 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Article delete authorization (Requirement 6.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser(AUTHOR_UID, 'alice');
    createTestUser(OTHER_UID, 'bob');
  });

  afterEach(() => {
    db.close();
  });

  it('author can delete their own article', () => {
    const article = makeArticle({ title: 'Deletable Article' });

    const result = articleService.deleteArticle(article.id, AUTHOR_UID);

    expect(result).toBe(true);
    expect(articleService.getArticleById(article.id)).toBeNull();
  });

  it('non-author cannot delete article — throws ForbiddenError (403)', () => {
    const article = makeArticle({ title: 'Protected Article' });

    expect(() =>
      articleService.deleteArticle(article.id, OTHER_UID)
    ).toThrow(ForbiddenError);
  });

  it('article still exists after a failed unauthorized delete', () => {
    const article = makeArticle({ title: 'Persistent Article' });

    try {
      articleService.deleteArticle(article.id, OTHER_UID);
    } catch {
      // expected ForbiddenError
    }

    const found = articleService.getArticleById(article.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Persistent Article');
  });

  it('deleteArticle returns false for non-existent article (no error)', () => {
    const result = articleService.deleteArticle('nonexistent-id', AUTHOR_UID);
    expect(result).toBe(false);
  });

  it('ForbiddenError on delete has correct status code 403', () => {
    const article = makeArticle({ title: 'Protected' });

    try {
      articleService.deleteArticle(article.id, OTHER_UID);
      expect.fail('Expected ForbiddenError');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Access control for article viewing — Requirement 7.5
// ─────────────────────────────────────────────────────────────────────────────

describe('Article view access control (Requirement 7.5)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser(AUTHOR_UID, 'alice');
    createTestUser(OTHER_UID, 'bob');
  });

  afterEach(() => {
    db.close();
  });

  it('published article is accessible to unauthenticated users', () => {
    const article = makeArticle({ title: 'Public Article', published: true });

    expect(articleService.canAccessArticle(article, undefined)).toBe(true);
  });

  it('published article is accessible to any authenticated user', () => {
    const article = makeArticle({ title: 'Public Article', published: true });

    expect(articleService.canAccessArticle(article, OTHER_UID)).toBe(true);
    expect(articleService.canAccessArticle(article, AUTHOR_UID)).toBe(true);
  });

  it('unpublished article is NOT accessible to unauthenticated users', () => {
    const article = makeArticle({ title: 'Draft', published: false });

    expect(articleService.canAccessArticle(article, undefined)).toBe(false);
  });

  it('unpublished article is NOT accessible to non-author users', () => {
    const article = makeArticle({ title: 'Draft', published: false });

    expect(articleService.canAccessArticle(article, OTHER_UID)).toBe(false);
  });

  it('unpublished article IS accessible to the author', () => {
    const article = makeArticle({
      title: 'My Draft',
      authorUid: AUTHOR_UID,
      published: false,
    });

    expect(articleService.canAccessArticle(article, AUTHOR_UID)).toBe(true);
  });

  it('access changes when article is published', () => {
    const article = makeArticle({
      title: 'Toggled Article',
      authorUid: AUTHOR_UID,
      published: false,
    });

    // Initially not accessible to non-author
    expect(articleService.canAccessArticle(article, OTHER_UID)).toBe(false);

    // Publish the article
    const published = articleService.updateArticle(article.id, { published: true });

    // Now accessible to non-author
    expect(articleService.canAccessArticle(published, OTHER_UID)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Editor route protection simulation — Requirement 6.1
// ─────────────────────────────────────────────────────────────────────────────

describe('Editor route protection (Requirement 6.1)', () => {
  /**
   * These tests simulate the auth check logic in the Astro editor pages:
   *   const user = Astro.locals.user;
   *   if (!user) return Astro.redirect('/login');
   *
   * We test the requireAuth helper that encapsulates this logic.
   */

  it('unauthenticated user should be redirected to login (null user)', () => {
    const authCheck = requireAuth(null);

    // Page logic: if (!authCheck.authenticated) return Astro.redirect('/login')
    expect(authCheck.authenticated).toBe(false);
    // Simulated redirect target
    const redirectTarget = authCheck.authenticated ? null : '/login';
    expect(redirectTarget).toBe('/login');
  });

  it('authenticated user should be allowed to access editor', () => {
    const user = { loggedIn: true as const, uid: AUTHOR_UID };
    const authCheck = requireAuth(user);

    expect(authCheck.authenticated).toBe(true);
    const redirectTarget = authCheck.authenticated ? null : '/login';
    expect(redirectTarget).toBeNull();
  });

  it('authenticated user with wrong ownership should be redirected to 403', () => {
    const user = { loggedIn: true as const, uid: OTHER_UID };
    const ownershipCheck = requireOwnership(user, AUTHOR_UID);

    // Page logic: if (!ownershipCheck.authorized) return Astro.redirect('/403')
    expect(ownershipCheck.authorized).toBe(false);
    expect(ownershipCheck.statusCode).toBe(403);
    const redirectTarget = ownershipCheck.authorized ? null : `/${ownershipCheck.statusCode}`;
    expect(redirectTarget).toBe('/403');
  });

  it('unauthenticated user accessing edit page should get 401 redirect', () => {
    const ownershipCheck = requireOwnership(null, AUTHOR_UID);

    expect(ownershipCheck.authorized).toBe(false);
    expect(ownershipCheck.statusCode).toBe(401);
  });

  it('author accessing their own edit page should be allowed', () => {
    const user = { loggedIn: true as const, uid: AUTHOR_UID };
    const ownershipCheck = requireOwnership(user, AUTHOR_UID);

    expect(ownershipCheck.authorized).toBe(true);
  });
});
