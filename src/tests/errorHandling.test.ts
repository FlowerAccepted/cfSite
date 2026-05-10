/**
 * Unit tests for error handling utilities and error page structure
 *
 * Tests cover:
 *   - Error page existence and correct structure
 *   - Error response formatting from services
 *   - Global error handler utilities
 *
 * Requirements: 2.4, 3.5, 5.4, 6.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  logError,
  getStatusCode,
  errorToResponse,
  getErrorPageRedirect,
  tryCatch,
  tryCatchSync,
  formatUserErrorMessage,
  buildErrorResponse,
} from '../utils/errorHandler';
import {
  ArticleError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  SearchError,
  ExternalLoadError,
  DatabaseError,
  ConflictError,
  toErrorResponse,
} from '../types/errors';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Error page existence — Requirement 3.5
// ─────────────────────────────────────────────────────────────────────────────

describe('Error pages — existence and structure (Requirement 3.5)', () => {
  const pagesDir = path.resolve(process.cwd(), 'src/pages');

  it('404 error page exists at /src/pages/404.astro', () => {
    const filePath = path.join(pagesDir, '404.astro');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('401 error page exists at /src/pages/401.astro', () => {
    const filePath = path.join(pagesDir, '401.astro');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('403 error page exists at /src/pages/403.astro', () => {
    const filePath = path.join(pagesDir, '403.astro');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('500 error page exists at /src/pages/500.astro', () => {
    const filePath = path.join(pagesDir, '500.astro');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('404 page contains a meaningful heading', () => {
    const filePath = path.join(pagesDir, '404.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Should have an h1 element
    expect(content).toMatch(/<h1/);
    // Should reference 404
    expect(content).toMatch(/404/);
  });

  it('401 page contains a meaningful heading', () => {
    const filePath = path.join(pagesDir, '401.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/<h1/);
    expect(content).toMatch(/401/);
  });

  it('403 page contains a meaningful heading', () => {
    const filePath = path.join(pagesDir, '403.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/<h1/);
    expect(content).toMatch(/403/);
  });

  it('500 page contains a meaningful heading', () => {
    const filePath = path.join(pagesDir, '500.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/<h1/);
    expect(content).toMatch(/500/);
  });

  it('404 page has a link back to home', () => {
    const filePath = path.join(pagesDir, '404.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/href="\/"/);
  });

  it('401 page has a link to login', () => {
    const filePath = path.join(pagesDir, '401.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/href="\/login"/);
  });

  it('403 page has a link back to home', () => {
    const filePath = path.join(pagesDir, '403.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/href="\/"/);
  });

  it('500 page has a link back to home', () => {
    const filePath = path.join(pagesDir, '500.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/href="\/"/);
  });

  it('all error pages use BaseLayout', () => {
    const pages = ['404.astro', '401.astro', '403.astro', '500.astro'];
    for (const page of pages) {
      const content = fs.readFileSync(path.join(pagesDir, page), 'utf-8');
      expect(content, `${page} should import BaseLayout`).toMatch(/BaseLayout/);
    }
  });

  it('all error pages have accessible aria-labelledby on the section', () => {
    const pages = ['404.astro', '401.astro', '403.astro', '500.astro'];
    for (const page of pages) {
      const content = fs.readFileSync(path.join(pagesDir, page), 'utf-8');
      expect(content, `${page} should have aria-labelledby`).toMatch(/aria-labelledby/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getStatusCode — maps errors to HTTP status codes
// ─────────────────────────────────────────────────────────────────────────────

describe('getStatusCode — HTTP status code mapping', () => {
  it('returns 400 for ValidationError', () => {
    expect(getStatusCode(new ValidationError('bad input'))).toBe(400);
  });

  it('returns 400 for SearchError', () => {
    expect(getStatusCode(new SearchError('invalid regex'))).toBe(400);
  });

  it('returns 401 for UnauthorizedError', () => {
    expect(getStatusCode(new UnauthorizedError())).toBe(401);
  });

  it('returns 403 for ForbiddenError', () => {
    expect(getStatusCode(new ForbiddenError())).toBe(403);
  });

  it('returns 404 for NotFoundError', () => {
    expect(getStatusCode(new NotFoundError('Article'))).toBe(404);
  });

  it('returns 409 for ConflictError', () => {
    expect(getStatusCode(new ConflictError('duplicate'))).toBe(409);
  });

  it('returns 500 for DatabaseError', () => {
    expect(getStatusCode(new DatabaseError('db failed'))).toBe(500);
  });

  it('returns 502 for ExternalLoadError', () => {
    expect(getStatusCode(new ExternalLoadError('timeout', 'https://example.com'))).toBe(502);
  });

  it('returns 500 for generic Error', () => {
    expect(getStatusCode(new Error('unknown'))).toBe(500);
  });

  it('returns the custom statusCode from ArticleError', () => {
    const err = new ArticleError('custom', 'CUSTOM', 418);
    expect(getStatusCode(err)).toBe(418);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getErrorPageRedirect — maps errors to redirect URLs
// ─────────────────────────────────────────────────────────────────────────────

describe('getErrorPageRedirect — error page routing', () => {
  it('redirects NotFoundError to /404', () => {
    const result = getErrorPageRedirect(new NotFoundError('Article'));
    expect(result.url).toBe('/404');
    expect(result.status).toBe(404);
  });

  it('redirects UnauthorizedError to /401', () => {
    const result = getErrorPageRedirect(new UnauthorizedError());
    expect(result.url).toBe('/401');
    expect(result.status).toBe(401);
  });

  it('redirects ForbiddenError to /403', () => {
    const result = getErrorPageRedirect(new ForbiddenError());
    expect(result.url).toBe('/403');
    expect(result.status).toBe(403);
  });

  it('redirects DatabaseError to /500', () => {
    const result = getErrorPageRedirect(new DatabaseError('db error'));
    expect(result.url).toBe('/500');
    expect(result.status).toBe(500);
  });

  it('redirects ExternalLoadError to /500 with 502 status', () => {
    const result = getErrorPageRedirect(new ExternalLoadError('timeout', 'https://example.com'));
    expect(result.url).toBe('/500');
    expect(result.status).toBe(502);
  });

  it('redirects generic Error to /500', () => {
    const result = getErrorPageRedirect(new Error('unknown'));
    expect(result.url).toBe('/500');
    expect(result.status).toBe(500);
  });

  it('ValidationError returns 400 status (not redirected to error page)', () => {
    const result = getErrorPageRedirect(new ValidationError('bad input'));
    expect(result.status).toBe(400);
  });

  it('SearchError returns 400 status (not redirected to error page)', () => {
    const result = getErrorPageRedirect(new SearchError('invalid regex'));
    expect(result.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. formatUserErrorMessage — user-friendly messages (Requirement 6.2, 2.4, 5.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('formatUserErrorMessage — user-friendly error messages', () => {
  it('returns the ValidationError message directly (Requirement 6.2)', () => {
    const err = new ValidationError('标题不能为空', 'title');
    expect(formatUserErrorMessage(err)).toBe('标题不能为空');
  });

  it('returns the SearchError message directly (Requirement 2.4)', () => {
    const err = new SearchError('无效的正则表达式: 缺少右括号');
    expect(formatUserErrorMessage(err)).toBe('无效的正则表达式: 缺少右括号');
  });

  it('returns the ExternalLoadError message directly (Requirement 5.4)', () => {
    const err = new ExternalLoadError('请求超时', 'https://example.com');
    expect(formatUserErrorMessage(err)).toBe('请求超时');
  });

  it('returns a generic message for NotFoundError', () => {
    const msg = formatUserErrorMessage(new NotFoundError('Article'));
    expect(msg).toBe('请求的资源不存在。');
  });

  it('returns a generic message for UnauthorizedError', () => {
    const msg = formatUserErrorMessage(new UnauthorizedError());
    expect(msg).toBe('请先登录后再进行此操作。');
  });

  it('returns a generic message for ForbiddenError', () => {
    const msg = formatUserErrorMessage(new ForbiddenError());
    expect(msg).toBe('您没有权限执行此操作。');
  });

  it('returns a generic message for DatabaseError (no internal details)', () => {
    const msg = formatUserErrorMessage(new DatabaseError('SQLITE_ERROR: table not found'));
    expect(msg).toBe('数据库操作失败，请稍后再试。');
    // Must not expose internal DB error details
    expect(msg).not.toContain('SQLITE_ERROR');
    expect(msg).not.toContain('table not found');
  });

  it('returns a safe fallback for unknown errors', () => {
    const msg = formatUserErrorMessage(new Error('internal secret'));
    expect(msg).toBe('发生了意外错误，请稍后再试。');
    expect(msg).not.toContain('internal secret');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. buildErrorResponse — structured error response (Requirement 2.4, 6.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildErrorResponse — structured error response formatting', () => {
  it('includes error code and message for ValidationError', () => {
    const err = new ValidationError('标题不能为空', 'title');
    const response = buildErrorResponse(err);

    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBe('标题不能为空');
    expect(response.error.field).toBe('title');
  });

  it('includes error code and message for SearchError (Requirement 2.4)', () => {
    const err = new SearchError('无效的正则表达式');
    const response = buildErrorResponse(err);

    expect(response.error.code).toBe('SEARCH_ERROR');
    expect(response.error.message).toBe('无效的正则表达式');
  });

  it('includes error code for NotFoundError', () => {
    const err = new NotFoundError('Article');
    const response = buildErrorResponse(err);

    expect(response.error.code).toBe('NOT_FOUND');
    expect(response.error.message).toBe('Article not found');
  });

  it('includes error code for UnauthorizedError', () => {
    const err = new UnauthorizedError();
    const response = buildErrorResponse(err);

    expect(response.error.code).toBe('UNAUTHORIZED');
  });

  it('includes error code for ForbiddenError', () => {
    const err = new ForbiddenError('No permission');
    const response = buildErrorResponse(err);

    expect(response.error.code).toBe('FORBIDDEN');
    expect(response.error.message).toBe('No permission');
  });

  it('uses INTERNAL_ERROR code for unknown errors', () => {
    const err = new Error('something went wrong');
    const response = buildErrorResponse(err);

    expect(response.error.code).toBe('INTERNAL_ERROR');
    expect(response.error.message).toBe('An unexpected error occurred');
  });

  it('does not include field for non-validation errors', () => {
    const err = new NotFoundError('Article');
    const response = buildErrorResponse(err);

    expect(response.error.field).toBeUndefined();
  });

  it('includes field for ValidationError with field', () => {
    const err = new ValidationError('Content too long', 'content');
    const response = buildErrorResponse(err);

    expect(response.error.field).toBe('content');
  });

  it('does not include field when ValidationError has no field', () => {
    const err = new ValidationError('General validation error');
    const response = buildErrorResponse(err);

    expect(response.error.field).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. tryCatch / tryCatchSync — safe wrappers
// ─────────────────────────────────────────────────────────────────────────────

describe('tryCatch — async error wrapper', () => {
  it('returns data on success', async () => {
    const result = await tryCatch(async () => 42);
    expect(result.data).toBe(42);
    expect(result.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const result = await tryCatch(async () => {
      throw new ValidationError('bad input');
    });
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error!.message).toBe('bad input');
  });

  it('wraps non-Error throws in an Error', async () => {
    const result = await tryCatch(async () => {
      throw 'string error';
    });
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe('string error');
  });

  it('returns complex data structures on success', async () => {
    const result = await tryCatch(async () => ({ id: '1', title: 'Test' }));
    expect(result.data).toEqual({ id: '1', title: 'Test' });
    expect(result.error).toBeNull();
  });
});

describe('tryCatchSync — synchronous error wrapper', () => {
  it('returns data on success', () => {
    const result = tryCatchSync(() => 'hello');
    expect(result.data).toBe('hello');
    expect(result.error).toBeNull();
  });

  it('returns error on failure', () => {
    const result = tryCatchSync(() => {
      throw new NotFoundError('Article');
    });
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('wraps non-Error throws in an Error', () => {
    const result = tryCatchSync(() => {
      throw 42;
    });
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe('42');
  });

  it('returns null on success when function returns null', () => {
    const result = tryCatchSync(() => null);
    // data is null but error is also null — success case
    expect(result.error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. errorToResponse — HTTP Response creation
// ─────────────────────────────────────────────────────────────────────────────

describe('errorToResponse — HTTP Response creation', () => {
  it('returns a Response with correct status for ValidationError', async () => {
    const err = new ValidationError('bad input');
    const response = errorToResponse(err);

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns a Response with correct status for NotFoundError', async () => {
    const err = new NotFoundError('Article');
    const response = errorToResponse(err);

    expect(response.status).toBe(404);
  });

  it('returns a Response with correct status for UnauthorizedError', async () => {
    const err = new UnauthorizedError();
    const response = errorToResponse(err);

    expect(response.status).toBe(401);
  });

  it('returns a Response with correct status for ForbiddenError', async () => {
    const err = new ForbiddenError();
    const response = errorToResponse(err);

    expect(response.status).toBe(403);
  });

  it('returns a Response with 500 for generic Error', async () => {
    const err = new Error('unknown');
    const response = errorToResponse(err);

    expect(response.status).toBe(500);
  });

  it('response body is valid JSON', async () => {
    const err = new ValidationError('bad input', 'title');
    const response = errorToResponse(err);
    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });

  it('response body contains correct error code', async () => {
    const err = new SearchError('invalid regex');
    const response = errorToResponse(err);
    const body = await response.json();

    expect(body.error.code).toBe('SEARCH_ERROR');
    expect(body.error.message).toBe('invalid regex');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. logError — error logging
// ─────────────────────────────────────────────────────────────────────────────

describe('logError — error logging', () => {
  it('does not throw when logging an error', () => {
    expect(() => logError(new Error('test'))).not.toThrow();
  });

  it('does not throw when logging with context', () => {
    expect(() =>
      logError(new ValidationError('bad input'), { route: '/article/edit', userId: '123' })
    ).not.toThrow();
  });

  it('does not throw when logging an ArticleError', () => {
    expect(() => logError(new NotFoundError('Article'))).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. toErrorResponse — from errors.ts (Requirement 2.4, 6.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('toErrorResponse — error response formatting (Requirements 2.4, 6.2)', () => {
  it('formats SearchError for invalid regex (Requirement 2.4)', () => {
    const err = new SearchError('Invalid regular expression: missing closing parenthesis');
    const response = toErrorResponse(err);

    expect(response.error.code).toBe('SEARCH_ERROR');
    expect(response.error.message).toContain('Invalid regular expression');
  });

  it('formats ValidationError for missing title (Requirement 6.2)', () => {
    const err = new ValidationError('Title is required', 'title');
    const response = toErrorResponse(err);

    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.field).toBe('title');
  });

  it('formats ExternalLoadError for timeout (Requirement 5.4)', () => {
    const err = new ExternalLoadError('Request timeout after 5000ms', 'https://slow.example.com');
    const response = toErrorResponse(err);

    expect(response.error.code).toBe('EXTERNAL_LOAD_ERROR');
    expect(response.error.message).toContain('timeout');
  });

  it('does not include details by default', () => {
    const err = new ArticleError('test', 'TEST', 500);
    const response = toErrorResponse(err, false);

    expect(response.error.details).toBeUndefined();
  });

  it('includes details when requested', () => {
    const err = new ArticleError('test', 'TEST', 500);
    const response = toErrorResponse(err, true);

    expect(response.error.details).toBeDefined();
  });
});
