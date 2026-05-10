/**
 * ArticleService - Manages articles and their lifecycle
 * 
 * This service provides CRUD operations for articles, including
 * creation, retrieval, updates, deletion, and access control.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { 
  Article, 
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesOptions,
  PaginatedArticles
} from '../types/article';
import { 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  ForbiddenError
} from '../types/errors';
import { generateStableArticleSlug } from '../utils/urlGenerator';
import { validateCreateArticleInput, validateUpdateArticleInput } from '../utils/articleValidation';
import { CategoryService } from './categoryService';

export class ArticleService {
  private categoryService: CategoryService;

  constructor(private db: Database.Database) {
    this.categoryService = new CategoryService(db);
  }

  /**
   * Create a new article
   * 
   * Requirements: 6.1, 6.2, 6.4, 6.5, 1.1
   * 
   * @param data - Article creation input
   * @returns Created article with associated categories
   * @throws ValidationError if input data is invalid
   * @throws DatabaseError if creation fails
   */
  createArticle(data: CreateArticleInput): Article {
    // Validate all inputs
    validateCreateArticleInput(data);

    // Generate stable URL name from article ID so links don't change with title edits
    const id = randomUUID();
    const urlName = generateStableArticleSlug(id);
    
    if (!urlName || urlName.length === 0) {
      throw new ValidationError(
        'Unable to generate valid stable URL name for this article.',
        'title'
      );
    }
    const now = Date.now();

    try {
      // Use transaction to ensure atomicity
      const transaction = this.db.transaction(() => {
        // Insert article
        this.db.prepare(`
          INSERT INTO articles (
            id, title, content, author_uid, url_name, 
            external_url, published, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          data.title,
          data.content,
          data.authorUid,
          urlName,
          data.externalUrl || null,
          data.published ? 1 : 0,
          now,
          now
        );

        // Associate categories if provided
        if (data.categories && data.categories.length > 0) {
          this.categoryService.addCategoriesToArticle(id, data.categories);
        }
      });

      transaction();

      // Retrieve and return the created article with categories
      const article = this.getArticleById(id);
      if (!article) {
        throw new DatabaseError('Article was created but could not be retrieved');
      }

      return article;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      
      // Handle unique constraint violation for url_name
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('UNIQUE constraint failed') && errorMessage.includes('url_name')) {
        throw new ValidationError(
          'An article with this URL name already exists for this author. Please use a different title.',
          'title'
        );
      }

      throw new DatabaseError(
        `Failed to create article: ${errorMessage}`,
        error as Error
      );
    }
  }

  /**
   * Get an article by ID
   * 
   * Requirements: 3.4, 7.2, 1.4
   * 
   * @param id - Article ID
   * @returns Article with associated categories and author data, or null if not found
   */
  getArticleById(id: string): Article | null {
    try {
      const row = this.db.prepare(`
        SELECT 
          a.id, a.title, a.content, a.author_uid, a.url_name,
          a.external_url, a.published, a.created_at, a.updated_at,
          u.username
        FROM articles a
        LEFT JOIN users u ON a.author_uid = u.uid
        WHERE a.id = ?
      `).get(id) as {
        id: string;
        title: string;
        content: string;
        author_uid: number;
        url_name: string;
        external_url: string | null;
        published: number;
        created_at: number;
        updated_at: number;
        username: string | null;
      } | undefined;

      if (!row) {
        return null;
      }

      // Load associated categories
      const categories = this.categoryService.getArticleCategories(id);

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        authorUid: String(row.author_uid),
        urlName: row.url_name,
        externalUrl: row.external_url || undefined,
        published: row.published === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        categories,
        author: row.username ? {
          uid: String(row.author_uid),
          username: row.username
        } : undefined
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to retrieve article: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get an article by URL parameters (author UID and URL name)
   * 
   * Requirements: 3.4
   * 
   * @param uid - Author UID
   * @param name - URL name
   * @returns Article with associated categories and author data, or null if not found
   */
  getArticleByUrl(uid: string, name: string): Article | null {
    try {
      const rows = this.db.prepare(`
        SELECT 
          a.id, a.title, a.content, a.author_uid, a.url_name,
          a.external_url, a.published, a.created_at, a.updated_at,
          u.username
        FROM articles a
        LEFT JOIN users u ON a.author_uid = u.uid
        WHERE a.author_uid = ?
      `).all(uid) as Array<{
        id: string;
        title: string;
        content: string;
        author_uid: number;
        url_name: string;
        external_url: string | null;
        published: number;
        created_at: number;
        updated_at: number;
        username: string | null;
      }>;

      const row = rows.find((candidate) => {
        const stableSlug = generateStableArticleSlug(candidate.id);
        return candidate.url_name === name || stableSlug === name;
      });

      if (!row) {
        return null;
      }

      // Load associated categories
      const categories = this.categoryService.getArticleCategories(row.id);

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        authorUid: String(row.author_uid),
        urlName: row.url_name,
        externalUrl: row.external_url || undefined,
        published: row.published === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        categories,
        author: row.username ? {
          uid: String(row.author_uid),
          username: row.username
        } : undefined
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to retrieve article by URL: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Update an article
   * 
   * Requirements: 6.3, 6.4, 6.5, 1.1
   * 
   * @param id - Article ID
   * @param data - Fields to update
   * @param authorUid - Optional UID of the user attempting the update (for authorization)
   * @returns Updated article
   * @throws NotFoundError if article doesn't exist
   * @throws ValidationError if update data is invalid
   * @throws ForbiddenError if authorUid is provided and user is not the author
   */
  updateArticle(id: string, data: UpdateArticleInput, authorUid?: string): Article {
    // Validate input
    validateUpdateArticleInput(data);

    // Check if article exists
    const existing = this.getArticleById(id);
    if (!existing) {
      throw new NotFoundError('Article');
    }

    // Check ownership if authorUid is provided
    if (authorUid !== undefined && existing.authorUid !== authorUid) {
      throw new ForbiddenError('You do not have permission to edit this article');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }

    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }

    if (data.externalUrl !== undefined) {
      updates.push('external_url = ?');
      values.push(data.externalUrl || null);
    }

    if (data.published !== undefined) {
      updates.push('published = ?');
      values.push(data.published ? 1 : 0);
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = ?');
    values.push(Date.now());

    values.push(id);

    try {
      const transaction = this.db.transaction(() => {
        // Always update the article (at minimum, updated_at is always updated)
        this.db.prepare(`
          UPDATE articles
          SET ${updates.join(', ')}
          WHERE id = ?
        `).run(...values);

        // Update categories if provided
        if (data.categories !== undefined) {
          // Remove all existing categories
          const existingCategories = this.categoryService.getArticleCategories(id);
          if (existingCategories.length > 0) {
            this.categoryService.removeCategoriesFromArticle(
              id,
              existingCategories.map(c => c.id)
            );
          }

          // Add new categories
          if (data.categories.length > 0) {
            this.categoryService.addCategoriesToArticle(id, data.categories);
          }
        }
      });

      transaction();

      // Retrieve and return updated article
      const updated = this.getArticleById(id);
      if (!updated) {
        throw new DatabaseError('Article disappeared after update');
      }
      return updated;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle unique constraint violation for url_name
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('UNIQUE constraint failed') && errorMessage.includes('url_name')) {
        throw new ValidationError(
          'An article with this URL name already exists for this author. Please use a different title.',
          'title'
        );
      }

      throw new DatabaseError(
        `Failed to update article: ${errorMessage}`,
        error as Error
      );
    }
  }

  /**
   * List articles with pagination and filtering
   * 
   * Requirements: 7.1, 2.1
   * 
   * @param options - Listing options (pagination, filters, sorting)
   * @returns Paginated articles
   */
  listArticles(options: ListArticlesOptions): PaginatedArticles {
    const {
      page,
      pageSize,
      authorUid,
      categories,
      published,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (authorUid !== undefined) {
      conditions.push('a.author_uid = ?');
      params.push(authorUid);
    }

    if (published !== undefined) {
      conditions.push('a.published = ?');
      params.push(published ? 1 : 0);
    }

    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => '?').join(',');
      conditions.push(`a.id IN (
        SELECT article_id FROM article_categories 
        WHERE category_id IN (${placeholders})
      )`);
      params.push(...categories);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Build ORDER BY clause
    const sortColumn = sortBy === 'createdAt' ? 'a.created_at' : 'a.updated_at';
    const orderClause = `ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    try {
      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT a.id) as total
        FROM articles a
        ${whereClause}
      `;
      const countResult = this.db.prepare(countQuery).get(...params) as { total: number };
      const total = countResult.total;

      // Get paginated articles
      const offset = (page - 1) * pageSize;
      const articlesQuery = `
        SELECT DISTINCT
          a.id, a.title, a.content, a.author_uid, a.url_name,
          a.external_url, a.published, a.created_at, a.updated_at,
          u.username
        FROM articles a
        LEFT JOIN users u ON a.author_uid = u.uid
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `;
      
      const rows = this.db.prepare(articlesQuery).all(
        ...params,
        pageSize,
        offset
      ) as Array<{
        id: string;
        title: string;
        content: string;
        author_uid: number;
        url_name: string;
        external_url: string | null;
        published: number;
        created_at: number;
        updated_at: number;
        username: string | null;
      }>;

      // Load categories for all articles in a single batch query (avoids N+1)
      const articleIds = rows.map(row => row.id);
      const categoriesByArticle = this.categoryService.getArticleCategoriesBatch(articleIds);

      const articles: Article[] = rows.map(row => {
        const categories = categoriesByArticle.get(row.id) ?? [];
        
        return {
          id: row.id,
          title: row.title,
          content: row.content,
          authorUid: String(row.author_uid),
          urlName: row.url_name,
          externalUrl: row.external_url || undefined,
          published: row.published === 1,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          categories,
          author: row.username ? {
            uid: String(row.author_uid),
            username: row.username
          } : undefined
        };
      });

      const totalPages = Math.ceil(total / pageSize);

      return {
        articles,
        total,
        page,
        pageSize,
        totalPages
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to list articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete an article
   * 
   * Requirements: 6.3
   * 
   * @param id - Article ID
   * @param authorUid - UID of the user attempting deletion (for authorization)
   * @returns true if deleted, false if not found
   * @throws ForbiddenError if user is not the author
   */
  deleteArticle(id: string, authorUid: string): boolean {
    // Check if article exists and verify ownership
    const article = this.getArticleById(id);
    if (!article) {
      return false;
    }

    if (article.authorUid !== authorUid) {
      throw new ForbiddenError('You do not have permission to delete this article');
    }

    try {
      const result = this.db.prepare(
        'DELETE FROM articles WHERE id = ?'
      ).run(id);

      return result.changes > 0;
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete article: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if a user can access an article
   * 
   * Requirements: 7.1, 7.5
   * 
   * @param article - The article to check access for
   * @param userUid - Optional user UID (undefined for unauthenticated users)
   * @returns true if user can access the article
   */
  canAccessArticle(article: Article, userUid?: string): boolean {
    // Published articles are accessible to everyone
    if (article.published) {
      return true;
    }

    // Unpublished articles are only accessible to the author
    if (userUid && userUid === article.authorUid) {
      return true;
    }

    return false;
  }
}
