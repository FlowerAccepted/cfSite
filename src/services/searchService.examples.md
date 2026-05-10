# SearchService Examples

## validateRegex Function

The `validateRegex` function validates regex patterns and returns descriptive error messages for invalid patterns.

### Valid Patterns

```typescript
import { validateRegex } from './searchService';

// Simple literal pattern
validateRegex('hello');
// Returns: { valid: true }

// Pattern with character class
validateRegex('[a-z]+');
// Returns: { valid: true }

// Pattern with quantifiers
validateRegex('\\d{2,4}');
// Returns: { valid: true }

// Pattern with alternation
validateRegex('cat|dog');
// Returns: { valid: true }

// Pattern with anchors
validateRegex('^start.*end$');
// Returns: { valid: true }

// Email pattern
validateRegex('(\\w+)@(\\w+)\\.(\\w+)');
// Returns: { valid: true }

// Empty pattern (matches everything)
validateRegex('');
// Returns: { valid: true }
```

### Invalid Patterns

```typescript
// Unterminated character class
validateRegex('[abc');
// Returns: { valid: false, error: 'Unterminated character class' }

// Unterminated group
validateRegex('(abc');
// Returns: { valid: false, error: 'Unterminated group' }

// Invalid quantifier range
validateRegex('a{5,2}');
// Returns: { valid: false, error: 'numbers out of order in {} quantifier' }

// Invalid named group reference
validateRegex('(?<name>test)\\k<invalid>');
// Returns: { valid: false, error: 'Invalid named capture referenced' }

// Unterminated named group
validateRegex('(?<invalid');
// Returns: { valid: false, error: 'Invalid group' }
```

### Usage in Search

```typescript
function searchArticles(pattern: string) {
  // Validate the regex pattern first
  const validation = validateRegex(pattern);
  
  if (!validation.valid) {
    // Return error to user with descriptive message
    return {
      success: false,
      error: `Invalid regular expression: ${validation.error}`
    };
  }
  
  // Proceed with search using the valid pattern
  const regex = new RegExp(pattern, 'gi');
  // ... search logic
}
```

## Requirements Validation

This implementation satisfies:

- **Requirement 2.2**: Supports regular expression pattern matching
- **Requirement 2.4**: Returns descriptive error messages for invalid regex patterns

The function:
1. ✅ Tries to compile the regex pattern using `new RegExp(pattern)`
2. ✅ Returns `{ valid: true }` if successful
3. ✅ Catches compilation errors and returns `{ valid: false, error: descriptive message }`
4. ✅ Provides descriptive error messages from the JavaScript regex engine
5. ✅ Will be used by SearchService for validating user input before searching


## highlightMatches Function

The `highlightMatches` function wraps matching text in `<mark>` HTML tags for visual highlighting in search results.

### Basic Usage

```typescript
import { highlightMatches } from './searchService';

// Simple literal match
highlightMatches('Hello world', 'world');
// Returns: 'Hello <mark>world</mark>'

// Multiple matches
highlightMatches('test test test', 'test');
// Returns: '<mark>test</mark> <mark>test</mark> <mark>test</mark>'

// No matches
highlightMatches('Hello world', 'xyz');
// Returns: 'Hello world'
```

### Regex Pattern Highlighting

```typescript
// Highlight digits
highlightMatches('test 123 test', '\\d+');
// Returns: 'test <mark>123</mark> test'

// Highlight word boundaries
highlightMatches('password word', '\\bword\\b');
// Returns: 'password <mark>word</mark>'

// Highlight character classes
highlightMatches('abc123def', '[a-z]+');
// Returns: '<mark>abc</mark>123<mark>def</mark>'

// Highlight with alternation
highlightMatches('I have a cat and a dog', 'cat|dog');
// Returns: 'I have a <mark>cat</mark> and a <mark>dog</mark>'
```

### Content Preservation

The function preserves the original text content, only adding `<mark>` tags:

```typescript
const original = 'Hello world! How are you?';
const highlighted = highlightMatches(original, 'world');
// highlighted: 'Hello <mark>world</mark>! How are you?'

// Remove marks to verify original text is preserved
const withoutMarks = highlighted.replace(/<\/?mark>/g, '');
// withoutMarks === original: true
```

### Error Handling

If an invalid regex pattern is provided, the function returns the original text unchanged:

```typescript
highlightMatches('test text', '[invalid');
// Returns: 'test text' (original text, no highlighting)
```

### Usage in Search Results

```typescript
interface SearchResult {
  article: Article;
  matches: {
    field: 'title' | 'content';
    snippet: string;
    position: number;
  }[];
}

function displaySearchResults(query: string, articles: Article[]): SearchResult[] {
  const regex = new RegExp(query, 'gi');
  const results: SearchResult[] = [];
  
  for (const article of articles) {
    const matches = [];
    
    // Check title
    if (regex.test(article.title)) {
      matches.push({
        field: 'title',
        snippet: highlightMatches(article.title, query),
        position: 0
      });
    }
    
    // Check content
    const contentMatch = article.content.match(regex);
    if (contentMatch) {
      // Extract snippet around match
      const start = Math.max(0, contentMatch.index! - 50);
      const end = Math.min(article.content.length, contentMatch.index! + 150);
      const snippet = article.content.substring(start, end);
      
      matches.push({
        field: 'content',
        snippet: highlightMatches(snippet, query),
        position: contentMatch.index!
      });
    }
    
    if (matches.length > 0) {
      results.push({ article, matches });
    }
  }
  
  return results;
}
```

## Requirements Validation

The `highlightMatches` function satisfies:

- **Requirement 2.6**: Display search results with highlighted matching text

The function:
1. ✅ Wraps all matches in `<mark>` HTML tags for visual highlighting
2. ✅ Preserves original text content (only adds markers)
3. ✅ Supports regex patterns with global matching
4. ✅ Handles invalid regex gracefully (returns original text)
5. ✅ Works with multiple matches in the same text
6. ✅ Preserves special characters, unicode, and whitespace
