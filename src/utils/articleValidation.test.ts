/**
 * Tests for article validation utilities
 * 
 * This test suite includes:
 * - Property-based tests for title and content length validation
 * - Unit tests for validation edge cases
 * - Tests for external URL validation
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  validateTitle,
  validateContent,
  validateExternalUrl,
  validateAuthorUid,
  validateCreateArticleInput,
  validateUpdateArticleInput,
} from './articleValidation';
import { ValidationError } from '../types/errors';

describe('Article Validation', () => {
  describe('validateTitle', () => {
    describe('Property 20: 标题长度验证 (fast-check)', () => {
      it('PBT: empty string should fail validation', () => {
        // **Validates: Requirements 6.6**
        // Feature: article-system, Property 20: 标题长度验证
        
        expect(() => validateTitle('')).toThrow(ValidationError);
        expect(() => validateTitle('   ')).toThrow(ValidationError);
      });

      it('PBT: titles exceeding 200 characters should fail validation', () => {
        // **Validates: Requirements 6.6**
        // Feature: article-system, Property 20: 标题长度验证
        
        fc.assert(
          fc.property(
            fc.integer({ min: 201, max: 1000 }),
            (length) => {
              const longTitle = 'a'.repeat(length);
              expect(() => validateTitle(longTitle)).toThrow(ValidationError);
              expect(() => validateTitle(longTitle)).toThrow(/cannot exceed 200 characters/);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('PBT: valid titles (1-200 chars) should pass validation', () => {
        // **Validates: Requirements 6.6**
        // Feature: article-system, Property 20: 标题长度验证
        
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
            (title) => {
              expect(() => validateTitle(title)).not.toThrow();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('PBT: titles with only whitespace should fail validation', () => {
        // **Validates: Requirements 6.6**
        // Feature: article-system, Property 20: 标题长度验证
        
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 50 }),
            (length) => {
              const whitespaceTitle = ' '.repeat(length);
              expect(() => validateTitle(whitespaceTitle)).toThrow(ValidationError);
              expect(() => validateTitle(whitespaceTitle)).toThrow(/cannot be empty/);
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Unit tests for title validation edge cases', () => {
      it('should throw ValidationError for undefined title', () => {
        expect(() => validateTitle(undefined as any)).toThrow(ValidationError);
        expect(() => validateTitle(undefined as any)).toThrow(/required/);
      });

      it('should throw ValidationError for null title', () => {
        expect(() => validateTitle(null as any)).toThrow(ValidationError);
        expect(() => validateTitle(null as any)).toThrow(/required/);
      });

      it('should throw ValidationError for non-string title', () => {
        expect(() => validateTitle(123 as any)).toThrow(ValidationError);
        expect(() => validateTitle({} as any)).toThrow(ValidationError);
        expect(() => validateTitle([] as any)).toThrow(ValidationError);
      });

      it('should accept title with exactly 200 characters', () => {
        const title = 'a'.repeat(200);
        expect(() => validateTitle(title)).not.toThrow();
      });

      it('should reject title with exactly 201 characters', () => {
        const title = 'a'.repeat(201);
        expect(() => validateTitle(title)).toThrow(ValidationError);
        expect(() => validateTitle(title)).toThrow(/cannot exceed 200 characters/);
      });

      it('should accept title with 1 character', () => {
        expect(() => validateTitle('a')).not.toThrow();
      });

      it('should accept title with special characters', () => {
        expect(() => validateTitle('Hello! @#$%^&*()')).not.toThrow();
        expect(() => validateTitle('文章标题')).not.toThrow();
        expect(() => validateTitle('Article 🚀')).not.toThrow();
      });

      it('should reject empty string after trimming', () => {
        expect(() => validateTitle('   ')).toThrow(ValidationError);
        expect(() => validateTitle('\t\n')).toThrow(ValidationError);
      });
    });
  });

  describe('validateContent', () => {
    describe('Property 21: 内容长度验证 (fast-check)', () => {
      it('PBT: content exceeding 100,000 characters should fail validation', () => {
        // **Validates: Requirements 6.7**
        // Feature: article-system, Property 21: 内容长度验证
        
        fc.assert(
          fc.property(
            fc.integer({ min: 100001, max: 150000 }),
            (length) => {
              const longContent = 'a'.repeat(length);
              expect(() => validateContent(longContent)).toThrow(ValidationError);
              expect(() => validateContent(longContent)).toThrow(/cannot exceed 100,000 characters/);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('PBT: valid content (1-100,000 chars) should pass validation', () => {
        // **Validates: Requirements 6.7**
        // Feature: article-system, Property 21: 内容长度验证
        // Note: content must be non-empty (Requirement 6.2), so we test 1-100,000 chars
        
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100000 }).filter(s => s.trim().length > 0),
            (content) => {
              expect(() => validateContent(content)).not.toThrow();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('PBT: content at exactly 100,000 characters should pass validation', () => {
        // **Validates: Requirements 6.7**
        // Feature: article-system, Property 21: 内容长度验证
        
        const content = 'a'.repeat(100000);
        expect(() => validateContent(content)).not.toThrow();
      });
    });

    describe('Unit tests for content validation edge cases', () => {
      it('should throw ValidationError for undefined content', () => {
        expect(() => validateContent(undefined as any)).toThrow(ValidationError);
        expect(() => validateContent(undefined as any)).toThrow(/required/);
      });

      it('should throw ValidationError for null content', () => {
        expect(() => validateContent(null as any)).toThrow(ValidationError);
        expect(() => validateContent(null as any)).toThrow(/required/);
      });

      it('should throw ValidationError for non-string content', () => {
        expect(() => validateContent(123 as any)).toThrow(ValidationError);
        expect(() => validateContent({} as any)).toThrow(ValidationError);
        expect(() => validateContent([] as any)).toThrow(ValidationError);
      });

      it('should throw ValidationError for empty string content', () => {
        expect(() => validateContent('')).toThrow(ValidationError);
        expect(() => validateContent('')).toThrow(/cannot be empty/);
      });

      it('should accept content with exactly 99,999 characters', () => {
        const content = 'a'.repeat(99999);
        expect(() => validateContent(content)).not.toThrow();
      });

      it('should accept content with exactly 100,000 characters', () => {
        const content = 'a'.repeat(100000);
        expect(() => validateContent(content)).not.toThrow();
      });

      it('should reject content with exactly 100,001 characters', () => {
        const content = 'a'.repeat(100001);
        expect(() => validateContent(content)).toThrow(ValidationError);
        expect(() => validateContent(content)).toThrow(/cannot exceed 100,000 characters/);
      });

      it('should accept content with special characters and unicode', () => {
        const content = 'Hello! @#$%^&*() 文章内容 🚀\n\nNew paragraph';
        expect(() => validateContent(content)).not.toThrow();
      });

      it('should throw ValidationError for whitespace-only content', () => {
        expect(() => validateContent('   ')).toThrow(ValidationError);
        expect(() => validateContent('\n\n\n')).toThrow(ValidationError);
      });
    });
  });

  describe('validateExternalUrl', () => {
    describe('Unit tests for external URL validation', () => {
      it('should accept valid HTTP URLs', () => {
        const result = validateExternalUrl('http://example.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept valid HTTPS URLs', () => {
        const result = validateExternalUrl('https://example.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept URLs with paths and query parameters', () => {
        const result = validateExternalUrl('https://example.com/path/to/resource?param=value');
        expect(result.valid).toBe(true);
      });

      it('should accept URLs with ports', () => {
        const result = validateExternalUrl('https://example.com:8080/path');
        expect(result.valid).toBe(true);
      });

      it('should reject URLs without protocol', () => {
        const result = validateExternalUrl('example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('http://');
      });

      it('should reject URLs with invalid protocols', () => {
        const result = validateExternalUrl('ftp://example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('http://');
      });

      it('should reject empty string', () => {
        const result = validateExternalUrl('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('empty');
      });

      it('should reject whitespace-only string', () => {
        const result = validateExternalUrl('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('empty');
      });

      it('should reject null or undefined', () => {
        const result1 = validateExternalUrl(null as any);
        expect(result1.valid).toBe(false);

        const result2 = validateExternalUrl(undefined as any);
        expect(result2.valid).toBe(false);
      });

      it('should reject malformed URLs', () => {
        const result = validateExternalUrl('https://');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid URL');
      });

      it('should reject javascript: protocol', () => {
        const result = validateExternalUrl('javascript:alert(1)');
        expect(result.valid).toBe(false);
      });

      it('should reject data: protocol', () => {
        const result = validateExternalUrl('data:text/html,<script>alert(1)</script>');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateAuthorUid', () => {
    it('should accept valid author UID', () => {
      expect(() => validateAuthorUid('user-123')).not.toThrow();
      expect(() => validateAuthorUid('abc')).not.toThrow();
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => validateAuthorUid('')).toThrow(ValidationError);
      expect(() => validateAuthorUid('   ')).toThrow(ValidationError);
    });

    it('should throw ValidationError for null or undefined', () => {
      expect(() => validateAuthorUid(null as any)).toThrow(ValidationError);
      expect(() => validateAuthorUid(undefined as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string', () => {
      expect(() => validateAuthorUid(123 as any)).toThrow(ValidationError);
      expect(() => validateAuthorUid({} as any)).toThrow(ValidationError);
    });
  });

  describe('validateCreateArticleInput', () => {
    const validInput = {
      title: 'Test Article',
      content: 'This is test content',
      authorUid: 'user-123',
      categories: ['tech', 'programming'],
      published: false,
    };

    it('should accept valid input', () => {
      expect(() => validateCreateArticleInput(validInput)).not.toThrow();
    });

    it('should accept valid input with external URL', () => {
      const inputWithUrl = {
        ...validInput,
        externalUrl: 'https://example.com/article.md',
      };
      expect(() => validateCreateArticleInput(inputWithUrl)).not.toThrow();
    });

    it('should throw ValidationError for invalid title', () => {
      const invalidInput = { ...validInput, title: '' };
      expect(() => validateCreateArticleInput(invalidInput)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid content', () => {
      const invalidInput = { ...validInput, content: 'a'.repeat(100001) };
      expect(() => validateCreateArticleInput(invalidInput)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid authorUid', () => {
      const invalidInput = { ...validInput, authorUid: '' };
      expect(() => validateCreateArticleInput(invalidInput)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-array categories', () => {
      const invalidInput = { ...validInput, categories: 'not-an-array' as any };
      expect(() => validateCreateArticleInput(invalidInput)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid external URL', () => {
      const invalidInput = {
        ...validInput,
        externalUrl: 'not-a-valid-url',
      };
      expect(() => validateCreateArticleInput(invalidInput)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-boolean published', () => {
      const invalidInput = { ...validInput, published: 'true' as any };
      expect(() => validateCreateArticleInput(invalidInput)).toThrow(ValidationError);
    });

    it('should accept empty categories array', () => {
      const inputWithEmptyCategories = { ...validInput, categories: [] };
      expect(() => validateCreateArticleInput(inputWithEmptyCategories)).not.toThrow();
    });

    it('should accept undefined external URL', () => {
      const inputWithoutUrl = { ...validInput, externalUrl: undefined };
      expect(() => validateCreateArticleInput(inputWithoutUrl)).not.toThrow();
    });

    it('should accept empty string external URL', () => {
      const inputWithEmptyUrl = { ...validInput, externalUrl: '' };
      expect(() => validateCreateArticleInput(inputWithEmptyUrl)).not.toThrow();
    });
  });

  describe('validateUpdateArticleInput', () => {
    it('should accept valid partial update', () => {
      expect(() => validateUpdateArticleInput({ title: 'New Title' })).not.toThrow();
      expect(() => validateUpdateArticleInput({ content: 'New content' })).not.toThrow();
      expect(() => validateUpdateArticleInput({ published: true })).not.toThrow();
    });

    it('should accept empty object (no updates)', () => {
      expect(() => validateUpdateArticleInput({})).not.toThrow();
    });

    it('should throw ValidationError for invalid title', () => {
      expect(() => validateUpdateArticleInput({ title: '' })).toThrow(ValidationError);
      expect(() => validateUpdateArticleInput({ title: 'a'.repeat(201) })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid content', () => {
      expect(() => validateUpdateArticleInput({ content: 'a'.repeat(100001) })).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-array categories', () => {
      expect(() => validateUpdateArticleInput({ categories: 'not-an-array' as any })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid external URL', () => {
      expect(() => validateUpdateArticleInput({ externalUrl: 'invalid-url' })).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-boolean published', () => {
      expect(() => validateUpdateArticleInput({ published: 'true' as any })).toThrow(ValidationError);
    });

    it('should accept valid external URL', () => {
      expect(() => validateUpdateArticleInput({ externalUrl: 'https://example.com' })).not.toThrow();
    });

    it('should accept multiple valid fields', () => {
      const update = {
        title: 'Updated Title',
        content: 'Updated content',
        categories: ['new-category'],
        published: true,
      };
      expect(() => validateUpdateArticleInput(update)).not.toThrow();
    });
  });
});
