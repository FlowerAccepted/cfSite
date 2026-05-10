/**
 * Example usage of ArticleService
 * 
 * This file demonstrates how to use the ArticleService to manage articles.
 */

import { ArticleService } from './articleService';
import { CategoryService } from './categoryService';
import { getDatabase } from '../utils/db';
import type { CreateArticleInput } from '../types/article';

// Get database instance
const db = getDatabase();

// Create service instances
const articleService = new ArticleService(db);
const categoryService = new CategoryService(db);

// ============================================================================
// Example 1: Create a simple article
// ============================================================================

const simpleArticle: CreateArticleInput = {
  title: 'Getting Started with TypeScript',
  content: '# Introduction\n\nTypeScript is a typed superset of JavaScript...',
  authorUid: '123',
  categories: [],
  published: false
};

const article1 = articleService.createArticle(simpleArticle);
console.log('Created article:', article1.id);
console.log('URL:', `/a/${article1.authorUid}/${article1.urlName}`);

// ============================================================================
// Example 2: Create an article with categories
// ============================================================================

// First, create some categories
const techCategory = categoryService.createCategory('Technology', 'Tech-related articles');
const programmingCategory = categoryService.createCategory('Programming', 'Programming tutorials');

const articleWithCategories: CreateArticleInput = {
  title: 'Advanced TypeScript Patterns',
  content: '# Advanced Patterns\n\nLet\'s explore some advanced TypeScript patterns...',
  authorUid: '123',
  categories: [techCategory.id, programmingCategory.id],
  published: true
};

const article2 = articleService.createArticle(articleWithCategories);
console.log('Created article with categories:', article2.id);
console.log('Categories:', article2.categories?.map(c => c.name).join(', '));

// ============================================================================
// Example 3: Create an article with external URL
// ============================================================================

const externalArticle: CreateArticleInput = {
  title: 'External Content Example',
  content: 'This article loads content from an external source.',
  authorUid: '123',
  categories: [],
  externalUrl: 'https://raw.githubusercontent.com/example/repo/main/article.md',
  published: true
};

const article3 = articleService.createArticle(externalArticle);
console.log('Created article with external URL:', article3.id);
console.log('External URL:', article3.externalUrl);

// ============================================================================
// Example 4: Retrieve an article by ID
// ============================================================================

const retrievedArticle = articleService.getArticleById(article1.id);
if (retrievedArticle) {
  console.log('Retrieved article:', retrievedArticle.title);
  console.log('Content length:', retrievedArticle.content.length);
}

// ============================================================================
// Example 5: Retrieve an article by URL parameters
// ============================================================================

const articleByUrl = articleService.getArticleByUrl('123', 'getting-started-with-typescript');
if (articleByUrl) {
  console.log('Found article by URL:', articleByUrl.title);
}

// ============================================================================
// Example 6: Update an article
// ============================================================================

const updatedArticle = articleService.updateArticle(article1.id, {
  title: 'Getting Started with TypeScript - Updated',
  published: true
});

console.log('Updated article:', updatedArticle.title);
console.log('Published:', updatedArticle.published);
console.log('Updated at:', updatedArticle.updatedAt);

// ============================================================================
// Example 7: List articles with pagination
// ============================================================================

