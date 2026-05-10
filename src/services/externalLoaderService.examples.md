# ExternalLoaderService Examples

This document provides examples of using the ExternalLoaderService functions.

## validateUrl Function

The `validateUrl` function validates URLs for external content loading. Only HTTP and HTTPS protocols are allowed for security reasons.

### Basic Usage

```typescript
import { validateUrl } from './externalLoaderService';

// Valid HTTP URL
const result1 = validateUrl('http://example.com/article.md');
console.log(result1); // { valid: true }

// Valid HTTPS URL
const result2 = validateUrl('https://example.com/article.md');
console.log(result2); // { valid: true }

// Invalid protocol (FTP)
const result3 = validateUrl('ftp://example.com/file.txt');
console.log(result3); // { valid: false, error: 'URL must use HTTP or HTTPS protocol' }

// Invalid URL format
const result4 = validateUrl('not a url');
console.log(result4); // { valid: false, error: 'URL must use HTTP or HTTPS protocol' }

// Empty string
const result5 = validateUrl('');
console.log(result5); // { valid: false, error: 'URL must be a non-empty string' }
```

### Validation Before Loading

```typescript
import { validateUrl, loadContent } from './externalLoaderService';

async function loadArticleContent(url: string) {
  // Validate URL first
  const validation = validateUrl(url);
  
  if (!validation.valid) {
    console.error('Invalid URL:', validation.error);
    return null;
  }
  
  // Load content if URL is valid
  const result = await loadContent(url);
  
  if (result.success) {
    console.log('Content loaded successfully:', result.content);
    return result.content;
  } else {
    console.error('Failed to load content:', result.error);
    return null;
  }
}

// Usage
await loadArticleContent('https://example.com/article.md');
```

### Form Validation

```typescript
import { validateUrl } from './externalLoaderService';

function validateArticleForm(formData: {
  title: string;
  content: string;
  externalUrl?: string;
}) {
  const errors: Record<string, string> = {};
  
  // Validate external URL if provided
  if (formData.externalUrl && formData.externalUrl.trim() !== '') {
    const urlValidation = validateUrl(formData.externalUrl);
    if (!urlValidation.valid) {
      errors.externalUrl = urlValidation.error || 'Invalid URL';
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Usage
const validation = validateArticleForm({
  title: 'My Article',
  content: 'Article content...',
  externalUrl: 'https://example.com/source.md'
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## loadContent Function

The `loadContent` function loads content from an external URL with timeout protection.

### Basic Usage

```typescript
import { loadContent } from './externalLoaderService';

// Load content with default timeout (5 seconds)
const result = await loadContent('https://example.com/article.md');

if (result.success) {
  console.log('Content:', result.content);
  console.log('Content Type:', result.contentType);
  console.log('Load Time:', result.loadTime, 'ms');
} else {
  console.error('Error:', result.error);
}
```

### Custom Timeout

```typescript
import { loadContent } from './externalLoaderService';

// Load content with custom timeout (10 seconds)
const result = await loadContent('https://example.com/large-file.md', 10000);

if (result.success) {
  console.log('Content loaded in', result.loadTime, 'ms');
} else {
  console.error('Failed to load:', result.error);
}
```

### Error Handling

```typescript
import { loadContent } from './externalLoaderService';

async function loadWithFallback(url: string, fallbackContent: string) {
  const result = await loadContent(url);
  
  if (result.success) {
    return result.content;
  }
  
  // Handle different error types
  if (result.error === 'Request timeout') {
    console.warn('Request timed out, using fallback content');
  } else if (result.error?.startsWith('HTTP')) {
    console.warn('HTTP error:', result.error);
  } else {
    console.warn('Network error:', result.error);
  }
  
  return fallbackContent;
}

// Usage
const content = await loadWithFallback(
  'https://example.com/article.md',
  'Default article content'
);
```

### Loading Multiple URLs

```typescript
import { loadContent } from './externalLoaderService';

async function loadMultipleArticles(urls: string[]) {
  const results = await Promise.all(
    urls.map(url => loadContent(url))
  );
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Loaded ${successful.length} of ${urls.length} articles`);
  
  if (failed.length > 0) {
    console.warn('Failed URLs:', failed.map(r => r.error));
  }
  
  return successful.map(r => r.content);
}

// Usage
const articles = await loadMultipleArticles([
  'https://example.com/article1.md',
  'https://example.com/article2.md',
  'https://example.com/article3.md'
]);
```

## Integration with Article System

### Article Creation with External URL

```typescript
import { validateUrl } from './externalLoaderService';
import { createArticle } from './articleService';

async function createArticleWithExternalUrl(data: {
  title: string;
  content: string;
  authorUid: string;
  externalUrl?: string;
}) {
  // Validate external URL if provided
  if (data.externalUrl) {
    const validation = validateUrl(data.externalUrl);
    if (!validation.valid) {
      throw new Error(`Invalid external URL: ${validation.error}`);
    }
  }
  
  // Create article
  const article = await createArticle({
    ...data,
    categories: [],
    published: false
  });
  
  return article;
}
```

### Article Display with External Content

```typescript
import { loadContent } from './externalLoaderService';
import { getArticleById } from './articleService';

async function displayArticle(articleId: string) {
  const article = await getArticleById(articleId);
  
  if (!article) {
    throw new Error('Article not found');
  }
  
  let content = article.content;
  
  // Load external content if configured
  if (article.externalUrl) {
    const result = await loadContent(article.externalUrl);
    
    if (result.success) {
      content = result.content;
      console.log(`External content loaded in ${result.loadTime}ms`);
    } else {
      console.warn('Failed to load external content, using stored content');
      console.warn('Error:', result.error);
    }
  }
  
  return {
    ...article,
    content
  };
}
```

## Security Considerations

### Protocol Restrictions

The `validateUrl` function only allows HTTP and HTTPS protocols to prevent security issues:

```typescript
// ✅ Allowed
validateUrl('http://example.com');   // Valid
validateUrl('https://example.com');  // Valid

// ❌ Blocked for security
validateUrl('ftp://example.com');              // Invalid
validateUrl('file:///etc/passwd');             // Invalid
validateUrl('javascript:alert(1)');            // Invalid
validateUrl('data:text/html,<script>...');     // Invalid
```

### URL Validation Best Practices

```typescript
import { validateUrl } from './externalLoaderService';

// Always validate user input
function handleUserInput(userUrl: string) {
  // Trim whitespace
  const trimmedUrl = userUrl.trim();
  
  // Validate
  const validation = validateUrl(trimmedUrl);
  
  if (!validation.valid) {
    // Show user-friendly error message
    alert(`Invalid URL: ${validation.error}`);
    return;
  }
  
  // Proceed with valid URL
  processUrl(trimmedUrl);
}

// Don't trust external URLs
async function loadExternalContent(url: string) {
  // Validate first
  const validation = validateUrl(url);
  if (!validation.valid) {
    throw new Error('Invalid URL');
  }
  
  // Load with timeout
  const result = await loadContent(url, 5000);
  
  // Always check success
  if (!result.success) {
    throw new Error(`Failed to load: ${result.error}`);
  }
  
  return result.content;
}
```
