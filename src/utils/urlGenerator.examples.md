# URL Generator Examples

This document demonstrates the `generateUrlName` function with real-world examples.

## Basic Examples

```typescript
import { generateUrlName } from './urlGenerator';

// Simple English titles
generateUrlName('Hello World')
// → "hello-world"

generateUrlName('How to Build a Web Application')
// → "how-to-build-a-web-application"

// Titles with special characters
generateUrlName('Hello! World?')
// → "hello-world"

generateUrlName('Article (Part 1) [Draft]')
// → "article-part-1-draft"
```

## Chinese Character Handling

```typescript
// Pure Chinese
generateUrlName('你好世界')
// → ""

// Mixed Chinese and English
generateUrlName('你好 Hello 世界 World')
// → "hello-world"

generateUrlName('文章标题: Article Title!')
// → "article-title"

// Bilingual titles
generateUrlName('深度学习入门 - Introduction to Deep Learning')
// → "introduction-to-deep-learning"
```

## Special Character Handling

```typescript
// Underscores are preserved
generateUrlName('hello_world_test')
// → "hello_world_test"

// Multiple special characters collapsed to single hyphen
generateUrlName('Hello!!! World???')
// → "hello-world"

// Leading/trailing special characters removed
generateUrlName('!!!Hello World!!!')
// → "hello-world"

// Emoji and non-ASCII characters removed
generateUrlName('Hello 😀 World 🌍')
// → "hello-world"
```

## Length Limiting

```typescript
// Long titles truncated to 100 characters
generateUrlName('a'.repeat(150))
// → "aaaa..." (100 characters)

// Trailing hyphens removed after truncation
generateUrlName('word-'.repeat(25))
// → "word-word-word-..." (≤100 chars, no trailing hyphen)
```

## Edge Cases

```typescript
// Empty and whitespace
generateUrlName('')
// → ""

generateUrlName('   ')
// → ""

// Only special characters
generateUrlName('!@#$%^&*()')
// → ""

// Only Chinese characters
generateUrlName('你好世界')
// → ""

// Numbers preserved
generateUrlName('Article 123 Test 456')
// → "article-123-test-456"

// Multiple spaces collapsed
generateUrlName('Hello     World')
// → "hello-world"
```

## Real-World Blog Post Examples

```typescript
// Technical article
generateUrlName('Understanding Array.prototype.map()')
// → "understanding-array-prototype-map"

// Version announcement
generateUrlName('Node.js v20.0.0 Release Notes')
// → "node-js-v20-0-0-release-notes"

// Tutorial
generateUrlName('How to Build a REST API with Express.js')
// → "how-to-build-a-rest-api-with-express-js"

// Bilingual technical article
generateUrlName('JavaScript异步编程 - Async Programming in JavaScript')
// → "async-programming-in-javascript"
```

## Properties Validated

The function satisfies the following correctness properties:

1. **URL Safety**: Only contains `[a-z0-9_-]`
2. **Length Limit**: Never exceeds 100 characters
3. **No Leading/Trailing Hyphens**: Clean start and end
4. **Chinese Character Removal**: No CJK characters in output
5. **Lowercase**: All output is lowercase
6. **Idempotency**: `generateUrlName(generateUrlName(x)) === generateUrlName(x)`
7. **Empty Input Handling**: Gracefully handles empty or invalid inputs
