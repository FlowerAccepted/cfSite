# Article Validation Utilities - Usage Examples

This document provides examples of how to use the article validation utilities.

## Overview

The article validation utilities provide functions to validate article data according to the system requirements:

- **Requirement 6.2**: Title and content are required
- **Requirement 6.6**: Title must not be empty and not exceed 200 characters
- **Requirement 6.7**: Content must not exceed 100,000 characters
- **Requirement 5.1**: External URLs must be valid HTTP/HTTPS URLs

## Functions

### `validateTitle(title: string): void`

Validates an article title. Throws `ValidationError` if invalid.

**Rules:**
- Title is required (not null/undefined)
- Title must be a string
- Title cannot be empty (after trimming whitespace)
- Title cannot exceed 200 characters

**Examples:**

```typescript
import { validateTitle } from './utils/articleValidation';
import { ValidationError } from './types/errors';

// Valid titles
validateTitle('My Article Title'); // ✓ OK
validateTitle('A'); // ✓ OK (minimum 1 character)
validateTitle('a'.repeat(200)); // ✓ OK (exactly 200 characters)
validateTitle('文章标题'); // ✓ OK (Unicode characters)
validateTitle('Article 🚀'); // ✓ OK (Emojis)

// Invalid titles
try {
  validateTitle(''); // ✗ Throws: "Title cannot be empty"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}

try {
  validateTitle('   '); // ✗ Throws: "Title cannot be empty"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}

try {
  validateTitle('a'.repeat(201)); // ✗ Throws: "Title cannot exceed 200 characters"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}

try {
  validateTitle(null); // ✗ Throws: "Title is required"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}
```

### `validateContent(content: string): void`

Validates article content. Throws `ValidationError` if invalid.

**Rules:**
- Content is required (not null/undefined)
- Content must be a string
- Content cannot exceed 100,000 characters
- Empty content is allowed

**Examples:**

```typescript
import { validateContent } from './utils/articleValidation';
import { ValidationError } from './types/errors';

// Valid content
validateContent('This is my article content'); // ✓ OK
validateContent(''); // ✓ OK (empty content is allowed)
validateContent('   '); // ✓ OK (whitespace-only is allowed)
validateContent('a'.repeat(100000)); // ✓ OK (exactly 100,000 characters)
validateContent('# Markdown\n\nWith **formatting**'); // ✓ OK

// Invalid content
try {
  validateContent('a'.repeat(100001)); // ✗ Throws: "Content cannot exceed 100,000 characters"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}

try {
  validateContent(null); // ✗ Throws: "Content is required"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}
```

### `validateExternalUrl(url: string): { valid: boolean; error?: string }`

Validates an external URL. Returns a result object instead of throwing.

**Rules:**
- URL must be a non-empty string
- URL must start with `http://` or `https://`
- URL must be a valid URL format
- Only HTTP and HTTPS protocols are allowed

**Examples:**

```typescript
import { validateExternalUrl } from './utils/articleValidation';

// Valid URLs
const result1 = validateExternalUrl('https://example.com');
console.log(result1); // { valid: true }

const result2 = validateExternalUrl('http://example.com/path?query=value');
console.log(result2); // { valid: true }

const result3 = validateExternalUrl('https://example.com:8080/api');
console.log(result3); // { valid: true }

// Invalid URLs
const result4 = validateExternalUrl('example.com');
console.log(result4); // { valid: false, error: 'URL must start with http:// or https://' }

const result5 = validateExternalUrl('ftp://example.com');
console.log(result5); // { valid: false, error: 'URL must start with http:// or https://' }

const result6 = validateExternalUrl('');
console.log(result6); // { valid: false, error: 'URL cannot be empty' }

const result7 = validateExternalUrl('javascript:alert(1)');
console.log(result7); // { valid: false, error: 'URL must start with http:// or https://' }

// Using the result
const urlToValidate = 'https://example.com/article.md';
const validation = validateExternalUrl(urlToValidate);

if (validation.valid) {
  console.log('URL is valid, proceed with loading');
} else {
  console.error('Invalid URL:', validation.error);
}
```

### `validateAuthorUid(authorUid: string): void`

Validates an author UID. Throws `ValidationError` if invalid.

**Rules:**
- Author UID is required (not null/undefined)
- Author UID must be a string
- Author UID cannot be empty (after trimming whitespace)

**Examples:**

```typescript
import { validateAuthorUid } from './utils/articleValidation';
import { ValidationError } from './types/errors';

// Valid author UIDs
validateAuthorUid('user-123'); // ✓ OK
validateAuthorUid('abc'); // ✓ OK
validateAuthorUid('author@example.com'); // ✓ OK

// Invalid author UIDs
try {
  validateAuthorUid(''); // ✗ Throws: "Author UID cannot be empty"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}

try {
  validateAuthorUid(null); // ✗ Throws: "Author UID is required"
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }
}
```