const articleList = articleService.listArticles({
  page: 1,
  pageSize: 10,
  published: true,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

console.log(`Found ${articleList.total} published articles`);
console.log(`Page ${articleList.page} of ${articleList.totalPages}`);
articleList.articles.forEach(article => {
  console.log(`- ${article.title} (${article.urlName})`);
});

// ============================================================================
// Example 8: List articles by author
// ============================================================================

const authorArticles = articleService.listArticles({
  page: 1,
  pageSize: 10,
  authorUid: '123',
  sortBy: 'updatedAt',
  sortOrder: 'desc'
});

console.log(`Author has ${authorArticles.total} articles`);

// ============================================================================
// Example 9: List articles by category
// ============================================================================

const categoryArticles = articleService.listArticles({
  page: 1,
  pageSize: 10,
  categories: [techCategory.id],
  published: true
});

console.log(`Found ${categoryArticles.total} articles in Technology category`);

// ============================================================================
// Example 10: Check access control
// ============================================================================

// Published article - accessible to everyone
const publishedArticle = articleService.getArticleById(article2.id);
if (publishedArticle) {
  console.log('Anyone can access:', articleService.canAccessArticle(publishedArticle));
  console.log('Author can access:', articleService.canAccessArticle(publishedArticle, '123'));
  console.log('Other user can access:', articleService.canAccessArticle(publishedArticle, '456'));
}

// Unpublished article - only author can access
const unpublishedArticle = articleService.getArticleById(article1.id);
if (unpublishedArticle) {
  console.log('Anonymous can access:', articleService.canAccessArticle(unpublishedArticle));
  console.log('Author can access:', articleService.canAccessArticle(unpublishedArticle, '123'));
  console.log('Other user can access:', articleService.canAccessArticle(unpublishedArticle, '456'));
}

// ============================================================================
// Example 11: Delete an article
// ============================================================================

const deleted = articleService.deleteArticle(article3.id, '123');
console.log('Article deleted:', deleted);

// Try to delete with wrong author (will throw ForbiddenError)
try {
  articleService.deleteArticle(article1.id, '456');
} catch (error) {
  console.log('Cannot delete another user\'s article:', error.message);
}

// ============================================================================
// Example 12: Handle validation errors
// ============================================================================

try {
  const invalidArticle: CreateArticleInput = {
    title: '', // Empty title
    content: 'Content',
    authorUid: '123',
    categories: [],
    published: false
  };
  articleService.createArticle(invalidArticle);
} catch (error) {
  console.log('Validation error:', error.message);
}

try {
  const tooLongTitle: CreateArticleInput = {
    title: 'a'.repeat(201), // Title too long
    content: 'Content',
    authorUid: '123',
    categories: [],
    published: false
  };
  articleService.createArticle(tooLongTitle);
} catch (error) {
  console.log('Validation error:', error.message);
}

// ============================================================================
// Example 13: Handle duplicate URL names
// ============================================================================

try {
  // Create two articles with the same title for the same author
  const article1: CreateArticleInput = {
    title: 'Duplicate Title',
    content: 'Content 1',
    authorUid: '123',
    categories: [],
    published: false
  };
  
  const article2: CreateArticleInput = {
    title: 'Duplicate Title', // Same title, same author
    content: 'Content 2',
    authorUid: '123',
    categories: [],
    published: false
  };
  
  articleService.createArticle(article1);
  articleService.createArticle(article2); // Will throw ValidationError
} catch (error) {
  console.log('Duplicate URL name error:', error.message);
}

// ============================================================================
// Example 14: Articles with special characters in title
// ============================================================================

const specialCharsArticle: CreateArticleInput = {
  title: 'Hello@World! #TypeScript & JavaScript',
  content: 'Content',
  authorUid: '123',
  categories: [],
  published: false
};

const article4 = articleService.createArticle(specialCharsArticle);
console.log('Original title:', article4.title);
console.log('URL name:', article4.urlName); // "hello-world-typescript-javascript"

// ============================================================================
// Example 15: Articles with Chinese characters
// ============================================================================

const chineseArticle: CreateArticleInput = {
  title: '你好世界 Hello World',
  content: '这是一篇中文文章',
  authorUid: '123',
  categories: [],
  published: false
};

const article5 = articleService.createArticle(chineseArticle);
console.log('Original title:', article5.title);
console.log('URL name:', article5.urlName); // "hello-world" (Chinese chars removed)

// ============================================================================
// Example 16: Update article categories
// ============================================================================

const article6 = articleService.createArticle({
  title: 'Article to Update',
  content: 'Content',
  authorUid: '123',
  categories: [techCategory.id],
  published: false
});

console.log('Initial categories:', article6.categories?.map(c => c.name));

// Update categories
const updatedArticle6 = articleService.updateArticle(article6.id, {
  categories: [programmingCategory.id]
});

console.log('Updated categories:', updatedArticle6.categories?.map(c => c.name));

// ============================================================================
// Example 17: Timestamp behavior
// ============================================================================

const article7 = articleService.createArticle({
  title: 'Timestamp Test',
  content: 'Content',
  authorUid: '123',
  categories: [],
  published: false
});

console.log('Created at:', article7.createdAt);
console.log('Updated at:', article7.updatedAt);
console.log('Timestamps equal:', article7.createdAt.getTime() === article7.updatedAt.getTime());

// Wait a bit and update
setTimeout(() => {
  const updated = articleService.updateArticle(article7.id, {
    content: 'Updated content'
  });
  
  console.log('Created at (unchanged):', updated.createdAt);
  console.log('Updated at (changed):', updated.updatedAt);
  console.log('Updated at > Created at:', updated.updatedAt > updated.createdAt);
}, 100);
