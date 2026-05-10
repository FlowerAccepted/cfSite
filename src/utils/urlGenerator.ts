/**
 * URL Generation Utilities for Article System
 * 
 * Generates URL-safe names from article titles according to requirements:
 * - Handle Chinese characters (removal approach)
 * - Replace special characters with hyphens
 * - Limit length to 100 characters
 * - Only alphanumeric characters, hyphens, and underscores allowed
 */

/**
 * Generates a URL-safe name from an article title
 * 
 * Requirements validated: 3.1, 3.2, 3.3
 * 
 * @param title - The article title to convert
 * @returns A URL-safe string containing only alphanumeric characters, hyphens, and underscores, max 100 chars
 * 
 * @example
 * generateUrlName("Hello World!") // "hello-world"
 * generateUrlName("你好世界 Hello") // "hello"
 * generateUrlName("Multiple   Spaces") // "multiple-spaces"
 */
export function generateUrlName(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Remove Chinese characters (U+4E00 to U+9FFF covers CJK Unified Ideographs)
    // Also remove other non-ASCII characters that aren't alphanumeric
    .replace(/[\u4e00-\u9fff]/g, '')
    // Replace sequences of non-alphanumeric characters (except underscores) with a single hyphen
    .replace(/[^a-z0-9_]+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit to 100 characters
    .substring(0, 100)
    // Remove trailing hyphen if substring cut in the middle of a word
    .replace(/-+$/, '');
}

/**
 * Generates a stable short article slug from the article ID.
 *
 * Example:
 * generateStableArticleSlug("c940d99d-8b42-40c3-8bd5-552856c07b30") // "c940d99d"
 */
export function generateStableArticleSlug(id: string): string {
  const normalized = String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return normalized.slice(0, 8);
}
