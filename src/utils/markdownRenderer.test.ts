/**
 * Unit Tests for Markdown Renderer
 * 
 * Tests specific examples, edge cases, and XSS protection.
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import { describe, it, expect } from 'vitest';
import {
  renderMarkdown,
  renderMarkdownToText,
  isMarkdown,
  extractFirstHeading,
  generateExcerpt
} from './markdownRenderer.js';

describe('Markdown Renderer - Unit Tests', () => {
  describe('renderMarkdown', () => {
    it('should render headers correctly', () => {
      const markdown = '# H1\n## H2\n### H3';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<h1>H1</h1>');
      expect(html).toContain('<h2>H2</h2>');
      expect(html).toContain('<h3>H3</h3>');
    });

    it('should render bold text correctly', () => {
      const markdown = 'This is **bold** text';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<strong>bold</strong>');
    });

    it('should render italic text correctly', () => {
      const markdown = 'This is *italic* text';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<em>italic</em>');
    });

    it('should render links correctly', () => {
      const markdown = '[Google](https://google.com)';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<a href="https://google.com">Google</a>');
    });

    it('should render images correctly', () => {
      const markdown = '![Alt text](https://example.com/image.jpg)';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<img');
      expect(html).toContain('src="https://example.com/image.jpg"');
      expect(html).toContain('alt="Alt text"');
    });

    it('should render unordered lists correctly', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<li>Item 3</li>');
      expect(html).toContain('</ul>');
    });

    it('should render ordered lists correctly', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>First</li>');
      expect(html).toContain('<li>Second</li>');
      expect(html).toContain('<li>Third</li>');
      expect(html).toContain('</ol>');
    });

    it('should render inline code correctly', () => {
      const markdown = 'Use `console.log()` to debug';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<code>console.log()</code>');
    });

    it('should render code blocks correctly', () => {
      const markdown = '```javascript\nconst x = 42;\n```';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<pre>');
      expect(html).toContain('<code');
      expect(html).toContain('const x = 42;');
    });

    it('should render code blocks with language class', () => {
      const markdown = '```python\nprint("hello")\n```';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('language-python');
    });

    it('should render blockquotes correctly', () => {
      const markdown = '> This is a quote';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<blockquote>');
      expect(html).toContain('This is a quote');
      expect(html).toContain('</blockquote>');
    });

    it('should render tables correctly', () => {
      const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
      `.trim();
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>Header 1</th>');
      expect(html).toContain('<td>Cell 1</td>');
    });

    it('should handle empty markdown', () => {
      const html = renderMarkdown('');
      expect(html).toBe('');
    });

    it('should handle plain text without markdown syntax', () => {
      const markdown = 'Just plain text';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('Just plain text');
      expect(html).toContain('<p>');
    });

    it('should handle complex nested markdown', () => {
      const markdown = `
# Title

This is a paragraph with **bold** and *italic* text.

- List item with [link](https://example.com)
- Another item with \`code\`

\`\`\`javascript
const x = 42;
\`\`\`

> A quote with **bold** text
      `.trim();
      
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<ul>');
      expect(html).toContain('<a href="https://example.com">link</a>');
      expect(html).toContain('<code>code</code>');
      expect(html).toContain('<pre>');
      expect(html).toContain('<blockquote>');
    });
  });

  describe('XSS Protection (Requirements 4.1, 4.2)', () => {
    it('should remove script tags', () => {
      const markdown = '<script>alert("xss")</script>\n\nSafe content';
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('<script');
      expect(html.toLowerCase()).not.toContain('alert');
      expect(html).toContain('Safe content');
    });

    it('should remove onclick event handlers', () => {
      const markdown = '<div onclick="alert(\'xss\')">Click me</div>';
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('onclick');
    });

    it('should remove onerror event handlers', () => {
      const markdown = '<img src="x" onerror="alert(\'xss\')">';
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('onerror');
    });

    it('should remove javascript: protocol in links', () => {
      const markdown = '<a href="javascript:alert(\'xss\')">Click</a>';
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('javascript:');
    });

    it('should remove data: protocol in images', () => {
      const markdown = '<img src="data:text/html,<script>alert(\'xss\')</script>">';
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('data:');
    });

    it('should remove style attributes', () => {
      const markdown = '<div style="background: url(javascript:alert(\'xss\'))">Text</div>';
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('style=');
    });

    it('should handle multiple XSS attempts in one document', () => {
      const markdown = `
# Title

<script>alert('xss1')</script>

Normal paragraph

<img src="x" onerror="alert('xss2')">

[Link](javascript:alert('xss3'))

<div onclick="alert('xss4')">Click</div>
      `.trim();
      
      const html = renderMarkdown(markdown);
      
      expect(html.toLowerCase()).not.toContain('<script');
      expect(html.toLowerCase()).not.toContain('onerror');
      expect(html.toLowerCase()).not.toContain('onclick');
      expect(html.toLowerCase()).not.toContain('javascript:');
      expect(html).toContain('Normal paragraph');
    });

    it('should allow safe HTML tags', () => {
      const markdown = 'Text with <strong>bold</strong> and <em>italic</em>';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });
  });

  describe('renderMarkdownToText', () => {
    it('should strip HTML tags', () => {
      const markdown = '# Title\n\nThis is **bold** text';
      const text = renderMarkdownToText(markdown);
      
      expect(text).not.toContain('<h1>');
      expect(text).not.toContain('<strong>');
      expect(text).toContain('Title');
      expect(text).toContain('bold');
    });

    it('should decode HTML entities', () => {
      const markdown = 'Text with &lt; and &gt; and &amp;';
      const text = renderMarkdownToText(markdown);
      
      expect(text).toContain('<');
      expect(text).toContain('>');
      expect(text).toContain('&');
    });

    it('should truncate to maxLength', () => {
      const markdown = 'A'.repeat(200);
      const text = renderMarkdownToText(markdown, 50);
      
      expect(text.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(text).toContain('...');
    });

    it('should handle empty markdown', () => {
      const text = renderMarkdownToText('');
      expect(text).toBe('');
    });
  });

  describe('isMarkdown', () => {
    it('should detect headers', () => {
      expect(isMarkdown('# Header')).toBe(true);
      expect(isMarkdown('## Header')).toBe(true);
    });

    it('should detect bold text', () => {
      expect(isMarkdown('**bold**')).toBe(true);
    });

    it('should detect italic text', () => {
      expect(isMarkdown('*italic*')).toBe(true);
    });

    it('should detect links', () => {
      expect(isMarkdown('[link](url)')).toBe(true);
    });

    it('should detect images', () => {
      expect(isMarkdown('![alt](url)')).toBe(true);
    });

    it('should detect lists', () => {
      expect(isMarkdown('- item')).toBe(true);
      expect(isMarkdown('* item')).toBe(true);
      expect(isMarkdown('1. item')).toBe(true);
    });

    it('should detect code blocks', () => {
      expect(isMarkdown('```code```')).toBe(true);
    });

    it('should detect inline code', () => {
      expect(isMarkdown('`code`')).toBe(true);
    });

    it('should detect blockquotes', () => {
      expect(isMarkdown('> quote')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isMarkdown('Just plain text')).toBe(false);
    });
  });

  describe('extractFirstHeading', () => {
    it('should extract h1 heading', () => {
      const markdown = '# Main Title\n\nContent';
      expect(extractFirstHeading(markdown)).toBe('Main Title');
    });

    it('should extract h2 heading', () => {
      const markdown = '## Subtitle\n\nContent';
      expect(extractFirstHeading(markdown)).toBe('Subtitle');
    });

    it('should return null if no heading', () => {
      const markdown = 'Just content without heading';
      expect(extractFirstHeading(markdown)).toBeNull();
    });

    it('should extract first heading when multiple exist', () => {
      const markdown = '# First\n\n## Second\n\n### Third';
      expect(extractFirstHeading(markdown)).toBe('First');
    });
  });

  describe('generateExcerpt', () => {
    it('should generate excerpt from first paragraph', () => {
      const markdown = '# Title\n\nThis is the first paragraph.\n\nThis is the second.';
      const excerpt = generateExcerpt(markdown, 100);
      
      expect(excerpt).toContain('first paragraph');
      expect(excerpt).not.toContain('Title');
    });

    it('should remove markdown syntax', () => {
      const markdown = 'This is **bold** and *italic* text with [link](url)';
      const excerpt = generateExcerpt(markdown, 100);
      
      expect(excerpt).not.toContain('**');
      expect(excerpt).not.toContain('*');
      expect(excerpt).not.toContain('[');
      expect(excerpt).not.toContain('](');
      expect(excerpt).toContain('bold');
      expect(excerpt).toContain('italic');
      expect(excerpt).toContain('link');
    });

    it('should truncate to specified length', () => {
      const markdown = 'A'.repeat(200);
      const excerpt = generateExcerpt(markdown, 50);
      
      expect(excerpt.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    it('should remove code blocks', () => {
      const markdown = 'Text before\n\n```\ncode\n```\n\nText after';
      const excerpt = generateExcerpt(markdown, 100);
      
      expect(excerpt).not.toContain('```');
      expect(excerpt).not.toContain('code');
    });

    it('should remove images', () => {
      const markdown = 'Text with ![image](url) in it';
      const excerpt = generateExcerpt(markdown, 100);
      
      expect(excerpt).not.toContain('![');
      expect(excerpt).not.toContain('](');
    });

    it('should handle empty markdown', () => {
      const excerpt = generateExcerpt('', 100);
      expect(excerpt).toBe('');
    });

    it('should handle markdown with only headings', () => {
      const markdown = '# Title\n## Subtitle';
      const excerpt = generateExcerpt(markdown, 100);
      
      // Should return empty or minimal text since headings are removed
      expect(excerpt.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Idempotency (Requirement 4.5)', () => {
    it('should produce same output when rendered multiple times', () => {
      const markdown = '# Title\n\nThis is **bold** and *italic* text.';
      
      const html1 = renderMarkdown(markdown);
      const html2 = renderMarkdown(markdown);
      const html3 = renderMarkdown(markdown);
      
      expect(html1).toBe(html2);
      expect(html2).toBe(html3);
    });

    it('should be idempotent with complex markdown', () => {
      const markdown = `
# Title

- List item 1
- List item 2

\`\`\`javascript
const x = 42;
\`\`\`

> Quote

[Link](https://example.com)
      `.trim();
      
      const html1 = renderMarkdown(markdown);
      const html2 = renderMarkdown(markdown);
      
      expect(html1).toBe(html2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long markdown', () => {
      const markdown = 'A'.repeat(10000);
      const html = renderMarkdown(markdown);
      
      expect(html).toBeTruthy();
      expect(typeof html).toBe('string');
    });

    it('should handle markdown with special characters', () => {
      const markdown = 'Text with <>&"\'';
      const html = renderMarkdown(markdown);
      
      expect(html).toBeTruthy();
    });

    it('should handle markdown with unicode characters', () => {
      const markdown = '# 中文标题\n\n这是中文内容 with emoji 🎉';
      const html = renderMarkdown(markdown);
      
      expect(html).toContain('中文标题');
      expect(html).toContain('这是中文内容');
      expect(html).toContain('🎉');
    });

    it('should handle malformed markdown gracefully', () => {
      const markdown = '# Unclosed [link\n\n**Unclosed bold';
      const html = renderMarkdown(markdown);
      
      // Should not throw, should produce some output
      expect(html).toBeTruthy();
      expect(typeof html).toBe('string');
    });

    it('should handle markdown with only whitespace', () => {
      const html = renderMarkdown('   \n\n   \t\t   ');
      // Empty or whitespace-only markdown may return empty string
      expect(typeof html).toBe('string');
    });
  });
});
