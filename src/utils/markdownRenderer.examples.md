# Markdown Renderer Examples

This document provides examples of how to use the Markdown rendering utilities.

## Basic Usage

```typescript
import { renderMarkdown } from './markdownRenderer.js';

const markdown = '# Hello World\n\nThis is **bold** text.';
const html = renderMarkdown(markdown);
// Output: '<h1>Hello World</h1>\n<p>This is <strong>bold</strong> text.</p>'
```

## Supported Markdown Elements

### Headers

```typescript
const markdown = `
# H1 Header
## H2 Header
### H3 Header
`;
const html = renderMarkdown(markdown);
```

### Text Formatting

```typescript
const markdown = `
**Bold text**
*Italic text*
***Bold and italic***
`;
const html = renderMarkdown(markdown);
```

### Links and Images

```typescript
const markdown = `
[Link text](https://example.com)
![Alt text](https://example.com/image.jpg)
`;
const html = renderMarkdown(markdown);
```

### Lists

```typescript
const markdown = `
- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third
`;
const html = renderMarkdown(markdown);
```

### Code

```typescript
const markdown = `
Inline \`code\` example.

\`\`\`javascript
const x = 42;
console.log(x);
\`\`\`
`;
const html = renderMarkdown(markdown);
```

### Blockquotes

```typescript
const markdown = `
> This is a quote
> It can span multiple lines
`;
const html = renderMarkdown(markdown);
```

### Tables

```typescript
const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
`;
const html = renderMarkdown(markdown);
```

## Security Features

The renderer automatically sanitizes dangerous HTML to prevent XSS attacks:

```typescript
const dangerousMarkdown = `
<script>alert('xss')</script>
<img src="x" onerror="alert('xss')">
`;
const html = renderMarkdown(dangerousMarkdown);
// Script tags and event handlers are removed
```

## Utility Functions

### Convert Markdown to Plain Text

```typescript
import { renderMarkdownToText } from './markdownRenderer.js';

const markdown = '# Title\n\nThis is **bold** text.';
const text = renderMarkdownToText(markdown);
// Output: 'Title\n\nbold text'
```

### Generate Excerpt

```typescript
import { generateExcerpt } from './markdownRenderer.js';

const markdown = `
# Article Title

This is the first paragraph with lots of content...

This is the second paragraph.
`;
const excerpt = generateExcerpt(markdown, 100);
// Output: 'This is the first paragraph with lots of content...'
```

### Check if Text Contains Markdown

```typescript
import { isMarkdown } from './markdownRenderer.js';

console.log(isMarkdown('# Header'));  // true
console.log(isMarkdown('**bold**'));  // true
console.log(isMarkdown('Plain text')); // false
```

### Extract First Heading

```typescript
import { extractFirstHeading } from './markdownRenderer.js';

const markdown = '# Main Title\n\n## Subtitle';
const heading = extractFirstHeading(markdown);
// Output: 'Main Title'
```

## Configuration

### Custom Renderer

```typescript
import { marked } from 'marked';
import { renderMarkdown } from './markdownRenderer.js';

const customRenderer = new marked.Renderer();
customRenderer.heading = function({ text, depth }) {
  return `<h${depth} class="custom-heading">${text}</h${depth}>\n`;
};

const html = renderMarkdown(markdown, { renderer: customRenderer });
```

### Disable Sanitization (Not Recommended)

```typescript
const html = renderMarkdown(markdown, { sanitize: false });
// Warning: Only use this if you trust the markdown source completely
```

## Best Practices

1. **Always sanitize user-generated content**: The default sanitization is enabled for security.

2. **Use excerpts for previews**: Generate excerpts instead of rendering full markdown for article previews.

3. **Cache rendered HTML**: Markdown rendering can be expensive for large documents. Cache the HTML output when possible.

4. **Validate markdown before rendering**: Use `isMarkdown()` to check if content contains markdown syntax.

5. **Handle errors gracefully**: The renderer returns an empty string on errors instead of throwing exceptions.

## Performance Considerations

- Rendering is idempotent: rendering the same markdown multiple times produces identical output
- For large documents (>10KB), consider rendering on the server side
- Use code splitting to load the markdown renderer only when needed

## Testing

The markdown renderer includes comprehensive tests:

- **Property-based tests**: Verify universal properties across all inputs
- **Unit tests**: Test specific examples and edge cases
- **XSS protection tests**: Ensure dangerous content is sanitized

Run tests with:
```bash
npm test -- src/utils/markdownRenderer
```
