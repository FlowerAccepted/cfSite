/**
 * Markdown Rendering Utility
 * 
 * Converts Markdown content to HTML with security and syntax support.
 * Requirements: 4.3, 7.3
 */

import { marked } from 'marked';
import { configureMarked, sanitizeHtml, createCodeRenderer } from './markdownConfig.js';

// Configure marked on module load
configureMarked();

/**
 * Render Markdown content to HTML
 * 
 * Supports all standard Markdown elements:
 * - Headers (h1-h6)
 * - Lists (ordered and unordered)
 * - Links
 * - Images
 * - Code blocks (with syntax highlighting support)
 * - Blockquotes
 * - Tables
 * - Emphasis (bold, italic)
 * 
 * @param markdown - The Markdown content to render
 * @param options - Rendering options
 * @returns Sanitized HTML string
 * 
 * @example
 * ```typescript
 * const html = renderMarkdown('# Hello\n\nThis is **bold** text.');
 * // Returns: '<h1>Hello</h1>\n<p>This is <strong>bold</strong> text.</p>'
 * ```
 */
export function renderMarkdown(
  markdown: string,
  options: {
    sanitize?: boolean;
    renderer?: marked.Renderer;
  } = {}
): string {
  const { sanitize = true, renderer } = options;
  
  try {
    // Render markdown to HTML
    let html: string;
    
    if (renderer) {
      html = marked(markdown, { renderer }) as string;
    } else {
      // Use custom code renderer by default
      const customRenderer = createCodeRenderer();
      html = marked(markdown, { renderer: customRenderer }) as string;
    }
    
    // Sanitize HTML to prevent XSS attacks
    if (sanitize) {
      html = sanitizeHtml(html);
    }
    
    return html;
  } catch (error) {
    // If markdown parsing fails, return empty string
    // This prevents the application from crashing on malformed markdown
    console.error('Markdown rendering error:', error);
    return '';
  }
}

/**
 * Render Markdown content to plain text (strip HTML)
 * Useful for generating excerpts or previews
 * 
 * @param markdown - The Markdown content
 * @param maxLength - Maximum length of the output (optional)
 * @returns Plain text string
 */
export function renderMarkdownToText(markdown: string, maxLength?: number): string {
  try {
    // Render to HTML first
    const html = renderMarkdown(markdown, { sanitize: true });
    
    // Strip HTML tags
    let text = html.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    text = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Trim whitespace
    text = text.trim();
    
    // Truncate if maxLength is specified
    if (maxLength && text.length > maxLength) {
      text = text.substring(0, maxLength).trim() + '...';
    }
    
    return text;
  } catch (error) {
    console.error('Markdown to text conversion error:', error);
    return '';
  }
}

/**
 * Check if a string contains valid Markdown syntax
 * This is a simple heuristic check, not a full parser
 * 
 * @param text - The text to check
 * @returns True if the text appears to contain Markdown syntax
 */
export function isMarkdown(text: string): boolean {
  // Check for common Markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /\*\*[^*]+\*\*/,         // Bold
    /\*[^*]+\*/,             // Italic
    /\[[^\]]+\]\([^)]+\)/,   // Links
    /!\[[^\]]*\]\([^)]+\)/,  // Images
    /^[-*+]\s+/m,            // Unordered lists
    /^\d+\.\s+/m,            // Ordered lists
    /^>\s+/m,                // Blockquotes
    /```[\s\S]*?```/,        // Code blocks
    /`[^`]+`/,               // Inline code
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Extract the first heading from Markdown content
 * Useful for generating titles or summaries
 * 
 * @param markdown - The Markdown content
 * @returns The first heading text, or null if no heading found
 */
export function extractFirstHeading(markdown: string): string | null {
  const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
  return headingMatch ? headingMatch[1].trim() : null;
}

/**
 * Generate an excerpt from Markdown content
 * Extracts the first paragraph or specified number of characters
 * 
 * @param markdown - The Markdown content
 * @param length - Maximum length of the excerpt (default: 200)
 * @returns Plain text excerpt
 */
export function generateExcerpt(markdown: string, length: number = 200): string {
  // Remove headings
  let text = markdown.replace(/^#{1,6}\s+.+$/gm, '');
  
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code
  text = text.replace(/`[^`]+`/g, '');
  
  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove images
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  
  // Remove emphasis markers
  text = text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
  
  // Get first paragraph
  const paragraphs = text.split(/\n\n+/);
  let excerpt = paragraphs.find(p => p.trim().length > 0) || '';
  
  // Trim to length
  excerpt = excerpt.trim();
  if (excerpt.length > length) {
    excerpt = excerpt.substring(0, length).trim() + '...';
  }
  
  return excerpt;
}
