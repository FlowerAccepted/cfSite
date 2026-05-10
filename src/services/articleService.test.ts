/**
 * Unit tests for ArticleService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArticleService } from './articleService';
import { CategoryService } from './categoryService';
import { createTestDatabase } from '../utils/db';
import { ValidationError, NotFoundError, ForbiddenError } from '../types/errors';
import type Database from 'better-sqlite3';
import type { CreateArticleInput } from '../types/article';

describe('ArticleService', () => {
  let db: Database.Database;
  let articleService: ArticleService;
  let categoryService: CategoryService;

  // Helper function to create a test user
  function createTestUser(uid: string, username: string): void {
    db.prepare(`
      INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uid, username, 'hash', 'salt', Date.now(), '{}');
  }

  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    
    // Create test users
    createTestUser('123', 'testuser1');
    createTestUser('456', 'testuser2');
  });

  afterEach(() => {
    db.close();
  });

  describe('createArticle', () => {
    it('should create an article with valid input', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'This is test content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      expect(article).toBeDefined();
      expect(article.id).toBeDefined();
      expect(article.title).toBe('Test Article');
      expect(article.content).toBe('This is test content');
      expect(article.authorUid).toBe('123');
      expect(article.urlName).toBe('test-article');
      expect(article.published).toBe(false);
      expect(article.createdAt).toBeInstanceOf(Date);
      expect(article.updatedAt).toBeInstanceOf(Date);
      expect(article.categories).toEqual([]);
    });

    it('should generate URL name from title', () => {
      const input: CreateArticleInput = {
        title: 'Hello World! This is a Test',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      expect(article.urlName).toBe('hello-world-this-is-a-test');
    });

    it('should handle Chinese characters in title', () => {
      const input: CreateArticleInput = {
        title: '你好世界 Hello World',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      // Chinese characters should be removed, leaving only "hello-world"
      expect(article.urlName).toBe('hello-world');
    });

    it('should create article with external URL', () => {
      const input: CreateArticleInput = {
        title: 'External Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        externalUrl: 'https://example.com/article.md',
        published: false
      };

      const article = articleService.createArticle(input);

      expect(article.externalUrl).toBe('https://example.com/article.md');
    });

    it('should create article with categories', () => {
      // Create categories first
      const cat1 = categoryService.createCategory('Technology');
      const cat2 = categoryService.createCategory('Programming');

      const input: CreateArticleInput = {
        title: 'Tech Article',
        content: 'Content about tech',
        authorUid: '123',
        categories: [cat1.id, cat2.id],
        published: false
      };

      const article = articleService.createArticle(input);

      expect(article.categories).toHaveLength(2);
      expect(article.categories?.map(c => c.name)).toContain('Technology');
      expect(article.categories?.map(c => c.name)).toContain('Programming');
    });

    it('should set timestamps correctly', () => {
      const beforeCreate = Date.now();
      
      const input: CreateArticleInput = {
        title: 'Timestamp Test',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);
      const afterCreate = Date.now();

      expect(article.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(article.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
      expect(article.updatedAt.getTime()).toBe(article.createdAt.getTime());
    });

    it('should throw ValidationError for empty title', () => {
      const input: CreateArticleInput = {
        title: '',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      expect(() => articleService.createArticle(input)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input)).toThrow('Title cannot be empty');
    });

    it('should throw ValidationError for title exceeding 200 characters', () => {
      const input: CreateArticleInput = {
        title: 'a'.repeat(201),
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      expect(() => articleService.createArticle(input)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input)).toThrow('Title cannot exceed 200 characters');
    });

    it('should throw ValidationError for content exceeding 100,000 characters', () => {
      const input: CreateArticleInput = {
        title: 'Test',
        content: 'a'.repeat(100001),
        authorUid: '123',
        categories: [],
        published: false
      };

      expect(() => articleService.createArticle(input)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input)).toThrow('Content cannot exceed 100,000 characters');
    });

    it('should throw ValidationError for invalid external URL', () => {
      const input: CreateArticleInput = {
        title: 'Test',
        content: 'Content',
        authorUid: '123',
        categories: [],
        externalUrl: 'not-a-valid-url',
        published: false
      };

      expect(() => articleService.createArticle(input)).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty author UID', () => {
      const input: CreateArticleInput = {
        title: 'Test',
        content: 'Content',
        authorUid: '',
        categories: [],
        published: false
      };

      expect(() => articleService.createArticle(input)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input)).toThrow('Author UID');
    });

    it('should throw ValidationError when title generates empty URL name', () => {
      const input: CreateArticleInput = {
        title: '你好世界',  // Only Chinese characters, will generate empty URL name
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      expect(() => articleService.createArticle(input)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input)).toThrow('Unable to generate valid URL name');
    });

    it('should throw ValidationError for duplicate URL name for same author', () => {
      const input1: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content 1',
        authorUid: '123',
        categories: [],
        published: false
      };

      const input2: CreateArticleInput = {
        title: 'Test Article',  // Same title, same author
        content: 'Content 2',
        authorUid: '123',
        categories: [],
        published: false
      };

      articleService.createArticle(input1);
      
      expect(() => articleService.createArticle(input2)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input2)).toThrow('article with this URL name already exists');
    });

    it('should allow duplicate URL names for different authors', () => {
      const input1: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content 1',
        authorUid: '123',
        categories: [],
        published: false
      };

      const input2: CreateArticleInput = {
        title: 'Test Article',  // Same title, different author
        content: 'Content 2',
        authorUid: '456',
        categories: [],
        published: false
      };

      const article1 = articleService.createArticle(input1);
      const article2 = articleService.createArticle(input2);

      expect(article1.urlName).toBe(article2.urlName);
      expect(article1.authorUid).not.toBe(article2.authorUid);
    });

    it('should handle published articles', () => {
      const input: CreateArticleInput = {
        title: 'Published Article',
        content: 'This is published',
        authorUid: '123',
        categories: [],
        published: true
      };

      const article = articleService.createArticle(input);

      expect(article.published).toBe(true);
    });

    it('should handle special characters in title', () => {
      const input: CreateArticleInput = {
        title: 'Test@#$%Article!!!',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      // Special characters should be replaced with hyphens
      expect(article.urlName).toBe('test-article');
    });

    it('should limit URL name to 100 characters', () => {
      const longTitle = 'a'.repeat(150);
      const input: CreateArticleInput = {
        title: longTitle,
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      expect(article.urlName.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getArticleById', () => {
    it('should retrieve an article by ID', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const retrieved = articleService.getArticleById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe(created.title);
      expect(retrieved?.content).toBe(created.content);
    });

    it('should return null for non-existent article', () => {
      const retrieved = articleService.getArticleById('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should load associated categories', () => {
      const cat = categoryService.createCategory('Test Category');
      
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat.id],
        published: false
      };

      const created = articleService.createArticle(input);
      const retrieved = articleService.getArticleById(created.id);

      expect(retrieved?.categories).toHaveLength(1);
      expect(retrieved?.categories?.[0].name).toBe('Test Category');
    });

    it('should load author data', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const retrieved = articleService.getArticleById(created.id);

      expect(retrieved?.author).toBeDefined();
      expect(retrieved?.author?.uid).toBe('123');
      expect(retrieved?.author?.username).toBe('testuser1');
    });
  });

  describe('getArticleByUrl', () => {
    it('should retrieve an article by author UID and URL name', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const retrieved = articleService.getArticleByUrl('123', 'test-article');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe(created.title);
    });

    it('should return null for non-existent URL', () => {
      const retrieved = articleService.getArticleByUrl('123', 'non-existent');
      expect(retrieved).toBeNull();
    });

    it('should load author data', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '456',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const retrieved = articleService.getArticleByUrl('456', 'test-article');

      expect(retrieved?.author).toBeDefined();
      expect(retrieved?.author?.uid).toBe('456');
      expect(retrieved?.author?.username).toBe('testuser2');
    });

    it('should load associated categories', () => {
      const cat = categoryService.createCategory('URL Test Category');
      
      const input: CreateArticleInput = {
        title: 'URL Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat.id],
        published: false
      };

      const created = articleService.createArticle(input);
      const retrieved = articleService.getArticleByUrl('123', 'url-test-article');

      expect(retrieved?.categories).toHaveLength(1);
      expect(retrieved?.categories?.[0].name).toBe('URL Test Category');
    });
  });

  describe('updateArticle', () => {
    it('should update article title', () => {
      const input: CreateArticleInput = {
        title: 'Original Title',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      
      // Wait a bit to ensure timestamp difference
      const originalUpdatedAt = created.updatedAt.getTime();
      
      const updated = articleService.updateArticle(created.id, {
        title: 'Updated Title'
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.urlName).toBe('updated-title');
      expect(updated.content).toBe('Content'); // Unchanged
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should update article content', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Original content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const updated = articleService.updateArticle(created.id, {
        content: 'Updated content'
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.title).toBe('Test Article'); // Unchanged
    });

    it('should update published status', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const updated = articleService.updateArticle(created.id, {
        published: true
      });

      expect(updated.published).toBe(true);
    });

    it('should update external URL', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const updated = articleService.updateArticle(created.id, {
        externalUrl: 'https://example.com/article.md'
      });

      expect(updated.externalUrl).toBe('https://example.com/article.md');
    });

    it('should update multiple fields at once', () => {
      const input: CreateArticleInput = {
        title: 'Original Title',
        content: 'Original content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const updated = articleService.updateArticle(created.id, {
        title: 'New Title',
        content: 'New content',
        published: true
      });

      expect(updated.title).toBe('New Title');
      expect(updated.content).toBe('New content');
      expect(updated.published).toBe(true);
    });

    it('should preserve author UID (immutable)', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const updated = articleService.updateArticle(created.id, {
        title: 'Updated Title',
        content: 'Updated content'
      });

      expect(updated.authorUid).toBe('123');
      expect(updated.authorUid).toBe(created.authorUid);
    });

    it('should update updated_at timestamp', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const originalUpdatedAt = created.updatedAt.getTime();
      
      // Small delay to ensure timestamp difference
      const beforeUpdate = Date.now();
      
      const updated = articleService.updateArticle(created.id, {
        title: 'Updated Title'
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
      expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime()); // createdAt unchanged
    });

    it('should update categories', () => {
      const cat1 = categoryService.createCategory('Category 1');
      const cat2 = categoryService.createCategory('Category 2');
      const cat3 = categoryService.createCategory('Category 3');

      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id, cat2.id],
        published: false
      };

      const created = articleService.createArticle(input);
      expect(created.categories).toHaveLength(2);

      // Update to different categories
      const updated = articleService.updateArticle(created.id, {
        categories: [cat2.id, cat3.id]
      });

      expect(updated.categories).toHaveLength(2);
      expect(updated.categories?.map(c => c.id)).toContain(cat2.id);
      expect(updated.categories?.map(c => c.id)).toContain(cat3.id);
      expect(updated.categories?.map(c => c.id)).not.toContain(cat1.id);
    });

    it('should remove all categories when empty array provided', () => {
      const cat1 = categoryService.createCategory('Category 1');
      const cat2 = categoryService.createCategory('Category 2');

      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id, cat2.id],
        published: false
      };

      const created = articleService.createArticle(input);
      expect(created.categories).toHaveLength(2);

      const updated = articleService.updateArticle(created.id, {
        categories: []
      });

      expect(updated.categories).toHaveLength(0);
    });

    it('should throw NotFoundError for non-existent article', () => {
      expect(() => articleService.updateArticle('non-existent-id', {
        title: 'New Title'
      })).toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid title', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);

      expect(() => articleService.updateArticle(created.id, {
        title: ''
      })).toThrow(ValidationError);

      expect(() => articleService.updateArticle(created.id, {
        title: 'a'.repeat(201)
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid content', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);

      expect(() => articleService.updateArticle(created.id, {
        content: 'a'.repeat(100001)
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid external URL', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);

      expect(() => articleService.updateArticle(created.id, {
        externalUrl: 'not-a-valid-url'
      })).toThrow(ValidationError);
    });

    it('should regenerate URL name when title changes', () => {
      const input: CreateArticleInput = {
        title: 'Original Title',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      expect(created.urlName).toBe('original-title');

      const updated = articleService.updateArticle(created.id, {
        title: 'Completely New Title'
      });

      expect(updated.urlName).toBe('completely-new-title');
    });

    it('should throw ValidationError when updated title generates empty URL name', () => {
      const input: CreateArticleInput = {
        title: 'Valid Title',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);

      expect(() => articleService.updateArticle(created.id, {
        title: '你好世界'  // Only Chinese characters
      })).toThrow(ValidationError);
      expect(() => articleService.updateArticle(created.id, {
        title: '你好世界'
      })).toThrow('Unable to generate valid URL name');
    });

    it('should handle empty update object', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const originalUpdatedAt = created.updatedAt.getTime();
      
      const updated = articleService.updateArticle(created.id, {});

      // Even with no changes, updated_at should be updated
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
      expect(updated.title).toBe(created.title);
      expect(updated.content).toBe(created.content);
    });

    it('should clear external URL when set to empty string', () => {
      const input: CreateArticleInput = {
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        externalUrl: 'https://example.com/article.md',
        published: false
      };

      const created = articleService.createArticle(input);
      expect(created.externalUrl).toBe('https://example.com/article.md');

      const updated = articleService.updateArticle(created.id, {
        externalUrl: ''
      });

      expect(updated.externalUrl).toBeUndefined();
    });
  });

  describe('listArticles', () => {
    it('should list all articles with pagination', () => {
      // Create multiple articles
      for (let i = 1; i <= 5; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: `Content ${i}`,
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should paginate results correctly', () => {
      // Create 15 articles
      for (let i = 1; i <= 15; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: `Content ${i}`,
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      // Get first page
      const page1 = articleService.listArticles({
        page: 1,
        pageSize: 5
      });

      expect(page1.articles).toHaveLength(5);
      expect(page1.total).toBe(15);
      expect(page1.totalPages).toBe(3);

      // Get second page
      const page2 = articleService.listArticles({
        page: 2,
        pageSize: 5
      });

      expect(page2.articles).toHaveLength(5);
      expect(page2.total).toBe(15);
      expect(page2.totalPages).toBe(3);

      // Get third page
      const page3 = articleService.listArticles({
        page: 3,
        pageSize: 5
      });

      expect(page3.articles).toHaveLength(5);
      expect(page3.total).toBe(15);
      expect(page3.totalPages).toBe(3);

      // Verify articles are different on each page
      const page1Ids = page1.articles.map(a => a.id);
      const page2Ids = page2.articles.map(a => a.id);
      const page3Ids = page3.articles.map(a => a.id);

      expect(page1Ids).not.toEqual(page2Ids);
      expect(page2Ids).not.toEqual(page3Ids);
      expect(page1Ids).not.toEqual(page3Ids);
    });

    it('should filter by author UID', () => {
      // Create articles by different authors
      articleService.createArticle({
        title: 'Article by User 1',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Article by User 2',
        content: 'Content',
        authorUid: '456',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Another Article by User 1',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      // Filter by author 123
      const result = articleService.listArticles({
        page: 1,
        pageSize: 10,
        authorUid: '123'
      });

      expect(result.articles).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.articles.every(a => a.authorUid === '123')).toBe(true);
    });

    it('should filter by published status', () => {
      // Create published and unpublished articles
      articleService.createArticle({
        title: 'Published Article 1',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Unpublished Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      });

      articleService.createArticle({
        title: 'Published Article 2',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      // Filter for published only
      const publishedResult = articleService.listArticles({
        page: 1,
        pageSize: 10,
        published: true
      });

      expect(publishedResult.articles).toHaveLength(2);
      expect(publishedResult.articles.every(a => a.published === true)).toBe(true);

      // Filter for unpublished only
      const unpublishedResult = articleService.listArticles({
        page: 1,
        pageSize: 10,
        published: false
      });

      expect(unpublishedResult.articles).toHaveLength(1);
      expect(unpublishedResult.articles.every(a => a.published === false)).toBe(true);
    });

    it('should filter by categories', () => {
      // Create categories
      const cat1 = categoryService.createCategory('Technology');
      const cat2 = categoryService.createCategory('Science');
      const cat3 = categoryService.createCategory('Art');

      // Create articles with different categories
      articleService.createArticle({
        title: 'Tech Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id],
        published: true
      });

      articleService.createArticle({
        title: 'Science Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat2.id],
        published: true
      });

      articleService.createArticle({
        title: 'Tech and Science Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id, cat2.id],
        published: true
      });

      articleService.createArticle({
        title: 'Art Article',
        content: 'Content',
        authorUid: '123',
        categories: [cat3.id],
        published: true
      });

      // Filter by Technology category
      const techResult = articleService.listArticles({
        page: 1,
        pageSize: 10,
        categories: [cat1.id]
      });

      expect(techResult.articles).toHaveLength(2);
      expect(techResult.articles.every(a => 
        a.categories?.some(c => c.id === cat1.id)
      )).toBe(true);

      // Filter by Science category
      const scienceResult = articleService.listArticles({
        page: 1,
        pageSize: 10,
        categories: [cat2.id]
      });

      expect(scienceResult.articles).toHaveLength(2);
      expect(scienceResult.articles.every(a => 
        a.categories?.some(c => c.id === cat2.id)
      )).toBe(true);
    });

    it('should sort by createdAt descending by default', () => {
      // Create articles - they will have timestamps in order
      const article1 = articleService.createArticle({
        title: 'First Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article2 = articleService.createArticle({
        title: 'Second Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article3 = articleService.createArticle({
        title: 'Third Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      // Should be sorted newest first (desc) - verify timestamps are in descending order
      expect(result.articles).toHaveLength(3);
      expect(result.articles[0].createdAt.getTime()).toBeGreaterThanOrEqual(result.articles[1].createdAt.getTime());
      expect(result.articles[1].createdAt.getTime()).toBeGreaterThanOrEqual(result.articles[2].createdAt.getTime());
      
      // The newest article should be first
      const articleIds = [article1.id, article2.id, article3.id];
      expect(articleIds).toContain(result.articles[0].id);
    });

    it('should sort by createdAt ascending', () => {
      const article1 = articleService.createArticle({
        title: 'First Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article2 = articleService.createArticle({
        title: 'Second Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article3 = articleService.createArticle({
        title: 'Third Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      });

      // Should be sorted oldest first (asc) - verify timestamps are in ascending order
      expect(result.articles).toHaveLength(3);
      expect(result.articles[0].createdAt.getTime()).toBeLessThanOrEqual(result.articles[1].createdAt.getTime());
      expect(result.articles[1].createdAt.getTime()).toBeLessThanOrEqual(result.articles[2].createdAt.getTime());
      
      // The oldest article should be first
      const articleIds = [article1.id, article2.id, article3.id];
      expect(articleIds).toContain(result.articles[0].id);
    });

    it('should sort by updatedAt descending', () => {
      const article1 = articleService.createArticle({
        title: 'Article 1',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article2 = articleService.createArticle({
        title: 'Article 2',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article3 = articleService.createArticle({
        title: 'Article 3',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      // Update article1 to make it the most recently updated
      articleService.updateArticle(article1.id, {
        content: 'Updated content'
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      });

      // article1 should be first (most recently updated)
      expect(result.articles[0].id).toBe(article1.id);
    });

    it('should sort by updatedAt ascending', () => {
      const article1 = articleService.createArticle({
        title: 'Article 1',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article2 = articleService.createArticle({
        title: 'Article 2',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const article3 = articleService.createArticle({
        title: 'Article 3',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      // Update article3 to make it the most recently updated
      articleService.updateArticle(article3.id, {
        content: 'Updated content'
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'asc'
      });

      // article1 should be first (least recently updated)
      expect(result.articles[0].id).toBe(article1.id);
      // article3 should be last (most recently updated)
      expect(result.articles[2].id).toBe(article3.id);
    });

    it('should combine multiple filters', () => {
      const cat1 = categoryService.createCategory('Tech');
      const cat2 = categoryService.createCategory('Science');

      // Create articles with various combinations
      articleService.createArticle({
        title: 'Published Tech by User 1',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id],
        published: true
      });

      articleService.createArticle({
        title: 'Unpublished Tech by User 1',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id],
        published: false
      });

      articleService.createArticle({
        title: 'Published Science by User 2',
        content: 'Content',
        authorUid: '456',
        categories: [cat2.id],
        published: true
      });

      articleService.createArticle({
        title: 'Published Tech by User 2',
        content: 'Content',
        authorUid: '456',
        categories: [cat1.id],
        published: true
      });

      // Filter: author=123, published=true, category=Tech
      const result = articleService.listArticles({
        page: 1,
        pageSize: 10,
        authorUid: '123',
        published: true,
        categories: [cat1.id]
      });

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe('Published Tech by User 1');
      expect(result.articles[0].authorUid).toBe('123');
      expect(result.articles[0].published).toBe(true);
      expect(result.articles[0].categories?.some(c => c.id === cat1.id)).toBe(true);
    });

    it('should return empty result when no articles match filters', () => {
      articleService.createArticle({
        title: 'Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10,
        authorUid: '999' // Non-existent author
      });

      expect(result.articles).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should load author data for all articles', () => {
      articleService.createArticle({
        title: 'Article by User 1',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      });

      articleService.createArticle({
        title: 'Article by User 2',
        content: 'Content',
        authorUid: '456',
        categories: [],
        published: true
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].author).toBeDefined();
      expect(result.articles[1].author).toBeDefined();
      expect(result.articles.find(a => a.authorUid === '123')?.author?.username).toBe('testuser1');
      expect(result.articles.find(a => a.authorUid === '456')?.author?.username).toBe('testuser2');
    });

    it('should load categories for all articles', () => {
      const cat1 = categoryService.createCategory('Category 1');
      const cat2 = categoryService.createCategory('Category 2');

      articleService.createArticle({
        title: 'Article 1',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id],
        published: true
      });

      articleService.createArticle({
        title: 'Article 2',
        content: 'Content',
        authorUid: '123',
        categories: [cat2.id],
        published: true
      });

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].categories).toBeDefined();
      expect(result.articles[1].categories).toBeDefined();
      expect(result.articles[0].categories).toHaveLength(1);
      expect(result.articles[1].categories).toHaveLength(1);
    });

    it('should handle empty database', () => {
      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(0);
    });

    it('should handle page beyond total pages', () => {
      // Create 5 articles
      for (let i = 1; i <= 5; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      // Request page 10 (beyond available pages)
      const result = articleService.listArticles({
        page: 10,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(0);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('deleteArticle', () => {
    it('should delete an article', () => {
      const input: CreateArticleInput = {
        title: 'Article to Delete',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);
      const deleted = articleService.deleteArticle(created.id, '123');

      expect(deleted).toBe(true);
      expect(articleService.getArticleById(created.id)).toBeNull();
    });

    it('should return false for non-existent article', () => {
      const deleted = articleService.deleteArticle('non-existent-id', '123');
      expect(deleted).toBe(false);
    });

    it('should throw ForbiddenError when non-author tries to delete', () => {
      const input: CreateArticleInput = {
        title: 'Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const created = articleService.createArticle(input);

      expect(() => articleService.deleteArticle(created.id, '456')).toThrow(ForbiddenError);
      expect(() => articleService.deleteArticle(created.id, '456')).toThrow('do not have permission');
    });

    it('should cascade delete category associations', () => {
      const cat = categoryService.createCategory('Test Category');
      
      const input: CreateArticleInput = {
        title: 'Article with Category',
        content: 'Content',
        authorUid: '123',
        categories: [cat.id],
        published: false
      };

      const created = articleService.createArticle(input);
      articleService.deleteArticle(created.id, '123');

      // Category should still exist
      expect(categoryService.getCategoryById(cat.id)).not.toBeNull();
      
      // But article should be gone
      expect(articleService.getArticleById(created.id)).toBeNull();
    });
  });

  describe('canAccessArticle', () => {
    it('should allow access to published articles for everyone', () => {
      const input: CreateArticleInput = {
        title: 'Published Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: true
      };

      const article = articleService.createArticle(input);

      expect(articleService.canAccessArticle(article)).toBe(true);
      expect(articleService.canAccessArticle(article, '456')).toBe(true);
      expect(articleService.canAccessArticle(article, undefined)).toBe(true);
    });

    it('should allow author to access unpublished articles', () => {
      const input: CreateArticleInput = {
        title: 'Unpublished Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      expect(articleService.canAccessArticle(article, '123')).toBe(true);
    });

    it('should deny access to unpublished articles for non-authors', () => {
      const input: CreateArticleInput = {
        title: 'Unpublished Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      };

      const article = articleService.createArticle(input);

      expect(articleService.canAccessArticle(article, '456')).toBe(false);
      expect(articleService.canAccessArticle(article, undefined)).toBe(false);
    });
  });

  describe('Edge Cases - Pagination', () => {
    it('should handle single page with exact pageSize items', () => {
      // Create exactly 10 articles
      for (let i = 1; i <= 10; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(10);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should handle single page with fewer items than pageSize', () => {
      // Create 3 articles with pageSize of 10
      for (let i = 1; i <= 3; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      const result = articleService.listArticles({
        page: 1,
        pageSize: 10
      });

      expect(result.articles).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.totalPages).toBe(1);
    });

    it('should handle last page with partial results', () => {
      // Create 23 articles (3 pages of 10, last page has 3)
      for (let i = 1; i <= 23; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      const lastPage = articleService.listArticles({
        page: 3,
        pageSize: 10
      });

      expect(lastPage.articles).toHaveLength(3);
      expect(lastPage.total).toBe(23);
      expect(lastPage.totalPages).toBe(3);
      expect(lastPage.page).toBe(3);
    });

    it('should handle pageSize of 1', () => {
      // Create 3 articles
      for (let i = 1; i <= 3; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      const result = articleService.listArticles({
        page: 1,
        pageSize: 1
      });

      expect(result.articles).toHaveLength(1);
      expect(result.total).toBe(3);
      expect(result.totalPages).toBe(3);
    });

    it('should handle very large pageSize', () => {
      // Create 5 articles
      for (let i = 1; i <= 5; i++) {
        articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
      }

      const result = articleService.listArticles({
        page: 1,
        pageSize: 1000
      });

      expect(result.articles).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(1);
    });

    it('should return consistent results across pages', () => {
      // Create 15 articles
      const createdIds: string[] = [];
      for (let i = 1; i <= 15; i++) {
        const article = articleService.createArticle({
          title: `Article ${i}`,
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: true
        });
        createdIds.push(article.id);
      }

      // Get all pages
      const page1 = articleService.listArticles({ page: 1, pageSize: 5 });
      const page2 = articleService.listArticles({ page: 2, pageSize: 5 });
      const page3 = articleService.listArticles({ page: 3, pageSize: 5 });

      // Collect all IDs from pages
      const allPageIds = [
        ...page1.articles.map(a => a.id),
        ...page2.articles.map(a => a.id),
        ...page3.articles.map(a => a.id)
      ];

      // Should have all 15 articles
      expect(allPageIds).toHaveLength(15);
      
      // No duplicates across pages
      const uniqueIds = new Set(allPageIds);
      expect(uniqueIds.size).toBe(15);
      
      // All created articles should be present
      createdIds.forEach(id => {
        expect(allPageIds).toContain(id);
      });
    });
  });

  describe('Edge Cases - Error Handling', () => {
    it('should handle NotFoundError when updating non-existent article', () => {
      expect(() => {
        articleService.updateArticle('non-existent-id', {
          title: 'New Title'
        });
      }).toThrow(NotFoundError);
      
      expect(() => {
        articleService.updateArticle('non-existent-id', {
          title: 'New Title'
        });
      }).toThrow('Article');
    });

    it('should handle ForbiddenError with descriptive message', () => {
      const article = articleService.createArticle({
        title: 'Test Article',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      });

      expect(() => {
        articleService.deleteArticle(article.id, '456');
      }).toThrow(ForbiddenError);
      
      expect(() => {
        articleService.deleteArticle(article.id, '456');
      }).toThrow('permission');
    });

    it('should handle ValidationError for boundary values', () => {
      // Title exactly at boundary (200 chars) - should succeed
      const validTitle = 'a'.repeat(200);
      const validArticle = articleService.createArticle({
        title: validTitle,
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      });
      expect(validArticle.title).toBe(validTitle);

      // Title over boundary (201 chars) - should fail
      expect(() => {
        articleService.createArticle({
          title: 'a'.repeat(201),
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: false
        });
      }).toThrow(ValidationError);
    });

    it('should handle ValidationError for content boundary values', () => {
      // Content exactly at boundary (100,000 chars) - should succeed
      const validContent = 'a'.repeat(100000);
      const validArticle = articleService.createArticle({
        title: 'Test',
        content: validContent,
        authorUid: '123',
        categories: [],
        published: false
      });
      expect(validArticle.content).toBe(validContent);

      // Content over boundary (100,001 chars) - should fail
      expect(() => {
        articleService.createArticle({
          title: 'Test',
          content: 'a'.repeat(100001),
          authorUid: '123',
          categories: [],
          published: false
        });
      }).toThrow(ValidationError);
    });

    it('should handle multiple validation errors gracefully', () => {
      // Empty title
      expect(() => {
        articleService.createArticle({
          title: '',
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: false
        });
      }).toThrow(ValidationError);

      // Empty author UID
      expect(() => {
        articleService.createArticle({
          title: 'Test',
          content: 'Content',
          authorUid: '',
          categories: [],
          published: false
        });
      }).toThrow(ValidationError);

      // Invalid external URL
      expect(() => {
        articleService.createArticle({
          title: 'Test',
          content: 'Content',
          authorUid: '123',
          categories: [],
          externalUrl: 'not-a-url',
          published: false
        });
      }).toThrow(ValidationError);
    });

    it('should return null (not throw) when article not found by ID', () => {
      const result = articleService.getArticleById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null (not throw) when article not found by URL', () => {
      const result = articleService.getArticleByUrl('123', 'non-existent-article');
      expect(result).toBeNull();
    });

    it('should return false (not throw) when deleting non-existent article', () => {
      const result = articleService.deleteArticle('non-existent-id', '123');
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases - CRUD Operations', () => {
    it('should handle article with minimal valid data', () => {
      const article = articleService.createArticle({
        title: 'A', // Single character title
        content: 'B', // Single character content
        authorUid: '123',
        categories: [],
        published: false
      });

      expect(article.title).toBe('A');
      expect(article.content).toBe('B');
      expect(article.urlName).toBe('a');
    });

    it('should handle article with maximum valid title length', () => {
      const maxTitle = 'a'.repeat(200);
      const article = articleService.createArticle({
        title: maxTitle,
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      });

      expect(article.title).toBe(maxTitle);
      expect(article.title.length).toBe(200);
    });

    it('should handle article with maximum valid content length', () => {
      const maxContent = 'a'.repeat(100000);
      const article = articleService.createArticle({
        title: 'Test',
        content: maxContent,
        authorUid: '123',
        categories: [],
        published: false
      });

      expect(article.content).toBe(maxContent);
      expect(article.content.length).toBe(100000);
    });

    it('should handle updating article with no changes', () => {
      const article = articleService.createArticle({
        title: 'Test',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      });

      const originalUpdatedAt = article.updatedAt.getTime();

      // Update with empty object
      const updated = articleService.updateArticle(article.id, {});

      // Should still update the timestamp
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
      expect(updated.title).toBe(article.title);
      expect(updated.content).toBe(article.content);
    });

    it('should handle retrieving article with no categories', () => {
      const article = articleService.createArticle({
        title: 'Test',
        content: 'Content',
        authorUid: '123',
        categories: [],
        published: false
      });

      const retrieved = articleService.getArticleById(article.id);
      expect(retrieved?.categories).toEqual([]);
    });

    it('should handle retrieving article with multiple categories', () => {
      const cat1 = categoryService.createCategory('Cat1');
      const cat2 = categoryService.createCategory('Cat2');
      const cat3 = categoryService.createCategory('Cat3');

      const article = articleService.createArticle({
        title: 'Test',
        content: 'Content',
        authorUid: '123',
        categories: [cat1.id, cat2.id, cat3.id],
        published: false
      });

      const retrieved = articleService.getArticleById(article.id);
      expect(retrieved?.categories).toHaveLength(3);
      expect(retrieved?.categories?.map(c => c.id)).toContain(cat1.id);
      expect(retrieved?.categories?.map(c => c.id)).toContain(cat2.id);
      expect(retrieved?.categories?.map(c => c.id)).toContain(cat3.id);
    });

    it('should handle article with whitespace-only title after URL generation', () => {
      // Title with only special characters that get removed
      expect(() => {
        articleService.createArticle({
          title: '!!!@@@###',
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: false
        });
      }).toThrow(ValidationError);
      
      expect(() => {
        articleService.createArticle({
          title: '!!!@@@###',
          content: 'Content',
          authorUid: '123',
          categories: [],
          published: false
        });
      }).toThrow('Unable to generate valid URL name');
    });

    it('should handle concurrent article creation with same title by same author', () => {
      const input1: CreateArticleInput = {
        title: 'Same Title',
        content: 'Content 1',
        authorUid: '123',
        categories: [],
        published: false
      };

      const input2: CreateArticleInput = {
        title: 'Same Title',
        content: 'Content 2',
        authorUid: '123',
        categories: [],
        published: false
      };

      // First should succeed
      const article1 = articleService.createArticle(input1);
      expect(article1).toBeDefined();

      // Second should fail with ValidationError
      expect(() => articleService.createArticle(input2)).toThrow(ValidationError);
      expect(() => articleService.createArticle(input2)).toThrow('URL name already exists');
    });

    it('should preserve article data integrity after multiple updates', () => {
      const article = articleService.createArticle({
        title: 'Original',
        content: 'Original Content',
        authorUid: '123',
        categories: [],
        published: false
      });

      const originalId = article.id;
      const originalAuthor = article.authorUid;
      const originalCreatedAt = article.createdAt;

      // Multiple updates
      let updated = articleService.updateArticle(article.id, { title: 'Update 1' });
      updated = articleService.updateArticle(article.id, { content: 'Update 2' });
      updated = articleService.updateArticle(article.id, { published: true });

      // Verify immutable fields
      expect(updated.id).toBe(originalId);
      expect(updated.authorUid).toBe(originalAuthor);
      expect(updated.createdAt.getTime()).toBe(originalCreatedAt.getTime());

      // Verify updated fields
      expect(updated.title).toBe('Update 1');
      expect(updated.content).toBe('Update 2');
      expect(updated.published).toBe(true);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
    });
  });
});