### `validateCreateArticleInput(input: CreateArticleInput): void`

Validates all fields for article creation. Throws `ValidationError` if any field is invalid.

**Examples:**

```typescript
import { validateCreateArticleInput } from './utils/articleValidation';
import { ValidationError } from './types/errors';

// Valid input
const validInput = {
  title: 'My Article',
  content: 'This is the article content',
  authorUid: 'user-123',
  categories: ['tech', 'programming'],
  published: false,
};

validateCreateArticleInput(validInput); // ✓ OK

// Valid input with external URL
const inputWithUrl = {
  title: 'External Article',
  content: 'Content loaded from external source',
  authorUid: 'user-456',
  categories: [],
  externalUrl: 'https://example.com/article.md',
  published: true,
};

validateCreateArticleInput(inputWithUrl); // ✓ OK

// Invalid input - empty title
try {
  validateCreateArticleInput({
    title: '',
    content: 'Content',
    authorUid: 'user-123',
    categories: [],
    published: false,
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message); // "Title cannot be empty"
    console.error(error.field); // "title"
  }
}

// Invalid input - content too long
try {
  validateCreateArticleInput({
    title: 'Article',
    content: 'a'.repeat(100001),
    authorUid: 'user-123',
    categories: [],
    published: false,
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message); // "Content cannot exceed 100,000 characters"
    console.error(error.field); // "content"
  }
}

// Invalid input - invalid external URL
try {
  validateCreateArticleInput({
    title: 'Article',
    content: 'Content',
    authorUid: 'user-123',
    categories: [],
    externalUrl: 'not-a-valid-url',
    published: false,
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message); // "URL must start with http:// or https://"
    console.error(error.field); // "externalUrl"
  }
}
```

### `validateUpdateArticleInput(input: UpdateArticleInput): void`

Validates fields for article updates. Only validates fields that are present. Throws `ValidationError` if any field is invalid.

**Examples:**

```typescript
import { validateUpdateArticleInput } from './utils/articleValidation';
import { ValidationError } from './types/errors';

// Valid partial updates
validateUpdateArticleInput({ title: 'New Title' }); // ✓ OK
validateUpdateArticleInput({ content: 'New content' }); // ✓ OK
validateUpdateArticleInput({ published: true }); // ✓ OK
validateUpdateArticleInput({ categories: ['new-category'] }); // ✓ OK
validateUpdateArticleInput({}); // ✓ OK (no updates)

// Valid multiple field update
validateUpdateArticleInput({
  title: 'Updated Title',
  content: 'Updated content',
  categories: ['tech'],
  published: true,
}); // ✓ OK

// Invalid update - empty title
try {
  validateUpdateArticleInput({ title: '' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message); // "Title cannot be empty"
  }
}

// Invalid update - content too long
try {
  validateUpdateArticleInput({ content: 'a'.repeat(100001) });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message); // "Content cannot exceed 100,000 characters"
  }
}
```

## Integration with ArticleService

Here's how these validation functions would typically be used in the ArticleService:

```typescript
import {
  validateCreateArticleInput,
  validateUpdateArticleInput,
} from '../utils/articleValidation';
import { ValidationError } from '../types/errors';

class ArticleService {
  createArticle(input: CreateArticleInput): Article {
    // Validate input first
    validateCreateArticleInput(input);
    
    // If validation passes, proceed with creation
    // ... database operations ...
  }
  
  updateArticle(id: string, input: UpdateArticleInput): Article {
    // Validate input first
    validateUpdateArticleInput(input);
    
    // If validation passes, proceed with update
    // ... database operations ...
  }
}
```

## Error Handling

All validation functions (except `validateExternalUrl`) throw `ValidationError` when validation fails. The `ValidationError` includes:

- `message`: Human-readable error message
- `field`: The field that failed validation (optional)
- `code`: Error code ('VALIDATION_ERROR')
- `statusCode`: HTTP status code (400)

**Example error handling:**

```typescript
import { validateTitle } from './utils/articleValidation';
import { ValidationError } from './types/errors';

function handleArticleSubmission(title: string) {
  try {
    validateTitle(title);
    // Proceed with article creation
  } catch (error) {
    if (error instanceof ValidationError) {
      // Display user-friendly error message
      console.error(`Validation failed for ${error.field}: ${error.message}`);
      // Return appropriate HTTP response
      return {
        status: error.statusCode,
        body: {
          error: {
            code: error.code,
            message: error.message,
            field: error.field,
          },
        },
      };
    }
    // Handle other errors
    throw error;
  }
}
```

## Testing

The validation utilities are thoroughly tested with:

- **Property-based tests** (using fast-check): Test validation across a wide range of randomly generated inputs
- **Unit tests**: Test specific edge cases and boundary conditions

See `src/utils/articleValidation.test.ts` for the complete test suite.
