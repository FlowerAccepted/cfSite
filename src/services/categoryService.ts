/**
 * CategoryService - Manages article categories and their associations
 * 
 * This service provides CRUD operations for categories and manages
 * the many-to-many relationship between articles and categories.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Category, UpdateCategoryInput } from '../types/article';
import { 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  ConflictError 
} from '../types/errors';

/** Simple in-memory cache entry */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CategoryService {
  /** In-memory cache for getAllCategories (TTL: 5 minutes) */
  private allCategoriesCache: CacheEntry<Category[]> | null = null;
  private static readonly ALL_CATEGORIES_TTL_MS = 5 * 60 * 1000;

  constructor(private db: Database.Database) {}

  /** Invalidate the getAllCategories cache (call after any write operation) */
  private invalidateCache(): void {
    this.allCategoriesCache = null;
  }

  /**
   * Create a new category
   * @param name - Category name (required, must be unique)
   * @param description - Optional category description
   * @returns Created category
   * @throws ValidationError if name is empty or invalid
   * @throws ConflictError if category name already exists
   */
  createCategory(name: string, description?: string): Category {
    // Validate input
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Category name cannot be empty', 'name');
    }

    const trimmedName = name.trim();
    
    // Check for duplicate name
    const existing = this.db.prepare(
      'SELECT id FROM categories WHERE name = ?'
    ).get(trimmedName);
    
    if (existing) {
      throw new ConflictError('Category', trimmedName);
    }

    const id = randomUUID();
    const createdAt = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO categories (id, name, description, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, trimmedName, description || null, createdAt);

      this.invalidateCache();

      return {
        id,
        name: trimmedName,
        description: description || undefined,
        createdAt: new Date(createdAt)
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to create category: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get all categories (cached for 5 minutes)
   * @returns Array of all categories
   */
  getAllCategories(): Category[] {
    // Return cached result if still valid
    const now = Date.now();
    if (this.allCategoriesCache && now < this.allCategoriesCache.expiresAt) {
      return this.allCategoriesCache.value;
    }

    try {
      const rows = this.db.prepare(`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.created_at,
          COUNT(ac.article_id) as article_count
        FROM categories c
        LEFT JOIN article_categories ac ON c.id = ac.category_id
        GROUP BY c.id
        ORDER BY c.name ASC
      `).all() as Array<{
        id: string;
        name: string;
        description: string | null;
        created_at: number;
        article_count: number;
      }>;

      const categories = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        createdAt: new Date(row.created_at),
        articleCount: row.article_count
      }));

      // Store in cache
      this.allCategoriesCache = {
        value: categories,
        expiresAt: now + CategoryService.ALL_CATEGORIES_TTL_MS
      };

      return categories;
    } catch (error) {
      throw new DatabaseError(
        `Failed to retrieve categories: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get a category by ID
   * @param id - Category ID
   * @returns Category or null if not found
   */
  getCategoryById(id: string): Category | null {
    try {
      const row = this.db.prepare(`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.created_at,
          COUNT(ac.article_id) as article_count
        FROM categories c
        LEFT JOIN article_categories ac ON c.id = ac.category_id
        WHERE c.id = ?
        GROUP BY c.id
      `).get(id) as {
        id: string;
        name: string;
        description: string | null;
        created_at: number;
        article_count: number;
      } | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        createdAt: new Date(row.created_at),
        articleCount: row.article_count
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to retrieve category: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Update a category
   * @param id - Category ID
   * @param data - Fields to update
   * @returns Updated category
   * @throws NotFoundError if category doesn't exist
   * @throws ValidationError if update data is invalid
   * @throws ConflictError if new name conflicts with existing category
   */
  updateCategory(id: string, data: UpdateCategoryInput): Category {
    // Check if category exists
    const existing = this.getCategoryById(id);
    if (!existing) {
      throw new NotFoundError('Category');
    }

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Category name cannot be empty', 'name');
      }

      const trimmedName = data.name.trim();
      
      // Check for duplicate name (excluding current category)
      const duplicate = this.db.prepare(
        'SELECT id FROM categories WHERE name = ? AND id != ?'
      ).get(trimmedName, id);
      
      if (duplicate) {
        throw new ConflictError('Category', trimmedName);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name.trim());
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }

    if (updates.length === 0) {
      // No updates, return existing category
      return existing;
    }

    values.push(id);

    try {
      this.db.prepare(`
        UPDATE categories
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);

      this.invalidateCache();

      // Retrieve and return updated category
      const updated = this.getCategoryById(id);
      if (!updated) {
        throw new DatabaseError('Category disappeared after update');
      }
      return updated;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to update category: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete a category
   * @param id - Category ID
   * @returns true if deleted, false if not found
   * @throws DatabaseError if deletion fails
   */
  deleteCategory(id: string): boolean {
    try {
      const result = this.db.prepare(
        'DELETE FROM categories WHERE id = ?'
      ).run(id);

      if (result.changes > 0) {
        this.invalidateCache();
      }

      return result.changes > 0;
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete category: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Add categories to an article
   * @param articleId - Article ID
   * @param categoryIds - Array of category IDs to add
   * @throws ValidationError if inputs are invalid
   * @throws DatabaseError if operation fails
   */
  addCategoriesToArticle(articleId: string, categoryIds: string[]): void {
    if (!articleId || articleId.trim().length === 0) {
      throw new ValidationError('Article ID cannot be empty', 'articleId');
    }

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new ValidationError('Category IDs must be a non-empty array', 'categoryIds');
    }

    const createdAt = Date.now();

    try {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO article_categories (article_id, category_id, created_at)
        VALUES (?, ?, ?)
      `);

      const transaction = this.db.transaction((ids: string[]) => {
        for (const categoryId of ids) {
          insert.run(articleId, categoryId, createdAt);
        }
      });

      transaction(categoryIds);
    } catch (error) {
      throw new DatabaseError(
        `Failed to add categories to article: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Remove categories from an article
   * @param articleId - Article ID
   * @param categoryIds - Array of category IDs to remove
   * @throws ValidationError if inputs are invalid
   * @throws DatabaseError if operation fails
   */
  removeCategoriesFromArticle(articleId: string, categoryIds: string[]): void {
    if (!articleId || articleId.trim().length === 0) {
      throw new ValidationError('Article ID cannot be empty', 'articleId');
    }

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new ValidationError('Category IDs must be a non-empty array', 'categoryIds');
    }

    try {
      const placeholders = categoryIds.map(() => '?').join(',');
      this.db.prepare(`
        DELETE FROM article_categories
        WHERE article_id = ? AND category_id IN (${placeholders})
      `).run(articleId, ...categoryIds);
    } catch (error) {
      throw new DatabaseError(
        `Failed to remove categories from article: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get all categories for an article
   * @param articleId - Article ID
   * @returns Array of categories associated with the article
   * @throws ValidationError if articleId is invalid
   * @throws DatabaseError if operation fails
   */
  getArticleCategories(articleId: string): Category[] {
    if (!articleId || articleId.trim().length === 0) {
      throw new ValidationError('Article ID cannot be empty', 'articleId');
    }

    try {
      const rows = this.db.prepare(`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.created_at
        FROM categories c
        INNER JOIN article_categories ac ON c.id = ac.category_id
        WHERE ac.article_id = ?
        ORDER BY c.name ASC
      `).all(articleId) as Array<{
        id: string;
        name: string;
        description: string | null;
        created_at: number;
      }>;

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        createdAt: new Date(row.created_at)
      }));
    } catch (error) {
      throw new DatabaseError(
        `Failed to retrieve article categories: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get categories for multiple articles in a single query (batch load to avoid N+1).
   * 
   * @param articleIds - Array of article IDs
   * @returns Map from article ID to its categories array
   * @throws DatabaseError if operation fails
   */
  getArticleCategoriesBatch(articleIds: string[]): Map<string, Category[]> {
    const result = new Map<string, Category[]>();
    if (articleIds.length === 0) return result;

    // Pre-populate with empty arrays so every id has an entry
    for (const id of articleIds) {
      result.set(id, []);
    }

    try {
      const placeholders = articleIds.map(() => '?').join(',');
      const rows = this.db.prepare(`
        SELECT 
          ac.article_id,
          c.id,
          c.name,
          c.description,
          c.created_at
        FROM categories c
        INNER JOIN article_categories ac ON c.id = ac.category_id
        WHERE ac.article_id IN (${placeholders})
        ORDER BY ac.article_id, c.name ASC
      `).all(...articleIds) as Array<{
        article_id: string;
        id: string;
        name: string;
        description: string | null;
        created_at: number;
      }>;

      for (const row of rows) {
        const cats = result.get(row.article_id)!;
        cats.push({
          id: row.id,
          name: row.name,
          description: row.description || undefined,
          createdAt: new Date(row.created_at)
        });
      }

      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to batch-retrieve article categories: ${(error as Error).message}`,
        error as Error
      );
    }
  }
}
