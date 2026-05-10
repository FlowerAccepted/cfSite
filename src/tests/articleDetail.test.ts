/**
 * Integration tests for article detail page logic
 *
 * The article detail page is a server-rendered Astro component at
 * `/src/pages/a/[uid]/[name].astro`. We test the underlying service logic
 * and helper functions that drive the page's behaviour:
 *   - Article retrieval by URL (uid + name)
 *   - 404 handling for non-existent articles
 *   - Access control (published vs unpublished)
 *   - External URL storage and retrieval
 *   - Article data completeness (title, author, categories, timestamps)
 *
 * Requirements: 3.4, 3.5, 5.3, 7.2, 7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArticleService } from '../services/articleService';
import { CategoryService } from '../services/categoryService';
import { createTestDatabase } from '../utils/db';
import type Database from 'better-sqlite3';
import type { CreateArticleInput } from '../types/article';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers mirrored from [name].astro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the access-control logic in [name].astro:
 *   if (!articleService.canAccessArticle(article, currentUserUid)) article = null;
 */
function resolveArticleAccess(
  articleService: ArticleService,
  uid: string,
  name: string,
  currentUserUid?: string
) {
  const article = articleService.getArticleByUrl(uid, name);
  if (!article) return null;
  if (!articleService.canAccessArticle(article, currentUserUid)) return null;
  return article;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test setup
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database;
let articleService: ArticleService;
let categoryService: CategoryService;

// uid is INTEGER in the users table — use numeric strings ('1', '2') that SQLite coerces
function createTestUser(uid: string, username: string): void {
  db.prepare(`
    INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(uid), username, 'hash', 'salt', Date.now(), '{}');
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
// 1. Article retrieval by URL — Requirement 3.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Article detail — retrieval by URL (Requirement 3.4)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('retrieves a published article by uid and url name', () => {
    const created = makeArticle({ title: 'Hello World', authorUid: '1' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.title).toBe('Hello World');
  });

  it('returns null when uid does not match any article', () => {
    const created = makeArticle({ title: 'My Article', authorUid: '1' });

    const found = articleService.getArticleByUrl('999', created.urlName);

    expect(found).toBeNull();
  });

  it('returns null when url name does not match any article', () => {
    makeArticle({ title: 'My Article', authorUid: '1' });

    const found = articleService.getArticleByUrl('1', 'nonexistent-name');

    expect(found).toBeNull();
  });

  it('returns null when both uid and name are wrong', () => {
    makeArticle({ title: 'My Article', authorUid: '1' });

    const found = articleService.getArticleByUrl('999', 'wrong-name');

    expect(found).toBeNull();
  });

  it('retrieves the correct article when multiple articles exist', () => {
    const a1 = makeArticle({ title: 'First Article', authorUid: '1' });
    const a2 = makeArticle({ title: 'Second Article', authorUid: '1' });

    const found1 = articleService.getArticleByUrl('1', a1.urlName);
    const found2 = articleService.getArticleByUrl('1', a2.urlName);

    expect(found1!.id).toBe(a1.id);
    expect(found2!.id).toBe(a2.id);
  });

  it('URL round-trip: article URL retrieves the same article (Property 8)', () => {
    const created = makeArticle({ title: 'Round Trip Test', authorUid: '1' });

    // Simulate the URL format /a/<uid>/<name>
    const uid = created.authorUid;
    const name = created.urlName;
    const retrieved = articleService.getArticleByUrl(uid, name);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.title).toBe(created.title);
    expect(retrieved!.content).toBe(created.content);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 404 handling — Requirement 3.5
// ─────────────────────────────────────────────────────────────────────────────

describe('Article detail — 404 handling (Requirement 3.5)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('returns null (→ 404) when no articles exist', () => {
    const found = articleService.getArticleByUrl('1', 'any-name');
    expect(found).toBeNull();
  });

  it('returns null (→ 404) for a non-existent uid', () => {
    makeArticle({ title: 'Existing Article', authorUid: '1' });

    const found = articleService.getArticleByUrl('999', 'existing-article');
    expect(found).toBeNull();
  });

  it('returns null (→ 404) for a non-existent url name', () => {
    makeArticle({ title: 'Existing Article', authorUid: '1' });

    const found = articleService.getArticleByUrl('1', 'does-not-exist');
    expect(found).toBeNull();
  });

  it('page logic returns null when article is not found (simulated 404)', () => {
    // Simulate the [name].astro logic: if (!article) return Astro.redirect('/404', 404)
    const article = articleService.getArticleByUrl('1', 'missing-article');
    const shouldReturn404 = article === null;

    expect(shouldReturn404).toBe(true);
  });

  it('page logic returns null when access is denied (simulated 404 for unpublished)', () => {
    const created = makeArticle({
      title: 'Draft Article',
      authorUid: '1',
      published: false,
    });

    // Non-author tries to access → resolves to null → 404
    const result = resolveArticleAccess(articleService, '1', created.urlName, '2');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Access control — Requirement 7.5
// ─────────────────────────────────────────────────────────────────────────────

describe('Article detail — access control (Requirement 7.5)', () => {
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

  it('published article is accessible to unauthenticated users', () => {
    const created = makeArticle({
      title: 'Public Article',
      authorUid: '1',
      published: true,
    });

    const result = resolveArticleAccess(articleService, '1', created.urlName, undefined);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(created.id);
  });

  it('published article is accessible to any authenticated user', () => {
    const created = makeArticle({
      title: 'Public Article',
      authorUid: '1',
      published: true,
    });

    const result = resolveArticleAccess(articleService, '1', created.urlName, '2');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(created.id);
  });

  it('published article is accessible to the author', () => {
    const created = makeArticle({
      title: 'My Published Article',
      authorUid: '1',
      published: true,
    });

    const result = resolveArticleAccess(articleService, '1', created.urlName, '1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(created.id);
  });

  it('unpublished article is NOT accessible to unauthenticated users', () => {
    const created = makeArticle({
      title: 'Draft Article',
      authorUid: '1',
      published: false,
    });

    const result = resolveArticleAccess(articleService, '1', created.urlName, undefined);

    expect(result).toBeNull();
  });

  it('unpublished article is NOT accessible to other authenticated users', () => {
    const created = makeArticle({
      title: 'Draft Article',
      authorUid: '1',
      published: false,
    });

    const result = resolveArticleAccess(articleService, '1', created.urlName, '2');

    expect(result).toBeNull();
  });

  it('unpublished article IS accessible to the author', () => {
    const created = makeArticle({
      title: 'My Draft',
      authorUid: '1',
      published: false,
    });

    const result = resolveArticleAccess(articleService, '1', created.urlName, '1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(created.id);
    expect(result!.published).toBe(false);
  });

  it('canAccessArticle returns true for published article regardless of user', () => {
    const created = makeArticle({ title: 'Public', published: true });

    expect(articleService.canAccessArticle(created, undefined)).toBe(true);
    expect(articleService.canAccessArticle(created, '2')).toBe(true);
    expect(articleService.canAccessArticle(created, '1')).toBe(true);
  });

  it('canAccessArticle returns false for unpublished article when user is not author', () => {
    const created = makeArticle({ title: 'Draft', published: false });

    expect(articleService.canAccessArticle(created, undefined)).toBe(false);
    expect(articleService.canAccessArticle(created, '2')).toBe(false);
    expect(articleService.canAccessArticle(created, '999')).toBe(false);
  });

  it('canAccessArticle returns true for unpublished article when user is the author', () => {
    const created = makeArticle({
      title: 'Draft',
      authorUid: '1',
      published: false,
    });

    expect(articleService.canAccessArticle(created, '1')).toBe(true);
  });

  it('access control is consistent: published status change affects access', () => {
    const created = makeArticle({
      title: 'Toggled Article',
      authorUid: '1',
      published: false,
    });

    // Initially unpublished — non-author cannot access
    const beforePublish = resolveArticleAccess(
      articleService,
      '1',
      created.urlName,
      '2'
    );
    expect(beforePublish).toBeNull();

    // Publish the article
    articleService.updateArticle(created.id, { published: true });

    // Now non-author can access
    const afterPublish = resolveArticleAccess(
      articleService,
      '1',
      created.urlName,
      '2'
    );
    expect(afterPublish).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Article data completeness — Requirement 7.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Article detail — data completeness (Requirement 7.2)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('retrieved article includes title', () => {
    const created = makeArticle({ title: 'My Detailed Article' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.title).toBe('My Detailed Article');
  });

  it('retrieved article includes content', () => {
    const created = makeArticle({
      title: 'Content Test',
      content: '# Heading\n\nSome **bold** content.',
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.content).toBe('# Heading\n\nSome **bold** content.');
  });

  it('retrieved article includes author information', () => {
    const created = makeArticle({ title: 'Author Test', authorUid: '1' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.authorUid).toBe('1');
    expect(found!.author).toBeDefined();
    expect(found!.author!.username).toBe('alice');
    expect(found!.author!.uid).toBe('1');
  });

  it('retrieved article includes categories', () => {
    const tech = categoryService.createCategory('Technology');
    const science = categoryService.createCategory('Science');
    const created = makeArticle({
      title: 'Categorised Article',
      categories: [tech.id, science.id],
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.categories).toBeDefined();
    expect(found!.categories!.length).toBe(2);
    const names = found!.categories!.map((c) => c.name);
    expect(names).toContain('Technology');
    expect(names).toContain('Science');
  });

  it('retrieved article includes createdAt timestamp', () => {
    const created = makeArticle({ title: 'Timestamp Test' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.createdAt).toBeInstanceOf(Date);
    expect(found!.createdAt.getTime()).toBeGreaterThan(0);
  });

  it('retrieved article includes updatedAt timestamp', () => {
    const created = makeArticle({ title: 'Timestamp Test' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.updatedAt).toBeInstanceOf(Date);
    expect(found!.updatedAt.getTime()).toBeGreaterThan(0);
  });

  it('updatedAt is >= createdAt (timestamp monotonicity)', () => {
    const created = makeArticle({ title: 'Monotonic Timestamps' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      found!.createdAt.getTime()
    );
  });

  it('retrieved article includes published status', () => {
    const published = makeArticle({ title: 'Published', published: true });
    const draft = makeArticle({ title: 'Draft Article', published: false });

    const foundPublished = articleService.getArticleByUrl('1', published.urlName);
    const foundDraft = articleService.getArticleByUrl('1', draft.urlName);

    expect(foundPublished!.published).toBe(true);
    expect(foundDraft!.published).toBe(false);
  });

  it('retrieved article includes urlName', () => {
    const created = makeArticle({ title: 'URL Name Test' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.urlName).toBe(created.urlName);
    expect(typeof found!.urlName).toBe('string');
    expect(found!.urlName.length).toBeGreaterThan(0);
  });

  it('article with no categories returns empty categories array', () => {
    const created = makeArticle({ title: 'No Categories', categories: [] });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.categories).toBeDefined();
    expect(found!.categories!.length).toBe(0);
  });

  it('article with no author in users table still returns authorUid', () => {
    // Insert article directly without a matching user (disable FK for this test)
    // We use a numeric author_uid that doesn't exist in users
    const now = Date.now();
    db.pragma('foreign_keys = OFF');
    db.prepare(`
      INSERT INTO articles (id, title, content, author_uid, url_name, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('orphan-id', 'Orphan Article', 'content', 9999, 'orphan-article', 1, now, now);
    db.pragma('foreign_keys = ON');

    const found = articleService.getArticleByUrl('9999', 'orphan-article');

    expect(found).not.toBeNull();
    expect(found!.authorUid).toBe('9999');
    // author may be undefined when user doesn't exist in users table
    // but authorUid must always be present
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. External URL storage and retrieval — Requirement 5.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Article detail — external URL (Requirement 5.3)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('stores and retrieves an external URL (Property 12)', () => {
    const externalUrl = 'https://example.com/article-content.md';
    const created = makeArticle({
      title: 'External Content Article',
      externalUrl,
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.externalUrl).toBe(externalUrl);
  });

  it('external URL is preserved exactly as stored', () => {
    const externalUrl = 'https://raw.githubusercontent.com/user/repo/main/article.md';
    const created = makeArticle({
      title: 'GitHub Article',
      externalUrl,
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.externalUrl).toBe(externalUrl);
  });

  it('article without external URL has undefined externalUrl', () => {
    const created = makeArticle({
      title: 'Local Content Article',
      // no externalUrl
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.externalUrl).toBeUndefined();
  });

  it('external URL can be updated via updateArticle', () => {
    const created = makeArticle({
      title: 'Updatable External Article',
      externalUrl: 'https://old-url.example.com/content.md',
    });

    const newUrl = 'https://new-url.example.com/content.md';
    articleService.updateArticle(created.id, { externalUrl: newUrl });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.externalUrl).toBe(newUrl);
  });

  it('external URL can be cleared by setting to empty string', () => {
    const created = makeArticle({
      title: 'Clear External URL',
      externalUrl: 'https://example.com/content.md',
    });

    articleService.updateArticle(created.id, { externalUrl: '' });

    const found = articleService.getArticleByUrl('1', created.urlName);

    // Empty string or undefined — either way, no external URL
    expect(!found!.externalUrl).toBe(true);
  });

  it('page logic detects external URL to use ExternalContentLoader (simulated)', () => {
    const created = makeArticle({
      title: 'External Article',
      externalUrl: 'https://example.com/content.md',
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    // Simulate the [name].astro logic:
    //   {article.externalUrl ? <ExternalContentLoader ... /> : <div set:html={renderedContent} />}
    const shouldUseExternalLoader = Boolean(found!.externalUrl);
    expect(shouldUseExternalLoader).toBe(true);
  });

  it('page logic uses inline content when no external URL (simulated)', () => {
    const created = makeArticle({
      title: 'Local Article',
      content: '# Local Content\n\nThis is local.',
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    const shouldUseExternalLoader = Boolean(found!.externalUrl);
    expect(shouldUseExternalLoader).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Various content types — Requirement 7.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Article detail — various content types (Requirement 7.2)', () => {
  beforeEach(() => {
    db = createTestDatabase();
    articleService = new ArticleService(db);
    categoryService = new CategoryService(db);
    createTestUser('1', 'alice');
  });

  afterEach(() => {
    db.close();
  });

  it('stores and retrieves plain text content', () => {
    const content = 'This is plain text content without any markdown.';
    const created = makeArticle({ title: 'Plain Text', content });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.content).toBe(content);
  });

  it('stores and retrieves Markdown content with headings', () => {
    const content = '# Heading 1\n\n## Heading 2\n\nSome paragraph text.';
    const created = makeArticle({ title: 'Markdown Article', content });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.content).toBe(content);
  });

  it('stores and retrieves Markdown content with code blocks', () => {
    const content = '```typescript\nconst x: number = 42;\nconsole.log(x);\n```';
    const created = makeArticle({ title: 'Code Article', content });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.content).toBe(content);
  });

  it('stores and retrieves content with Chinese characters', () => {
    const content = '# 中文标题\n\n这是一篇中文文章，包含各种内容。';
    const created = makeArticle({ title: 'Chinese Article', content });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.content).toBe(content);
  });

  it('stores and retrieves long content near the limit', () => {
    const content = 'A'.repeat(99_000);
    const created = makeArticle({ title: 'Long Article', content });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.content).toBe(content);
    expect(found!.content.length).toBe(99_000);
  });

  it('article with multiple categories displays all of them', () => {
    const cat1 = categoryService.createCategory('Frontend');
    const cat2 = categoryService.createCategory('Backend');
    const cat3 = categoryService.createCategory('DevOps');

    const created = makeArticle({
      title: 'Full Stack Article',
      categories: [cat1.id, cat2.id, cat3.id],
    });

    const found = articleService.getArticleByUrl('1', created.urlName);

    expect(found!.categories!.length).toBe(3);
    const names = found!.categories!.map((c) => c.name);
    expect(names).toContain('Frontend');
    expect(names).toContain('Backend');
    expect(names).toContain('DevOps');
  });
});
