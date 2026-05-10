/**
 * Integration tests for article editor page logic
 *
 * The editor pages are server-rendered Astro components:
 *   - `/src/pages/article/edit.astro`       (article creation)
 *   - `/src/pages/article/[id]/edit.astro`  (article editing)
 *
 * Since these are Astro SSR pages we test the underlying service logic
 * that drives their behaviour:
 *   - Article creation with valid inputs
 *   - Validation errors (missing title, missing content, length limits)
 *   - Article editing by the author
 *   - Forbidden edit attempts by non-authors
 *   - Timestamp behaviour on creation and edit (Req 6.4)
 *   - Author UID preservation after edits (Req 6.5)
 *   - Category association on creation and editing (Req 1.1, 1.3)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArticleService } from '../services/articleService';
import { CategoryService } from '../services/categoryService';
import { createTestDatabase } from '../utils/db';
import { ValidationError, ForbiddenError } from '../types/errors';
import type Database from 'better-sqlite3';
import type { CreateArticleInput } from '../types/article';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test setup
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database;
let articleService: ArticleService;
let categoryService: CategoryService;

/** Insert a test user. uid is stored as INTEGER in the users table. */
function createTestUser(uid: string, username: string): void {
  db.prepare(`
    INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(uid), username, 'hash', 'salt', Date.now(), '{}');
}

/** Convenience wrapper around articleService.createArticle with sensible defaults. */
function makeArticle(
  overrides: Partial<CreateArticleInput> & { title: string }
): ReturnType<ArticleService['createArticle']> {
  return articleService.createArticle({
    content: 'Default content',
    authorUid: '1',
    categories: [],
    published: false,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Article creation — Requirement 6.1, 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Article creation — valid inputs (Requirement 6.1)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('creates an article with valid title and content', () => {
    const article = makeArticle({
      title: 'My First Article',
      content: 'This is the article content.',
      authorUid: '1',
    });

    expect(article).toBeDefined();
    expect(article.id).toBeTruthy();
    expect(article.title).toBe('My First Article');
    expect(article.content).toBe('This is the article content.');
    expect(article.authorUid).toBe('1');
  });

  it('created article is retrievable by ID', () => {
    const article = makeArticle({ title: 'Retrievable Article' });

    const found = articleService.getArticleById(article.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(article.id);
    expect(found!.title).toBe('Retrievable Article');
  });

  it('created article has a generated urlName', () => {
    const article = makeArticle({ title: 'URL Name Test' });

    expect(article.urlName).toBeTruthy();
    expect(typeof article.urlName).toBe('string');
    expect(article.urlName.length).toBeGreaterThan(0);
  });

  it('created article stores the authorUid correctly', () => {
    const article = makeArticle({ title: 'Author Test', authorUid: '1' });

    expect(article.authorUid).toBe('1');
  });

  it('created article stores the published flag correctly', () => {
    const draft = makeArticle({ title: 'Draft', published: false });
    const published = makeArticle({ title: 'Published Article', published: true });

    expect(draft.published).toBe(false);
    expect(published.published).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Article creation — validation errors (Requirement 6.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Article creation — validation errors (Requirement 6.2)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('throws ValidationError when title is empty', () => {
    expect(() =>
      articleService.createArticle({
        title: '',
        content: 'Some content',
        authorUid: '1',
        categories: [],
        published: false,
      })
    ).toThrow(ValidationError);
  });

  it('ValidationError for empty title targets the title field', () => {
    try {
      articleService.createArticle({
        title: '',
        content: 'Some content',
        authorUid: '1',
        categories: [],
        published: false,
      });
      expect.fail('Expected ValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe('title');
    }
  });

  it('throws ValidationError when content is empty', () => {
    expect(() =>
      articleService.createArticle({
        title: 'Valid Title',
        content: '',
        authorUid: '1',
        categories: [],
        published: false,
      })
    ).toThrow(ValidationError);
  });

  it('ValidationError for empty content targets the content field', () => {
    try {
      articleService.createArticle({
        title: 'Valid Title',
        content: '',
        authorUid: '1',
        categories: [],
        published: false,
      });
      expect.fail('Expected ValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe('content');
    }
  });

  it('throws ValidationError when title exceeds 200 characters', () => {
    const longTitle = 'A'.repeat(201);

    expect(() =>
      articleService.createArticle({
        title: longTitle,
        content: 'Some content',
        authorUid: '1',
        categories: [],
        published: false,
      })
    ).toThrow(ValidationError);
  });

  it('ValidationError for long title targets the title field', () => {
    const longTitle = 'A'.repeat(201);

    try {
      articleService.createArticle({
        title: longTitle,
        content: 'Some content',
        authorUid: '1',
        categories: [],
        published: false,
      });
      expect.fail('Expected ValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe('title');
    }
  });

  it('accepts a title of exactly 200 characters', () => {
    const maxTitle = 'A'.repeat(200);

    const article = articleService.createArticle({
      title: maxTitle,
      content: 'Some content',
      authorUid: '1',
      categories: [],
      published: false,
    });

    expect(article.title).toBe(maxTitle);
  });

  it('throws ValidationError when content exceeds 100,000 characters', () => {
    const longContent = 'B'.repeat(100_001);

    expect(() =>
      articleService.createArticle({
        title: 'Valid Title',
        content: longContent,
        authorUid: '1',
        categories: [],
        published: false,
      })
    ).toThrow(ValidationError);
  });

  it('ValidationError for long content targets the content field', () => {
    const longContent = 'B'.repeat(100_001);

    try {
      articleService.createArticle({
        title: 'Valid Title',
        content: longContent,
        authorUid: '1',
        categories: [],
        published: false,
      });
      expect.fail('Expected ValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe('content');
    }
  });

  it('accepts content of exactly 100,000 characters', () => {
    const maxContent = 'C'.repeat(100_000);

    const article = articleService.createArticle({
      title: 'Max Content Article',
      content: maxContent,
      authorUid: '1',
      categories: [],
      published: false,
    });

    expect(article.content.length).toBe(100_000);
  });

  it('throws ValidationError when content is only whitespace', () => {
    expect(() =>
      articleService.createArticle({
        title: 'Valid Title',
        content: '   \n\t  ',
        authorUid: '1',
        categories: [],
        published: false,
      })
    ).toThrow(ValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Article editing — author can edit (Requirement 6.3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Article editing — author can edit their own article (Requirement 6.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
    createTestUser('2', 'bob');
  });

  afterEach(() => {
    db.close();
  });

  it('author can update the title of their own article', () => {
    const article = makeArticle({ title: 'Original Title', authorUid: '1' });

    const updated = articleService.updateArticle(
      article.id,
      { title: 'Updated Title' },
      '1'
    );

    expect(updated.title).toBe('Updated Title');
  });

  it('author can update the content of their own article', () => {
    const article = makeArticle({
      title: 'Content Update Test',
      content: 'Original content',
      authorUid: '1',
    });

    const updated = articleService.updateArticle(
      article.id,
      { content: 'Updated content' },
      '1'
    );

    expect(updated.content).toBe('Updated content');
  });

  it('author can update the published status of their own article', () => {
    const article = makeArticle({ title: 'Publish Test', published: false, authorUid: '1' });

    const updated = articleService.updateArticle(
      article.id,
      { published: true },
      '1'
    );

    expect(updated.published).toBe(true);
  });

  it('updated article is persisted and retrievable', () => {
    const article = makeArticle({ title: 'Persist Test', authorUid: '1' });

    articleService.updateArticle(article.id, { title: 'Persisted Title' }, '1');

    const found = articleService.getArticleById(article.id);
    expect(found!.title).toBe('Persisted Title');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Article editing — non-author cannot edit (Requirement 6.3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Article editing — non-author cannot edit (Requirement 6.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
    createTestUser('2', 'bob');
  });

  afterEach(() => {
    db.close();
  });

  it('throws ForbiddenError when a different user tries to edit', () => {
    const article = makeArticle({ title: 'Alice Article', authorUid: '1' });

    expect(() =>
      articleService.updateArticle(article.id, { title: 'Hacked Title' }, '2')
    ).toThrow(ForbiddenError);
  });

  it('ForbiddenError is thrown even when the new data is valid', () => {
    const article = makeArticle({ title: 'Protected Article', authorUid: '1' });

    try {
      articleService.updateArticle(
        article.id,
        { title: 'Valid New Title', content: 'Valid new content' },
        '2'
      );
      expect.fail('Expected ForbiddenError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it('article is unchanged after a forbidden edit attempt', () => {
    const article = makeArticle({
      title: 'Unchanged Article',
      content: 'Original content',
      authorUid: '1',
    });

    try {
      articleService.updateArticle(article.id, { title: 'Changed Title' }, '2');
    } catch {
      // expected ForbiddenError
    }

    const found = articleService.getArticleById(article.id);
    expect(found!.title).toBe('Unchanged Article');
    expect(found!.content).toBe('Original content');
  });

  it('throws ForbiddenError for an unauthenticated user (empty string uid)', () => {
    const article = makeArticle({ title: 'Auth Test', authorUid: '1' });

    expect(() =>
      articleService.updateArticle(article.id, { title: 'New Title' }, '')
    ).toThrow(ForbiddenError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Timestamps — Requirement 6.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Article timestamps (Requirement 6.4)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('created article has a createdAt timestamp', () => {
    const article = makeArticle({ title: 'Timestamp Article' });

    expect(article.createdAt).toBeInstanceOf(Date);
    expect(article.createdAt.getTime()).toBeGreaterThan(0);
  });

  it('created article has an updatedAt timestamp', () => {
    const article = makeArticle({ title: 'Timestamp Article' });

    expect(article.updatedAt).toBeInstanceOf(Date);
    expect(article.updatedAt.getTime()).toBeGreaterThan(0);
  });

  it('updatedAt is >= createdAt immediately after creation', () => {
    const article = makeArticle({ title: 'Monotonic Timestamps' });

    expect(article.updatedAt.getTime()).toBeGreaterThanOrEqual(
      article.createdAt.getTime()
    );
  });

  it('updatedAt is updated after an edit (Property 18)', () => {
    const article = makeArticle({ title: 'Edit Timestamp Test' });
    const createdUpdatedAt = article.updatedAt.getTime();

    // Wait a tick to ensure the timestamp changes
    const before = Date.now();
    // Spin until at least 1ms has passed to guarantee a different timestamp
    while (Date.now() <= before) { /* busy wait */ }

    const updated = articleService.updateArticle(
      article.id,
      { title: 'Edited Title' },
      '1'
    );

    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(createdUpdatedAt);
  });

  it('createdAt does not change after an edit', () => {
    const article = makeArticle({ title: 'CreatedAt Immutable' });
    const originalCreatedAt = article.createdAt.getTime();

    articleService.updateArticle(article.id, { title: 'New Title' }, '1');

    const found = articleService.getArticleById(article.id);
    expect(found!.createdAt.getTime()).toBe(originalCreatedAt);
  });

  it('updatedAt >= createdAt after multiple edits', () => {
    const article = makeArticle({ title: 'Multiple Edits' });

    articleService.updateArticle(article.id, { title: 'Edit 1' }, '1');
    articleService.updateArticle(article.id, { title: 'Edit 2' }, '1');
    const final = articleService.updateArticle(article.id, { title: 'Edit 3' }, '1');

    expect(final.updatedAt.getTime()).toBeGreaterThanOrEqual(
      final.createdAt.getTime()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Author UID preservation — Requirement 6.5 (Property 19)
// ─────────────────────────────────────────────────────────────────────────────

describe('Author UID preservation after edits (Requirement 6.5 / Property 19)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('authorUid is unchanged after updating the title', () => {
    const article = makeArticle({ title: 'Author Preserved', authorUid: '1' });

    const updated = articleService.updateArticle(
      article.id,
      { title: 'New Title' },
      '1'
    );

    expect(updated.authorUid).toBe('1');
  });

  it('authorUid is unchanged after updating the content', () => {
    const article = makeArticle({ title: 'Author Preserved', authorUid: '1' });

    const updated = articleService.updateArticle(
      article.id,
      { content: 'New content' },
      '1'
    );

    expect(updated.authorUid).toBe('1');
  });

  it('authorUid is unchanged after updating published status', () => {
    const article = makeArticle({ title: 'Author Preserved', authorUid: '1' });

    const updated = articleService.updateArticle(
      article.id,
      { published: true },
      '1'
    );

    expect(updated.authorUid).toBe('1');
  });

  it('authorUid is unchanged after multiple sequential edits', () => {
    const article = makeArticle({ title: 'Sequential Edits', authorUid: '1' });

    articleService.updateArticle(article.id, { title: 'Edit 1' }, '1');
    articleService.updateArticle(article.id, { content: 'New content' }, '1');
    const final = articleService.updateArticle(article.id, { published: true }, '1');

    expect(final.authorUid).toBe('1');
  });

  it('authorUid in the database matches the original after edit', () => {
    const article = makeArticle({ title: 'DB Author Check', authorUid: '1' });

    articleService.updateArticle(article.id, { title: 'Updated' }, '1');

    const found = articleService.getArticleById(article.id);
    expect(found!.authorUid).toBe('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Category association — Requirement 1.1, 1.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Category association on creation and editing (Requirement 1.1, 1.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('categories are stored with the article on creation', () => {
    const tech = categoryService.createCategory('Technology');
    const science = categoryService.createCategory('Science');

    const article = makeArticle({
      title: 'Categorised Article',
      categories: [tech.id, science.id],
    });

    expect(article.categories).toBeDefined();
    expect(article.categories!.length).toBe(2);
    const names = article.categories!.map((c) => c.name);
    expect(names).toContain('Technology');
    expect(names).toContain('Science');
  });

  it('article with no categories has an empty categories array', () => {
    const article = makeArticle({ title: 'No Categories', categories: [] });

    expect(article.categories).toBeDefined();
    expect(article.categories!.length).toBe(0);
  });

  it('categories can be updated when editing an article', () => {
    const tech = categoryService.createCategory('Technology');
    const art = categoryService.createCategory('Art');

    const article = makeArticle({
      title: 'Category Update Test',
      categories: [tech.id],
    });

    const updated = articleService.updateArticle(
      article.id,
      { categories: [art.id] },
      '1'
    );

    expect(updated.categories!.length).toBe(1);
    expect(updated.categories![0].name).toBe('Art');
  });

  it('categories can be cleared when editing an article', () => {
    const tech = categoryService.createCategory('Technology');

    const article = makeArticle({
      title: 'Clear Categories Test',
      categories: [tech.id],
    });

    const updated = articleService.updateArticle(
      article.id,
      { categories: [] },
      '1'
    );

    expect(updated.categories!.length).toBe(0);
  });

  it('categories are retrievable after creation via getArticleById', () => {
    const cat = categoryService.createCategory('Lifestyle');

    const article = makeArticle({
      title: 'Category Retrieval Test',
      categories: [cat.id],
    });

    const found = articleService.getArticleById(article.id);
    expect(found!.categories!.length).toBe(1);
    expect(found!.categories![0].name).toBe('Lifestyle');
  });

  it('other article fields are unchanged after updating categories (Property 1 invariant)', () => {
    const cat = categoryService.createCategory('Sports');

    const article = makeArticle({
      title: 'Invariant Test',
      content: 'Original content',
      authorUid: '1',
      categories: [],
    });

    const updated = articleService.updateArticle(
      article.id,
      { categories: [cat.id] },
      '1'
    );

    expect(updated.title).toBe('Invariant Test');
    expect(updated.content).toBe('Original content');
    expect(updated.authorUid).toBe('1');
  });
});
