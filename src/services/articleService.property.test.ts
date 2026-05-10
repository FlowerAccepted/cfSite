/**
 * Property-Based Tests for ArticleService
 * 
 * This test suite validates universal properties that should hold
 * for all valid inputs using fast-check for property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ArticleService } from './articleService';
import { CategoryService } from './categoryService';
import { createTestDatabase } from '../utils/db';
import type Database from 'better-sqlite3';
import type { CreateArticleInput, UpdateArticleInput } from '../types/article';
import { ValidationError, ForbiddenError } from '../types/errors';

describe('ArticleService - Property-Based Tests', () => {
  let db: Database.Database;
  let articleService: ArticleService;
  let categoryService: CategoryService;

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
    categoryService = new CategoryService(db);
    
    // Create test users
    createTestUser(1, 'testuser1');
    createTestUser(2, 'testuser2');
  });

  afterEach(() => {
    db.close();
  });

  describe('Property 18: 时间戳单调性 (Timestamp Monotonicity)', () => {
    it('PBT: updated_at must be >= created_at and increase on edits', () => {
      // **Validates: Requirements 6.4**
      // Feature: article-system, Property 18: 时间戳单调性
      
      fc.assert(
        fc.property(
          // Generate valid article data with titles that can produce valid URL names
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)), // Must contain at least one alphanumeric
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            published: fc.boolean()
          }),
          // Generate update data
          fc.record({
            title: fc.option(
              fc.string({ minLength: 1, maxLength: 200 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              { nil: undefined }
            ),
            content: fc.option(fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0), { nil: undefined }),
            published: fc.option(fc.boolean(), { nil: undefined })
          }),
          (createData, updateData) => {
            // Create article with unique title to avoid URL conflicts
            const uniqueTitle = `${createData.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: createData.content,
              authorUid: '1',
              categories: [],
              published: createData.published
            };

            const created = articleService.createArticle(input);

            // Property 1: updated_at >= created_at at creation
            expect(created.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime());

            // Small delay to ensure timestamp difference
            const beforeUpdate = Date.now();

            // Update article with unique title if title is being updated
            const uniqueUpdateData = updateData.title !== undefined
              ? { ...updateData, title: `${updateData.title}-${Date.now()}-${Math.random().toString(36).substring(7)}` }
              : updateData;
            
            const updated = articleService.updateArticle(created.id, uniqueUpdateData);

            // Property 2: updated_at increases after edit
            expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
            expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

            // Property 3: created_at remains unchanged
            expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());

            // Property 4: updated_at >= created_at always holds
            expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(updated.createdAt.getTime());
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: multiple sequential edits maintain timestamp monotonicity', () => {
      // **Validates: Requirements 6.4**
      // Feature: article-system, Property 18: 时间戳单调性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.array(
            fc.record({
              title: fc.option(
                fc.string({ minLength: 1, maxLength: 200 })
                  .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
                { nil: undefined }
              ),
              content: fc.option(fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0), { nil: undefined })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (initialTitle, updates) => {
            // Create initial article with unique title
            const uniqueTitle = `${initialTitle}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Initial content',
              authorUid: '1',
              categories: [],
              published: false
            };

            let article = articleService.createArticle(input);
            let previousUpdatedAt = article.updatedAt.getTime();
            const originalCreatedAt = article.createdAt.getTime();

            // Apply sequential updates
            for (const update of updates) {
              // Make title unique if it's being updated
              const uniqueUpdate = update.title !== undefined
                ? { ...update, title: `${update.title}-${Date.now()}-${Math.random().toString(36).substring(7)}` }
                : update;
              
              article = articleService.updateArticle(article.id, uniqueUpdate);

              // Property: updated_at is monotonically increasing
              expect(article.updatedAt.getTime()).toBeGreaterThanOrEqual(previousUpdatedAt);

              // Property: created_at never changes
              expect(article.createdAt.getTime()).toBe(originalCreatedAt);

              // Property: updated_at >= created_at
              expect(article.updatedAt.getTime()).toBeGreaterThanOrEqual(article.createdAt.getTime());

              previousUpdatedAt = article.updatedAt.getTime();
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 19: 作者不变性 (Author Immutability)', () => {
    it('PBT: author_uid remains unchanged through any edit operations', () => {
      // **Validates: Requirements 6.5**
      // Feature: article-system, Property 19: 作者不变性
      
      fc.assert(
        fc.property(
          fc.constantFrom('1', '2'),
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.record({
            title: fc.option(
              fc.string({ minLength: 1, maxLength: 200 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              { nil: undefined }
            ),
            content: fc.option(fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0), { nil: undefined }),
            published: fc.option(fc.boolean(), { nil: undefined })
          }),
          (authorUid, initialTitle, updateData) => {
            // Create article with unique title
            const uniqueTitle = `${initialTitle}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: authorUid,
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);
            const originalAuthorUid = created.authorUid;

            // Update article with unique title if title is being updated
            const uniqueUpdateData = updateData.title !== undefined
              ? { ...updateData, title: `${updateData.title}-${Date.now()}-${Math.random().toString(36).substring(7)}` }
              : updateData;
            
            const updated = articleService.updateArticle(created.id, uniqueUpdateData);

            // Property: author_uid is immutable
            expect(updated.authorUid).toBe(originalAuthorUid);
            expect(updated.authorUid).toBe(authorUid);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: author_uid remains unchanged through multiple sequential edits', () => {
      // **Validates: Requirements 6.5**
      // Feature: article-system, Property 19: 作者不变性
      
      fc.assert(
        fc.property(
          fc.constantFrom('1', '2'),
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.array(
            fc.record({
              title: fc.option(
                fc.string({ minLength: 1, maxLength: 200 })
                  .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
                { nil: undefined }
              ),
              content: fc.option(fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0), { nil: undefined }),
              published: fc.option(fc.boolean(), { nil: undefined })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (authorUid, initialTitle, updates) => {
            // Create article with unique title
            const uniqueTitle = `${initialTitle}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: authorUid,
              categories: [],
              published: false
            };

            let article = articleService.createArticle(input);
            const originalAuthorUid = article.authorUid;

            // Apply multiple updates
            for (const update of updates) {
              // Make title unique if it's being updated
              const uniqueUpdate = update.title !== undefined
                ? { ...update, title: `${update.title}-${Date.now()}-${Math.random().toString(36).substring(7)}` }
                : update;
              
              article = articleService.updateArticle(article.id, uniqueUpdate);

              // Property: author_uid never changes
              expect(article.authorUid).toBe(originalAuthorUid);
              expect(article.authorUid).toBe(authorUid);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: author_uid immutability with category updates', () => {
      // **Validates: Requirements 6.5, 1.1**
      // Feature: article-system, Property 19: 作者不变性
      
      fc.assert(
        fc.property(
          fc.constantFrom('1', '2'),
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
          (authorUid, title, categoryNames) => {
            // Create categories
            const categoryIds = categoryNames.map((name, idx) => {
              try {
                return categoryService.createCategory(`${name}-${idx}-${Date.now()}-${Math.random().toString(36).substring(7)}`).id;
              } catch {
                // If category creation fails (duplicate), skip
                return null;
              }
            }).filter(id => id !== null) as string[];

            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: authorUid,
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);
            const originalAuthorUid = created.authorUid;

            // Update with categories
            const updated = articleService.updateArticle(created.id, {
              categories: categoryIds
            });

            // Property: author_uid remains unchanged even when updating categories
            expect(updated.authorUid).toBe(originalAuthorUid);
            expect(updated.authorUid).toBe(authorUid);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 1: 分类关联完整性 (Category Association Integrity) - Update Context', () => {
    it('PBT: updating article categories preserves category integrity', () => {
      // **Validates: Requirements 1.1, 1.3**
      // Feature: article-system, Property 1: 分类关联完整性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
          (title, initialCategoryNames, updatedCategoryNames) => {
            // Create initial categories
            const initialCategoryIds = initialCategoryNames.map((name, idx) => {
              try {
                return categoryService.createCategory(`initial-${name}-${idx}-${Date.now()}-${Math.random().toString(36).substring(7)}`).id;
              } catch {
                return null;
              }
            }).filter(id => id !== null) as string[];

            // Create updated categories
            const updatedCategoryIds = updatedCategoryNames.map((name, idx) => {
              try {
                return categoryService.createCategory(`updated-${name}-${idx}-${Date.now()}-${Math.random().toString(36).substring(7)}`).id;
              } catch {
                return null;
              }
            }).filter(id => id !== null) as string[];

            // Create article with initial categories and unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: initialCategoryIds,
              published: false
            };

            const created = articleService.createArticle(input);

            // Update article with new categories
            const updated = articleService.updateArticle(created.id, {
              categories: updatedCategoryIds
            });

            // Property: updated categories match exactly what was set
            const retrievedCategoryIds = updated.categories?.map(c => c.id).sort() || [];
            const expectedCategoryIds = updatedCategoryIds.sort();

            expect(retrievedCategoryIds).toEqual(expectedCategoryIds);

            // Property: old categories are no longer associated
            const oldCategoryIds = initialCategoryIds.filter(id => !updatedCategoryIds.includes(id));
            for (const oldId of oldCategoryIds) {
              expect(retrievedCategoryIds).not.toContain(oldId);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 23: 文章删除权限和级联 (Article Deletion Authorization and Cascade)', () => {
    it('PBT: only article author can delete their articles', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          fc.boolean(),
          (title, content, published) => {
            // Create article with unique title by author '1'
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: content,
              authorUid: '1',
              categories: [],
              published: published
            };

            const created = articleService.createArticle(input);

            // Property: author can delete their own article
            const deletedByAuthor = articleService.deleteArticle(created.id, '1');
            expect(deletedByAuthor).toBe(true);

            // Verify article is actually deleted
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: non-author cannot delete articles', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          fc.boolean(),
          (title, content, published) => {
            // Create article with unique title by author '1'
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: content,
              authorUid: '1',
              categories: [],
              published: published
            };

            const created = articleService.createArticle(input);

            // Property: non-author (user '2') cannot delete the article
            expect(() => {
              articleService.deleteArticle(created.id, '2');
            }).toThrow('do not have permission');

            // Verify article still exists after failed deletion attempt
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.id).toBe(created.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: deleting article cascades to remove category associations', () => {
      // **Validates: Requirements 6.3, 1.1**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          (title, categoryNames) => {
            // Create categories
            const categoryIds = categoryNames.map((name, idx) => {
              try {
                return categoryService.createCategory(`${name}-${idx}-${Date.now()}-${Math.random().toString(36).substring(7)}`).id;
              } catch {
                return null;
              }
            }).filter(id => id !== null) as string[];

            if (categoryIds.length === 0) {
              // Skip if no categories were created
              return;
            }

            // Create article with categories and unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: categoryIds,
              published: false
            };

            const created = articleService.createArticle(input);

            // Verify categories are associated
            expect(created.categories).toBeDefined();
            expect(created.categories!.length).toBe(categoryIds.length);

            // Delete the article
            const deleted = articleService.deleteArticle(created.id, '1');
            expect(deleted).toBe(true);

            // Property: article is deleted
            const retrievedArticle = articleService.getArticleById(created.id);
            expect(retrievedArticle).toBeNull();

            // Property: categories still exist (not cascade deleted)
            for (const categoryId of categoryIds) {
              const category = categoryService.getCategoryById(categoryId);
              expect(category).not.toBeNull();
            }

            // Property: category associations are removed (cascade delete)
            // We can verify this by checking that the article_categories table
            // no longer has entries for this article
            const associations = db.prepare(
              'SELECT * FROM article_categories WHERE article_id = ?'
            ).all(created.id);
            expect(associations).toHaveLength(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: deleting non-existent article returns false', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('1', '2'),
          (nonExistentId, authorUid) => {
            // Property: attempting to delete non-existent article returns false
            const result = articleService.deleteArticle(nonExistentId, authorUid);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: deletion works regardless of article published state', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.boolean(),
          (title, published) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: [],
              published: published
            };

            const created = articleService.createArticle(input);

            // Property: author can delete article regardless of published state
            const deleted = articleService.deleteArticle(created.id, '1');
            expect(deleted).toBe(true);

            // Verify deletion
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: deletion with external URL works correctly', () => {
      // **Validates: Requirements 6.3, 5.2**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.webUrl(),
          (title, externalUrl) => {
            // Create article with external URL and unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: [],
              externalUrl: externalUrl,
              published: false
            };

            const created = articleService.createArticle(input);
            expect(created.externalUrl).toBe(externalUrl);

            // Property: article with external URL can be deleted
            const deleted = articleService.deleteArticle(created.id, '1');
            expect(deleted).toBe(true);

            // Verify deletion
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('PBT: multiple sequential deletions by same author', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 23: 文章删除权限和级联
      
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            { minLength: 2, maxLength: 5 }
          ),
          (titles) => {
            // Create multiple articles by the same author
            const articleIds: string[] = [];
            for (const title of titles) {
              const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: 'Test content',
                authorUid: '1',
                categories: [],
                published: false
              };
              const created = articleService.createArticle(input);
              articleIds.push(created.id);
            }

            // Property: author can delete all their articles sequentially
            for (const articleId of articleIds) {
              const deleted = articleService.deleteArticle(articleId, '1');
              expect(deleted).toBe(true);

              // Verify each deletion
              const retrieved = articleService.getArticleById(articleId);
              expect(retrieved).toBeNull();
            }

            // Property: all articles are deleted
            for (const articleId of articleIds) {
              const retrieved = articleService.getArticleById(articleId);
              expect(retrieved).toBeNull();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 8: URL往返一致性 (URL Round-Trip Consistency)', () => {
    it('PBT: generating URL from article and retrieving by URL returns same article', () => {
      // **Validates: Requirements 3.4**
      // Feature: article-system, Property 8: URL往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          fc.boolean(),
          (title, content, published) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: content,
              authorUid: '1',
              categories: [],
              published: published
            };

            const created = articleService.createArticle(input);

            // Property: article has a URL name generated from title
            expect(created.urlName).toBeDefined();
            expect(created.urlName.length).toBeGreaterThan(0);

            // Retrieve article by URL (using authorUid and urlName)
            const retrievedByUrl = articleService.getArticleByUrl(created.authorUid, created.urlName);

            // Property: retrieving by URL returns the same article
            expect(retrievedByUrl).not.toBeNull();
            expect(retrievedByUrl!.id).toBe(created.id);
            expect(retrievedByUrl!.title).toBe(created.title);
            expect(retrievedByUrl!.content).toBe(created.content);
            expect(retrievedByUrl!.authorUid).toBe(created.authorUid);
            expect(retrievedByUrl!.urlName).toBe(created.urlName);
            expect(retrievedByUrl!.published).toBe(created.published);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: URL round-trip works with various title formats', () => {
      // **Validates: Requirements 3.4**
      // Feature: article-system, Property 8: URL往返一致性
      
      fc.assert(
        fc.property(
          fc.oneof(
            // Various title formats that should all produce valid URLs
            fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            fc.constant('Hello World 123'),
            fc.constant('Test-Article_Name'),
            fc.constant('Article with spaces'),
            fc.constant('UPPERCASE TITLE'),
            fc.constant('lowercase title'),
            fc.constant('MixedCase Title'),
            fc.constant('Title!@#$%^&*()'),
            fc.constant('Title   with   multiple   spaces'),
          ),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          (title, content) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: content,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Retrieve by URL
            const retrievedByUrl = articleService.getArticleByUrl(created.authorUid, created.urlName);

            // Property: URL round-trip returns same article regardless of title format
            expect(retrievedByUrl).not.toBeNull();
            expect(retrievedByUrl!.id).toBe(created.id);
            expect(retrievedByUrl!.title).toBe(created.title);
            expect(retrievedByUrl!.content).toBe(created.content);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: URL round-trip preserves all article fields', () => {
      // **Validates: Requirements 3.4**
      // Feature: article-system, Property 8: URL往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          fc.boolean(),
          fc.option(fc.webUrl(), { nil: undefined }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
          (title, content, published, externalUrl, categoryNames) => {
            // Create categories
            const categoryIds = categoryNames.map((name, idx) => {
              try {
                return categoryService.createCategory(`${name}-${idx}-${Date.now()}-${Math.random().toString(36).substring(7)}`).id;
              } catch {
                return null;
              }
            }).filter(id => id !== null) as string[];

            // Create article with all fields and unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: content,
              authorUid: '1',
              categories: categoryIds,
              externalUrl: externalUrl,
              published: published
            };

            const created = articleService.createArticle(input);

            // Retrieve by URL
            const retrievedByUrl = articleService.getArticleByUrl(created.authorUid, created.urlName);

            // Property: all fields are preserved in URL round-trip
            expect(retrievedByUrl).not.toBeNull();
            expect(retrievedByUrl!.id).toBe(created.id);
            expect(retrievedByUrl!.title).toBe(created.title);
            expect(retrievedByUrl!.content).toBe(created.content);
            expect(retrievedByUrl!.authorUid).toBe(created.authorUid);
            expect(retrievedByUrl!.urlName).toBe(created.urlName);
            expect(retrievedByUrl!.published).toBe(created.published);
            expect(retrievedByUrl!.externalUrl).toBe(created.externalUrl);
            expect(retrievedByUrl!.createdAt.getTime()).toBe(created.createdAt.getTime());
            expect(retrievedByUrl!.updatedAt.getTime()).toBe(created.updatedAt.getTime());

            // Property: categories are preserved
            const retrievedCategoryIds = retrievedByUrl!.categories?.map(c => c.id).sort() || [];
            const expectedCategoryIds = categoryIds.sort();
            expect(retrievedCategoryIds).toEqual(expectedCategoryIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: URL round-trip works after article updates', () => {
      // **Validates: Requirements 3.4**
      // Feature: article-system, Property 8: URL往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          fc.record({
            content: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
            published: fc.option(fc.boolean(), { nil: undefined })
          }),
          (title, initialContent, updateData) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: initialContent,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);
            const originalUrlName = created.urlName;

            // Update article (not changing title, so URL name stays the same)
            const updated = articleService.updateArticle(created.id, updateData);

            // Property: URL name doesn't change when title isn't updated
            expect(updated.urlName).toBe(originalUrlName);

            // Retrieve by URL after update
            const retrievedByUrl = articleService.getArticleByUrl(updated.authorUid, updated.urlName);

            // Property: URL round-trip returns updated article
            expect(retrievedByUrl).not.toBeNull();
            expect(retrievedByUrl!.id).toBe(updated.id);
            expect(retrievedByUrl!.content).toBe(updated.content);
            expect(retrievedByUrl!.published).toBe(updated.published);
            expect(retrievedByUrl!.urlName).toBe(originalUrlName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: URL round-trip with different authors creates distinct URLs', () => {
      // **Validates: Requirements 3.4, 3.1**
      // Feature: article-system, Property 8: URL往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          (title, content) => {
            // Create two articles with same title but different authors
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            
            const article1 = articleService.createArticle({
              title: uniqueTitle,
              content: content,
              authorUid: '1',
              categories: [],
              published: false
            });

            const article2 = articleService.createArticle({
              title: uniqueTitle,
              content: content,
              authorUid: '2',
              categories: [],
              published: false
            });

            // Property: both articles can have the same URL name (different authors)
            // The URL format is /a/<uid>/<name>, so different UIDs make them unique
            expect(article1.urlName).toBe(article2.urlName); // Same title -> same URL name

            // Retrieve by URL for each author
            const retrieved1 = articleService.getArticleByUrl('1', article1.urlName);
            const retrieved2 = articleService.getArticleByUrl('2', article2.urlName);

            // Property: each retrieval returns the correct article for that author
            expect(retrieved1).not.toBeNull();
            expect(retrieved1!.id).toBe(article1.id);
            expect(retrieved1!.authorUid).toBe('1');

            expect(retrieved2).not.toBeNull();
            expect(retrieved2!.id).toBe(article2.id);
            expect(retrieved2!.authorUid).toBe('2');

            // Property: articles are distinct
            expect(retrieved1!.id).not.toBe(retrieved2!.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: non-existent URL returns null', () => {
      // **Validates: Requirements 3.4, 3.5**
      // Feature: article-system, Property 8: URL往返一致性
      
      fc.assert(
        fc.property(
          fc.constantFrom('1', '2'),
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => /^[a-z0-9-_]+$/.test(s)), // Valid URL name format
          (uid, urlName) => {
            // Try to retrieve article with URL that doesn't exist
            const retrieved = articleService.getArticleByUrl(uid, urlName);

            // Property: non-existent URL returns null (not an error)
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 10: Markdown存储往返一致性 (Markdown Storage Round-Trip Consistency)', () => {
    it('PBT: saved Markdown content is retrieved byte-for-byte identical', () => {
      // **Validates: Requirements 4.4**
      // Feature: article-system, Property 10: Markdown存储往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 10000 }).filter(s => s.trim().length > 0), // Generate various Markdown content
          (title, markdownContent) => {
            // Create article with unique title and the generated Markdown content
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: markdownContent,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: content stored matches exactly what was provided
            expect(created.content).toBe(markdownContent);

            // Retrieve the article by ID
            const retrievedById = articleService.getArticleById(created.id);

            // Property: retrieved content is byte-for-byte identical to original
            expect(retrievedById).not.toBeNull();
            expect(retrievedById!.content).toBe(markdownContent);

            // Retrieve the article by URL
            const retrievedByUrl = articleService.getArticleByUrl(created.authorUid, created.urlName);

            // Property: content retrieved by URL is also byte-for-byte identical
            expect(retrievedByUrl).not.toBeNull();
            expect(retrievedByUrl!.content).toBe(markdownContent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: Markdown content with special characters preserves exact bytes', () => {
      // **Validates: Requirements 4.4**
      // Feature: article-system, Property 10: Markdown存储往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length > 0).map(s => {
            // Add various Markdown-specific characters and patterns
            const markdownElements = [
              '# Heading\n',
              '## Subheading\n',
              '**bold**\n',
              '*italic*\n',
              '`code`\n',
              '```\ncode block\n```\n',
              '[link](url)\n',
              '![image](url)\n',
              '- list item\n',
              '1. numbered\n',
              '> quote\n',
              '\n\n', // Multiple newlines
              '\t', // Tabs
              '中文字符\n', // Chinese characters
              'emoji 🎉\n',
              '---\n', // Horizontal rule
            ];
            // Randomly insert Markdown elements into the string
            return s + markdownElements[Math.floor(Math.random() * markdownElements.length)];
          }),
          (title, markdownContent) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: markdownContent,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: special characters and Markdown syntax are preserved exactly
            expect(created.content).toBe(markdownContent);

            // Retrieve and verify
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.content).toBe(markdownContent);

            // Verify byte length is identical (no encoding issues)
            expect(retrieved!.content.length).toBe(markdownContent.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: Markdown content round-trip after update operations', () => {
      // **Validates: Requirements 4.4**
      // Feature: article-system, Property 10: Markdown存储往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length > 0), // Initial content
          fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length > 0), // Updated content
          (title, initialContent, updatedContent) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: initialContent,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: initial content is stored correctly
            expect(created.content).toBe(initialContent);

            // Update the content
            const updated = articleService.updateArticle(created.id, {
              content: updatedContent
            });

            // Property: updated content is stored correctly
            expect(updated.content).toBe(updatedContent);

            // Retrieve and verify updated content
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.content).toBe(updatedContent);

            // Property: content is exactly what was set in the update
            // (whether it's the same as initial or different doesn't matter - 
            // what matters is it matches what we set)
            expect(retrieved!.content).toBe(updatedContent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: Markdown content with whitespace characters preserves exact format', () => {
      // **Validates: Requirements 4.4**
      // Feature: article-system, Property 10: Markdown存储往返一致性
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          fc.oneof(
            fc.constant('content with trailing space '), // Trailing space
            fc.constant('content\nwith\nnewlines'), // Newlines
            fc.constant('content\twith\ttabs'), // Tabs
            fc.constant('  leading spaces content'), // Leading spaces
            fc.constant('content with  multiple  spaces'), // Multiple spaces
            fc.constant(' \n content \n with \n mixed \n whitespace \n '), // Mixed whitespace
          ),
          (title, contentWithWhitespace) => {
            // Create article with unique title and content containing whitespace
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: contentWithWhitespace,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: whitespace within content is preserved exactly, not trimmed or normalized
            expect(created.content).toBe(contentWithWhitespace);

            // Retrieve and verify
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.content).toBe(contentWithWhitespace);

            // Verify exact byte-for-byte match
            expect(retrieved!.content.length).toBe(contentWithWhitespace.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: URL格式一致性 (URL Format Consistency)', () => {
    it('PBT: all generated URLs match /a/<uid>/<name> format', () => {
      // **Validates: Requirements 3.1**
      // Feature: article-system, Property 6: URL格式一致性
      
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            authorUid: fc.oneof(fc.constant('1'), fc.constant('2')),
            published: fc.boolean()
          }),
          (articleData) => {
            // Create article with unique title to avoid URL conflicts
            const uniqueTitle = `${articleData.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: articleData.content,
              authorUid: articleData.authorUid,
              categories: [],
              published: articleData.published
            };

            const created = articleService.createArticle(input);

            // Construct the expected URL format: /a/<uid>/<name>
            const expectedUrl = `/a/${created.authorUid}/${created.urlName}`;

            // Property 1: URL must strictly match the format /a/<uid>/<name>
            const urlPattern = /^\/a\/[^\/]+\/[^\/]+$/;
            expect(expectedUrl).toMatch(urlPattern);

            // Property 2: uid in URL must match the article's authorUid
            const urlParts = expectedUrl.split('/');
            expect(urlParts[0]).toBe(''); // Empty string before first /
            expect(urlParts[1]).toBe('a'); // 'a' segment
            expect(urlParts[2]).toBe(created.authorUid); // uid segment
            expect(urlParts[3]).toBe(created.urlName); // name segment
            expect(urlParts.length).toBe(4); // Exactly 4 parts

            // Property 3: name in URL must be URL-safe (alphanumeric, hyphens, underscores only)
            const urlNamePattern = /^[a-z0-9_-]+$/;
            expect(created.urlName).toMatch(urlNamePattern);

            // Property 4: Verify the article can be retrieved using the URL components
            const retrieved = articleService.getArticleByUrl(created.authorUid, created.urlName);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.id).toBe(created.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: URL format consistency with various title formats', () => {
      // **Validates: Requirements 3.1**
      // Feature: article-system, Property 6: URL格式一致性
      
      fc.assert(
        fc.property(
          fc.oneof(
            // English titles
            fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => /[a-zA-Z]/.test(s)),
            // Titles with numbers
            fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => /[0-9]/.test(s)),
            // Mixed alphanumeric
            fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => /[a-zA-Z0-9]/.test(s)),
            // Titles with special characters (will be converted)
            fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s))
              .map(s => `${s}!!!@@@###`),
            // Titles with spaces
            fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => /[a-zA-Z0-9]/.test(s))
              .map(s => `Hello ${s} World`)
          ),
          (title) => {
            // Create article with unique title
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: 'Test content',
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Construct URL
            const url = `/a/${created.authorUid}/${created.urlName}`;

            // Property: URL must always match the strict format
            const urlPattern = /^\/a\/[^\/]+\/[a-z0-9_-]+$/;
            expect(url).toMatch(urlPattern);

            // Property: URL must not contain spaces or special characters in the name part
            expect(created.urlName).not.toMatch(/[\s!@#$%^&*()+=\[\]{}|\\:;"'<>,.?/]/);

            // Property: URL name must be lowercase
            expect(created.urlName).toBe(created.urlName.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: URL format consistency across multiple articles by same author', () => {
      // **Validates: Requirements 3.1**
      // Feature: article-system, Property 6: URL格式一致性
      
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 200 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              content: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0)
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (articlesData) => {
            const authorUid = '1';
            const createdArticles = [];

            // Create multiple articles
            for (const articleData of articlesData) {
              const uniqueTitle = `${articleData.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              const input: CreateArticleInput = {
                title: uniqueTitle,
                content: articleData.content,
                authorUid: authorUid,
                categories: [],
                published: false
              };

              const created = articleService.createArticle(input);
              createdArticles.push(created);
            }

            // Property: All articles must have URLs in the correct format
            for (const article of createdArticles) {
              const url = `/a/${article.authorUid}/${article.urlName}`;
              const urlPattern = /^\/a\/[^\/]+\/[a-z0-9_-]+$/;
              expect(url).toMatch(urlPattern);

              // Property: All URLs must have the same uid (author)
              expect(article.authorUid).toBe(authorUid);

              // Property: Each URL must be unique (different urlName)
              const urlNames = createdArticles.map(a => a.urlName);
              const uniqueUrlNames = new Set(urlNames);
              expect(uniqueUrlNames.size).toBe(createdArticles.length);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('PBT: URL format consistency after article updates', () => {
      // **Validates: Requirements 3.1**
      // Feature: article-system, Property 6: URL格式一致性
      
      fc.assert(
        fc.property(
          fc.record({
            initialTitle: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            updatedTitle: fc.option(
              fc.string({ minLength: 1, maxLength: 200 })
                .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
              { nil: undefined }
            ),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0)
          }),
          (data) => {
            // Create initial article
            const uniqueInitialTitle = `${data.initialTitle}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueInitialTitle,
              content: data.content,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);
            const initialUrl = `/a/${created.authorUid}/${created.urlName}`;

            // Verify initial URL format
            const urlPattern = /^\/a\/[^\/]+\/[a-z0-9_-]+$/;
            expect(initialUrl).toMatch(urlPattern);

            // Update article (title may or may not change)
            if (data.updatedTitle !== undefined) {
              const uniqueUpdatedTitle = `${data.updatedTitle}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              const updated = articleService.updateArticle(created.id, {
                title: uniqueUpdatedTitle
              });

              const updatedUrl = `/a/${updated.authorUid}/${updated.urlName}`;

              // Property: Updated URL must still match the format
              expect(updatedUrl).toMatch(urlPattern);

              // Property: Author UID in URL must remain the same
              expect(updated.authorUid).toBe(created.authorUid);
            } else {
              // Update without changing title
              const updated = articleService.updateArticle(created.id, {
                content: 'Updated content'
              });

              const updatedUrl = `/a/${updated.authorUid}/${updated.urlName}`;

              // Property: URL format must still be correct
              expect(updatedUrl).toMatch(urlPattern);

              // Property: URL should remain the same when title doesn't change
              expect(updated.urlName).toBe(created.urlName);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 22: 访问控制一致性 (Access Control Consistency)', () => {
    it('PBT: published articles accessible to all users, unpublished only to author', () => {
      // **Validates: Requirements 7.1, 7.5**
      // Feature: article-system, Property 22: 访问控制一致性
      
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            authorUid: fc.constantFrom('1', '2'),
            published: fc.boolean()
          }),
          fc.option(fc.constantFrom('1', '2', '3'), { nil: undefined }), // userUid (including undefined for unauthenticated)
          (articleData, userUid) => {
            // Create article with unique title
            const uniqueTitle = `${articleData.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: articleData.content,
              authorUid: articleData.authorUid,
              categories: [],
              published: articleData.published
            };

            const article = articleService.createArticle(input);

            // Test access control
            const canAccess = articleService.canAccessArticle(article, userUid);

            if (article.published) {
              // Property 1: Published articles are accessible to everyone
              expect(canAccess).toBe(true);
            } else {
              // Property 2: Unpublished articles are only accessible to the author
              if (userUid === article.authorUid) {
                expect(canAccess).toBe(true);
              } else {
                expect(canAccess).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: access control consistency across article updates', () => {
      // **Validates: Requirements 7.1, 7.5**
      // Feature: article-system, Property 22: 访问控制一致性
      
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            authorUid: fc.constantFrom('1', '2'),
            initialPublished: fc.boolean(),
            updatedPublished: fc.boolean()
          }),
          (data) => {
            // Create article with unique title
            const uniqueTitle = `${data.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: data.content,
              authorUid: data.authorUid,
              categories: [],
              published: data.initialPublished
            };

            const article = articleService.createArticle(input);

            // Test access before update
            const authorCanAccessBefore = articleService.canAccessArticle(article, data.authorUid);
            const otherUserCanAccessBefore = articleService.canAccessArticle(article, '3');
            const unauthCanAccessBefore = articleService.canAccessArticle(article, undefined);

            // Verify initial access control
            if (data.initialPublished) {
              expect(authorCanAccessBefore).toBe(true);
              expect(otherUserCanAccessBefore).toBe(true);
              expect(unauthCanAccessBefore).toBe(true);
            } else {
              expect(authorCanAccessBefore).toBe(true);
              expect(otherUserCanAccessBefore).toBe(false);
              expect(unauthCanAccessBefore).toBe(false);
            }

            // Update published status
            const updated = articleService.updateArticle(article.id, {
              published: data.updatedPublished
            });

            // Test access after update
            const authorCanAccessAfter = articleService.canAccessArticle(updated, data.authorUid);
            const otherUserCanAccessAfter = articleService.canAccessArticle(updated, '3');
            const unauthCanAccessAfter = articleService.canAccessArticle(updated, undefined);

            // Verify updated access control
            if (data.updatedPublished) {
              expect(authorCanAccessAfter).toBe(true);
              expect(otherUserCanAccessAfter).toBe(true);
              expect(unauthCanAccessAfter).toBe(true);
            } else {
              expect(authorCanAccessAfter).toBe(true);
              expect(otherUserCanAccessAfter).toBe(false);
              expect(unauthCanAccessAfter).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: unauthenticated users can only access published articles', () => {
      // **Validates: Requirements 7.1, 7.5**
      // Feature: article-system, Property 22: 访问控制一致性
      
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            authorUid: fc.constantFrom('1', '2'),
            published: fc.boolean()
          }),
          (data) => {
            // Create article with unique title
            const uniqueTitle = `${data.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: data.content,
              authorUid: data.authorUid,
              categories: [],
              published: data.published
            };

            const article = articleService.createArticle(input);

            // Test unauthenticated access (undefined userUid)
            const canAccess = articleService.canAccessArticle(article, undefined);

            // Property: Unauthenticated users can only access published articles
            expect(canAccess).toBe(article.published);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: non-author authenticated users can only access published articles', () => {
      // **Validates: Requirements 7.1, 7.5**
      // Feature: article-system, Property 22: 访问控制一致性
      
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            authorUid: fc.constantFrom('1', '2'),
            published: fc.boolean()
          }),
          (data) => {
            // Create article with unique title
            const uniqueTitle = `${data.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: data.content,
              authorUid: data.authorUid,
              categories: [],
              published: data.published
            };

            const article = articleService.createArticle(input);

            // Test access by non-author (user '3' who is neither '1' nor '2')
            // First create user 3 if not exists
            try {
              db.prepare(`
                INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(3, 'testuser3', 'hash', 'salt', Date.now(), '{}');
            } catch (e) {
              // User might already exist from previous test
            }

            const canAccess = articleService.canAccessArticle(article, '3');

            // Property: Non-author users can only access published articles
            expect(canAccess).toBe(article.published);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: author can always access their own articles regardless of published status', () => {
      // **Validates: Requirements 7.1, 7.5**
      // Feature: article-system, Property 22: 访问控制一致性
      
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 })
              .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
            content: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            authorUid: fc.constantFrom('1', '2'),
            published: fc.boolean()
          }),
          (data) => {
            // Create article with unique title
            const uniqueTitle = `${data.title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: data.content,
              authorUid: data.authorUid,
              categories: [],
              published: data.published
            };

            const article = articleService.createArticle(input);

            // Test access by author
            const canAccess = articleService.canAccessArticle(article, data.authorUid);

            // Property: Author can always access their own articles
            expect(canAccess).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: 文章创建必填字段验证 (Article Creation Required Fields Validation)', () => {
    it('PBT: missing or empty title must be rejected with ValidationError', () => {
      // **Validates: Requirements 6.2**
      // Feature: article-system, Property 16: 文章创建必填字段验证

      // Generator for invalid titles: empty string or whitespace-only strings
      const invalidTitleArb = fc.oneof(
        fc.constant(''),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length === 0)
      );

      // Generator for valid content (non-empty, non-whitespace-only)
      const validContentArb = fc.string({ minLength: 1, maxLength: 1000 })
        .filter(s => s.trim().length > 0);

      fc.assert(
        fc.property(
          invalidTitleArb,
          validContentArb,
          (invalidTitle, validContent) => {
            const input: CreateArticleInput = {
              title: invalidTitle,
              content: validContent,
              authorUid: '1',
              categories: [],
              published: false
            };

            // Property: creating an article with missing/empty title must throw ValidationError
            expect(() => {
              articleService.createArticle(input);
            }).toThrow(ValidationError);

            // Property: the error must indicate the 'title' field
            try {
              articleService.createArticle(input);
            } catch (err) {
              expect(err).toBeInstanceOf(ValidationError);
              const validationErr = err as ValidationError;
              expect(validationErr.field).toBe('title');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: missing or empty content must be rejected with ValidationError', () => {
      // **Validates: Requirements 6.2**
      // Feature: article-system, Property 16: 文章创建必填字段验证

      // Generator for valid titles (must contain at least one alphanumeric for URL generation)
      const validTitleArb = fc.string({ minLength: 1, maxLength: 200 })
        .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s));

      // Generator for invalid content: empty string or whitespace-only strings
      const invalidContentArb = fc.oneof(
        fc.constant(''),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length === 0)
      );

      fc.assert(
        fc.property(
          validTitleArb,
          invalidContentArb,
          (validTitle, invalidContent) => {
            // Use unique title to avoid URL conflicts
            const uniqueTitle = `${validTitle}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content: invalidContent,
              authorUid: '1',
              categories: [],
              published: false
            };

            // Property: creating an article with empty/whitespace-only content must throw ValidationError
            // indicating the 'content' field is missing/invalid
            expect(() => {
              articleService.createArticle(input);
            }).toThrow(ValidationError);

            try {
              articleService.createArticle(input);
            } catch (err) {
              expect(err).toBeInstanceOf(ValidationError);
              const validationErr = err as ValidationError;
              expect(validationErr.field).toBe('content');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17: 文章编辑权限验证 (Article Edit Permission)', () => {
    it('PBT: author can edit their own article without error', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 17: 文章编辑权限验证

      fc.assert(
        fc.property(
          // Generate valid article title
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          // Generate valid content
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          // Generate update data
          fc.record({
            content: fc.option(
              fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
              { nil: undefined }
            ),
            published: fc.option(fc.boolean(), { nil: undefined })
          }),
          (title, content, updateData) => {
            // Create article by author '1'
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: author can edit their own article (no ForbiddenError thrown)
            expect(() => {
              articleService.updateArticle(created.id, updateData, '1');
            }).not.toThrow(ForbiddenError);

            // Verify the update actually succeeded
            const updated = articleService.updateArticle(created.id, updateData, '1');
            expect(updated.id).toBe(created.id);
            expect(updated.authorUid).toBe('1');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: non-author cannot edit article (ForbiddenError thrown)', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 17: 文章编辑权限验证

      fc.assert(
        fc.property(
          // Generate valid article title
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          // Generate valid content
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          // Generate update data
          fc.record({
            content: fc.option(
              fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
              { nil: undefined }
            ),
            published: fc.option(fc.boolean(), { nil: undefined })
          }),
          (title, content, updateData) => {
            // Create article by author '1'
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);

            // Property: non-author (user '2') cannot edit the article
            expect(() => {
              articleService.updateArticle(created.id, updateData, '2');
            }).toThrow(ForbiddenError);

            // Verify the article is unchanged after failed edit attempt
            const retrieved = articleService.getArticleById(created.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.id).toBe(created.id);
            expect(retrieved!.authorUid).toBe('1');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: edit permission is exclusive to the author (biconditional)', () => {
      // **Validates: Requirements 6.3**
      // Feature: article-system, Property 17: 文章编辑权限验证
      // Tests the biconditional: user can edit IF AND ONLY IF user is the author

      fc.assert(
        fc.property(
          // Generate valid article title
          fc.string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s)),
          // Generate valid content
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          // Generate a user UID that is either the author or not
          fc.constantFrom('1', '2'),
          (title, content, attemptingUserUid) => {
            // Create article by author '1'
            const uniqueTitle = `${title}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const input: CreateArticleInput = {
              title: uniqueTitle,
              content,
              authorUid: '1',
              categories: [],
              published: false
            };

            const created = articleService.createArticle(input);
            const isAuthor = attemptingUserUid === created.authorUid;

            if (isAuthor) {
              // Property: author can edit without error
              expect(() => {
                articleService.updateArticle(created.id, { published: true }, attemptingUserUid);
              }).not.toThrow();
            } else {
              // Property: non-author gets ForbiddenError
              expect(() => {
                articleService.updateArticle(created.id, { published: true }, attemptingUserUid);
              }).toThrow(ForbiddenError);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
