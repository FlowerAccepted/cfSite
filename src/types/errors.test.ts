/**
 * Tests for error classes
 */
import { describe, it, expect } from 'vitest';
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
} from './errors';

describe('Error Classes', () => {
  it('should create ArticleError with correct properties', () => {
    const error = new ArticleError('Test error', 'TEST_CODE', 500);
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('ArticleError');
    expect(error instanceof Error).toBe(true);
  });
  
  it('should create ValidationError with field', () => {
    const error = new ValidationError('Invalid title', 'title');
    
    expect(error.message).toBe('Invalid title');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.field).toBe('title');
    expect(error.name).toBe('ValidationError');
  });
  
  it('should create NotFoundError', () => {
    const error = new NotFoundError('Article');
    
    expect(error.message).toBe('Article not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('NotFoundError');
  });
  
  it('should create UnauthorizedError', () => {
    const error = new UnauthorizedError();
    
    expect(error.message).toBe('Unauthorized access');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('UnauthorizedError');
  });
  
  it('should create ForbiddenError', () => {
    const error = new ForbiddenError('Access denied');
    
    expect(error.message).toBe('Access denied');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe('ForbiddenError');
  });
  
  it('should create SearchError', () => {
    const error = new SearchError('Invalid regex pattern');
    
    expect(error.message).toBe('Invalid regex pattern');
    expect(error.code).toBe('SEARCH_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('SearchError');
  });
  
  it('should create ExternalLoadError with URL', () => {
    const error = new ExternalLoadError('Failed to load', 'https://example.com');
    
    expect(error.message).toBe('Failed to load');
    expect(error.code).toBe('EXTERNAL_LOAD_ERROR');
    expect(error.statusCode).toBe(502);
    expect(error.url).toBe('https://example.com');
    expect(error.name).toBe('ExternalLoadError');
  });
  
  it('should create DatabaseError', () => {
    const originalError = new Error('Connection failed');
    const error = new DatabaseError('Database operation failed', originalError);
    
    expect(error.message).toBe('Database operation failed');
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.originalError).toBe(originalError);
    expect(error.name).toBe('DatabaseError');
  });
  
  it('should create ConflictError', () => {
    const error = new ConflictError('Resource already exists');
    
    expect(error.message).toBe('Resource already exists');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('ConflictError');
  });
});

describe('toErrorResponse', () => {
  it('should convert ArticleError to ErrorResponse', () => {
    const error = new ArticleError('Test error', 'TEST_CODE', 500);
    const response = toErrorResponse(error);
    
    expect(response.error.code).toBe('TEST_CODE');
    expect(response.error.message).toBe('Test error');
    expect(response.error.field).toBeUndefined();
    expect(response.error.details).toBeUndefined();
  });
  
  it('should convert ValidationError with field to ErrorResponse', () => {
    const error = new ValidationError('Invalid title', 'title');
    const response = toErrorResponse(error);
    
    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBe('Invalid title');
    expect(response.error.field).toBe('title');
  });
  
  it('should include details when requested', () => {
    const error = new ArticleError('Test error', 'TEST_CODE', 500);
    const response = toErrorResponse(error, true);
    
    expect(response.error.details).toBeDefined();
    expect(response.error.details.stack).toBeDefined();
  });
  
  it('should handle unknown errors', () => {
    const error = new Error('Unknown error');
    const response = toErrorResponse(error);
    
    expect(response.error.code).toBe('INTERNAL_ERROR');
    expect(response.error.message).toBe('An unexpected error occurred');
    expect(response.error.details).toBeUndefined();
  });
  
  it('should include details for unknown errors when requested', () => {
    const error = new Error('Unknown error');
    const response = toErrorResponse(error, true);
    
    expect(response.error.details).toBeDefined();
    expect(response.error.details.message).toBe('Unknown error');
  });
});
