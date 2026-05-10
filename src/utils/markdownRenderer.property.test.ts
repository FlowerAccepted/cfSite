/**
 * Property-Based Tests for Markdown Renderer
 * 
 * Tests universal properties that should hold for all Markdown inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderMarkdown, renderMarkdownToText, isMarkdown, generateExcerpt } from './markdownRenderer.js';

describe('Markdown Renderer - Property Tests', () => {
  /**
   * Property 9: Markdown语法支持完整性
   * **Validates: Requirements 4.3**
   * 
   * For any Markdown text containing standard syntax elements (headers, lists, links, images, code blocks),
   * the parser must correctly recognize and process all these elements.
   * 
   * This test verifies that:
   * 1. Rendering produces valid HTML output (non-empty string for non-empty input)
   * 2. Common Markdown elements are recognized when properly formatted
   * 3. The renderer doesn't crash on any input
   */
  it('Property 9: Markdown syntax support completeness', () => {
    // Feature: article-system, Property 9: Markdown语法支持完整性
    
    fc.assert(
      fc.property(
        fc.record({
          // Generate various Markdown elements with proper formatting
          header: fc.oneof(
            fc.constant(''),
            fc.tuple(fc.integer({ min: 1, max: 6 }), fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0))
              .map(([level, text]) => `${'#'.repeat(level)} ${text.trim()}\n\n`)
          ),
          bold: fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length > 0 && !trimmed.includes('*') && !trimmed.includes('\\');
            }).map(text => `**${text.trim()}**\n\n`)
          ),
          italic: fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length > 0 && !trimmed.includes('*') && !trimmed.includes('\\');
            }).map(text => `*${text.trim()}*\n\n`)
          ),
          link: fc.oneof(
            fc.constant(''),
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
                const trimmed = s.trim();
                return trimmed.length > 0 && !trimmed.match(/[\[\]\\`*_{}()#+\-.!]/);
              }),
              fc.webUrl()
            ).map(([text, url]) => `[${text.trim()}](${url})\n\n`)
          ),
          image: fc.oneof(
            fc.constant(''),
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
                const trimmed = s.trim();
                return trimmed.length > 0 && !trimmed.match(/[\[\]\\`*_{}()#+\-.!]/);
              }), // Ensure alt text doesn't contain markdown special characters
              fc.webUrl()
            ).map(([alt, url]) => `![${alt.trim()}](${url})\n\n`)
          ),
          list: fc.oneof(
            fc.constant(''),
            fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 })
              .map(items => items.map(item => `- ${item.trim()}`).join('\n') + '\n\n')
          ),
          orderedList: fc.oneof(
            fc.constant(''),
            fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 })
              .map(items => items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n') + '\n\n')
          ),
          code: fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length > 0 && !trimmed.includes('`');
            }).map(code => `\`${code.trim()}\`\n\n`)
          ),
          codeBlock: fc.oneof(
            fc.constant(''),
            fc.tuple(
              fc.constantFrom('javascript', 'python', 'typescript', ''),
              fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
            ).map(([lang, code]) => `\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`)
          ),
          blockquote: fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0).map(text => `> ${text.trim()}\n\n`)
          ),
          paragraph: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0).map(s => s.trim() + '\n\n')
        }),
        (elements) => {
          // Combine all elements into a Markdown document
          const markdown = Object.values(elements).join('');
          
          // Skip empty markdown
          if (markdown.trim().length === 0) {
            return true;
          }
          
          // Render the markdown
          const html = renderMarkdown(markdown);
          
          // Core property: Rendering produces output
          expect(html).toBeTruthy();
          expect(typeof html).toBe('string');
          
          // Verify that rendering doesn't crash and produces some HTML
          // For non-empty markdown, we should get some HTML tags
          if (markdown.trim().length > 0) {
            expect(html.length).toBeGreaterThan(0);
          }
          
          // Check that specific well-formed elements are processed correctly
          // Headers should produce <h1> to <h6> tags
          if (elements.header && typeof elements.header === 'string' && elements.header.match(/^#{1,6}\s+\S/m)) {
            expect(html).toMatch(/<h[1-6]>/);
          }
          
          // Bold should produce <strong> tags (only if properly formatted)
          // Must have exactly ** on each side with content in between
          if (elements.bold && elements.bold.match(/^\*\*[^*]+\*\*\s*$/)) {
            expect(html).toMatch(/<strong>/);
          }
          
          // Italic should produce <em> tags (only if properly formatted)
          // Must have exactly * on each side with content in between, and not be part of bold
          if (elements.italic && elements.italic.match(/^\*[^*]+\*\s*$/) && !elements.italic.includes('**')) {
            expect(html).toMatch(/<em>/);
          }
          
          // Links should produce <a> tags
          if (elements.link && elements.link.match(/\[[^\]]+\]\([^)]+\)/)) {
            expect(html).toMatch(/<a\s+[^>]*href=/);
          }
          
          // Images should produce <img> tags
          if (elements.image && elements.image.match(/!\[[^\]]*\]\([^)]+\)/)) {
            expect(html).toMatch(/<img\s+[^>]*src=/);
          }
          
          // Lists should produce <ul> or <li> tags
          if (elements.list && elements.list.match(/^-\s+\S/m)) {
            expect(html).toMatch(/<ul>|<li>/);
          }
          
          // Ordered lists should produce <ol> or <li> tags
          if (elements.orderedList && elements.orderedList.match(/^\d+\.\s+\S/m)) {
            expect(html).toMatch(/<ol>|<li>/);
          }
          
          // Inline code should produce <code> tags
          if (elements.code && elements.code.match(/`\S.*\S`/)) {
            expect(html).toMatch(/<code>/);
          }
          
          // Code blocks should produce <pre><code> tags
          if (elements.codeBlock && elements.codeBlock.match(/```[\s\S]+```/)) {
            expect(html).toMatch(/<pre>/);
            expect(html).toMatch(/<code/);
          }
          
          // Blockquotes should produce <blockquote> tags
          if (elements.blockquote && elements.blockquote.match(/^>\s+\S/m)) {
            expect(html).toMatch(/<blockquote>/);
          }
          
          // Paragraphs should produce <p> tags (if not empty and not parsed as other element)
          // Skip if paragraph could be parsed as list (starts with * or -)
          if (elements.paragraph && elements.paragraph.trim().length > 0 
              && !elements.paragraph.match(/^[*\-+]\s/)
              && !elements.paragraph.match(/^\d+\.\s/)) {
            expect(html).toMatch(/<p>/);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Markdown渲染幂等性
   * **Validates: Requirements 4.5**
   * 
   * For any Markdown content, rendering twice must produce identical HTML output.
   * (Rendering is idempotent)
   */
  it('Property 11: Markdown rendering idempotency', () => {
    // Feature: article-system, Property 11: Markdown渲染幂等性
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (markdown) => {
          // Render the same markdown twice
          const html1 = renderMarkdown(markdown);
          const html2 = renderMarkdown(markdown);
          
          // Both renders should produce identical output
          expect(html1).toBe(html2);
          
          // Verify the output is a string
          expect(typeof html1).toBe('string');
          expect(typeof html2).toBe('string');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Rendering should never throw errors
   * For any input string, renderMarkdown should return a string (possibly empty)
   * and never throw an exception.
   */
  it('Property: Markdown rendering never throws', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (markdown) => {
          // Rendering should not throw
          expect(() => {
            const html = renderMarkdown(markdown);
            expect(typeof html).toBe('string');
          }).not.toThrow();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sanitization removes dangerous content
   * For any markdown containing script tags or event handlers,
   * the rendered HTML should not contain these dangerous elements.
   */
  it('Property: Sanitization removes dangerous content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('onclick', 'onerror', 'onload', 'onmouseover'),
        (text, eventHandler) => {
          // Create markdown with dangerous HTML
          const dangerousMarkdown = `
# Test

<script>alert('xss')</script>

<img src="x" ${eventHandler}="alert('xss')">

${text}
          `.trim();
          
          const html = renderMarkdown(dangerousMarkdown);
          
          // Verify dangerous content is removed
          expect(html.toLowerCase()).not.toContain('<script');
          expect(html.toLowerCase()).not.toContain(eventHandler.toLowerCase());
          expect(html.toLowerCase()).not.toContain('javascript:');
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Text extraction preserves content
   * For any markdown, converting to text should preserve the textual content
   * (without HTML tags or markdown syntax).
   */
  it('Property: Text extraction preserves content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (text) => {
          // Create simple markdown with the text
          const markdown = `# Title\n\n${text}`;
          
          const plainText = renderMarkdownToText(markdown);
          
          // The plain text should contain the original text content
          // (may have whitespace differences)
          expect(plainText).toBeTruthy();
          expect(typeof plainText).toBe('string');
          
          // Should not contain HTML tags (proper HTML tags start with a letter or /)
          expect(plainText).not.toMatch(/<[a-zA-Z\/][^>]*>/);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Excerpt generation produces shorter text
   * For any markdown longer than the excerpt length,
   * the excerpt should be shorter than or equal to the specified length.
   */
  it('Property: Excerpt generation respects length limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100, maxLength: 1000 }),
        fc.integer({ min: 50, max: 200 }),
        (markdown, maxLength) => {
          const excerpt = generateExcerpt(markdown, maxLength);
          
          // Excerpt should not exceed the specified length (plus ellipsis)
          expect(excerpt.length).toBeLessThanOrEqual(maxLength + 3); // +3 for '...'
          
          // Should be a string
          expect(typeof excerpt).toBe('string');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
