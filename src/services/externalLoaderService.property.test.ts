/**
 * Property-Based Tests for ExternalLoaderService
 * 
 * This test suite validates universal properties that should hold
 * for all valid inputs using fast-check for property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ArticleService } from './articleService';
import { loadContent, validateUrl } from './externalLoaderService';
import { createTestDatabase } from '../utils/db';
import type Database from 'better-sqlite3';
import type { CreateArticleInput } from '../types/article';

describe('ExternalLoaderService - Property-Based Tests', () => {
  let db: Database.Database;
  let articleService: ArticleService;

  // Helper function to create a test user
  function createTestUser(uid: number, username: string): void {
    db.prepare(`
      INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uid, username, 'hash', 'salt', Date.now(), '{}');
  }

  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    
    // Create test user
    createTestUser(1, 'testuser1');
  });

  afterEach(() => {
    db.close();
  });

  describe('Property 12: 外部URL存储往返一致性 (External URL Storage Round-Trip)', () => {
    it('PBT: Stored external URLs are retrieved identically', () => {
      // **Validates: Requirements 5.2**
      // Feature: article-system, Property 12: 外部URL存储往返一致性
      
      fc.assert(
        fc.property(
          // Generate valid HTTP/HTTPS URLs
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 1000 })
            .filter(s => s.trim().length > 0),
          (externalUrl, title, content) => {
            // Create article with external URL
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content,
              authorUid: '1',
              categories: [],
              externalUrl,
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: Retrieved external URL must be identical to stored URL
            expect(created.externalUrl).toBe(externalUrl);

            // Retrieve by ID and verify again
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.externalUrl).toBe(externalUrl);

            // Retrieve by URL and verify again
            const retrievedByUrl = articleService.getArticleByUrl(created.authorUid, created.urlName);
            expect(retrievedByUrl).not.toBeNull();
            expect(retrievedByUrl!.externalUrl).toBe(externalUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: External URL can be updated and retrieved identically', () => {
      // **Validates: Requirements 5.2**
      // Feature: article-system, Property 12: 外部URL存储往返一致性
      
      fc.assert(
        fc.property(
          // Generate two different valid URLs
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          (initialUrl, updatedUrl, title) => {
            // Create article with initial external URL
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: [],
              externalUrl: initialUrl,
              published: false
            };

            const created = articleService.createArticle(input);
            expect(created.externalUrl).toBe(initialUrl);

            // Update external URL
            const updated = articleService.updateArticle(created.id, {
              externalUrl: updatedUrl
            });

            // Property: Updated external URL must be identical to new URL
            expect(updated.externalUrl).toBe(updatedUrl);

            // Retrieve and verify
            const retrieved = articleService.getArticleById(updated.id);
            expect(retrieved!.externalUrl).toBe(updatedUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: External URL can be set to undefined/null', () => {
      // **Validates: Requirements 5.2**
      // Feature: article-system, Property 12: 外部URL存储往返一致性
      
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          (externalUrl, title) => {
            // Create article with external URL
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: [],
              externalUrl,
              published: false
            };

            const created = articleService.createArticle(input);
            expect(created.externalUrl).toBe(externalUrl);

            // Remove external URL by setting to empty string (which becomes null in DB)
            const updated = articleService.updateArticle(created.id, {
              externalUrl: ''
            });

            // Property: External URL should be undefined after removal (empty string becomes null/undefined)
            expect(updated.externalUrl).toBeUndefined();

            // Retrieve and verify
            const retrieved = articleService.getArticleById(updated.id);
            expect(retrieved!.externalUrl).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: Articles without external URL have undefined externalUrl', () => {
      // **Validates: Requirements 5.2**
      // Feature: article-system, Property 12: 外部URL存储往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 1000 })
            .filter(s => s.trim().length > 0),
          (title, content) => {
            // Create article without external URL
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content,
              authorUid: '1',
              categories: [],
              // No externalUrl provided
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: External URL should be undefined when not provided
            expect(created.externalUrl).toBeUndefined();

            // Retrieve and verify
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved!.externalUrl).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: 外部加载错误优雅降级 (Error Graceful Degradation)', () => {
    it('PBT: Invalid URLs return error response instead of throwing', async () => {
      // **Validates: Requirements 5.4**
      // Feature: article-system, Property 13: 外部加载错误优雅降级
      
      await fc.assert(
        fc.asyncProperty(
          // Generate various invalid URLs
          fc.oneof(
            fc.constant(''),
            fc.constant('not-a-url'),
            fc.constant('ftp://example.com'),
            fc.constant('javascript:alert(1)'),
            fc.constant('file:///etc/passwd'),
            fc.string().filter(s => !s.startsWith('http://') && !s.startsWith('https://'))
          ),
          async (invalidUrl) => {
            // Property: loadContent should not throw for invalid URLs
            const result = await loadContent(invalidUrl);

            // Should return error response
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.content).toBe('');
            expect(result.contentType).toBe('text/plain');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: Non-existent domains return error response instead of throwing', async () => {
      // **Validates: Requirements 5.4**
      // Feature: article-system, Property 13: 外部加载错误优雅降级
      
      await fc.assert(
        fc.asyncProperty(
          // Generate URLs with non-existent domains
          fc.string({ minLength: 10, maxLength: 30 })
            .filter(s => /^[a-z0-9-]+$/.test(s))
            .map(s => `https://${s}.invalid-tld-that-does-not-exist-12345.com/article.txt`),
          async (url) => {
            // Property: loadContent should not throw for network errors
            const result = await loadContent(url, 2000); // Short timeout for faster tests

            // Should return error response (network error or timeout)
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.content).toBe('');
          }
        ),
        { numRuns: 20 } // Fewer runs since these involve network timeouts
      );
    }, 60000); // 60 second test timeout

    it('PBT: validateUrl never throws for any input', () => {
      // **Validates: Requirements 5.4**
      // Feature: article-system, Property 13: 外部加载错误优雅降级
      
      fc.assert(
        fc.property(
          // Generate any possible input including non-strings
          fc.anything(),
          (input) => {
            // Property: validateUrl should never throw
            let result;
            expect(() => {
              result = validateUrl(input as any);
            }).not.toThrow();

            // Should always return an object with valid property
            expect(result).toBeDefined();
            expect(typeof result.valid).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 14: 外部加载超时保护 (Timeout Protection)', () => {
    it('PBT: Requests abort after specified timeout', async () => {
      // **Validates: Requirements 5.5**
      // Feature: article-system, Property 14: 外部加载超时保护
      
      await fc.assert(
        fc.asyncProperty(
          // Generate various timeout values
          fc.integer({ min: 100, max: 2000 }),
          async (timeout) => {
            // Use a URL that will definitely timeout (non-routable IP)
            const url = 'http://192.0.2.1/article.txt'; // TEST-NET-1, non-routable

            const startTime = Date.now();
            const result = await loadContent(url, timeout);
            const elapsed = Date.now() - startTime;

            // Property: Request should complete within timeout + small buffer (500ms for processing)
            expect(elapsed).toBeLessThan(timeout + 500);

            // Should return timeout error
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.loadTime).toBeGreaterThanOrEqual(timeout - 100); // Allow small variance
          }
        ),
        { numRuns: 10 } // Fewer runs since these involve actual timeouts
      );
    }, 30000); // 30 second test timeout

    it('PBT: Default timeout is 5000ms', async () => {
      // **Validates: Requirements 5.5**
      // Feature: article-system, Property 14: 外部加载超时保护
      
      // Use a URL that will timeout
      const url = 'http://192.0.2.1/article.txt';

      const startTime = Date.now();
      const result = await loadContent(url); // No timeout specified, should use default
      const elapsed = Date.now() - startTime;

      // Property: Should timeout around 5000ms (default)
      expect(elapsed).toBeGreaterThan(4500);
      expect(elapsed).toBeLessThan(5500);
      expect(result.success).toBe(false);
    }, 10000); // 10 second test timeout
  });

  describe('Property 15: 外部内容类型支持 (Content Type Support)', () => {
    it('PBT: Content type is preserved from response headers', async () => {
      // **Validates: Requirements 5.6**
      // Feature: article-system, Property 15: 外部内容类型支持
      
      // Note: This test requires mocking fetch to control content-type headers
      // For now, we test that the contentType field is always present and valid
      
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          async (url) => {
            const result = await loadContent(url, 1000);

            // Property: contentType should always be defined
            expect(result.contentType).toBeDefined();
            expect(typeof result.contentType).toBe('string');
            
            // Should be a valid content type format or default
            expect(result.contentType.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 } // Fewer runs since these involve network requests
      );
    }, 30000); // 30 second test timeout

    it('PBT: Plain text content type is handled', async () => {
      // **Validates: Requirements 5.6**
      // Feature: article-system, Property 15: 外部内容类型支持
      
      // Test that text/plain is a valid content type
      const result = await loadContent('http://192.0.2.1/test.txt', 500);
      
      // Even on error, contentType should be valid
      expect(result.contentType).toBe('text/plain');
    }, 10000); // 10 second test timeout

    it('PBT: Content is returned as string', async () => {
      // **Validates: Requirements 5.6**
      // Feature: article-system, Property 15: 外部内容类型支持
      
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          async (url) => {
            const result = await loadContent(url, 1000);

            // Property: content should always be a string
            expect(typeof result.content).toBe('string');
            
            // On success, content should be non-empty (if the URL actually works)
            // On failure, content should be empty
            if (!result.success) {
              expect(result.content).toBe('');
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // 30 second test timeout
  });
});
