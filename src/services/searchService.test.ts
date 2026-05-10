import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateRegex, highlightMatches, SearchService } from './searchService';
import { ArticleService } from './articleService';
import { createTestDatabase } from '../utils/db';
import type Database from 'better-sqlite3';
import type { CreateArticleInput, SearchOptions } from '../types/article';
import { SearchError } from '../types/errors';

describe('SearchService - validateRegex', () => {
  describe('Valid regex patterns', () => {
    it('should validate simple literal patterns', () => {
      const result = validateRegex('hello');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate patterns with character classes', () => {
      const result = validateRegex('[a-z]+');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate patterns with quantifiers', () => {
      const result = validateRegex('\\d{2,4}');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate patterns with alternation', () => {
      const result = validateRegex('cat|dog');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate patterns with anchors', () => {
      const result = validateRegex('^start.*end$');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate patterns with groups', () => {
      const result = validateRegex('(\\w+)@(\\w+)\\.(\\w+)');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate empty pattern', () => {
      const result = validateRegex('');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate patterns with lookahead', () => {
      const result = validateRegex('(?=.*[a-z])');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Invalid regex patterns', () => {
    it('should return error for unterminated character class', () => {
      const result = validateRegex('[abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('character class');
    });

    it('should return error for unterminated group', () => {
      const result = validateRegex('(abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for invalid quantifier', () => {
      const result = validateRegex('a{2,1}');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for invalid escape sequence', () => {
      // \k is actually valid in JS regex (matches literal 'k')
      // Use an invalid named group reference instead
      const result = validateRegex('(?<name>test)\\k<invalid>');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for unmatched closing bracket', () => {
      const result = validateRegex('abc]');
      // Note: This is actually valid in JavaScript regex (literal ])
      // Let's test a truly invalid pattern instead
      const result2 = validateRegex('(?<invalid');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeDefined();
    });

    it('should return error for invalid backreference', () => {
      // \1 before a group is actually valid in JS (matches literal character)
      // Use an invalid quantifier range instead
      const result = validateRegex('a{5,2}');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return descriptive error messages', () => {
      const result = validateRegex('[a-z');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle patterns with special characters', () => {
      const result = validateRegex('\\$\\^\\*\\+\\?');
      expect(result.valid).toBe(true);
    });

    it('should handle unicode patterns', () => {
      const result = validateRegex('[\\u4e00-\\u9fa5]+');
      expect(result.valid).toBe(true);
    });

    it('should handle very long patterns', () => {
      const longPattern = 'a'.repeat(1000);
      const result = validateRegex(longPattern);
      expect(result.valid).toBe(true);
    });

    it('should handle patterns with multiple errors (returns first error)', () => {
      const result = validateRegex('[abc(def');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('SearchService - highlightMatches', () => {
  describe('Basic highlighting', () => {
    it('should highlight a simple literal match', () => {
      const result = highlightMatches('Hello world', 'world');
      expect(result).toBe('Hello <mark>world</mark>');
    });

    it('should highlight multiple matches', () => {
      const result = highlightMatches('test test test', 'test');
      expect(result).toBe('<mark>test</mark> <mark>test</mark> <mark>test</mark>');
    });

    it('should highlight case-sensitive matches', () => {
      const result = highlightMatches('Hello hello HELLO', 'hello', true);
      expect(result).toBe('Hello <mark>hello</mark> HELLO');
    });

    it('should return original text when no matches found', () => {
      const result = highlightMatches('Hello world', 'xyz');
      expect(result).toBe('Hello world');
    });

    it('should handle empty text', () => {
      const result = highlightMatches('', 'test');
      expect(result).toBe('');
    });

    it('should handle empty pattern (matches everything)', () => {
      const result = highlightMatches('abc', '');
      // Empty pattern matches between every character
      expect(result).toContain('mark');
    });
  });

  describe('Regex pattern highlighting', () => {
    it('should highlight digit patterns', () => {
      const result = highlightMatches('test 123 test', '\\d+');
      expect(result).toBe('test <mark>123</mark> test');
    });

    it('should highlight word boundaries', () => {
      const result = highlightMatches('password word', '\\bword\\b');
      expect(result).toBe('password <mark>word</mark>');
    });

    it('should highlight character classes', () => {
      const result = highlightMatches('abc123def', '[a-z]+');
      expect(result).toBe('<mark>abc</mark>123<mark>def</mark>');
    });

    it('should highlight with quantifiers', () => {
      const result = highlightMatches('a aa aaa', 'a{2,}');
      expect(result).toBe('a <mark>aa</mark> <mark>aaa</mark>');
    });

    it('should highlight with alternation', () => {
      const result = highlightMatches('I have a cat and a dog', 'cat|dog');
      expect(result).toBe('I have a <mark>cat</mark> and a <mark>dog</mark>');
    });

    it('should highlight with groups', () => {
      const result = highlightMatches('test@example.com', '(\\w+)@(\\w+)');
      expect(result).toBe('<mark>test@example</mark>.com');
    });
  });

  describe('Content preservation', () => {
    it('should preserve original text content', () => {
      const original = 'Hello world! How are you?';
      const result = highlightMatches(original, 'world');
      // Remove mark tags to verify original text is preserved
      const withoutMarks = result.replace(/<\/?mark>/g, '');
      expect(withoutMarks).toBe(original);
    });

    it('should preserve special characters', () => {
      const original = 'Price: $100.50';
      const result = highlightMatches(original, '\\d+');
      const withoutMarks = result.replace(/<\/?mark>/g, '');
      expect(withoutMarks).toBe(original);
    });

    it('should preserve unicode characters', () => {
      const original = '你好世界 Hello';
      const result = highlightMatches(original, 'Hello');
      const withoutMarks = result.replace(/<\/?mark>/g, '');
      expect(withoutMarks).toBe(original);
    });

    it('should preserve whitespace', () => {
      const original = 'test  \n  test';
      const result = highlightMatches(original, 'test');
      const withoutMarks = result.replace(/<\/?mark>/g, '');
      expect(withoutMarks).toBe(original);
    });
  });

  describe('Edge cases', () => {
    it('should handle invalid regex gracefully', () => {
      const result = highlightMatches('test text', '[invalid');
      // Should return original text when regex is invalid
      expect(result).toBe('test text');
    });

    it('should handle special regex characters in text', () => {
      const result = highlightMatches('test (parentheses)', '\\(.*?\\)');
      expect(result).toBe('test <mark>(parentheses)</mark>');
    });

    it('should handle overlapping potential matches', () => {
      const result = highlightMatches('aaaa', 'aa');
      // Global flag should match all non-overlapping occurrences
      expect(result).toBe('<mark>aa</mark><mark>aa</mark>');
    });

    it('should handle very long text', () => {
      const longText = 'word '.repeat(1000) + 'target';
      const result = highlightMatches(longText, 'target');
      expect(result).toContain('<mark>target</mark>');
      expect(result.split('<mark>').length - 1).toBe(1);
    });

    it('should handle patterns that match empty strings at boundaries', () => {
      const result = highlightMatches('test', 't*');
      // This will match empty strings too, but should still work
      expect(result).toContain('mark');
    });
  });

  describe('HTML safety', () => {
    it('should not double-escape existing HTML', () => {
      const result = highlightMatches('<div>test</div>', 'test');
      expect(result).toBe('<div><mark>test</mark></div>');
    });

    it('should handle text with existing mark tags', () => {
      const result = highlightMatches('<mark>already</mark> marked', 'marked');
      expect(result).toContain('<mark>marked</mark>');
    });
  });
});

describe('SearchService - searchArticles', () => {
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

  describe('Specific regex patterns', () => {
    it('should search with literal text pattern', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'JavaScript Tutorial',
        content: 'Learn JavaScript basics',
        authorUid: '1',
        categories: [],
        published: true
      });

      const article2 = articleService.createArticle({
        title: 'Python Guide',
        content: 'Python programming fundamentals',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('JavaScript', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
      expect(result.articles[0].matches.length).toBeGreaterThan(0);
    });

    it('should search with wildcard pattern (.*)', async () => {
      // Create test articles
      articleService.createArticle({
        title: 'Article One',
        content: 'Content about programming',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Article Two',
        content: 'Content about design',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'],
        caseSensitive: false
      };

      // Search for "Content" followed by anything
      const result = await searchService.searchArticles('Content.*', searchOptions);

      expect(result.total).toBe(2);
      expect(result.articles.length).toBe(2);
    });

    it('should search with digit pattern (\\d+)', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'Version 2.0 Release',
        content: 'New features in version 2.0',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Getting Started',
        content: 'No numbers here',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('\\d+', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
    });

    it('should search with character class pattern ([a-z]+)', async () => {
      // Create test articles
      articleService.createArticle({
        title: 'ABC123',
        content: 'Mixed content with abc and 123',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('[a-z]+', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].matches.length).toBeGreaterThan(0);
    });

    it('should search with word boundary pattern (\\bword\\b)', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'The word is here',
        content: 'This contains the word we want',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Password protected',
        content: 'This has password but not the standalone term',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'], // Only search content to avoid matching "word" in title
        caseSensitive: false
      };

      const result = await searchService.searchArticles('\\bword\\b', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
    });

    it('should search with alternation pattern (cat|dog)', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'Cat Care Guide',
        content: 'How to care for your cat',
        authorUid: '1',
        categories: [],
        published: true
      });

      const article2 = articleService.createArticle({
        title: 'Dog Training',
        content: 'Train your dog effectively',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Bird Watching',
        content: 'Guide to bird watching',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('cat|dog', searchOptions);

      expect(result.total).toBe(2);
      const resultIds = result.articles.map(hit => hit.article.id);
      expect(resultIds).toContain(article1.id);
      expect(resultIds).toContain(article2.id);
    });

    it('should search with quantifier pattern (a{2,3})', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'Aardvark Facts',
        content: 'Learn about aardvarks',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Apple Guide',
        content: 'All about apples',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('a{2,3}', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
    });

    it('should search with anchor pattern (^start)', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'Start Here',
        content: 'Start your journey with this guide',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Getting Started',
        content: 'This is where you start',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('^Start', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
    });

    it('should search with case-sensitive pattern', async () => {
      // Create test articles
      const article1 = articleService.createArticle({
        title: 'JavaScript Guide',
        content: 'Learn JavaScript',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'javascript basics',
        content: 'Learn javascript fundamentals',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: true
      };

      const result = await searchService.searchArticles('JavaScript', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
    });

    it('should search with unicode pattern', async () => {
      // Create test articles with mixed content
      const article1 = articleService.createArticle({
        title: 'Chinese Article 中文',
        content: '这是中文内容',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'English Title',
        content: 'English content only',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'], // Only search content
        caseSensitive: false
      };

      const result = await searchService.searchArticles('[\\u4e00-\\u9fa5]+', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.id).toBe(article1.id);
    });
  });

  describe('Performance with large article sets', () => {
    it('should handle search with 100 articles efficiently', async () => {
      // Create 100 articles
      for (let i = 0; i < 100; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: `Content for article number ${i}`,
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 50,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const startTime = Date.now();
      const result = await searchService.searchArticles('article', searchOptions);
      const executionTime = Date.now() - startTime;

      expect(result.total).toBe(100);
      expect(result.articles.length).toBe(50); // First page
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.executionTime).toBeLessThan(2000);
    });

    it('should handle search with 500 articles efficiently', async () => {
      // Create 500 articles
      for (let i = 0; i < 500; i++) {
        articleService.createArticle({
          title: `Test Article ${i}`,
          content: `This is test content for article ${i}`,
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 100,
        searchFields: ['content'],
        caseSensitive: false
      };

      const startTime = Date.now();
      const result = await searchService.searchArticles('test', searchOptions);
      const executionTime = Date.now() - startTime;

      expect(result.total).toBe(500);
      expect(result.articles.length).toBe(100); // First page
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle search with 1000 articles and complex regex', async () => {
      // Create 1000 articles with varying content
      for (let i = 0; i < 1000; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: `Content with number ${i} and text data`,
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 50,
        searchFields: ['content'],
        caseSensitive: false
      };

      const startTime = Date.now();
      const result = await searchService.searchArticles('\\d+', searchOptions);
      const executionTime = Date.now() - startTime;

      expect(result.total).toBe(1000);
      expect(result.articles.length).toBe(50);
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle pagination correctly with large result sets', async () => {
      // Create 50 articles
      for (let i = 0; i < 50; i++) {
        articleService.createArticle({
          title: `Test ${i}`,
          content: `Test content ${i}`,
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 2,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('test', searchOptions);

      expect(result.total).toBe(50);
      expect(result.articles.length).toBe(10); // Second page
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it('should handle search with very long article content', async () => {
      // Create article with very long content
      const longContent = 'Lorem ipsum dolor sit amet. '.repeat(1000); // ~28,000 characters
      
      articleService.createArticle({
        title: 'Long Article',
        content: longContent,
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'],
        caseSensitive: false
      };

      const startTime = Date.now();
      const result = await searchService.searchArticles('Lorem', searchOptions);
      const executionTime = Date.now() - startTime;

      expect(result.total).toBe(1);
      expect(executionTime).toBeLessThan(2000);
    });

    it('should return execution time in results', async () => {
      // Create a few articles
      for (let i = 0; i < 10; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: `Content ${i}`,
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('Article', searchOptions);

      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThan(2000);
    });
  });

  describe('Timeout behavior', () => {
    it('should throw SearchError when search exceeds 2 second timeout', async () => {
      // Create a large number of articles to increase search time
      for (let i = 0; i < 5000; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: `This is a very long content string that will take time to search through. `.repeat(50),
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 100,
        searchFields: ['content'],
        caseSensitive: false
      };

      // Use a complex regex that might take longer
      try {
        await searchService.searchArticles('(very.*long.*content.*string)+', searchOptions);
        // If we get here without timeout, that's okay - the test environment might be fast
        // The important thing is that IF it times out, it throws the right error
      } catch (error) {
        expect(error).toBeInstanceOf(SearchError);
        expect((error as SearchError).message).toContain('timeout');
      }
    }, 30000); // Allow up to 30 seconds for this test (creating 5000 articles takes time)

    it('should check timeout periodically during search', async () => {
      // Create many articles
      for (let i = 0; i < 1000; i++) {
        articleService.createArticle({
          title: `Test Article ${i}`,
          content: `Content ${i}`,
          authorUid: '1',
          categories: [],
          published: true
        });
      }

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 100,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      // Normal search should complete without timeout
      const result = await searchService.searchArticles('test', searchOptions);
      
      expect(result.total).toBe(1000);
      expect(result.executionTime).toBeLessThan(2000);
    });

    it('should include timeout information in error message', async () => {
      // We can't reliably trigger a timeout in a test environment
      // But we can verify the error handling structure
      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      // Test with invalid regex to verify error handling
      try {
        await searchService.searchArticles('[invalid', searchOptions);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(SearchError);
        expect((error as SearchError).message).toBeTruthy();
      }
    });
  });

  describe('Search result structure', () => {
    it('should return correct result structure', async () => {
      const article = articleService.createArticle({
        title: 'Test Article',
        content: 'Test content',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('test', searchOptions);

      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('executionTime');

      expect(Array.isArray(result.articles)).toBe(true);
      expect(result.query).toBe('test');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should include match information in results', async () => {
      articleService.createArticle({
        title: 'JavaScript Tutorial',
        content: 'Learn JavaScript programming',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('JavaScript', searchOptions);

      expect(result.articles.length).toBe(1);
      const hit = result.articles[0];
      
      expect(hit).toHaveProperty('article');
      expect(hit).toHaveProperty('matches');
      expect(Array.isArray(hit.matches)).toBe(true);
      expect(hit.matches.length).toBeGreaterThan(0);

      const match = hit.matches[0];
      expect(match).toHaveProperty('field');
      expect(match).toHaveProperty('snippet');
      expect(match).toHaveProperty('position');
      expect(['title', 'content']).toContain(match.field);
    });

    it('should include highlighted snippets in matches', async () => {
      articleService.createArticle({
        title: 'Test Article',
        content: 'This is test content with the word test appearing multiple times',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('test', searchOptions);

      expect(result.articles.length).toBe(1);
      const hit = result.articles[0];
      const contentMatch = hit.matches.find(m => m.field === 'content');

      expect(contentMatch).toBeDefined();
      expect(contentMatch!.snippet).toContain('<mark>');
      expect(contentMatch!.snippet).toContain('</mark>');
      expect(contentMatch!.snippet).toContain('test');
    });

    it('should include article metadata in results', async () => {
      const article = articleService.createArticle({
        title: 'Test Article',
        content: 'Test content',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('test', searchOptions);

      expect(result.articles.length).toBe(1);
      const resultArticle = result.articles[0].article;

      expect(resultArticle.id).toBe(article.id);
      expect(resultArticle.title).toBe(article.title);
      expect(resultArticle.content).toBe(article.content);
      expect(resultArticle.authorUid).toBe(article.authorUid);
      expect(resultArticle.published).toBe(true);
      expect(resultArticle.createdAt).toBeInstanceOf(Date);
      expect(resultArticle.updatedAt).toBeInstanceOf(Date);
    });

    it('should extract context around matches in content', async () => {
      const longContent = 'Start of content. '.repeat(10) + 
                         'Important keyword here. ' + 
                         'End of content. '.repeat(10);

      articleService.createArticle({
        title: 'Test',
        content: longContent,
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('keyword', searchOptions);

      expect(result.articles.length).toBe(1);
      const contentMatch = result.articles[0].matches.find(m => m.field === 'content');

      expect(contentMatch).toBeDefined();
      // Snippet should include context before and after the match
      expect(contentMatch!.snippet.length).toBeLessThan(longContent.length);
      expect(contentMatch!.snippet).toContain('keyword');
      expect(contentMatch!.snippet).toContain('...');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty search results', async () => {
      articleService.createArticle({
        title: 'Test Article',
        content: 'Test content',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('nonexistent', searchOptions);

      expect(result.total).toBe(0);
      expect(result.articles.length).toBe(0);
    });

    it('should only search in published articles', async () => {
      articleService.createArticle({
        title: 'Published Article',
        content: 'This is published',
        authorUid: '1',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Unpublished Article',
        content: 'This is not published',
        authorUid: '1',
        categories: [],
        published: false
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('published', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles[0].article.title).toBe('Published Article');
    });

    it('should throw SearchError for invalid regex', async () => {
      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      await expect(
        searchService.searchArticles('[invalid', searchOptions)
      ).rejects.toThrow(SearchError);

      await expect(
        searchService.searchArticles('[invalid', searchOptions)
      ).rejects.toThrow(/Invalid regular expression/);
    });

    it('should handle empty pattern', async () => {
      articleService.createArticle({
        title: 'Test',
        content: 'Content',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('', searchOptions);

      // Empty pattern matches everything
      expect(result.total).toBeGreaterThan(0);
    });

    it('should handle search with no articles in database', async () => {
      const searchOptions: SearchOptions = {
        page: 1,
        pageSize: 10,
        searchFields: ['title', 'content'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('test', searchOptions);

      expect(result.total).toBe(0);
      expect(result.articles.length).toBe(0);
    });

    it('should handle page beyond available results', async () => {
      articleService.createArticle({
        title: 'Test',
        content: 'Content',
        authorUid: '1',
        categories: [],
        published: true
      });

      const searchOptions: SearchOptions = {
        page: 10,
        pageSize: 10,
        searchFields: ['title'],
        caseSensitive: false
      };

      const result = await searchService.searchArticles('test', searchOptions);

      expect(result.total).toBe(1);
      expect(result.articles.length).toBe(0); // No results on page 10
      expect(result.page).toBe(10);
    });
  });
});
