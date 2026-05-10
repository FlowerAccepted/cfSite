/**
 * Property-Based Tests for SearchService
 * 
 * This test suite validates universal properties that should hold
 * for all valid inputs using fast-check for property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { SearchService } from './searchService';
import { ArticleService } from './articleService';
import { createTestDatabase } from '../utils/db';
import type Database from 'better-sqlite3';
import type { CreateArticleInput, SearchOptions } from '../types/article';

describe('SearchService - Property-Based Tests', () => {
  let db: Database.Database;
  let searchService: SearchService;
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
    searchService = new SearchService(db);
    articleService = new ArticleService(db);
    
    // Create test user
    createTestUser(1, 'testuser1');
  });

  afterEach(() => {
    // Clean up all articles before closing
    db.prepare('DELETE FROM article_categories').run();
    db.prepare('DELETE FROM articles').run();
    db.prepare('DELETE FROM categories').run();
    db.close();
  });

  describe('Property 3: 正则搜索准确性 (Regex Search Accuracy)', () => {
    it('PBT: search returns all matching articles and no non-matching articles', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of articles with various content
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.string({ minLength: 1, maxLength: 500 })
                .filter(s => s.trim().length > 0)
            }),
            { minLength: 3, maxLength: 10 }
          ),
          // Generate a valid regex pattern
          fc.oneof(
            // Simple literal patterns
            fc.constantFrom('test', 'hello', 'world', 'article', 'content'),
            // Digit patterns
            fc.constant('\\d+'),
            // Word patterns
            fc.constant('\\w+'),
            // Character classes
            fc.constantFrom('[a-z]+', '[A-Z]+', '[0-9]+'),
            // Alternation
            fc.constantFrom('cat|dog', 'hello|world'),
            // Anchors
            fc.constantFrom('^test', 'end$'),
            // Quantifiers
            fc.constantFrom('a+', 'b*', 'c{2,4}')
          ),
          async (articleData, pattern) => {
            // Clean database before each iteration
            db.prepare('DELETE FROM article_categories').run();
            db.prepare('DELETE FROM articles').run();
            
            // Create articles with unique titles (all published so they appear in search)
            // Use UUID-like suffix to avoid pattern matching in the unique identifier
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: true // Must be published to appear in search results
              };
              return articleService.createArticle(input);
            });

            // Perform search
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100, // Large enough to get all results
              searchFields: ['title', 'content'],
              caseSensitive: false
            };

            const searchResult = await searchService.searchArticles(pattern, searchOptions);

            // Manually determine which articles should match
            let regex: RegExp;
            try {
              regex = new RegExp(pattern, 'gi');
            } catch {
              // If pattern is invalid, skip this test case
              return;
            }

            const expectedMatches = createdArticles.filter(article => {
              // Reset regex for each article
              regex.lastIndex = 0;
              const titleMatches = regex.test(article.title);
              regex.lastIndex = 0;
              const contentMatches = regex.test(article.content);
              return titleMatches || contentMatches;
            });

            const expectedMatchIds = new Set(expectedMatches.map(a => a.id));
            const actualMatchIds = new Set(searchResult.articles.map(hit => hit.article.id));

            // Property 1: All matching articles are returned (no false negatives)
            for (const expectedArticle of expectedMatches) {
              expect(actualMatchIds.has(expectedArticle.id)).toBe(true);
            }

            // Property 2: No non-matching articles are returned (no false positives)
            for (const hit of searchResult.articles) {
              expect(expectedMatchIds.has(hit.article.id)).toBe(true);
            }

            // Property 3: Total count matches the number of matching articles
            expect(searchResult.total).toBe(expectedMatches.length);
            expect(searchResult.articles.length).toBe(expectedMatches.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: search in title only returns articles with matching titles', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.string({ minLength: 1, maxLength: 500 })
                .filter(s => s.trim().length > 0)
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.constantFrom('test', 'hello', 'article', '\\d+', '[a-z]+'),
          async (articleData, pattern) => {
            // Clean database before each iteration
            db.prepare('DELETE FROM article_categories').run();
            db.prepare('DELETE FROM articles').run();
            
            // Create articles
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: true
              };
              return articleService.createArticle(input);
            });

            // Search only in titles
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100,
              searchFields: ['title'], // Only search titles
              caseSensitive: false
            };

            const searchResult = await searchService.searchArticles(pattern, searchOptions);

            // Manually determine which articles should match based on title only
            let regex: RegExp;
            try {
              regex = new RegExp(pattern, 'gi');
            } catch {
              return;
            }

            const expectedMatches = createdArticles.filter(article => {
              regex.lastIndex = 0;
              return regex.test(article.title);
            });

            // Property: Only articles with matching titles are returned
            expect(searchResult.articles.length).toBe(expectedMatches.length);

            for (const hit of searchResult.articles) {
              regex.lastIndex = 0;
              expect(regex.test(hit.article.title)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: search in content only returns articles with matching content', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.string({ minLength: 1, maxLength: 500 })
                .filter(s => s.trim().length > 0)
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.constantFrom('test', 'content', 'data', '\\d+', '[a-z]+'),
          async (articleData, pattern) => {
            // Clean database before each iteration
            db.prepare('DELETE FROM article_categories').run();
            db.prepare('DELETE FROM articles').run();
            
            // Create articles
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: true
              };
              return articleService.createArticle(input);
            });

            // Search only in content
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100,
              searchFields: ['content'], // Only search content
              caseSensitive: false
            };

            const searchResult = await searchService.searchArticles(pattern, searchOptions);

            // Manually determine which articles should match based on content only
            let regex: RegExp;
            try {
              regex = new RegExp(pattern, 'gi');
            } catch {
              return;
            }

            const expectedMatches = createdArticles.filter(article => {
              regex.lastIndex = 0;
              return regex.test(article.content);
            });

            // Property: Only articles with matching content are returned
            expect(searchResult.articles.length).toBe(expectedMatches.length);

            for (const hit of searchResult.articles) {
              regex.lastIndex = 0;
              expect(regex.test(hit.article.content)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: case-sensitive search respects case', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.oneof(
                fc.constant('Test Article'),
                fc.constant('test article'),
                fc.constant('TEST ARTICLE'),
                fc.constant('TeSt ArTiClE')
              ),
              content: fc.string({ minLength: 1, maxLength: 200 })
                .filter(s => s.trim().length > 0)
            }),
            { minLength: 4, maxLength: 4 } // Create exactly 4 articles with different cases
          ),
          async (articleData) => {
            // Create articles with different case variations
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: true
              };
              return articleService.createArticle(input);
            });

            // Case-sensitive search for lowercase "test"
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100,
              searchFields: ['title'],
              caseSensitive: true
            };

            const searchResult = await searchService.searchArticles('test', searchOptions);

            // Property: Only articles with lowercase "test" should match
            for (const hit of searchResult.articles) {
              expect(hit.article.title.toLowerCase()).toContain('test');
              // Should contain lowercase 'test' but not only uppercase 'TEST'
              const hasLowercaseTest = /test/.test(hit.article.title);
              expect(hasLowercaseTest).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: search with empty pattern matches all articles', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.string({ minLength: 1, maxLength: 200 })
                .filter(s => s.trim().length > 0)
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (articleData) => {
            // Create articles
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: true
              };
              return articleService.createArticle(input);
            });

            // Search with empty pattern (matches everything)
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100,
              searchFields: ['title', 'content'],
              caseSensitive: false
            };

            const searchResult = await searchService.searchArticles('', searchOptions);

            // Property: Empty pattern matches all published articles
            // (Empty regex matches at every position, so all articles match)
            expect(searchResult.total).toBeGreaterThanOrEqual(createdArticles.length);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: search returns no results when pattern matches nothing', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.constantFrom('apple', 'banana', 'cherry', 'date')
            }),
            { minLength: 3, maxLength: 5 }
          ),
          async (articleData) => {
            // Create articles with specific content that won't match our pattern
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: true
              };
              return articleService.createArticle(input);
            });

            // Search for a pattern that definitely won't match
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100,
              searchFields: ['content'],
              caseSensitive: false
            };

            // Use a pattern that won't match any of the content values
            const searchResult = await searchService.searchArticles('ZZZZZZZZZ', searchOptions);

            // Property: No results when pattern matches nothing
            expect(searchResult.total).toBe(0);
            expect(searchResult.articles.length).toBe(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: search pagination returns correct subset of results', async () => {
      // **Validates: Requirements 2.2, 2.3**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }),
          fc.integer({ min: 2, max: 4 }),
          async (numArticles, pageSize) => {
            // Create articles that all match a simple pattern
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = [];
            for (let i = 0; i < numArticles; i++) {
              const input: CreateArticleInput = {
                title: `Test Article ${i}${uniqueSuffix}`,
                content: `This is test content number ${i}`,
                authorUid: '1',
                categories: [],
                published: true
              };
              createdArticles.push(articleService.createArticle(input));
            }

            // Search for "test" which should match all articles
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: pageSize,
              searchFields: ['title', 'content'],
              caseSensitive: false
            };

            const searchResult = await searchService.searchArticles('test', searchOptions);

            // Property: Total count reflects all matches
            expect(searchResult.total).toBeGreaterThanOrEqual(numArticles);

            // Property: Returned articles don't exceed page size
            expect(searchResult.articles.length).toBeLessThanOrEqual(pageSize);

            // Property: Page size and page number are correctly set
            expect(searchResult.pageSize).toBe(pageSize);
            expect(searchResult.page).toBe(1);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: search only returns published articles', async () => {
      // **Validates: Requirements 2.2, 2.3, 7.1**
      // Feature: article-system, Property 3: 正则搜索准确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.constant('test content'),
              published: fc.boolean()
            }),
            { minLength: 4, maxLength: 8 }
          ),
          async (articleData) => {
            // Create articles with mixed published states
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const createdArticles = articleData.map((data, idx) => {
              const uniqueTitle = `${data.title}${uniqueSuffix}${idx}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: data.content,
                authorUid: '1',
                categories: [],
                published: data.published
              };
              return articleService.createArticle(input);
            });

            // Count how many are published
            const publishedCount = createdArticles.filter(a => a.published).length;

            // Search for "test" which is in all content
            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 100,
              searchFields: ['content'],
              caseSensitive: false
            };

            const searchResult = await searchService.searchArticles('test', searchOptions);

            // Property: Only published articles are returned
            for (const hit of searchResult.articles) {
              expect(hit.article.published).toBe(true);
            }

            // Property: All published articles that match are returned
            expect(searchResult.total).toBeGreaterThanOrEqual(publishedCount);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 4: 无效正则错误处理 (Invalid Regex Error Handling)', () => {
    it('PBT: invalid regex patterns return descriptive errors instead of crashing', async () => {
      // **Validates: Requirements 2.4**
      // Feature: article-system, Property 4: 无效正则错误处理
      
      await fc.assert(
        fc.asyncProperty(
          // Generate various invalid regex patterns (verified to be invalid in JavaScript)
          fc.oneof(
            // Unterminated character class
            fc.constantFrom('[abc', '[a-z', '[^abc'),
            // Unterminated group
            fc.constantFrom('(abc', '(test|hello', '(?:group'),
            // Invalid quantifiers (nothing to repeat)
            fc.constantFrom('*', '+', '?', '{2,3}'),
            // Invalid escape sequences
            fc.constantFrom('\\'),
            // Unmatched closing brackets
            fc.constantFrom(')'),
            // Invalid range
            fc.constantFrom('[z-a]'),
            // Nested quantifiers (nothing to repeat)
            fc.constantFrom('a++', 'b**'),
            // Invalid lookahead/lookbehind
            fc.constantFrom('(?', '(?<')
          ),
          async (invalidPattern) => {
            // Create a test article to search against
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const input: CreateArticleInput = {
              title: `Test Article${uniqueSuffix}`,
              content: 'Test content for invalid regex testing',
              authorUid: '1',
              categories: [],
              published: true
            };
            articleService.createArticle(input);

            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 10,
              searchFields: ['title', 'content'],
              caseSensitive: false
            };

            // Property 1: Invalid regex should throw SearchError, not crash
            let errorThrown = false;
            let errorMessage = '';
            
            try {
              await searchService.searchArticles(invalidPattern, searchOptions);
            } catch (error) {
              errorThrown = true;
              errorMessage = error instanceof Error ? error.message : String(error);
            }

            // Property 2: An error must be thrown for invalid regex
            expect(errorThrown).toBe(true);

            // Property 3: Error message should be descriptive (not empty)
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.length).toBeGreaterThan(0);

            // Property 4: Error message should indicate it's a regex issue
            const lowerMessage = errorMessage.toLowerCase();
            const hasRegexKeyword = 
              lowerMessage.includes('regex') ||
              lowerMessage.includes('regular expression') ||
              lowerMessage.includes('pattern') ||
              lowerMessage.includes('invalid');
            expect(hasRegexKeyword).toBe(true);

            // Clean up
            db.prepare('DELETE FROM article_categories').run();
            db.prepare('DELETE FROM articles').run();
          }
        ),
        { numRuns: 100 } // Run 100 times to test many invalid patterns
      );
    });

    it('PBT: validateRegex function correctly identifies invalid patterns', async () => {
      // **Validates: Requirements 2.4**
      // Feature: article-system, Property 4: 无效正则错误处理
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constantFrom('[abc', '(test', '*', '+', '\\', ')', 'a++', '(?', '[z-a]', '{2,3}')
          ),
          async (invalidPattern) => {
            const { validateRegex } = await import('./searchService');
            const result = validateRegex(invalidPattern);

            // Property 1: Invalid patterns are identified as invalid
            expect(result.valid).toBe(false);

            // Property 2: Error message is provided
            expect(result.error).toBeDefined();
            expect(result.error).toBeTruthy();
            expect(result.error!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: validateRegex function correctly identifies valid patterns', async () => {
      // **Validates: Requirements 2.4**
      // Feature: article-system, Property 4: 无效正则错误处理
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Simple literals
            fc.constantFrom('test', 'hello', 'world', 'article'),
            // Character classes
            fc.constantFrom('[a-z]', '[A-Z]', '[0-9]', '[a-zA-Z0-9]'),
            // Quantifiers
            fc.constantFrom('a+', 'b*', 'c?', 'd{2,4}', 'e{3}'),
            // Groups
            fc.constantFrom('(abc)', '(?:test)', '(hello|world)'),
            // Anchors
            fc.constantFrom('^start', 'end$', '^full$'),
            // Metacharacters
            fc.constantFrom('\\d+', '\\w+', '\\s*', '\\.', '\\['),
            // Alternation
            fc.constantFrom('cat|dog', 'yes|no|maybe'),
            // Word boundaries
            fc.constantFrom('\\bword\\b', '\\Btest'),
            // Lookahead/lookbehind (if supported)
            fc.constantFrom('(?=test)', '(?!test)')
          ),
          async (validPattern) => {
            const { validateRegex } = await import('./searchService');
            const result = validateRegex(validPattern);

            // Property: Valid patterns are identified as valid
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: system remains stable after multiple invalid regex attempts', async () => {
      // **Validates: Requirements 2.4**
      // Feature: article-system, Property 4: 无效正则错误处理
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom('[abc', '(test', '*', '+', '\\', 'a++', ')', '(?', '[z-a]'),
            { minLength: 3, maxLength: 10 }
          ),
          async (invalidPatterns) => {
            // Create a test article
            const uniqueSuffix = `__${Date.now()}__${Math.random().toString(36).substring(2, 15)}`;
            const input: CreateArticleInput = {
              title: `Stability Test${uniqueSuffix}`,
              content: 'Testing system stability with invalid regex',
              authorUid: '1',
              categories: [],
              published: true
            };
            articleService.createArticle(input);

            const searchOptions: SearchOptions = {
              page: 1,
              pageSize: 10,
              searchFields: ['title', 'content'],
              caseSensitive: false
            };

            // Try multiple invalid patterns in sequence
            for (const pattern of invalidPatterns) {
              let errorThrown = false;
              
              try {
                await searchService.searchArticles(pattern, searchOptions);
              } catch (error) {
                errorThrown = true;
              }

              // Property: Each invalid pattern throws an error
              expect(errorThrown).toBe(true);
            }

            // Property: After all invalid attempts, system can still handle valid search
            const validResult = await searchService.searchArticles('test', searchOptions);
            expect(validResult).toBeDefined();
            expect(validResult.articles).toBeDefined();
            expect(Array.isArray(validResult.articles)).toBe(true);

            // Clean up
            db.prepare('DELETE FROM article_categories').run();
            db.prepare('DELETE FROM articles').run();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
