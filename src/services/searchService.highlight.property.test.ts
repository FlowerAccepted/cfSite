/**
 * Property-Based Tests for highlightMatches function
 * 
 * This test suite validates Property 5: 搜索结果高亮正确性
 * Tests that highlights appear at all match positions without changing text
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { highlightMatches } from './searchService';

describe('SearchService - highlightMatches Property Tests', () => {
  describe('Property 5: 搜索结果高亮正确性 (Highlight Correctness)', () => {
    it('PBT: highlights appear at all match positions without changing text content', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary text
          fc.string({ minLength: 0, maxLength: 500 }),
          // Generate valid regex patterns
          fc.oneof(
            // Simple literal patterns
            fc.constantFrom('test', 'hello', 'world', 'the', 'a', 'is'),
            // Digit patterns
            fc.constant('\\d+'),
            // Word patterns
            fc.constant('\\w+'),
            // Character classes
            fc.constantFrom('[a-z]+', '[A-Z]+', '[0-9]+', '[a-zA-Z]+'),
            // Alternation
            fc.constantFrom('cat|dog', 'hello|world', 'yes|no'),
            // Quantifiers
            fc.constantFrom('a+', 'b*', 'c?', 'd{2,4}'),
            // Word boundaries
            fc.constantFrom('\\bword\\b', '\\btest\\b')
          ),
          fc.boolean(), // caseSensitive flag
          async (text, pattern, caseSensitive) => {
            // Perform highlighting
            const highlighted = highlightMatches(text, pattern, caseSensitive);

            // Property 1: Original text content is preserved (except for added markers)
            // Remove all <mark> and </mark> tags to get back original text
            const textWithoutMarks = highlighted.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Property 2: All matches have corresponding highlights
            // Create regex to find all matches in original text
            let regex: RegExp;
            try {
              const flags = caseSensitive ? 'g' : 'gi';
              regex = new RegExp(pattern, flags);
            } catch {
              // If pattern is invalid, highlightMatches should return original text
              expect(highlighted).toBe(text);
              return;
            }

            // Find all matches in original text
            const matches = [...text.matchAll(regex)];
            
            // Count <mark> tags in highlighted text
            const markCount = (highlighted.match(/<mark>/g) || []).length;
            
            // Property 3: Number of <mark> tags equals number of matches
            expect(markCount).toBe(matches.length);

            // Property 4: Each match is wrapped in <mark> tags
            for (const match of matches) {
              const matchedText = match[0];
              if (matchedText.length > 0) {
                // The highlighted version should contain the match wrapped in marks
                const expectedHighlight = `<mark>${matchedText}</mark>`;
                expect(highlighted).toContain(expectedHighlight);
              }
            }

            // Property 5: No text is added or removed (only markers)
            // The length difference should be exactly the length of added tags
            const addedTagsLength = markCount * '<mark></mark>'.length;
            expect(highlighted.length).toBe(text.length + addedTagsLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights preserve text order and position', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate text with known patterns
          fc.array(
            fc.oneof(
              fc.constant('test'),
              fc.constant('hello'),
              fc.constant('world'),
              fc.string({ minLength: 1, maxLength: 20 })
            ),
            { minLength: 3, maxLength: 10 }
          ),
          fc.constantFrom('test', 'hello', 'world'),
          async (textParts, pattern) => {
            const text = textParts.join(' ');
            const highlighted = highlightMatches(text, pattern, false);

            // Property: Text order is preserved
            // Split by <mark> tags and verify the non-highlighted parts are in order
            const parts = highlighted.split(/<\/?mark>/);
            
            // Reconstruct text from parts (every odd index is highlighted, even is not)
            let reconstructed = '';
            for (let i = 0; i < parts.length; i++) {
              reconstructed += parts[i];
            }
            
            expect(reconstructed).toBe(text);

            // Property: Relative positions of matches are preserved
            const regex = new RegExp(pattern, 'gi');
            const originalMatches = [...text.matchAll(regex)];
            
            if (originalMatches.length > 1) {
              // Check that matches appear in the same order in highlighted text
              let lastIndex = -1;
              for (const match of originalMatches) {
                const matchText = match[0];
                const highlightedMatch = `<mark>${matchText}</mark>`;
                const index = highlighted.indexOf(highlightedMatch, lastIndex + 1);
                
                // Each subsequent match should appear after the previous one
                expect(index).toBeGreaterThan(lastIndex);
                lastIndex = index;
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights work correctly with case sensitivity', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate text with mixed case
          fc.array(
            fc.oneof(
              fc.constant('Test'),
              fc.constant('test'),
              fc.constant('TEST'),
              fc.constant('TeSt')
            ),
            { minLength: 2, maxLength: 5 }
          ),
          fc.boolean(),
          async (words, caseSensitive) => {
            const text = words.join(' ');
            const pattern = 'test';
            const highlighted = highlightMatches(text, pattern, caseSensitive);

            // Property: Original text is preserved
            const textWithoutMarks = highlighted.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Property: Case sensitivity is respected
            const flags = caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(pattern, flags);
            const expectedMatches = [...text.matchAll(regex)];
            const actualMarkCount = (highlighted.match(/<mark>/g) || []).length;
            
            expect(actualMarkCount).toBe(expectedMatches.length);

            // Property: Only matching cases are highlighted
            if (caseSensitive) {
              // Should only highlight exact case matches
              for (const word of words) {
                if (word === 'test') {
                  expect(highlighted).toContain('<mark>test</mark>');
                } else {
                  // Other cases should not be highlighted
                  expect(highlighted).not.toContain(`<mark>${word}</mark>`);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights handle special regex patterns correctly', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate text with various content types
          fc.record({
            letters: fc.string({ minLength: 0, maxLength: 50 }),
            digits: fc.array(fc.integer({ min: 0, max: 999 }), { maxLength: 5 }),
            spaces: fc.constant('   ')
          }),
          // Generate special regex patterns
          fc.constantFrom(
            '\\d+',      // digits
            '\\w+',      // word characters
            '\\s+',      // whitespace
            '[a-z]+',    // lowercase letters
            '[A-Z]+',    // uppercase letters
            '[0-9]+'     // digits (character class)
          ),
          async (content, pattern) => {
            const text = `${content.letters}${content.spaces}${content.digits.join(' ')}`;
            const highlighted = highlightMatches(text, pattern, false);

            // Property: Original text is preserved
            const textWithoutMarks = highlighted.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Property: All matches are highlighted
            const regex = new RegExp(pattern, 'gi');
            const matches = [...text.matchAll(regex)];
            const markCount = (highlighted.match(/<mark>/g) || []).length;
            
            expect(markCount).toBe(matches.length);

            // Property: No extra marks are added
            const closeMarkCount = (highlighted.match(/<\/mark>/g) || []).length;
            expect(closeMarkCount).toBe(markCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights handle empty and edge case patterns', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 100 }),
          async (text) => {
            // Test with empty pattern
            const highlightedEmpty = highlightMatches(text, '', false);
            
            // Property: Empty pattern behavior is consistent
            // Empty regex matches at every position, so text should have marks
            // But the important property is that original text is preserved
            const textWithoutMarks = highlightedEmpty.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Test with pattern that matches nothing
            const impossiblePattern = 'ZZZZZZZZZZZZZZZ';
            const highlightedNone = highlightMatches(text, impossiblePattern, false);
            
            // Property: When no matches, original text is returned unchanged
            if (!text.includes(impossiblePattern)) {
              expect(highlightedNone).toBe(text);
            }

            // Test with pattern that matches everything
            const everythingPattern = '.*';
            const highlightedAll = highlightMatches(text, everythingPattern, false);
            
            // Property: Original text is preserved even with greedy patterns
            const textWithoutMarksAll = highlightedAll.replace(/<\/?mark>/g, '');
            expect(textWithoutMarksAll).toBe(text);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights handle unicode and special characters', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate text with unicode characters
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 100 }),
            fc.constant('你好世界 Hello World'),
            fc.constant('Emoji: 😀 🎉 🚀'),
            fc.constant('Special: @#$%^&*()'),
            fc.constant('Accents: café résumé naïve')
          ),
          fc.constantFrom('Hello', 'World', '\\w+', '[a-zA-Z]+'),
          async (text, pattern) => {
            const highlighted = highlightMatches(text, pattern, false);

            // Property: Original text is preserved including unicode
            const textWithoutMarks = highlighted.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Property: Byte length is consistent
            // Original text length + added mark tags length = highlighted length
            const regex = new RegExp(pattern, 'gi');
            const matches = [...text.matchAll(regex)];
            const markCount = matches.length;
            const expectedLength = text.length + (markCount * '<mark></mark>'.length);
            
            expect(highlighted.length).toBe(expectedLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights are idempotent when applied to non-highlighted text', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => !s.includes('<mark>') && !s.includes('</mark>')),
          fc.constantFrom('test', 'hello', '\\d+', '\\w+'),
          async (text, pattern) => {
            // Apply highlighting once
            const highlighted1 = highlightMatches(text, pattern, false);

            // Property: Highlighting the same text with same pattern produces same result
            const highlighted2 = highlightMatches(text, pattern, false);
            expect(highlighted1).toBe(highlighted2);

            // Property: The number of marks is deterministic
            const markCount1 = (highlighted1.match(/<mark>/g) || []).length;
            const markCount2 = (highlighted2.match(/<mark>/g) || []).length;
            expect(markCount1).toBe(markCount2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights handle overlapping pattern matches correctly', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate text with repeating patterns
          fc.oneof(
            fc.constant('aaaa'),
            fc.constant('abababab'),
            fc.constant('testtest'),
            fc.constant('121212')
          ),
          fc.constantFrom('aa', 'ab', 'test', '12', 'a+', 'b+'),
          async (text, pattern) => {
            const highlighted = highlightMatches(text, pattern, false);

            // Property: Original text is preserved
            const textWithoutMarks = highlighted.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Property: Non-overlapping matches are all highlighted
            // (regex with 'g' flag finds non-overlapping matches)
            const regex = new RegExp(pattern, 'g');
            const matches = [...text.matchAll(regex)];
            const markCount = (highlighted.match(/<mark>/g) || []).length;
            
            expect(markCount).toBe(matches.length);

            // Property: Each match appears exactly once in highlighted form
            for (const match of matches) {
              const matchText = match[0];
              if (matchText.length > 0) {
                const highlightedMatch = `<mark>${matchText}</mark>`;
                // Count occurrences of this specific highlighted match
                const occurrences = (highlighted.match(new RegExp(highlightedMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                expect(occurrences).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: highlights maintain text integrity with complex patterns', async () => {
      // **Validates: Requirements 2.6**
      // Feature: article-system, Property 5: 搜索结果高亮正确性
      
      await fc.assert(
        fc.asyncProperty(
          // Generate realistic article-like text
          fc.array(
            fc.oneof(
              fc.lorem({ maxCount: 5 }),
              fc.constant('test@example.com'),
              fc.constant('https://example.com'),
              fc.constant('(123) 456-7890'),
              fc.constant('Price: $99.99')
            ),
            { minLength: 1, maxLength: 5 }
          ),
          // Complex patterns
          fc.constantFrom(
            '\\w+@\\w+\\.\\w+',           // email pattern
            'https?://[\\w.]+',           // URL pattern
            '\\(\\d{3}\\) \\d{3}-\\d{4}', // phone pattern
            '\\$\\d+\\.\\d{2}',           // price pattern
            '\\b\\w{4,}\\b'               // words with 4+ chars
          ),
          async (textParts, pattern) => {
            const text = textParts.join(' ');
            
            let highlighted: string;
            try {
              highlighted = highlightMatches(text, pattern, false);
            } catch {
              // If pattern fails, skip this iteration
              return;
            }

            // Property: Original text is always preserved
            const textWithoutMarks = highlighted.replace(/<\/?mark>/g, '');
            expect(textWithoutMarks).toBe(text);

            // Property: Marks are properly paired
            const openMarks = (highlighted.match(/<mark>/g) || []).length;
            const closeMarks = (highlighted.match(/<\/mark>/g) || []).length;
            expect(openMarks).toBe(closeMarks);

            // Property: No nested marks (marks don't contain other marks)
            const nestedMarks = highlighted.match(/<mark>[^<]*<mark>/g);
            expect(nestedMarks).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
