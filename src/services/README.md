# Article System Services

This directory contains service layer implementations for the Article System.

## Implemented Services

### ArticleService (`articleService.ts`)

The `ArticleService` manages the complete lifecycle of articles, including creation, retrieval, updates, deletion, and access control.

#### Features

- **Create articles** with automatic URL name generation
- **Retrieve articles** by ID or URL parameters (author UID + URL name)
- **Update articles** with timestamp management and author immutability
- **Delete articles** with authorization checks
- **List articles** with pagination, filtering, and sorting
- **Access control** for published/unpublished articles
- **Category associations** through integration with CategoryService
- **External URL support** for loading content from external sources

#### Core Methods

- `createArticle(data: CreateArticleInput): Article` - Create a new article
- `getArticleById(id: string): Article | null` - Retrieve by ID
- `getArticleByUrl(uid: string, name: string): Article | null` - Retrieve by URL
- `updateArticle(id: string, data: UpdateArticleInput): Article` - Update article
- `listArticles(options: ListArticlesOptions): PaginatedArticles` - List with pagination
- `deleteArticle(id: string, authorUid: string): boolean` - Delete with auth check
- `canAccessArticle(article: Article, userUid?: string): boolean` - Access control

#### URL Name Generation

Automatically generates URL-safe names from article titles:
- Converts to lowercase
- Removes Chinese characters and special characters
- Replaces spaces with hyphens
- Limits to 100 characters
- Ensures uniqueness per author

Examples:
- "Hello World!" → "hello-world"
- "你好世界 Hello" → "hello"
- "TypeScript & JavaScript" → "typescript-javascript"

#### Validation

- **Title**: Required, 1-200 characters
- **Content**: Required, max 100,000 characters
- **Author UID**: Required, non-empty
- **External URL**: Must be valid HTTP/HTTPS URL (if provided)
- **Categories**: Must be an array
- **Published**: Must be boolean

#### Usage

See `articleService.example.ts` for detailed usage examples.

#### Testing

```bash
npm test -- src/services/articleService.test.ts
```

### CategoryService (`categoryService.ts`)

Manages article categories and their associations with articles.

#### Features

- Create, read, update, and delete categories
- Manage many-to-many relationships between articles and categories
- Retrieve categories with article counts
- Add/remove categories from articles

#### Usage

See `categoryService.example.ts` for detailed usage examples.

#### Testing

```bash
npm test -- src/services/categoryService.test.ts
```

## Planned Services

### SearchService (`searchService.ts`)
Provides search functionality:
- Regex-based article search
- Search result highlighting
- Regex validation

### ExternalLoaderService (`externalLoaderService.ts`)
Handles external content loading:
- Fetch content from external URLs
- Timeout protection
- Error handling and graceful degradation

## Service Architecture

All services follow these principles:
- **Type Safety**: Use TypeScript interfaces from `src/types/`
- **Error Handling**: Throw custom errors from `src/types/errors.ts`
- **Testability**: Each service has corresponding unit and property-based tests
- **Single Responsibility**: Each service focuses on a specific domain
- **Database Integration**: Use better-sqlite3 for synchronous operations
- **Transaction Support**: Use transactions for multi-step operations

## Error Handling

Services throw custom errors:
- `ValidationError`: Invalid input data (400)
- `NotFoundError`: Resource not found (404)
- `ForbiddenError`: Unauthorized access (403)
- `DatabaseError`: Database operation failures (500)
- `ConflictError`: Resource conflicts (409)

## Testing

Services are tested using:
- **Unit Tests**: Specific examples and edge cases
- **Property-Based Tests**: Universal properties using fast-check
- **Integration Tests**: Service interactions

Run all tests:
```bash
npm test
```

Run specific service tests:
```bash
npm test -- src/services/articleService.test.ts
npm test -- src/services/categoryService.test.ts
```
