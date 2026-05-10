# Article System Types

This directory contains TypeScript type definitions and error classes for the Article System.

## Files

### `article.ts`
Core type definitions for the article system including:
- **Article**: Main article entity with all properties
- **Category**: Category entity for organizing articles
- **User**: User entity representing article authors
- **CreateArticleInput**: Input data for creating articles
- **UpdateArticleInput**: Input data for updating articles
- **ListArticlesOptions**: Options for paginated article listings
- **PaginatedArticles**: Paginated result structure
- **SearchOptions**: Options for search operations
- **SearchResult**: Search result structure with matched articles
- **ArticleSearchHit**: Individual article match in search results
- **ExternalContent**: Result of external content loading
- **OperationContext**: Context for authorized operations
- **BulkOperationResult**: Result of bulk operations

### `errors.ts`
Custom error classes for structured error handling:
- **ArticleError**: Base error class for all article system errors
- **ValidationError**: Input validation failures
- **NotFoundError**: Resource not found errors
- **UnauthorizedError**: Authentication failures
- **ForbiddenError**: Authorization failures
- **SearchError**: Search operation failures
- **ExternalLoadError**: External content loading failures
- **DatabaseError**: Database operation failures
- **ConflictError**: Resource conflict errors (e.g., duplicates)
- **ErrorResponse**: Standard error response format
- **toErrorResponse()**: Utility function to convert errors to standard format

## Usage

```typescript
import type { Article, Category, CreateArticleInput } from './types/article';
import { ValidationError, NotFoundError } from './types/errors';

// Create an article
const input: CreateArticleInput = {
  title: 'My Article',
  content: 'Article content...',
  authorUid: 'user-123',
  categories: ['cat-1'],
  published: true,
};

// Handle errors
try {
  // ... operation
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed for field: ${error.field}`);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found');
  }
}
```

## Testing

All type definitions and error classes have corresponding test files:
- `article.test.ts`: Tests for type definitions
- `errors.test.ts`: Tests for error classes

Run tests with:
```bash
npm test
```
