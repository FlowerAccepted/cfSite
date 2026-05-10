/**
 * External Loader Service
 * 
 * Handles loading content from external URLs with validation and timeout protection.
 * 
 * Requirements:
 * - Requirement 5.1: Validate URLs and only allow HTTP/HTTPS protocols
 * - Requirement 5.3: Fetch content from external URLs
 * - Requirement 5.4: Handle errors gracefully with fallback messages
 * - Requirement 5.5: Complete content fetching within 5 seconds (timeout)
 * - Requirement 5.6: Support plain text and Markdown content types
 */

/**
 * Result of external content loading
 */
export interface ExternalContent {
  content: string;
  contentType: string;
  loadTime: number; // milliseconds
  success: boolean;
  error?: string;
}

/**
 * Validates a URL for external content loading
 * 
 * Only HTTP and HTTPS protocols are allowed for security reasons.
 * 
 * @param url - The URL to validate
 * @returns Validation result with valid flag and optional error message
 * 
 * @example
 * ```typescript
 * const result = validateUrl('https://example.com/article.md');
 * if (result.valid) {
 *   // URL is valid
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  // Check if URL is provided and is a string
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  const trimmedUrl = url.trim();
  
  // Check if URL is empty after trimming
  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  // Check if URL starts with http:// or https://
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
  }

  // Try to parse the URL using the URL constructor
  try {
    const parsedUrl = new URL(trimmedUrl);
    
    // Double-check that the protocol is http or https
    // (URL constructor normalizes protocols to lowercase with colon)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }

    // URL is valid
    return { valid: true };
  } catch (error) {
    // URL constructor throws TypeError for invalid URLs
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Loads content from an external URL with timeout protection
 * 
 * @param url - The URL to load content from
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 * @returns Promise resolving to ExternalContent with success status and content or error
 * 
 * @example
 * ```typescript
 * const result = await loadContent('https://example.com/article.md');
 * if (result.success) {
 *   console.log(result.content);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function loadContent(
  url: string,
  timeout: number = 5000
): Promise<ExternalContent> {
  // Validate URL first
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      content: '',
      contentType: 'text/plain',
      loadTime: 0,
      success: false,
      error: validation.error || 'Invalid URL'
    };
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = Date.now();
    
    // Fetch content with timeout
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ArticleSystem/1.0'
      }
    });

    // Check if response is OK (status 200-299)
    if (!response.ok) {
      return {
        content: '',
        contentType: 'text/plain',
        loadTime: Date.now() - startTime,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    // Read content as text
    const content = await response.text();
    const loadTime = Date.now() - startTime;

    // Get content type from response headers
    const contentType = response.headers.get('content-type') || 'text/plain';

    return {
      content,
      contentType,
      loadTime,
      success: true
    };
  } catch (error) {
    // Handle abort (timeout) error
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        content: '',
        contentType: 'text/plain',
        loadTime: timeout,
        success: false,
        error: 'Request timeout'
      };
    }

    // Handle other errors (network errors, etc.)
    return {
      content: '',
      contentType: 'text/plain',
      loadTime: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    // Always clear the timeout
    clearTimeout(timeoutId);
  }
}

/**
 * ExternalLoaderService interface for dependency injection
 */
export interface ExternalLoaderService {
  loadContent(url: string, timeout?: number): Promise<ExternalContent>;
  validateUrl(url: string): { valid: boolean; error?: string };
}

/**
 * Default implementation of ExternalLoaderService
 */
export const externalLoaderService: ExternalLoaderService = {
  loadContent,
  validateUrl
};
