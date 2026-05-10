/**
 * SearchService - Handles article search with regex support
 * 
 * This service provides regex-based search functionality for articles,
 * including pattern validation and text highlighting.
 */

import type Database from 'better-sqlite3';
import type { 
  Article, 
  SearchOptions, 
  SearchResult, 
  ArticleSearchHit 
} from '../types/article';
import { SearchError } from '../types/errors';
import { CategoryService } from './categoryService';

/**
 * Validates a regex pattern
 * 
 * @param pattern - The regex pattern string to validate
 * @returns Object with valid flag and optional error message
 * 
 * @example
 * validateRegex('\\d+') // { valid: true }
 * validateRegex('[invalid') // { valid: false, error: 'Unterminated character class' }
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    // Attempt to compile the regex pattern
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    // Catch compilation errors and return descriptive message
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Invalid regular expression';
    
    return { 
      valid: false, 
      error: errorMessage 
    };
  }
}

/**
 * Highlights text matches by wrapping them in <mark> tags
 * 
 * @param text - The text to search and highlight
 * @param pattern - The regex pattern to match
 * @param caseSensitive - Whether to use case-sensitive matching
 * @returns Text with matches wrapped in <mark> tags
 * 
 * @example
 * highlightMatches('Hello world', 'world') // 'Hello <mark>world</mark>'
 * highlightMatches('test 123 test', '\\d+') // 'test <mark>123</mark> test'
 */
export function highlightMatches(text: string, pattern: string, caseSensitive: boolean = false): string {
  try {
    // Create regex with global flag to find all matches
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    
    // Replace all matches with <mark> wrapped version
    return text.replace(regex, (match) => `<mark>${match}</mark>`);
  } catch (error) {
    // If regex is invalid, return original text unchanged
    return text;
  }
}

/**
 * SearchService class for performing article searches
 */
export class SearchService {
  private categoryService: CategoryService;

  constructor(private db: Database.Database) {
    this.categoryService = new CategoryService(db);
  }

  /**
   * Search articles using regex pattern matching
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.5
   * 
   * @param query - The regex pattern to search for
   * @param options - Search options (fields, pagination, case sensitivity, categories)
   * @returns Search results with matched articles and execution time
   * @throws SearchError if regex is invalid or search times out
   * 
   * @example
   * searchArticles('\\d+', { 
   *   page: 1, 
   *   pageSize: 10, 
   *   searchFields: ['title', 'content'],
   *   caseSensitive: false 
   * })
   */
  async searchArticles(query: string, options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const TIMEOUT_MS = 2000; // 2 seconds timeout

    // Validate the regex pattern
    const validation = validateRegex(query);
    if (!validation.valid) {
      throw new SearchError(`Invalid regular expression: ${validation.error}`);
    }

    // Create regex with appropriate flags
    const flags = options.caseSensitive ? 'g' : 'gi';
    let regex: RegExp;
    try {
      regex = new RegExp(query, flags);
    } catch (error) {
      throw new SearchError(`Failed to compile regex: ${(error as Error).message}`);
    }

    // Build WHERE clause for category filtering
    const conditions: string[] = [];
    const params: any[] = [];

    // Only search published articles
    conditions.push('a.published = 1');

    if (options.categories && options.categories.length > 0) {
      const placeholders = options.categories.map(() => '?').join(',');
      conditions.push(`a.id IN (
        SELECT article_id FROM article_categories 
        WHERE category_id IN (${placeholders})
      )`);
      params.push(...options.categories);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    try {
      // Fetch all matching articles from database
      const articlesQuery = `
        SELECT 
          a.id, a.title, a.content, a.author_uid, a.url_name,
          a.external_url, a.published, a.created_at, a.updated_at,
          u.username
        FROM articles a
        LEFT JOIN users u ON a.author_uid = u.uid
        ${whereClause}
        ORDER BY a.created_at DESC
      `;

      const rows = this.db.prepare(articlesQuery).all(...params) as Array<{
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

      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new SearchError('Search timeout exceeded');
      }

      // Search through articles and collect matches
      const hits: ArticleSearchHit[] = [];

      for (const row of rows) {
        // Check timeout periodically
        if (Date.now() - startTime > TIMEOUT_MS) {
          throw new SearchError('Search timeout exceeded');
        }

        const matches: ArticleSearchHit['matches'] = [];

        // Search in title if requested
        if (options.searchFields.includes('title')) {
          // Reset regex lastIndex for global flag
          regex.lastIndex = 0;
          const titleMatches = [...row.title.matchAll(regex)];
          
          if (titleMatches.length > 0) {
            const firstMatch = titleMatches[0];
            matches.push({
              field: 'title',
              snippet: highlightMatches(row.title, query, options.caseSensitive),
              position: firstMatch.index || 0
            });
          }
        }

        // Search in content if requested
        if (options.searchFields.includes('content')) {
          // Reset regex lastIndex for global flag
          regex.lastIndex = 0;
          const contentMatches = [...row.content.matchAll(regex)];
          
          if (contentMatches.length > 0) {
            const firstMatch = contentMatches[0];
            const matchPosition = firstMatch.index || 0;
            
            // Extract snippet with context (50 chars before, 100 chars after match)
            const contextBefore = 50;
            const contextAfter = 100;
            const start = Math.max(0, matchPosition - contextBefore);
            const end = Math.min(row.content.length, matchPosition + contextAfter);
            
            let snippet = row.content.substring(start, end);
            
            // Add ellipsis if we're not at the start/end
            if (start > 0) {
              snippet = '...' + snippet;
            }
            if (end < row.content.length) {
              snippet = snippet + '...';
            }
            
            // Highlight matches in the snippet
            snippet = highlightMatches(snippet, query, options.caseSensitive);
            
            matches.push({
              field: 'content',
              snippet,
              position: matchPosition
            });
          }
        }

        // If we found matches, add this article to results
        if (matches.length > 0) {
          // Load categories for this article
          const categories = this.categoryService.getArticleCategories(row.id);
          
          const article: Article = {
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

          hits.push({ article, matches });
        }
      }

      // Apply pagination to results
      const total = hits.length;
      const startIndex = (options.page - 1) * options.pageSize;
      const endIndex = startIndex + options.pageSize;
      const paginatedHits = hits.slice(startIndex, endIndex);

      const executionTime = Date.now() - startTime;

      return {
        articles: paginatedHits,
        total,
        page: options.page,
        pageSize: options.pageSize,
        query,
        executionTime
      };
    } catch (error) {
      if (error instanceof SearchError) {
        throw error;
      }
      throw new SearchError(`Search failed: ${(error as Error).message}`);
    }
  }
}
