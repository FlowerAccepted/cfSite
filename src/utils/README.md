# Article System Utilities

This directory contains utility functions for the Article System.

## Implemented Utilities

### URL Generation (`urlGenerator.ts`)
✅ **Status: Implemented**

Generates URL-safe names from article titles according to requirements 3.1, 3.2, and 3.3.

**Features:**
- Converts titles to lowercase
- Removes Chinese characters (CJK Unified Ideographs)
- Replaces special characters with hyphens
- Preserves underscores
- Limits length to 100 characters
- Ensures only alphanumeric characters, hyphens, and underscores

**Usage:**
```typescript
import { generateUrlName } from './utils/urlGenerator';

generateUrlName('Hello World!'); // "hello-world"
generateUrlName('你好世界 Hello'); // "hello"
generateUrlName('Article (Part 1)'); // "article-part-1"
```

**Testing:**
- 37 unit tests covering edge cases and real-world examples
- Property-based tests validating correctness properties

## Planned Utilities

### Validation (`validation.ts`)
- Article title validation (length, format)
- Article content validation (length)
- URL validation for external links
- Regex pattern validation

### Text Processing (`textProcessing.ts`)
- Highlight text matches in search results
- Extract text snippets with context
- Markdown processing helpers

### Date Formatting (`dateFormatter.ts`)
- Format dates for display
- Handle timezones and localization

## Utility Design Principles

- **Pure Functions**: Utilities should be pure functions without side effects
- **Type Safety**: Strong TypeScript typing for all inputs and outputs
- **Testability**: Easy to test with both unit and property-based tests
- **Reusability**: Generic and composable functions

## Testing

All utilities will have comprehensive tests:
- **Unit Tests**: Specific examples and edge cases
- **Property-Based Tests**: Universal properties across all inputs

Run tests with:
```bash
npm test
```
