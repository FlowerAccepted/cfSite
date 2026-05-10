/**
 * Unit tests for ExternalLoaderService
 * 
 * Tests the validateUrl and loadContent functions with various scenarios including:
 * - URL validation with various formats and edge cases
 * - Successful content loading (with mocks)
 * - Error scenarios (404, 500, timeout, network errors)
 * - Content type detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateUrl, loadContent } from './externalLoaderService';

// Helper to create mock response with proper headers
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  content: string;
  contentType?: string;
}) {
  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    text: async () => options.content,
    headers: {
      get: (name: string) => {
        if (name === 'content-type' && options.contentType) {
          return options.contentType;
        }
        return null;
      }
    }
  };
}

describe('ExternalLoaderService - validateUrl', () => {
  describe('Valid URLs', () => {
    it('should accept valid HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid HTTPS URL', () => {
      const result = validateUrl('https://example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with path', () => {
      const result = validateUrl('https://example.com/path/to/article.md');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with query parameters', () => {
      const result = validateUrl('https://example.com/article?id=123&lang=en');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with fragment', () => {
      const result = validateUrl('https://example.com/article#section');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with port', () => {
      const result = validateUrl('https://example.com:8080/article');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with subdomain', () => {
      const result = validateUrl('https://blog.example.com/article');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with authentication', () => {
      const result = validateUrl('https://user:pass@example.com/article');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with IP address', () => {
      const result = validateUrl('http://192.168.1.1/article');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URL with localhost', () => {
      const result = validateUrl('http://localhost:3000/article');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Invalid URLs - Protocol restrictions', () => {
    it('should reject FTP protocol', () => {
      const result = validateUrl('ftp://example.com/file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
    });

    it('should reject file protocol', () => {
      const result = validateUrl('file:///path/to/file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
    });

    it('should reject data protocol', () => {
      const result = validateUrl('data:text/plain;base64,SGVsbG8=');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
    });

    it('should reject javascript protocol', () => {
      const result = validateUrl('javascript:alert("XSS")');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
    });

    it('should reject URL without protocol', () => {
      const result = validateUrl('example.com/article');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
    });

    it('should reject URL with only protocol', () => {
      const result = validateUrl('http://');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });
  });

  describe('Invalid URLs - Format errors', () => {
    it('should reject empty string', () => {
      const result = validateUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });

    it('should reject whitespace-only string', () => {
      const result = validateUrl('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });

    it('should reject malformed URL', () => {
      const result = validateUrl('https://example com/article');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    // Note: Testing a truly malformed URL that URL constructor will reject
    it('should reject URL with invalid syntax', () => {
      const result = validateUrl('https://[invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });
  });

  describe('Invalid URLs - Type errors', () => {
    it('should reject null', () => {
      const result = validateUrl(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });

    it('should reject undefined', () => {
      const result = validateUrl(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });

    it('should reject number', () => {
      const result = validateUrl(123 as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });

    it('should reject object', () => {
      const result = validateUrl({} as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });

    it('should reject array', () => {
      const result = validateUrl([] as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
    });
  });

  describe('Edge cases', () => {
    it('should trim whitespace and validate', () => {
      const result = validateUrl('  https://example.com/article  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle very long URLs', () => {
      const longPath = 'a'.repeat(1000);
      const result = validateUrl(`https://example.com/${longPath}`);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle URLs with special characters in path', () => {
      const result = validateUrl('https://example.com/文章/article');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle URLs with encoded characters', () => {
      const result = validateUrl('https://example.com/%E6%96%87%E7%AB%A0');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Security considerations', () => {
    it('should reject URLs with potential XSS in protocol', () => {
      const result = validateUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
    });

    it('should reject URLs with data URIs', () => {
      const result = validateUrl('data:text/html,<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });

    it('should accept URLs with special characters properly encoded', () => {
      const result = validateUrl('https://example.com/search?q=%3Cscript%3E');
      expect(result.valid).toBe(true);
    });
  });
});


describe('ExternalLoaderService - loadContent', () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Successful loads', () => {
    it('should successfully load plain text content', async () => {
      const mockContent = 'This is plain text content';
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: mockContent,
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/article.txt');

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
      expect(result.contentType).toBe('text/plain');
      expect(result.loadTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should successfully load Markdown content', async () => {
      const mockContent = '# Heading\n\nThis is **markdown** content.';
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: mockContent,
          contentType: 'text/markdown'
        })
      );

      const result = await loadContent('https://example.com/article.md');

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
      expect(result.contentType).toBe('text/markdown');
      expect(result.loadTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle content with no content-type header', async () => {
      const mockContent = 'Content without type';
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: mockContent
        })
      );

      const result = await loadContent('https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
      expect(result.contentType).toBe('text/plain'); // Default
    });

    it('should include User-Agent header in request', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'content',
          contentType: 'text/plain'
        })
      );
      global.fetch = mockFetch;

      await loadContent('https://example.com/article.txt');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/article.txt',
        expect.objectContaining({
          headers: {
            'User-Agent': 'ArticleSystem/1.0'
          }
        })
      );
    });

    it('should measure load time accurately', async () => {
      // Mock fetch with delay
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'content',
          contentType: 'text/plain'
        });
      });

      const result = await loadContent('https://example.com/article.txt');

      expect(result.success).toBe(true);
      // Allow small timing variations (timer may fire slightly early or late)
      expect(result.loadTime).toBeGreaterThanOrEqual(90);
      expect(result.loadTime).toBeLessThan(300); // Should be around 100ms
    });
  });

  describe('HTTP error responses', () => {
    it('should handle 404 Not Found error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          content: ''
        })
      );

      const result = await loadContent('https://example.com/nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
      expect(result.content).toBe('');
      expect(result.contentType).toBe('text/plain');
      expect(result.loadTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle 500 Internal Server Error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          content: ''
        })
      );

      const result = await loadContent('https://example.com/error.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
      expect(result.content).toBe('');
    });

    it('should handle 403 Forbidden error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          content: ''
        })
      );

      const result = await loadContent('https://example.com/forbidden.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 403: Forbidden');
    });

    it('should handle 503 Service Unavailable error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          content: ''
        })
      );

      const result = await loadContent('https://example.com/unavailable.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 503: Service Unavailable');
    });
  });

  describe('Timeout handling', () => {
    it('should timeout after specified duration', async () => {
      // Mock fetch that responds to abort signal
      global.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
          // Never resolve normally
        });
      });

      const timeout = 1000;
      const startTime = Date.now();
      const result = await loadContent('https://example.com/slow.txt', timeout);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
      expect(result.content).toBe('');
      expect(result.loadTime).toBe(timeout);
      expect(elapsed).toBeGreaterThanOrEqual(timeout);
      expect(elapsed).toBeLessThan(timeout + 500); // Should abort quickly
    }, 10000); // 10 second test timeout

    it('should use default timeout of 5000ms', async () => {
      // Mock fetch that responds to abort signal
      global.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      });

      const startTime = Date.now();
      const result = await loadContent('https://example.com/slow.txt');
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
      expect(elapsed).toBeGreaterThanOrEqual(5000);
      expect(elapsed).toBeLessThan(5500);
    }, 10000); // 10 second test timeout

    it('should abort request on timeout', async () => {
      let abortCalled = false;
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            abortCalled = true;
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      });

      await loadContent('https://example.com/slow.txt', 500);

      expect(abortCalled).toBe(true);
    }, 10000); // 10 second test timeout

    it('should handle fast responses without timeout', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'fast content',
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/fast.txt', 5000);

      expect(result.success).toBe(true);
      expect(result.content).toBe('fast content');
      expect(result.loadTime).toBeLessThan(5000);
    });
  });

  describe('Network error handling', () => {
    it('should handle network connection error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

      const result = await loadContent('https://example.com/article.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
      expect(result.content).toBe('');
      expect(result.loadTime).toBe(0);
    });

    it('should handle DNS resolution error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      const result = await loadContent('https://nonexistent-domain-12345.com/article.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('getaddrinfo ENOTFOUND');
      expect(result.content).toBe('');
    });

    it('should handle connection refused error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await loadContent('https://localhost:9999/article.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('connect ECONNREFUSED');
    });

    it('should handle SSL/TLS error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('certificate has expired'));

      const result = await loadContent('https://expired.badssl.com/');

      expect(result.success).toBe(false);
      expect(result.error).toBe('certificate has expired');
    });

    it('should handle unknown error types', async () => {
      global.fetch = vi.fn().mockRejectedValue('string error');

      const result = await loadContent('https://example.com/article.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('Invalid URL handling', () => {
    it('should reject invalid URL before making request', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const result = await loadContent('not-a-url');

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
      expect(mockFetch).not.toHaveBeenCalled(); // Should not attempt fetch
    });

    it('should reject FTP URL before making request', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const result = await loadContent('ftp://example.com/file.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject empty URL', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const result = await loadContent('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL must be a non-empty string');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Content type detection', () => {
    it('should detect text/plain content type', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'plain text',
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/file.txt');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/plain');
    });

    it('should detect text/markdown content type', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: '# Markdown',
          contentType: 'text/markdown'
        })
      );

      const result = await loadContent('https://example.com/file.md');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/markdown');
    });

    it('should detect text/markdown with charset', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: '# Markdown',
          contentType: 'text/markdown; charset=utf-8'
        })
      );

      const result = await loadContent('https://example.com/file.md');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/markdown; charset=utf-8');
    });

    it('should handle text/html content type', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: '<html><body>HTML</body></html>',
          contentType: 'text/html'
        })
      );

      const result = await loadContent('https://example.com/page.html');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/html');
    });

    it('should default to text/plain when content-type is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'content'
        })
      );

      const result = await loadContent('https://example.com/file');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/plain');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response content', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: '',
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/empty.txt');

      expect(result.success).toBe(true);
      expect(result.content).toBe('');
      expect(result.contentType).toBe('text/plain');
    });

    it('should handle very large content', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: largeContent,
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/large.txt');

      expect(result.success).toBe(true);
      expect(result.content).toBe(largeContent);
      expect(result.content.length).toBe(1000000);
    });

    it('should handle Unicode content', async () => {
      const unicodeContent = '你好世界 🌍 مرحبا العالم';
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: unicodeContent,
          contentType: 'text/plain; charset=utf-8'
        })
      );

      const result = await loadContent('https://example.com/unicode.txt');

      expect(result.success).toBe(true);
      expect(result.content).toBe(unicodeContent);
    });

    it('should handle URLs with query parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'content',
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/article?id=123&lang=en');

      expect(result.success).toBe(true);
      expect(result.content).toBe('content');
    });

    it('should handle URLs with fragments', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          content: 'content',
          contentType: 'text/plain'
        })
      );

      const result = await loadContent('https://example.com/article#section');

      expect(result.success).toBe(true);
      expect(result.content).toBe('content');
    });
  });
});
