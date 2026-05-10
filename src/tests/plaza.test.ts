/**
 * Integration tests for plaza page logic
 *
 * The plaza page is a server-rendered Astro component. We test the underlying
 * service logic and helper functions that drive the page's behaviour:
 *   - Article listing (published articles only)
 *   - Regex search functionality
 *   - Category filtering
 *   - Pagination
 *   - Error handling for invalid regex
 *
 * Requirements: 2.1, 2.2, 2.3, 7.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArticleService } from '../services/articleService';
import { CategoryService } from '../services/categoryService';
import { SearchService } from '../services/searchService';
import { createTestDatabase } from '../utils/db';
import { SearchError } from '../types/errors';
import type Database from 'better-sqlite3';
import type { CreateArticleInput, SearchOptions } from '../types/article';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers extracted / mirrored from plaza.astro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the buildUrl helper in plaza.astro.
 * Builds a URL for a given page number, preserving search and category params.
 */
function buildUrl(
  page: number,
  searchQuery: string,
  categoryFilter: string
): string {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (categoryFilter) params.set('category', categoryFilter);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/plaza?${qs}` : '/plaza';
}

/**
 * Mirrors the page-number parsing logic in plaza.astro.
 */
function parsePage(pageParam: string | null): number {
  return Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test setup
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database;
let articleService: ArticleService;
let categoryService: CategoryService;
let searchService: SearchService;

const PAGE_SIZE = 12; // matches plaza.astro constant

function createTestUser(uid: string, username: string): void {
  db.prepare(`
    INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid, username, 'hash', 'salt', Date.now(), '{}');
}

