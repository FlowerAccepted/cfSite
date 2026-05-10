/**
 * Tests for URL Generation Utilities
 * 
 * Includes both unit tests (specific examples) and property-based tests (universal properties)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateUrlName } from './urlGenerator';

describe('generateUrlName - Unit Tests', () => {
  describe('Basic functionality', () => {
    it('converts simple title to lowercase', () => {
      expect(generateUrlName('Hello World')).toBe('hello-world');
    });

    it('replaces spaces with hyphens', () => {
      expect(generateUrlName('Multiple Word Title')).toBe('multiple-word-title');
    });

    it('handles empty string', () => {
      expect(generateUrlName('')).toBe('');
    });

    it('handles whitespace-only string', () => {
      expect(generateUrlName('   ')).toBe('');
    });
  });

  describe('Special character handling', () => {
    it('removes special characters and replaces with hyphens', () => {
      expect(generateUrlName('Hello! World?')).toBe('hello-world');
    });

    it('handles multiple consecutive special characters', () => {
      expect(generateUrlName('Hello!!! World???')).toBe('hello-world');
    });

    it('preserves underscores', () => {
      expect(generateUrlName('hello_world_test')).toBe('hello_world_test');
    });

    it('handles mixed underscores and hyphens', () => {
      expect(generateUrlName('hello_world-test')).toBe('hello_world-test');
    });

    it('removes leading and trailing special characters', () => {
      expect(generateUrlName('!!!Hello World!!!')).toBe('hello-world');
    });

    it('handles parentheses and brackets', () => {
      expect(generateUrlName('Article (Part 1) [Draft]')).toBe('article-part-1-draft');
    });

    it('handles dots and commas', () => {
      expect(generateUrlName('Hello, World. Test.')).toBe('hello-world-test');
    });
  });

  describe('Chinese character handling', () => {
    it('removes Chinese characters', () => {
      expect(generateUrlName('你好世界')).toBe('');
    });

    it('removes Chinese characters but keeps English', () => {
      expect(generateUrlName('你好 Hello 世界 World')).toBe('hello-world');
    });

    it('handles mixed Chinese and English with special chars', () => {
      expect(generateUrlName('文章标题: Article Title!')).toBe('article-title');
    });

    it('handles Chinese characters at different positions', () => {
      expect(generateUrlName('Start 开始 Middle 中间 End')).toBe('start-middle-end');
    });
  });

  describe('Length limiting', () => {
    it('limits to 100 characters', () => {
      const longTitle = 'a'.repeat(150);
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toBe('a'.repeat(100));
    });

    it('handles long title with spaces', () => {
      const longTitle = 'word '.repeat(30); // 150 characters
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('removes trailing hyphen after truncation', () => {
      const longTitle = 'word-'.repeat(25); // Creates "word-word-word-..."
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.endsWith('-')).toBe(false);
    });

    it('handles exactly 100 character input', () => {
      const title = 'a'.repeat(100);
      const result = generateUrlName(title);
      expect(result).toBe(title);
      expect(result.length).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('handles title with only special characters', () => {
      expect(generateUrlName('!@#$%^&*()')).toBe('');
    });

    it('handles title with numbers', () => {
      expect(generateUrlName('Article 123 Test 456')).toBe('article-123-test-456');
    });

    it('handles title starting with numbers', () => {
      expect(generateUrlName('123 Article')).toBe('123-article');
    });

    it('handles multiple consecutive spaces', () => {
      expect(generateUrlName('Hello     World')).toBe('hello-world');
    });

    it('handles tabs and newlines', () => {
      expect(generateUrlName('Hello\tWorld\nTest')).toBe('hello-world-test');
    });

    it('handles emoji characters', () => {
      expect(generateUrlName('Hello 😀 World 🌍')).toBe('hello-world');
    });

    it('handles accented characters', () => {
      expect(generateUrlName('Café Résumé')).toBe('caf-r-sum');
    });
  });

  // Task 3.3: Additional edge case tests for URL generation
  describe('Edge cases - Chinese characters (Task 3.3)', () => {
    it('removes all Chinese characters from title', () => {
      expect(generateUrlName('你好世界')).toBe('');
    });

    it('removes Chinese characters but preserves English words', () => {
      expect(generateUrlName('你好 Hello 世界 World')).toBe('hello-world');
    });

    it('handles Chinese punctuation', () => {
      expect(generateUrlName('文章：标题')).toBe('');
    });

    it('handles mixed Chinese, English, and numbers', () => {
      expect(generateUrlName('2024年 Article 测试')).toBe('2024-article');
    });

    it('handles Chinese characters at boundaries', () => {
      expect(generateUrlName('开始Start')).toBe('start');
      expect(generateUrlName('End结束')).toBe('end');
    });

    it('handles traditional Chinese characters', () => {
      expect(generateUrlName('繁體中文 Traditional')).toBe('traditional');
    });
  });

  describe('Edge cases - Emojis (Task 3.3)', () => {
    it('removes single emoji', () => {
      expect(generateUrlName('😀')).toBe('');
    });

    it('removes multiple emojis', () => {
      expect(generateUrlName('😀😁😂🤣')).toBe('');
    });

    it('removes emojis but preserves text', () => {
      expect(generateUrlName('Hello 😀 World')).toBe('hello-world');
    });

    it('handles emojis at start and end', () => {
      expect(generateUrlName('😀 Start')).toBe('start');
      expect(generateUrlName('End 😀')).toBe('end');
    });

    it('handles various emoji types', () => {
      expect(generateUrlName('Faces 😀😁 Animals 🐶🐱 Symbols ❤️✨')).toBe('faces-animals-symbols');
    });

    it('handles emoji with skin tone modifiers', () => {
      expect(generateUrlName('Hello 👋🏻 World')).toBe('hello-world');
    });

    it('handles flag emojis', () => {
      expect(generateUrlName('USA 🇺🇸 China 🇨🇳')).toBe('usa-china');
    });

    it('handles combined emojis', () => {
      expect(generateUrlName('Family 👨‍👩‍👧‍👦 Test')).toBe('family-test');
    });
  });

  describe('Edge cases - Special characters (Task 3.3)', () => {
    it('handles currency symbols', () => {
      expect(generateUrlName('Price $100 €50 ¥1000')).toBe('price-100-50-1000');
    });

    it('handles mathematical symbols', () => {
      expect(generateUrlName('Formula: x + y = z')).toBe('formula-x-y-z');
    });

    it('handles quotation marks', () => {
      expect(generateUrlName('"Quoted" \'Text\'')).toBe('quoted-text');
    });

    it('handles angle brackets', () => {
      expect(generateUrlName('<HTML> Tags')).toBe('html-tags');
    });

    it('handles slashes', () => {
      expect(generateUrlName('Path/To/File')).toBe('path-to-file');
      expect(generateUrlName('And\\Or')).toBe('and-or');
    });

    it('handles ampersands', () => {
      expect(generateUrlName('Rock & Roll')).toBe('rock-roll');
    });

    it('handles asterisks and plus signs', () => {
      expect(generateUrlName('C++ and C*')).toBe('c-and-c');
    });

    it('handles percentage signs', () => {
      expect(generateUrlName('100% Complete')).toBe('100-complete');
    });

    it('handles hash symbols', () => {
      expect(generateUrlName('#hashtag #test')).toBe('hashtag-test');
    });

    it('handles at symbols', () => {
      expect(generateUrlName('Email@example.com')).toBe('email-example-com');
    });

    it('handles pipe symbols', () => {
      expect(generateUrlName('Option A | Option B')).toBe('option-a-option-b');
    });

    it('handles tilde and backticks', () => {
      expect(generateUrlName('~Home `code`')).toBe('home-code');
    });
  });

  describe('Edge cases - Empty strings (Task 3.3)', () => {
    it('handles empty string', () => {
      expect(generateUrlName('')).toBe('');
    });

    it('handles string with only spaces', () => {
      expect(generateUrlName('   ')).toBe('');
    });

    it('handles string with only tabs', () => {
      expect(generateUrlName('\t\t\t')).toBe('');
    });

    it('handles string with only newlines', () => {
      expect(generateUrlName('\n\n\n')).toBe('');
    });

    it('handles string with mixed whitespace', () => {
      expect(generateUrlName('  \t\n\r  ')).toBe('');
    });

    it('handles string with only special characters', () => {
      expect(generateUrlName('!@#$%^&*()')).toBe('');
    });

    it('handles string with only Chinese characters', () => {
      expect(generateUrlName('你好世界')).toBe('');
    });

    it('handles string with only emojis', () => {
      expect(generateUrlName('😀😁😂')).toBe('');
    });

    it('handles null-like inputs gracefully', () => {
      // These should not crash
      expect(generateUrlName('')).toBe('');
    });
  });

  describe('Edge cases - Very long titles (Task 3.3)', () => {
    it('truncates title longer than 100 characters', () => {
      const longTitle = 'a'.repeat(150);
      const result = generateUrlName(longTitle);
      expect(result.length).toBe(100);
      expect(result).toBe('a'.repeat(100));
    });

    it('truncates title with spaces to 100 characters', () => {
      const longTitle = 'word '.repeat(50); // 250 characters
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles exactly 100 character title', () => {
      const title = 'a'.repeat(100);
      const result = generateUrlName(title);
      expect(result).toBe(title);
      expect(result.length).toBe(100);
    });

    it('handles 99 character title', () => {
      const title = 'a'.repeat(99);
      const result = generateUrlName(title);
      expect(result).toBe(title);
      expect(result.length).toBe(99);
    });

    it('handles 101 character title', () => {
      const title = 'a'.repeat(101);
      const result = generateUrlName(title);
      expect(result).toBe('a'.repeat(100));
      expect(result.length).toBe(100);
    });

    it('removes trailing hyphen after truncation', () => {
      const longTitle = 'word-'.repeat(25); // Creates "word-word-word-..."
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.endsWith('-')).toBe(false);
    });

    it('handles very long title with Chinese characters', () => {
      const longTitle = '你好'.repeat(100) + 'hello world';
      const result = generateUrlName(longTitle);
      expect(result).toBe('hello-world');
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles very long title with emojis', () => {
      const longTitle = '😀'.repeat(100) + 'test article';
      const result = generateUrlName(longTitle);
      expect(result).toBe('test-article');
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles very long title with special characters', () => {
      const longTitle = '!!!'.repeat(100) + 'important';
      const result = generateUrlName(longTitle);
      expect(result).toBe('important');
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles extremely long title (1000+ characters)', () => {
      const longTitle = 'test '.repeat(300); // 1500 characters
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles long title that becomes empty after processing', () => {
      const longTitle = '你好'.repeat(200);
      const result = generateUrlName(longTitle);
      expect(result).toBe('');
    });

    it('handles long title with mixed content', () => {
      const longTitle = 'English 中文 😀 !!! '.repeat(20);
      const result = generateUrlName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toMatch(/^[a-z0-9_-]*$/);
    });
  });

  describe('Real-world examples', () => {
    it('handles typical blog post title', () => {
      expect(generateUrlName('How to Build a Web Application in 2024'))
        .toBe('how-to-build-a-web-application-in-2024');
    });

    it('handles title with version numbers', () => {
      expect(generateUrlName('Node.js v20.0.0 Release Notes'))
        .toBe('node-js-v20-0-0-release-notes');
    });

    it('handles title with code-like content', () => {
      expect(generateUrlName('Understanding Array.prototype.map()'))
        .toBe('understanding-array-prototype-map');
    });

    it('handles bilingual title', () => {
      expect(generateUrlName('深度学习入门 - Introduction to Deep Learning'))
        .toBe('introduction-to-deep-learning');
    });
  });
});

describe('generateUrlName - Property-Based Tests', () => {
  describe('Property 7: URL名称安全性', () => {
    it('generated URL name contains only alphanumeric, hyphens, and underscores', () => {
      // Feature: article-system, Property 7: URL名称安全性
      const testCases = [
        'Hello World!',
        '你好世界',
        'Test@#$%123',
        'Mixed_Content-123',
        '!!!Special!!!',
        'Emoji 😀🌍',
        'Café Résumé',
        'Multiple   Spaces',
        '\t\nNewlines\r\n',
        'a'.repeat(200),
      ];

      testCases.forEach(title => {
        const result = generateUrlName(title);
        // Must only contain alphanumeric, hyphens, and underscores
        const validPattern = /^[a-z0-9_-]*$/;
        expect(result).toMatch(validPattern);
      });
    });

    it('generated URL name length does not exceed 100 characters', () => {
      // Feature: article-system, Property 7: URL名称安全性
      const testCases = [
        'a'.repeat(50),
        'a'.repeat(100),
        'a'.repeat(150),
        'a'.repeat(200),
        'word '.repeat(50),
        'test-'.repeat(30),
        '你好'.repeat(100) + 'hello',
      ];

      testCases.forEach(title => {
        const result = generateUrlName(title);
        expect(result.length).toBeLessThanOrEqual(100);
      });
    });

    it('does not have leading or trailing hyphens', () => {
      // Feature: article-system, Property 7: URL名称安全性
      const testCases = [
        '!!!Hello',
        'World!!!',
        '!!!Hello World!!!',
        '---test---',
        '   spaces   ',
        '你好Hello你好',
      ];

      testCases.forEach(title => {
        const result = generateUrlName(title);
        if (result.length > 0) {
          expect(result.startsWith('-')).toBe(false);
          expect(result.endsWith('-')).toBe(false);
        }
      });
    });
  });

  describe('Property 7: URL名称安全性 (fast-check)', () => {
    it('PBT: generated URL name contains only alphanumeric, hyphens, and underscores', () => {
      // **Validates: Requirements 3.2, 3.3**
      // Feature: article-system, Property 7: URL名称安全性
      fc.assert(
        fc.property(
          fc.string(),
          (title) => {
            const result = generateUrlName(title);
            // Must only contain alphanumeric, hyphens, and underscores
            const validPattern = /^[a-z0-9_-]*$/;
            expect(result).toMatch(validPattern);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: generated URL name length does not exceed 100 characters', () => {
      // **Validates: Requirements 3.2, 3.3**
      // Feature: article-system, Property 7: URL名称安全性
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (title) => {
            const result = generateUrlName(title);
            expect(result.length).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: does not have leading or trailing hyphens', () => {
      // **Validates: Requirements 3.2, 3.3**
      // Feature: article-system, Property 7: URL名称安全性
      fc.assert(
        fc.property(
          fc.string(),
          (title) => {
            const result = generateUrlName(title);
            if (result.length > 0) {
              expect(result.startsWith('-')).toBe(false);
              expect(result.endsWith('-')).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: combined safety properties - alphanumeric/hyphens/underscores only, max 100 chars, no leading/trailing hyphens', () => {
      // **Validates: Requirements 3.2, 3.3**
      // Feature: article-system, Property 7: URL名称安全性
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (title) => {
            const result = generateUrlName(title);
            
            // Property 1: Only alphanumeric, hyphens, and underscores
            const validPattern = /^[a-z0-9_-]*$/;
            expect(result).toMatch(validPattern);
            
            // Property 2: Length does not exceed 100 characters
            expect(result.length).toBeLessThanOrEqual(100);
            
            // Property 3: No leading or trailing hyphens
            if (result.length > 0) {
              expect(result.startsWith('-')).toBe(false);
              expect(result.endsWith('-')).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Idempotency', () => {
    it('applying generateUrlName twice produces the same result', () => {
      const testCases = [
        'Hello World',
        '你好世界',
        'Test@123',
        'a'.repeat(150),
        '!!!Special!!!',
      ];

      testCases.forEach(title => {
        const firstPass = generateUrlName(title);
        const secondPass = generateUrlName(firstPass);
        expect(firstPass).toBe(secondPass);
      });
    });
  });

  describe('Property: Chinese character removal', () => {
    it('result contains no Chinese characters', () => {
      const testCases = [
        '你好世界',
        '文章标题 Article',
        'Hello 世界 World',
        '深度学习',
        '测试Test测试',
      ];

      testCases.forEach(title => {
        const result = generateUrlName(title);
        // Check no Chinese characters remain (U+4E00 to U+9FFF)
        const chinesePattern = /[\u4e00-\u9fff]/;
        expect(result).not.toMatch(chinesePattern);
      });
    });
  });

  describe('Property: Lowercase conversion', () => {
    it('result is always lowercase', () => {
      const testCases = [
        'HELLO WORLD',
        'Hello World',
        'hElLo WoRlD',
        'TEST123',
        'MixedCase_Test',
      ];

      testCases.forEach(title => {
        const result = generateUrlName(title);
        expect(result).toBe(result.toLowerCase());
      });
    });
  });

  describe('Property: Empty input handling', () => {
    it('handles inputs that become empty after processing', () => {
      const testCases = [
        '',
        '   ',
        '你好世界',
        '!!!',
        '@#$%',
        '\t\n\r',
      ];

      testCases.forEach(title => {
        const result = generateUrlName(title);
        expect(typeof result).toBe('string');
        expect(result).toBe('');
      });
    });
  });
});
