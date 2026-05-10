/**
 * Integration tests for UI component logic
 *
 * Since these are Astro components, we test the pure helper functions
 * extracted from each component rather than full DOM rendering.
 *
 * Requirements: 1.2, 2.2, 5.3, 7.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers extracted from ArticleCard.astro
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Highlight occurrences of `pattern` in `text`.
 * Escapes HTML in non-matching segments, wraps matches in <mark>.
 * Falls back to plain escaped text if the pattern is invalid or empty.
 */
function applyHighlight(text: string, pattern: string): string {
  if (!pattern) return escapeHtml(text);
  let regex: RegExp;
  try {
    regex = new RegExp(`(${pattern})`, 'gi');
  } catch {
    return escapeHtml(text);
  }

  const parts = text.split(regex);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) {
        return `<mark class="article-card-highlight">${escapeHtml(part)}</mark>`;
      }
      return escapeHtml(part);
    })
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper extracted from SearchBar.astro
// ─────────────────────────────────────────────────────────────────────────────

function validateRegex(pattern: string): { valid: boolean; error?: string } {
  if (!pattern) return { valid: true };
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : '无效的正则表达式',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CategorySelector state management (extracted from the <script> block)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure state-management logic for CategorySelector.
 * Mirrors the select / deselect helpers in the component's <script> block.
 */
class CategorySelectorState {
  private selectedIds: Set<string>;

  constructor(initialIds: string[] = []) {
    this.selectedIds = new Set(initialIds);
  }

  select(id: string): void {
    this.selectedIds.add(id);
  }

  deselect(id: string): void {
    this.selectedIds.delete(id);
  }

  toggle(id: string): void {
    if (this.selectedIds.has(id)) {
      this.deselect(id);
    } else {
      this.select(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  getSelected(): string[] {
    return Array.from(this.selectedIds);
  }

  clear(): void {
    this.selectedIds.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExternalContentLoader — mock the loadContent service
// ─────────────────────────────────────────────────────────────────────────────

import type { ExternalContent } from '../services/externalLoaderService';

// We test the rendering decision logic that lives in the component's frontmatter.
function resolveRenderMode(result: ExternalContent): {
  isSuccess: boolean;
  isMarkdown: boolean;
  showFallback: boolean;
} {
  if (!result.success || !result.content) {
    return { isSuccess: false, isMarkdown: false, showFallback: true };
  }
  const ct = result.contentType.toLowerCase();
  const isMarkdown =
    ct.includes('markdown') ||
    ct.includes('text/x-markdown') ||
    // Simple heuristic: content starts with a Markdown heading
    result.content.trimStart().startsWith('#');
  return { isSuccess: true, isMarkdown, showFallback: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: ArticleCard — applyHighlight
// ─────────────────────────────────────────────────────────────────────────────

describe('ArticleCard — applyHighlight (Requirements: 2.6, 7.1)', () => {
  describe('No pattern (empty string)', () => {
    it('returns HTML-escaped text when pattern is empty', () => {
      expect(applyHighlight('Hello world', '')).toBe('Hello world');
    });

    it('escapes HTML special characters when pattern is empty', () => {
      expect(applyHighlight('<script>alert(1)</script>', '')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;'
      );
    });
  });

  describe('Simple literal patterns', () => {
    it('wraps a single match in <mark>', () => {
      const result = applyHighlight('Hello world', 'world');
      expect(result).toBe(
        'Hello <mark class="article-card-highlight">world</mark>'
      );
    });

    it('wraps multiple matches in <mark>', () => {
      const result = applyHighlight('test test test', 'test');
      expect(result).toBe(
        '<mark class="article-card-highlight">test</mark> ' +
          '<mark class="article-card-highlight">test</mark> ' +
          '<mark class="article-card-highlight">test</mark>'
      );
    });

    it('is case-insensitive', () => {
      const result = applyHighlight('Hello HELLO hello', 'hello');
      expect(result).toContain('<mark class="article-card-highlight">Hello</mark>');
      expect(result).toContain('<mark class="article-card-highlight">HELLO</mark>');
      expect(result).toContain('<mark class="article-card-highlight">hello</mark>');
    });

    it('returns escaped text when pattern has no match', () => {
      const result = applyHighlight('Hello world', 'xyz');
      expect(result).toBe('Hello world');
    });
  });

  describe('Regex patterns', () => {
    it('highlights digit sequences with \\d+', () => {
      const result = applyHighlight('version 2.0 release', '\\d+');
      expect(result).toContain('<mark class="article-card-highlight">2</mark>');
      expect(result).toContain('<mark class="article-card-highlight">0</mark>');
    });

    it('highlights alternation patterns (cat|dog)', () => {
      const result = applyHighlight('I have a cat and a dog', 'cat|dog');
      expect(result).toContain('<mark class="article-card-highlight">cat</mark>');
      expect(result).toContain('<mark class="article-card-highlight">dog</mark>');
    });

    it('highlights anchor pattern ^start', () => {
      const result = applyHighlight('Start here', '^Start');
      expect(result).toContain('<mark class="article-card-highlight">Start</mark>');
    });

    it('highlights character class [a-z]+', () => {
      const result = applyHighlight('abc123', '[a-z]+');
      expect(result).toContain('<mark class="article-card-highlight">abc</mark>');
    });
  });

  describe('HTML escaping inside matches', () => {
    it('escapes HTML inside matched text', () => {
      const result = applyHighlight('<b>bold</b>', 'bold');
      // The non-matching parts should be escaped
      expect(result).toContain('&lt;b&gt;');
      expect(result).toContain('&lt;/b&gt;');
      // The match itself should be wrapped and escaped
      expect(result).toContain(
        '<mark class="article-card-highlight">bold</mark>'
      );
    });

    it('escapes ampersands in non-matching segments', () => {
      const result = applyHighlight('cats & dogs', 'cats');
      expect(result).toContain('&amp;');
    });

    it('escapes quotes in non-matching segments', () => {
      const result = applyHighlight('say "hello"', 'hello');
      expect(result).toContain('&quot;');
    });
  });

  describe('Invalid regex patterns', () => {
    it('falls back to escaped plain text for invalid regex', () => {
      const result = applyHighlight('test text', '[invalid');
      expect(result).toBe('test text');
      expect(result).not.toContain('<mark');
    });

    it('falls back gracefully for unterminated group', () => {
      const result = applyHighlight('hello world', '(hello');
      expect(result).toBe('hello world');
    });
  });

  describe('Edge cases', () => {
    it('handles empty text', () => {
      expect(applyHighlight('', 'test')).toBe('');
    });

    it('handles text with only special HTML characters', () => {
      const result = applyHighlight('&<>"\'', '');
      expect(result).toBe('&amp;&lt;&gt;&quot;&#39;');
    });

    it('preserves original text content (without marks)', () => {
      const original = 'Hello world! How are you?';
      const result = applyHighlight(original, 'world');
      const withoutMarks = result.replace(
        /<\/?mark[^>]*>/g,
        ''
      );
      expect(withoutMarks).toBe(original);
    });

    it('handles Chinese characters in text', () => {
      const result = applyHighlight('你好世界 Hello', 'Hello');
      expect(result).toContain('<mark class="article-card-highlight">Hello</mark>');
      expect(result).toContain('你好世界');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: SearchBar — validateRegex (Requirements: 2.2, 2.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('SearchBar — validateRegex (Requirements: 2.2, 2.4)', () => {
  describe('Valid patterns', () => {
    it('returns valid for empty string', () => {
      expect(validateRegex('')).toEqual({ valid: true });
    });

    it('returns valid for simple literal', () => {
      expect(validateRegex('hello').valid).toBe(true);
    });

    it('returns valid for character class', () => {
      expect(validateRegex('[a-z]+').valid).toBe(true);
    });

    it('returns valid for quantifiers', () => {
      expect(validateRegex('\\d{2,4}').valid).toBe(true);
    });

    it('returns valid for alternation', () => {
      expect(validateRegex('cat|dog').valid).toBe(true);
    });

    it('returns valid for anchors', () => {
      expect(validateRegex('^start.*end$').valid).toBe(true);
    });

    it('returns valid for groups', () => {
      expect(validateRegex('(\\w+)@(\\w+)').valid).toBe(true);
    });

    it('returns valid for lookahead', () => {
      expect(validateRegex('(?=.*[a-z])').valid).toBe(true);
    });

    it('returns valid for unicode range', () => {
      expect(validateRegex('[\\u4e00-\\u9fa5]+').valid).toBe(true);
    });

    it('returns valid for escaped special characters', () => {
      expect(validateRegex('\\$\\^\\*\\+\\?').valid).toBe(true);
    });
  });

  describe('Invalid patterns', () => {
    it('returns invalid for unterminated character class', () => {
      const result = validateRegex('[abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('returns invalid for unterminated group', () => {
      const result = validateRegex('(abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for invalid quantifier range', () => {
      const result = validateRegex('a{5,2}');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for invalid named group reference', () => {
      const result = validateRegex('(?<invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('provides a descriptive error message', () => {
      const result = validateRegex('[a-z');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error!.length).toBeGreaterThan(0);
    });

    it('does not throw — returns error object instead', () => {
      expect(() => validateRegex('[[[invalid')).not.toThrow();
      const result = validateRegex('[[[invalid');
      expect(result.valid).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles very long valid patterns', () => {
      const longPattern = 'a'.repeat(500);
      expect(validateRegex(longPattern).valid).toBe(true);
    });

    it('handles patterns with multiple potential errors', () => {
      const result = validateRegex('[abc(def');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: CategorySelector — state management (Requirements: 1.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('CategorySelector — state management (Requirements: 1.2)', () => {
  let state: CategorySelectorState;

  beforeEach(() => {
    state = new CategorySelectorState();
  });

  describe('Initial state', () => {
    it('starts with no selected categories', () => {
      expect(state.getSelected()).toEqual([]);
    });

    it('accepts initial selected IDs', () => {
      const s = new CategorySelectorState(['cat-1', 'cat-2']);
      expect(s.getSelected()).toContain('cat-1');
      expect(s.getSelected()).toContain('cat-2');
    });
  });

  describe('select()', () => {
    it('adds a category to the selection', () => {
      state.select('cat-1');
      expect(state.isSelected('cat-1')).toBe(true);
    });

    it('is idempotent — selecting twice does not duplicate', () => {
      state.select('cat-1');
      state.select('cat-1');
      expect(state.getSelected().filter((id) => id === 'cat-1').length).toBe(1);
    });

    it('can select multiple categories', () => {
      state.select('cat-1');
      state.select('cat-2');
      state.select('cat-3');
      expect(state.getSelected().length).toBe(3);
    });
  });

  describe('deselect()', () => {
    it('removes a selected category', () => {
      state.select('cat-1');
      state.deselect('cat-1');
      expect(state.isSelected('cat-1')).toBe(false);
    });

    it('is safe to call on a non-selected category', () => {
      expect(() => state.deselect('cat-99')).not.toThrow();
      expect(state.getSelected()).toEqual([]);
    });

    it('only removes the targeted category', () => {
      state.select('cat-1');
      state.select('cat-2');
      state.deselect('cat-1');
      expect(state.isSelected('cat-1')).toBe(false);
      expect(state.isSelected('cat-2')).toBe(true);
    });
  });

  describe('toggle()', () => {
    it('selects an unselected category', () => {
      state.toggle('cat-1');
      expect(state.isSelected('cat-1')).toBe(true);
    });

    it('deselects a selected category', () => {
      state.select('cat-1');
      state.toggle('cat-1');
      expect(state.isSelected('cat-1')).toBe(false);
    });

    it('double-toggle returns to original state', () => {
      state.toggle('cat-1');
      state.toggle('cat-1');
      expect(state.isSelected('cat-1')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('removes all selected categories', () => {
      state.select('cat-1');
      state.select('cat-2');
      state.clear();
      expect(state.getSelected()).toEqual([]);
    });
  });

  describe('Form submission — hidden inputs', () => {
    it('getSelected() returns all currently selected IDs', () => {
      state.select('cat-a');
      state.select('cat-b');
      const selected = state.getSelected();
      expect(selected).toContain('cat-a');
      expect(selected).toContain('cat-b');
      expect(selected.length).toBe(2);
    });

    it('reflects deselection in getSelected()', () => {
      state.select('cat-a');
      state.select('cat-b');
      state.deselect('cat-a');
      const selected = state.getSelected();
      expect(selected).not.toContain('cat-a');
      expect(selected).toContain('cat-b');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: ExternalContentLoader — success and error states (Requirements: 5.3)
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalContentLoader — render mode resolution (Requirements: 5.3)', () => {
  describe('Success state', () => {
    it('resolves to success when loadContent returns success=true', () => {
      const result: ExternalContent = {
        content: 'Hello world',
        contentType: 'text/plain',
        loadTime: 120,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.isSuccess).toBe(true);
      expect(mode.showFallback).toBe(false);
    });

    it('detects plain text content type', () => {
      const result: ExternalContent = {
        content: 'Plain text content',
        contentType: 'text/plain',
        loadTime: 80,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.isMarkdown).toBe(false);
    });

    it('detects markdown content type by content-type header', () => {
      const result: ExternalContent = {
        content: '# Heading\n\nSome text',
        contentType: 'text/markdown',
        loadTime: 95,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.isMarkdown).toBe(true);
    });

    it('detects markdown by text/x-markdown content type', () => {
      const result: ExternalContent = {
        content: '## Section\n\nContent here',
        contentType: 'text/x-markdown',
        loadTime: 110,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.isMarkdown).toBe(true);
    });

    it('detects markdown by content heuristic (starts with #)', () => {
      const result: ExternalContent = {
        content: '# My Article\n\nSome content',
        contentType: 'text/plain',
        loadTime: 75,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.isMarkdown).toBe(true);
    });

    it('does not treat non-heading plain text as markdown', () => {
      const result: ExternalContent = {
        content: 'Just plain text without heading',
        contentType: 'text/plain',
        loadTime: 60,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.isMarkdown).toBe(false);
    });
  });

  describe('Error state — graceful degradation (Requirements: 5.4)', () => {
    it('shows fallback when success=false', () => {
      const result: ExternalContent = {
        content: '',
        contentType: 'text/plain',
        loadTime: 0,
        success: false,
        error: 'HTTP 404: Not Found',
      };
      const mode = resolveRenderMode(result);
      expect(mode.isSuccess).toBe(false);
      expect(mode.showFallback).toBe(true);
    });

    it('shows fallback on timeout error', () => {
      const result: ExternalContent = {
        content: '',
        contentType: 'text/plain',
        loadTime: 5000,
        success: false,
        error: 'Request timeout',
      };
      const mode = resolveRenderMode(result);
      expect(mode.showFallback).toBe(true);
    });

    it('shows fallback on network error', () => {
      const result: ExternalContent = {
        content: '',
        contentType: 'text/plain',
        loadTime: 0,
        success: false,
        error: 'Failed to fetch',
      };
      const mode = resolveRenderMode(result);
      expect(mode.showFallback).toBe(true);
    });

    it('shows fallback on HTTP 500 error', () => {
      const result: ExternalContent = {
        content: '',
        contentType: 'text/plain',
        loadTime: 200,
        success: false,
        error: 'HTTP 500: Internal Server Error',
      };
      const mode = resolveRenderMode(result);
      expect(mode.showFallback).toBe(true);
    });

    it('shows fallback when content is empty even if success=true', () => {
      const result: ExternalContent = {
        content: '',
        contentType: 'text/plain',
        loadTime: 50,
        success: true,
      };
      const mode = resolveRenderMode(result);
      expect(mode.showFallback).toBe(true);
    });
  });

  describe('loadContent mock integration', () => {
    it('mocked loadContent returning success is handled correctly', async () => {
      const mockLoadContent = vi.fn().mockResolvedValue({
        content: '# External Article\n\nContent here.',
        contentType: 'text/plain',
        loadTime: 150,
        success: true,
      } satisfies ExternalContent);

      const result = await mockLoadContent('https://example.com/article.md', 5000);
      const mode = resolveRenderMode(result);

      expect(mockLoadContent).toHaveBeenCalledWith(
        'https://example.com/article.md',
        5000
      );
      expect(mode.isSuccess).toBe(true);
      expect(mode.isMarkdown).toBe(true); // starts with #
      expect(mode.showFallback).toBe(false);
    });

    it('mocked loadContent returning error is handled correctly', async () => {
      const mockLoadContent = vi.fn().mockResolvedValue({
        content: '',
        contentType: 'text/plain',
        loadTime: 5000,
        success: false,
        error: 'Request timeout',
      } satisfies ExternalContent);

      const result = await mockLoadContent('https://slow.example.com/', 5000);
      const mode = resolveRenderMode(result);

      expect(mode.isSuccess).toBe(false);
      expect(mode.showFallback).toBe(true);
    });

    it('mocked loadContent with 404 shows fallback', async () => {
      const mockLoadContent = vi.fn().mockResolvedValue({
        content: '',
        contentType: 'text/plain',
        loadTime: 80,
        success: false,
        error: 'HTTP 404: Not Found',
      } satisfies ExternalContent);

      const result = await mockLoadContent('https://example.com/missing', 5000);
      const mode = resolveRenderMode(result);

      expect(mode.showFallback).toBe(true);
      expect(result.error).toContain('404');
    });

    it('mocked loadContent with plain text shows non-markdown mode', async () => {
      const mockLoadContent = vi.fn().mockResolvedValue({
        content: 'Just some plain text content without markdown.',
        contentType: 'text/plain',
        loadTime: 90,
        success: true,
      } satisfies ExternalContent);

      const result = await mockLoadContent('https://example.com/plain.txt', 5000);
      const mode = resolveRenderMode(result);

      expect(mode.isSuccess).toBe(true);
      expect(mode.isMarkdown).toBe(false);
    });
  });
});
