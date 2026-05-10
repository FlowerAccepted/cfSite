/**
 * Core type definitions for the Article System
 */

/**
 * Article entity representing a published or draft article
 */
export interface Article {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  urlName: string;
  externalUrl?: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Associated data (optional, loaded based on query needs)
  author?: User;
  categories?: Category[];
}

/**
 * Category entity for organizing articles
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  
  // Associated data (optional)
  articleCount?: number;
}

/**
 * User entity representing article authors
 */
export interface User {
  uid: string;
  username: string;
  // Additional user fields can be added as needed
}

/**
 * Input data for creating a new article
 */
export interface CreateArticleInput {
  title: string;
  content: string;
  authorUid: string;
  categories: string[];
  externalUrl?: string;
  published: boolean;
}

/**
 * Input data for updating an existing article
 */
export interface UpdateArticleInput {
  title?: string;
  content?: string;
  categories?: string[];
  externalUrl?: string;
  published?: boolean;
}

/**
 * Options for listing articles with pagination and filtering
 */
export interface ListArticlesOptions {
  page: number;
  pageSize: number;
  authorUid?: string;
  categories?: string[];
  published?: boolean;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result for article listings
 */
export interface PaginatedArticles {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Input data for updating a category
 */
export interface UpdateCategoryInput {
  name?: string;
  description?: string;
}

/**
 * Options for search operations
 */
export interface SearchOptions {
  page: number;
  pageSize: number;
  searchFields: ('title' | 'content')[];
  caseSensitive?: boolean;
  categories?: string[];
}

/**
 * Search result containing matched articles
 */
export interface SearchResult {
  articles: ArticleSearchHit[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  executionTime: number; // milliseconds
}

/**
 * Individual article match in search results
 */
export interface ArticleSearchHit {
  article: Article;
  matches: {
    field: 'title' | 'content';
    snippet: string; // Text snippet with highlight markers
    position: number;
  }[];
}

/**
 * Result of external content loading
 */
export interface ExternalContent {
  content: string;
  contentType: string;
  loadTime: number; // milliseconds
  success: boolean;
  error?: string;
}

/**
 * Context for operations requiring authorization
 */
export interface OperationContext {
  userUid: string;
  userRole?: 'user' | 'admin' | 'moderator';
  permissions?: string[];
}

/**
 * Result of bulk operations
 */
export interface BulkOperationResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}
