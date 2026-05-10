/**
 * Global Error Handler Utilities
 *
 * Provides centralized error handling for API routes and Astro pages.
 * Catches errors, logs them, and returns appropriate HTTP responses
 * with user-friendly messages.
 *
 * Requirements: 2.4, 5.4, 6.2
 */

import {
  ArticleError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  SearchError,
  ExternalLoadError,
  DatabaseError,
  toErrorResponse,
  type ErrorResponse,
} from '../types/errors';

/**
 * Log an error with context information.
 * In production, this would send to a logging service.
 * In development, it logs to the console.
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

  if (isDev) {
    console.error('[ArticleSystem Error]', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
    });
  } else {
    // In production, log minimal info (no stack traces to avoid leaking internals)
    console.error('[ArticleSystem Error]', {
      name: error.name,
      message: error instanceof ArticleError ? error.message : 'Internal server error',
      code: error instanceof ArticleError ? error.code : 'INTERNAL_ERROR',
      ...context,
    });
  }
}

/**
 * Get the HTTP status code for an error.
 *
 * @param error - The error to get the status code for
 * @returns HTTP status code
 */
export function getStatusCode(error: Error): number {
  if (error instanceof ArticleError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Convert an error to a JSON Response with the appropriate HTTP status code.
 * Used in API route handlers.
 *
 * @param error - The error to convert
 * @param includeDetails - Whether to include stack traces (development only)
 * @returns Response object with JSON body and correct status code
 */
export function errorToResponse(error: Error, includeDetails?: boolean): Response {
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';
  const statusCode = getStatusCode(error);
  const body = toErrorResponse(error, includeDetails ?? isDev);

  logError(error);

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle an error in an Astro page context.
 * Returns a redirect URL for the appropriate error page.
 *
 * @param error - The error that occurred
 * @returns Object with redirect URL and status code
 */
export function getErrorPageRedirect(error: Error): { url: string; status: number } {
  if (error instanceof NotFoundError) {
    return { url: '/404', status: 404 };
  }
  if (error instanceof UnauthorizedError) {
    return { url: '/401', status: 401 };
  }
  if (error instanceof ForbiddenError) {
    return { url: '/403', status: 403 };
  }
  if (error instanceof ValidationError || error instanceof SearchError) {
    // Validation and search errors are user-facing — don't redirect to error pages
    return { url: '/400', status: 400 };
  }
  if (error instanceof ExternalLoadError) {
    // External load errors are handled inline (fallback message), not redirected
    return { url: '/500', status: 502 };
  }
  if (error instanceof DatabaseError) {
    return { url: '/500', status: 500 };
  }
  // Unknown errors
  return { url: '/500', status: 500 };
}

/**
 * Wrap an async operation with error handling.
 * Returns a Result-like object with either a value or an error.
 *
 * @param fn - Async function to execute
 * @returns Object with `data` on success or `error` on failure
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<{ data: T; error: null } | { data: null; error: Error }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { data: null, error };
  }
}

/**
 * Wrap a synchronous operation with error handling.
 * Returns a Result-like object with either a value or an error.
 *
 * @param fn - Synchronous function to execute
 * @returns Object with `data` on success or `error` on failure
 */
export function tryCatchSync<T>(
  fn: () => T
): { data: T; error: null } | { data: null; error: Error } {
  try {
    const data = fn();
    return { data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { data: null, error };
  }
}

/**
 * Format an error for display to the user.
 * Returns a user-friendly message that doesn't expose internal details.
 *
 * @param error - The error to format
 * @returns User-friendly error message string
 */
export function formatUserErrorMessage(error: Error): string {
  // These error types have user-safe messages
  if (
    error instanceof ValidationError ||
    error instanceof SearchError ||
    error instanceof ExternalLoadError
  ) {
    return error.message;
  }

  if (error instanceof NotFoundError) {
    return '请求的资源不存在。';
  }

  if (error instanceof UnauthorizedError) {
    return '请先登录后再进行此操作。';
  }

  if (error instanceof ForbiddenError) {
    return '您没有权限执行此操作。';
  }

  if (error instanceof DatabaseError) {
    return '数据库操作失败，请稍后再试。';
  }

  if (error instanceof ArticleError) {
    return error.message;
  }

  // Unknown errors — don't expose internal details
  return '发生了意外错误，请稍后再试。';
}

/**
 * Build a standard error response body for API routes.
 * Includes the error code, message, and optional field for validation errors.
 *
 * @param error - The error to build a response for
 * @returns ErrorResponse object
 */
export function buildErrorResponse(error: Error): ErrorResponse {
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';
  return toErrorResponse(error, isDev);
}