function makeArticle(
  overrides: Partial<CreateArticleInput> & { title: string }
): ReturnType<ArticleService['createArticle']> {
  return articleService.createArticle({
    content: 'Default content',
    authorUid: '1',
    categories: [],
    published: true,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Article listing — Requirement 2.1, 7.1
// ─────────────────────────────────────────────────────────────────────────────

describe('Plaza page — article listing (Requirements: 2.1, 7.1)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    searchService = new SearchService(db);
    createTestUser('1', 'alice');
    createTestUser('2', 'bob');
  });

  afterEach(() => {
    db.close();
  });

  it('returns only published articles in browse mode', () => {
    makeArticle({ title: 'Published One', published: true });
    makeArticle({ title: 'Published Two', published: true });
    makeArticle({ title: 'Draft Article', published: false });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.articles.every((a) => a.published)).toBe(true);
  });

  it('returns an empty list when no articles are published', () => {
    makeArticle({ title: 'Draft Only', published: false });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns articles sorted by createdAt descending by default', () => {
    // Insert articles with explicit, distinct timestamps to guarantee ordering
    const now = Date.now();
    db.prepare(`
      INSERT INTO articles (id, title, content, author_uid, url_name, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('id-oldest', 'First Article', 'content', '1', 'first-article', 1, now - 2000, now - 2000);
    db.prepare(`
      INSERT INTO articles (id, title, content, author_uid, url_name, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('id-middle', 'Second Article', 'content', '1', 'second-article', 1, now - 1000, now - 1000);
    db.prepare(`
      INSERT INTO articles (id, title, content, author_uid, url_name, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('id-newest', 'Third Article', 'content', '1', 'third-article', 1, now, now);

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    // Most recently created should come first
    const ids = result.articles.map((a) => a.id);
    expect(ids[0]).toBe('id-newest');
    expect(ids[ids.length - 1]).toBe('id-oldest');
  });

  it('includes author information with each article', () => {
    makeArticle({ title: 'Article With Author', authorUid: '1' });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles[0].author).toBeDefined();
    expect(result.articles[0].author?.username).toBe('alice');
  });

  it('includes category information with each article', () => {
    const cat = categoryService.createCategory('Technology');
    makeArticle({ title: 'Tech Article', categories: [cat.id] });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles[0].categories).toHaveLength(1);
    expect(result.articles[0].categories?.[0].name).toBe('Technology');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Search functionality — Requirements 2.2, 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Plaza page — search functionality (Requirements: 2.2, 2.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    searchService = new SearchService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  const defaultSearchOptions: SearchOptions = {
    page: 1,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'content'],
    caseSensitive: false,
  };

  it('returns articles whose title matches the regex', async () => {
    const a1 = makeArticle({ title: 'JavaScript Tutorial', content: 'Intro to JS' });
    makeArticle({ title: 'Python Guide', content: 'Intro to Python' });

    const result = await searchService.searchArticles('JavaScript', defaultSearchOptions);

    expect(result.total).toBe(1);
    expect(result.articles[0].article.id).toBe(a1.id);
  });

  it('returns articles whose content matches the regex', async () => {
    const a1 = makeArticle({ title: 'Article One', content: 'Contains the keyword regex' });
    makeArticle({ title: 'Article Two', content: 'No matching text here' });

    const result = await searchService.searchArticles('keyword', defaultSearchOptions);

    expect(result.total).toBe(1);
    expect(result.articles[0].article.id).toBe(a1.id);
  });

  it('returns all articles matching an alternation pattern (cat|dog)', async () => {
    const a1 = makeArticle({ title: 'Cat Care', content: 'About cats' });
    const a2 = makeArticle({ title: 'Dog Training', content: 'About dogs' });
    makeArticle({ title: 'Bird Watching', content: 'About birds' });

    const result = await searchService.searchArticles('cat|dog', defaultSearchOptions);

    expect(result.total).toBe(2);
    const ids = result.articles.map((h) => h.article.id);
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
  });

  it('returns articles matching a digit pattern (\\d+)', async () => {
    const a1 = makeArticle({ title: 'Version 2.0', content: 'Release notes' });
    makeArticle({ title: 'Getting Started', content: 'No numbers here' });

    const result = await searchService.searchArticles('\\d+', defaultSearchOptions);

    expect(result.total).toBe(1);
    expect(result.articles[0].article.id).toBe(a1.id);
  });

  it('returns articles matching a character class pattern ([a-z]+)', async () => {
    // All articles with lowercase letters in content will match
    makeArticle({ title: 'Article', content: 'lowercase content' });

    const result = await searchService.searchArticles('[a-z]+', {
      ...defaultSearchOptions,
      searchFields: ['content'],
    });

    expect(result.total).toBeGreaterThan(0);
  });

  it('performs case-insensitive search by default', async () => {
    const a1 = makeArticle({ title: 'JavaScript Guide', content: 'Learn JS' });
    const a2 = makeArticle({ title: 'javascript basics', content: 'Learn js' });

    const result = await searchService.searchArticles('javascript', {
      ...defaultSearchOptions,
      caseSensitive: false,
    });

    expect(result.total).toBe(2);
    const ids = result.articles.map((h) => h.article.id);
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
  });

  it('performs case-sensitive search when requested', async () => {
    const a1 = makeArticle({ title: 'JavaScript Guide', content: 'Learn JS' });
    makeArticle({ title: 'javascript basics', content: 'Learn js' });

    const result = await searchService.searchArticles('JavaScript', {
      ...defaultSearchOptions,
      caseSensitive: true,
    });

    expect(result.total).toBe(1);
    expect(result.articles[0].article.id).toBe(a1.id);
  });

  it('only returns published articles in search results', async () => {
    makeArticle({ title: 'Published JS Article', content: 'JavaScript content', published: true });
    makeArticle({ title: 'Draft JS Article', content: 'JavaScript draft', published: false });

    const result = await searchService.searchArticles('JavaScript', defaultSearchOptions);

    expect(result.total).toBe(1);
    expect(result.articles[0].article.published).toBe(true);
  });

  it('returns empty results when no articles match the pattern', async () => {
    makeArticle({ title: 'Article One', content: 'Some content' });

    const result = await searchService.searchArticles('xyznonexistent', defaultSearchOptions);

    expect(result.total).toBe(0);
    expect(result.articles).toHaveLength(0);
  });

  it('includes match snippets in search results', async () => {
    makeArticle({ title: 'Test Article', content: 'This is test content for searching' });

    const result = await searchService.searchArticles('test', defaultSearchOptions);

    expect(result.articles.length).toBeGreaterThan(0);
    const hit = result.articles[0];
    expect(hit.matches.length).toBeGreaterThan(0);
    expect(hit.matches[0]).toHaveProperty('field');
    expect(hit.matches[0]).toHaveProperty('snippet');
  });

  it('includes highlighted text in match snippets', async () => {
    makeArticle({ title: 'Highlight Test', content: 'Content with highlight word' });

    const result = await searchService.searchArticles('highlight', defaultSearchOptions);

    expect(result.articles.length).toBeGreaterThan(0);
    const snippet = result.articles[0].matches[0].snippet;
    expect(snippet).toContain('<mark>');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Category filtering — Requirement 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Plaza page — category filtering (Requirements: 2.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    searchService = new SearchService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('filters articles by a single category in browse mode', () => {
    const tech = categoryService.createCategory('Technology');
    const science = categoryService.createCategory('Science');

    makeArticle({ title: 'Tech Article', categories: [tech.id] });
    makeArticle({ title: 'Science Article', categories: [science.id] });
    makeArticle({ title: 'Tech and Science', categories: [tech.id, science.id] });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      categories: [tech.id],
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(2);
    expect(result.articles.every((a) => a.categories?.some((c) => c.id === tech.id))).toBe(true);
  });

  it('returns all published articles when no category filter is applied', () => {
    const tech = categoryService.createCategory('Technology');
    makeArticle({ title: 'Tech Article', categories: [tech.id] });
    makeArticle({ title: 'Uncategorised Article', categories: [] });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(2);
  });

  it('returns empty list when no articles belong to the filtered category', () => {
    const tech = categoryService.createCategory('Technology');
    const art = categoryService.createCategory('Art');

    makeArticle({ title: 'Tech Article', categories: [tech.id] });

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      categories: [art.id],
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('filters search results by category', async () => {
    const tech = categoryService.createCategory('Technology');
    const science = categoryService.createCategory('Science');

    const a1 = makeArticle({ title: 'JavaScript Tutorial', categories: [tech.id] });
    makeArticle({ title: 'JavaScript in Science', categories: [science.id] });

    const result = await searchService.searchArticles('JavaScript', {
      page: 1,
      pageSize: PAGE_SIZE,
      searchFields: ['title', 'content'],
      caseSensitive: false,
      categories: [tech.id],
    });

    expect(result.total).toBe(1);
    expect(result.articles[0].article.id).toBe(a1.id);
  });

  it('getAllCategories returns all available categories for the filter UI', () => {
    categoryService.createCategory('Technology');
    categoryService.createCategory('Science');
    categoryService.createCategory('Art');

    const categories = categoryService.getAllCategories();

    expect(categories).toHaveLength(3);
    const names = categories.map((c) => c.name);
    expect(names).toContain('Technology');
    expect(names).toContain('Science');
    expect(names).toContain('Art');
  });

  it('getAllCategories returns empty array when no categories exist', () => {
    const categories = categoryService.getAllCategories();
    expect(categories).toHaveLength(0);
  });

  it('category articleCount reflects published and unpublished articles', () => {
    const tech = categoryService.createCategory('Technology');
    makeArticle({ title: 'Tech 1', categories: [tech.id], published: true });
    makeArticle({ title: 'Tech 2', categories: [tech.id], published: false });

    const categories = categoryService.getAllCategories();
    const techCat = categories.find((c) => c.id === tech.id);

    // articleCount counts all associations regardless of published status
    expect(techCat?.articleCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pagination — Requirement 2.1
// ─────────────────────────────────────────────────────────────────────────────

describe('Plaza page — pagination (Requirements: 2.1)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    searchService = new SearchService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('returns correct page size for the first page', () => {
    for (let i = 1; i <= 15; i++) {
      makeArticle({ title: `Article ${i}` });
    }

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(PAGE_SIZE);
    expect(result.total).toBe(15);
    expect(result.totalPages).toBe(2);
  });

  it('returns remaining articles on the last page', () => {
    for (let i = 1; i <= 15; i++) {
      makeArticle({ title: `Article ${i}` });
    }

    const result = articleService.listArticles({
      page: 2,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(3); // 15 - 12 = 3
    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
  });

  it('returns non-overlapping articles across pages', () => {
    for (let i = 1; i <= 24; i++) {
      makeArticle({ title: `Article ${i}` });
    }

    const page1 = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const page2 = articleService.listArticles({
      page: 2,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const page1Ids = new Set(page1.articles.map((a) => a.id));
    const page2Ids = page2.articles.map((a) => a.id);

    // No article should appear on both pages
    expect(page2Ids.every((id) => !page1Ids.has(id))).toBe(true);
  });

  it('returns correct totalPages calculation', () => {
    for (let i = 1; i <= 25; i++) {
      makeArticle({ title: `Article ${i}` });
    }

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    // ceil(25 / 12) = 3
    expect(result.totalPages).toBe(3);
  });

  it('returns totalPages of 1 when articles fit on a single page', () => {
    for (let i = 1; i <= 5; i++) {
      makeArticle({ title: `Article ${i}` });
    }

    const result = articleService.listArticles({
      page: 1,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.totalPages).toBe(1);
  });

  it('returns empty articles array for a page beyond totalPages', () => {
    for (let i = 1; i <= 5; i++) {
      makeArticle({ title: `Article ${i}` });
    }

    const result = articleService.listArticles({
      page: 99,
      pageSize: PAGE_SIZE,
      published: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.articles).toHaveLength(0);
    expect(result.total).toBe(5);
  });

  it('paginates search results correctly', async () => {
    for (let i = 1; i <= 20; i++) {
      makeArticle({ title: `Search Article ${i}`, content: 'searchable content' });
    }

    const page1 = await searchService.searchArticles('searchable', {
      page: 1,
      pageSize: PAGE_SIZE,
      searchFields: ['content'],
      caseSensitive: false,
    });

    const page2 = await searchService.searchArticles('searchable', {
      page: 2,
      pageSize: PAGE_SIZE,
      searchFields: ['content'],
      caseSensitive: false,
    });

    expect(page1.total).toBe(20);
    expect(page1.articles).toHaveLength(PAGE_SIZE);
    expect(page2.articles).toHaveLength(8); // 20 - 12 = 8

    const page1Ids = new Set(page1.articles.map((h) => h.article.id));
    const page2Ids = page2.articles.map((h) => h.article.id);
    expect(page2Ids.every((id) => !page1Ids.has(id))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Error handling — invalid regex — Requirement 2.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Plaza page — error handling for invalid regex (Requirements: 2.4)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    searchService = new SearchService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('throws SearchError for an unterminated character class', async () => {
    await expect(
      searchService.searchArticles('[abc', {
        page: 1,
        pageSize: PAGE_SIZE,
        searchFields: ['title', 'content'],
        caseSensitive: false,
      })
    ).rejects.toThrow(SearchError);
  });

  it('throws SearchError for an unterminated group', async () => {
    await expect(
      searchService.searchArticles('(abc', {
        page: 1,
        pageSize: PAGE_SIZE,
        searchFields: ['title', 'content'],
        caseSensitive: false,
      })
    ).rejects.toThrow(SearchError);
  });

  it('throws SearchError for an invalid quantifier range', async () => {
    await expect(
      searchService.searchArticles('a{5,2}', {
        page: 1,
        pageSize: PAGE_SIZE,
        searchFields: ['title', 'content'],
        caseSensitive: false,
      })
    ).rejects.toThrow(SearchError);
  });

  it('error message contains descriptive text about the invalid regex', async () => {
    try {
      await searchService.searchArticles('[invalid', {
        page: 1,
        pageSize: PAGE_SIZE,
        searchFields: ['title', 'content'],
        caseSensitive: false,
      });
      expect.fail('Should have thrown a SearchError');
    } catch (err) {
      expect(err).toBeInstanceOf(SearchError);
      const message = (err as SearchError).message;
      expect(message.length).toBeGreaterThan(0);
      // Should mention "Invalid regular expression" or similar
      expect(message.toLowerCase()).toMatch(/invalid|regex|regular expression/);
    }
  });

  it('plaza page catches the error and sets searchError string (simulated)', async () => {
    // Simulate the plaza.astro error-handling block:
    //   try { ... } catch (err) { searchError = err?.message ?? '搜索出错'; }
    let searchError = '';
    let articles: unknown[] = [];

    try {
      const result = await searchService.searchArticles('[bad regex', {
        page: 1,
        pageSize: PAGE_SIZE,
        searchFields: ['title', 'content'],
        caseSensitive: false,
      });
      articles = result.articles;
    } catch (err: unknown) {
      searchError = (err as Error)?.message ?? '搜索出错';
      articles = [];
    }

    expect(searchError).toBeTruthy();
    expect(searchError.length).toBeGreaterThan(0);
    expect(articles).toHaveLength(0);
  });

  it('does not throw for a valid but unusual regex pattern', async () => {
    makeArticle({ title: 'Test Article', content: 'Some content' });

    await expect(
      searchService.searchArticles('(?=.*test)', {
        page: 1,
        pageSize: PAGE_SIZE,
        searchFields: ['title', 'content'],
        caseSensitive: false,
      })
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. URL helper functions (extracted from plaza.astro)
// ─────────────────────────────────────────────────────────────────────────────

describe('Plaza page — URL helper functions', () => {
  describe('buildUrl', () => {
    it('returns /plaza for page 1 with no filters', () => {
      expect(buildUrl(1, '', '')).toBe('/plaza');
    });

    it('includes page param for pages > 1', () => {
      expect(buildUrl(2, '', '')).toBe('/plaza?page=2');
    });

    it('includes search query param', () => {
      expect(buildUrl(1, 'javascript', '')).toBe('/plaza?q=javascript');
    });

    it('includes category param', () => {
      expect(buildUrl(1, '', 'cat-id-123')).toBe('/plaza?category=cat-id-123');
    });

    it('includes all params together', () => {
      const url = buildUrl(3, 'test', 'cat-1');
      expect(url).toContain('q=test');
      expect(url).toContain('category=cat-1');
      expect(url).toContain('page=3');
    });

    it('does not include page param for page 1', () => {
      const url = buildUrl(1, 'test', 'cat-1');
      expect(url).not.toContain('page=');
    });
  });

  describe('parsePage', () => {
    it('returns 1 for null input', () => {
      expect(parsePage(null)).toBe(1);
    });

    it('returns 1 for non-numeric input', () => {
      expect(parsePage('abc')).toBe(1);
    });

    it('returns 1 for zero', () => {
      expect(parsePage('0')).toBe(1);
    });

    it('returns 1 for negative numbers', () => {
      expect(parsePage('-5')).toBe(1);
    });

    it('returns the parsed page number for valid input', () => {
      expect(parsePage('3')).toBe(3);
    });

    it('returns 1 for empty string', () => {
      expect(parsePage('')).toBe(1);
    });
  });
});
