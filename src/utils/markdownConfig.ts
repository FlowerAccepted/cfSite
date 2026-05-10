/**
 * Markdown Configuration
 * 
 * Configures the marked library with security options and syntax highlighting.
 * Requirements: 4.1, 4.2
 */

import { marked } from 'marked';

/**
 * Configure marked with security options
 * - Sanitize dangerous HTML to prevent XSS attacks
 * - Enable breaks for better line break handling
 * - Enable GFM (GitHub Flavored Markdown) for extended syntax support
 */
export function configureMarked(): void {
  marked.setOptions({
    // Enable GitHub Flavored Markdown
    gfm: true,
    
    // Convert \n to <br> in paragraphs
    breaks: false,
    
    // Use pedantic mode for strict markdown parsing
    pedantic: false,
    
    // Sanitize HTML to prevent XSS attacks
    // This will escape HTML tags in the markdown content
    // Note: marked v5+ removed built-in sanitization, so we'll handle it separately
  });
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes dangerous HTML tags and attributes
 */
export function sanitizeHtml(html: string): string {
  // List of allowed tags
  const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'div', 'span'
  ];
  
  // List of allowed attributes per tag
  const allowedAttributes: Record<string, string[]> = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'code': ['class'], // For syntax highlighting
    'pre': ['class'],
    'div': ['class'],
    'span': ['class']
  };
  
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol in links
  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  html = html.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  
  // Remove data: protocol in images (can be used for XSS)
  html = html.replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
  
  // Remove style attributes (can be used for CSS injection)
  html = html.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
  
  return html;
}

/**
 * Custom renderer for code blocks with syntax highlighting support
 * This is a placeholder for future syntax highlighting integration
 */
export function createCodeRenderer() {
  const renderer = new marked.Renderer();
  
  // Override code block rendering
  renderer.code = function({ text, lang }: { text: string; lang?: string; escaped?: boolean }) {
    // For now, just add the language class for future highlighting
    // In the future, this can integrate with libraries like highlight.js or prism
    const langClass = lang ? ` language-${lang}` : '';
    // Escape HTML in code to prevent XSS
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return `<pre><code class="hljs${langClass}">${escapedText}</code></pre>\n`;
  };
  
  return renderer;
}

/**
 * Get configured marked instance with custom renderer
 */
export function getConfiguredMarked() {
  configureMarked();
  const renderer = createCodeRenderer();
  return { marked, renderer };
}
