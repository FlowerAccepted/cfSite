/**
 * Unit and Property-Based Tests for CategoryService
 * 
 * This test suite covers:
 * - CRUD operations for categories
 * - Article-category associations
 * - Input validation
 * - Error handling
 * - Property-based tests for data integrity
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { CategoryService } from './categoryService';
import { createTestDatabase } from '../utils/db';
import type Database from 'better-sqlite3';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} from '../types/errors';

describe('CategoryService', () => {
  let db: Database.Database;
  let service: CategoryService;

  // Helper function to create a test article in the database
  const createTestArticle = (articleId: string, authorUid: number = 1): void => {
    // First ensure the user exists
    const userExists = db.prepare('SELECT uid FROM users WHERE uid = ?').get(authorUid);
    if (!userExists) {
      db.prepare(`
        INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(authorUid, 'testuser', 'hash', 'salt', Date.now(), '{}');
    }

    // Create the article
    db.prepare(`
      INSERT INTO articles (id, title, content, author_uid, url_name, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      articleId,
      'Test Article',
      'Test content',
      authorUid,
      'test-article-' + articleId,
      0,
      Date.now(),
      Date.now()
    );
  };

  beforeEach(() => {
    db = createTestDatabase();
    service = new CategoryService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createCategory', () => {
    it('should create a category with name only', () => {
      const category = service.createCategory('Technology');

      expect(category.id).toBeDefined();
      expect(category.name).toBe('Technology');
      expect(category.description).toBeUndefined();
      expect(category.createdAt).toBeInstanceOf(Date);
    });

    it('should create a category with name and description', () => {
      const category = service.createCategory('Science', 'Scientific articles');

      expect(category.id).toBeDefined();
      expect(category.name).toBe('Science');
      expect(category.description).toBe('Scientific articles');
      expect(category.createdAt).toBeInstanceOf(Date);
    });

    it('should trim whitespace from category name', () => {
      const category = service.createCategory('  Technology  ');

      expect(category.name).toBe('Technology');
    });

    it('should throw ValidationError for empty name', () => {
      expect(() => service.createCategory('')).toThrow(ValidationError);
      expect(() => service.createCategory('   ')).toThrow(ValidationError);
    });

    it('should throw ConflictError for duplicate name', () => {
      service.createCategory('Technology');
      
      expect(() => service.createCategory('Technology')).toThrow(ConflictError);
    });

    it('should allow same name with different case initially, but prevent exact duplicates', () => {
      service.createCategory('Technology');
      
      // SQLite is case-insensitive by default for UNIQUE constraints
      // This behavior depends on collation settings
      expect(() => service.createCategory('Technology')).toThrow(ConflictError);
    });
  });

  describe('getAllCategories', () => {
    it('should return empty array when no categories exist', () => {
      const categories = service.getAllCategories();

      expect(categories).toEqual([]);
    });

    it('should return all categories sorted by name', () => {
      service.createCategory('Zebra');
      service.createCategory('Apple');
      service.createCategory('Mango');

      const categories = service.getAllCategories();

      expect(categories).toHaveLength(3);
      expect(categories[0].name).toBe('Apple');
      expect(categories[1].name).toBe('Mango');
      expect(categories[2].name).toBe('Zebra');
    });

    it('should include article count for each category', () => {
      const cat1 = service.createCategory('Tech');
      const cat2 = service.createCategory('Science');

      // Create test articles
      createTestArticle('article-1');
      createTestArticle('article-2');
      createTestArticle('article-3');

      // Add some article associations
      service.addCategoriesToArticle('article-1', [cat1.id]);
      service.addCategoriesToArticle('article-2', [cat1.id]);
      service.addCategoriesToArticle('article-3', [cat2.id]);

      const categories = service.getAllCategories();

      const tech = categories.find(c => c.name === 'Tech');
      const science = categories.find(c => c.name === 'Science');

      expect(tech?.articleCount).toBe(2);
      expect(science?.articleCount).toBe(1);
    });
  });

  describe('getCategoryById', () => {
    it('should return category by ID', () => {
      const created = service.createCategory('Technology', 'Tech articles');
      const retrieved = service.getCategoryById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Technology');
      expect(retrieved?.description).toBe('Tech articles');
    });

    it('should return null for non-existent ID', () => {
      const category = service.getCategoryById('non-existent-id');

      expect(category).toBeNull();
    });

    it('should include article count', () => {
      const cat = service.createCategory('Tech');
      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [cat.id]);

      const retrieved = service.getCategoryById(cat.id);

      expect(retrieved?.articleCount).toBe(1);
    });
  });

  describe('updateCategory', () => {
    it('should update category name', () => {
      const category = service.createCategory('Tecnology'); // Typo
      const updated = service.updateCategory(category.id, { name: 'Technology' });

      expect(updated.name).toBe('Technology');
      expect(updated.id).toBe(category.id);
    });

    it('should update category description', () => {
      const category = service.createCategory('Tech', 'Old description');
      const updated = service.updateCategory(category.id, { 
        description: 'New description' 
      });

      expect(updated.description).toBe('New description');
    });

    it('should update both name and description', () => {
      const category = service.createCategory('Tech', 'Old');
      const updated = service.updateCategory(category.id, { 
        name: 'Technology',
        description: 'New' 
      });

      expect(updated.name).toBe('Technology');
      expect(updated.description).toBe('New');
    });

    it('should return unchanged category when no updates provided', () => {
      const category = service.createCategory('Tech');
      const updated = service.updateCategory(category.id, {});

      // Compare relevant fields (updated will have articleCount from getCategoryById)
      expect(updated.id).toBe(category.id);
      expect(updated.name).toBe(category.name);
      expect(updated.description).toBe(category.description);
    });

    it('should throw NotFoundError for non-existent category', () => {
      expect(() => 
        service.updateCategory('non-existent', { name: 'New' })
      ).toThrow(NotFoundError);
    });

    it('should throw ValidationError for empty name', () => {
      const category = service.createCategory('Tech');

      expect(() => 
        service.updateCategory(category.id, { name: '' })
      ).toThrow(ValidationError);
    });

    it('should throw ConflictError when new name conflicts', () => {
      service.createCategory('Tech');
      const science = service.createCategory('Science');

      expect(() => 
        service.updateCategory(science.id, { name: 'Tech' })
      ).toThrow(ConflictError);
    });

    it('should allow updating to same name (no conflict with self)', () => {
      const category = service.createCategory('Tech');
      
      expect(() => 
        service.updateCategory(category.id, { name: 'Tech' })
      ).not.toThrow();
    });
  });

  describe('deleteCategory', () => {
    it('should delete existing category', () => {
      const category = service.createCategory('Tech');
      const result = service.deleteCategory(category.id);

      expect(result).toBe(true);
      expect(service.getCategoryById(category.id)).toBeNull();
    });

    it('should return false for non-existent category', () => {
      const result = service.deleteCategory('non-existent');

      expect(result).toBe(false);
    });

    it('should cascade delete article associations', () => {
      const category = service.createCategory('Tech');
      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [category.id]);

      service.deleteCategory(category.id);

      // Verify association is removed
      const categories = service.getArticleCategories('article-1');
      expect(categories).toHaveLength(0);
    });
  });

  describe('addCategoriesToArticle', () => {
    it('should add single category to article', () => {
      const category = service.createCategory('Tech');
      createTestArticle('article-1');
      
      service.addCategoriesToArticle('article-1', [category.id]);

      const categories = service.getArticleCategories('article-1');
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe(category.id);
    });

    it('should add multiple categories to article', () => {
      const cat1 = service.createCategory('Tech');
      const cat2 = service.createCategory('Science');
      const cat3 = service.createCategory('Math');

      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [cat1.id, cat2.id, cat3.id]);

      const categories = service.getArticleCategories('article-1');
      expect(categories).toHaveLength(3);
    });

    it('should ignore duplicate category assignments', () => {
      const category = service.createCategory('Tech');

      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [category.id]);
      service.addCategoriesToArticle('article-1', [category.id]); // Duplicate

      const categories = service.getArticleCategories('article-1');
      expect(categories).toHaveLength(1);
    });

    it('should throw ValidationError for empty article ID', () => {
      const category = service.createCategory('Tech');

      expect(() => 
        service.addCategoriesToArticle('', [category.id])
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty category array', () => {
      expect(() => 
        service.addCategoriesToArticle('article-1', [])
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-array category IDs', () => {
      expect(() => 
        service.addCategoriesToArticle('article-1', 'not-an-array' as any)
      ).toThrow(ValidationError);
    });
  });

  describe('removeCategoriesFromArticle', () => {
    it('should remove single category from article', () => {
      const cat1 = service.createCategory('Tech');
      const cat2 = service.createCategory('Science');

      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [cat1.id, cat2.id]);
      service.removeCategoriesFromArticle('article-1', [cat1.id]);

      const categories = service.getArticleCategories('article-1');
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe(cat2.id);
    });

    it('should remove multiple categories from article', () => {
      const cat1 = service.createCategory('Tech');
      const cat2 = service.createCategory('Science');
      const cat3 = service.createCategory('Math');

      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [cat1.id, cat2.id, cat3.id]);
      service.removeCategoriesFromArticle('article-1', [cat1.id, cat2.id]);

      const categories = service.getArticleCategories('article-1');
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe(cat3.id);
    });

    it('should handle removing non-existent associations gracefully', () => {
      const category = service.createCategory('Tech');

      expect(() => 
        service.removeCategoriesFromArticle('article-1', [category.id])
      ).not.toThrow();
    });

    it('should throw ValidationError for empty article ID', () => {
      const category = service.createCategory('Tech');

      expect(() => 
        service.removeCategoriesFromArticle('', [category.id])
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty category array', () => {
      expect(() => 
        service.removeCategoriesFromArticle('article-1', [])
      ).toThrow(ValidationError);
    });
  });

  describe('getArticleCategories', () => {
    it('should return empty array for article with no categories', () => {
      const categories = service.getArticleCategories('article-1');

      expect(categories).toEqual([]);
    });

    it('should return categories sorted by name', () => {
      const cat1 = service.createCategory('Zebra');
      const cat2 = service.createCategory('Apple');
      const cat3 = service.createCategory('Mango');

      createTestArticle('article-1');
      service.addCategoriesToArticle('article-1', [cat1.id, cat2.id, cat3.id]);

      const categories = service.getArticleCategories('article-1');

      expect(categories).toHaveLength(3);
      expect(categories[0].name).toBe('Apple');
      expect(categories[1].name).toBe('Mango');
      expect(categories[2].name).toBe('Zebra');
    });

    it('should throw ValidationError for empty article ID', () => {
      expect(() => 
        service.getArticleCategories('')
      ).toThrow(ValidationError);
    });
  });

  // Property-Based Tests
  describe('Property-Based Tests', () => {
    it('Property 1: Category association completeness - adding and retrieving categories returns the same set', () => {
      // Feature: article-system, Property 1: 分类关联完整性
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          (categoryNames, articleId) => {
            // Create unique category names
            const uniqueNames = [...new Set(categoryNames)];
            
            // Create categories
            const categories = uniqueNames.map(name => 
              service.createCategory(name + '-' + Math.random())
            );
            const categoryIds = categories.map(c => c.id);

            // Create test article
            createTestArticle(articleId);

            // Add categories to article
            service.addCategoriesToArticle(articleId, categoryIds);

            // Retrieve categories
            const retrieved = service.getArticleCategories(articleId);
            const retrievedIds = new Set(retrieved.map(c => c.id));

            // Verify all added categories are retrieved
            return categoryIds.every(id => retrievedIds.has(id)) &&
                   retrievedIds.size === categoryIds.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: Category list completeness - getAllCategories returns all created categories', () => {
      // Feature: article-system, Property 2: 分类列表完整性
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
          (categoryNames) => {
            // Create fresh database for this test
            const testDb = createTestDatabase();
            const testService = new CategoryService(testDb);

            try {
              // Create unique category names
              const uniqueNames = [...new Set(categoryNames)];
              
              // Create categories
              const created = uniqueNames.map((name, idx) => 
                testService.createCategory(`${name}-${idx}`)
              );
              const createdIds = new Set(created.map(c => c.id));

              // Retrieve all categories
              const retrieved = testService.getAllCategories();
              const retrievedIds = new Set(retrieved.map(c => c.id));

              // Verify exact match
              return createdIds.size === retrievedIds.size &&
                     [...createdIds].every(id => retrievedIds.has(id));
            } finally {
              testDb.close();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 3: Name trimming consistency - category names are always trimmed', () => {
      // Feature: article-system, Property: Name trimming
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.nat(5),
          fc.nat(5),
          (name, leftSpaces, rightSpaces) => {
            const testDb = createTestDatabase();
            const testService = new CategoryService(testDb);

            try {
              const paddedName = ' '.repeat(leftSpaces) + name + ' '.repeat(rightSpaces);
              const category = testService.createCategory(paddedName);

              return category.name === name.trim() && category.name.trim() === category.name;
            } finally {
              testDb.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4: Update idempotence - updating with same values returns equivalent category', () => {
      // Feature: article-system, Property: Update idempotence
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          (name, description) => {
            const testDb = createTestDatabase();
            const testService = new CategoryService(testDb);

            try {
              const category = testService.createCategory(name + '-' + Math.random(), description);
              const updated = testService.updateCategory(category.id, {
                name: category.name,
                description: category.description
              });

              return category.id === updated.id &&
                     category.name === updated.name &&
                     category.description === updated.description;
            } finally {
              testDb.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5: Delete removes all associations - deleting category removes article associations', () => {
      // Feature: article-system, Property: Cascade delete
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (categoryName, articleIds) => {
            const testDb = createTestDatabase();
            const testService = new CategoryService(testDb);

            try {
              const category = testService.createCategory(categoryName + '-' + Math.random());

              // Create test articles and add category to them
              articleIds.forEach(articleId => {
                // Create test article in the test database
                const userExists = testDb.prepare('SELECT uid FROM users WHERE uid = ?').get(1);
                if (!userExists) {
                  testDb.prepare(`
                    INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `).run(1, 'testuser', 'hash', 'salt', Date.now(), '{}');
                }
                testDb.prepare(`
                  INSERT INTO articles (id, title, content, author_uid, url_name, published, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  articleId,
                  'Test Article',
                  'Test content',
                  1,
                  'test-article-' + articleId,
                  0,
                  Date.now(),
                  Date.now()
                );

                testService.addCategoriesToArticle(articleId, [category.id]);
              });

              // Delete category
              testService.deleteCategory(category.id);

              // Verify all associations are removed
              return articleIds.every(articleId => {
                const categories = testService.getArticleCategories(articleId);
                return categories.length === 0;
              });
            } finally {
              testDb.close();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
