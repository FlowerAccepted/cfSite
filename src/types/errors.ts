/**
 * Error classes for the Article System
 * 
 * These custom error classes provide structured error handling
 * with appropriate HTTP status codes and error codes.
 */

/**
 * Base error class for all article system errors
 */
export class ArticleError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ArticleError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends ArticleError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends ArticleError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a user is not authenticated
 */
export class UnauthorizedError extends ArticleError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error thrown when a user lacks permission for an operation
 */
export class ForbiddenError extends ArticleError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error thrown when search operations fail
 */
export class SearchError extends ArticleError {
  constructor(message: string) {
    super(message, 'SEARCH_ERROR', 400);
    this.name = 'SearchError';
  }
}

/**
 * Error thrown when external content loading fails
 */
export class ExternalLoadError extends ArticleError {
  constructor(message: string, public url: string) {
    super(message, 'EXTERNAL_LOAD_ERROR', 502);
    this.name = 'ExternalLoadError';
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseError extends ArticleError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

/**
 * Error thrown when a conflict occurs (e.g., duplicate resource)
 */
export class ConflictError extends ArticleError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/**
 * Standard error response format for API endpoints
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string; // For validation errors
    details?: any; // Additional error details (development only)
  };
}

/**
 * Converts an error to a standardized error response
 */
export function toErrorResponse(error: Error, includeDetails: boolean = false): ErrorResponse {
  if (error instanceof ArticleError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        field: error instanceof ValidationError ? error.field : undefined,
        details: includeDetails ? { stack: error.stack } : undefined,
      },
    };
  }
  
  // Handle unknown errors
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: includeDetails ? { message: error.message, stack: error.stack } : undefined,
    },
  };
}
