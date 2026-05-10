/**
 * CategoryService Usage Examples
 * 
 * This file demonstrates how to use the CategoryService for managing
 * article categories and their associations.
 */

import { CategoryService } from './categoryService';
import { getDatabase, initializeDatabase } from '../utils/db';

// Initialize the database (run once on application startup)
initializeDatabase();

// Get database connection
const db = getDatabase();

// Create service instance
const categoryService = new CategoryService(db);

// ============================================================================
// Example 1: Create Categories
// ============================================================================

// Create a simple category
const techCategory = categoryService.createCategory('Technology');
console.log('Created category:', techCategory);
// Output: { id: '...', name: 'Technology', createdAt: Date, articleCount: 0 }

// Create a category with description
const scienceCategory = categoryService.createCategory(
  'Science',
  'Articles about scientific discoveries and research'
);
console.log('Created category with description:', scienceCategory);

// ============================================================================
// Example 2: Retrieve Categories
// ============================================================================

// Get all categories
const allCategories = categoryService.getAllCategories();
console.log('All categories:', allCategories);
// Output: Array of categories sorted by name

// Get a specific category by ID
const category = categoryService.getCategoryById(techCategory.id);
console.log('Retrieved category:', category);

// ============================================================================
// Example 3: Update Categories
// ============================================================================

// Update category name
const updatedCategory = categoryService.updateCategory(techCategory.id, {
  name: 'Tech & Innovation'
});
console.log('Updated category name:', updatedCategory);

// Update category description
const updatedWithDesc = categoryService.updateCategory(techCategory.id, {
  description: 'Technology and innovation articles'
});
console.log('Updated category description:', updatedWithDesc);

// Update both name and description
const fullyUpdated = categoryService.updateCategory(techCategory.id, {
  name: 'Technology',
  description: 'All things tech'
});
console.log('Fully updated category:', fullyUpdated);

// ============================================================================
// Example 4: Associate Categories with Articles
// ============================================================================

// Assuming you have article IDs from ArticleService
const articleId = 'some-article-id';

// Add single category to an article
categoryService.addCategoriesToArticle(articleId, [techCategory.id]);

// Add multiple categories to an article
categoryService.addCategoriesToArticle(articleId, [
  techCategory.id,
  scienceCategory.id
]);

// Get all categories for an article
const articleCategories = categoryService.getArticleCategories(articleId);
console.log('Article categories:', articleCategories);

// ============================================================================
// Example 5: Remove Category Associations
// ============================================================================

// Remove single category from article
categoryService.removeCategoriesFromArticle(articleId, [techCategory.id]);

// Remove multiple categories from article
categoryService.removeCategoriesFromArticle(articleId, [
  techCategory.id,
  scienceCategory.id
]);

// ============================================================================
// Example 6: Delete Categories
// ============================================================================

// Delete a category (also removes all article associations)
const deleted = categoryService.deleteCategory(techCategory.id);
console.log('Category deleted:', deleted); // true if successful

// ============================================================================
// Example 7: Error Handling
// ============================================================================

try {
  // This will throw ValidationError
  categoryService.createCategory('');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  }
}

try {
  // This will throw ConflictError
  categoryService.createCategory('Technology');
  categoryService.createCategory('Technology'); // Duplicate
} catch (error) {
  if (error instanceof ConflictError) {
    console.error('Conflict error:', error.message);
  }
}

try {
  // This will throw NotFoundError
  categoryService.updateCategory('non-existent-id', { name: 'New Name' });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.error('Not found error:', error.message);
  }
}

// ============================================================================
// Example 8: Batch Operations
// ============================================================================

// Create multiple categories at once
const categoryNames = ['JavaScript', 'Python', 'Rust', 'Go'];
const createdCategories = categoryNames.map(name => 
  categoryService.createCategory(name)
);

// Add all categories to an article
const categoryIds = createdCategories.map(c => c.id);
categoryService.addCategoriesToArticle(articleId, categoryIds);

// ============================================================================
// Example 9: Category Statistics
// ============================================================================

// Get categories with article counts
const categoriesWithCounts = categoryService.getAllCategories();
categoriesWithCounts.forEach(cat => {
  console.log(`${cat.name}: ${cat.articleCount} articles`);
});

// Find most popular categories
const popularCategories = categoriesWithCounts
  .filter(c => c.articleCount && c.articleCount > 0)
  .sort((a, b) => (b.articleCount || 0) - (a.articleCount || 0))
  .slice(0, 5);
console.log('Top 5 categories:', popularCategories);

// ============================================================================
// Example 10: Integration with Astro Pages
// ============================================================================

// In an Astro page component:
/*
---
import { CategoryService } from '../services/categoryService';
import { getDatabase } from '../utils/db';

const db = getDatabase();
const categoryService = new CategoryService(db);

// Get all categories for a category selector
const categories = categoryService.getAllCategories();

// Get categories for a specific article
const articleId = Astro.params.id;
const articleCategories = categoryService.getArticleCategories(articleId);
---

<div>
  <h2>Categories</h2>
  <ul>
    {categories.map(cat => (
      <li>
        {cat.name} ({cat.articleCount} articles)
        {cat.description && <p>{cat.description}</p>}
      </li>
    ))}
  </ul>
</div>
*/
