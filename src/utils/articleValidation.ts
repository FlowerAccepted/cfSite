/**
 * Article validation utilities
 * 
 * Validates article data according to requirements:
 * - Requirement 6.2: Title and content are required
 * - Requirement 6.6: Title must not be empty and not exceed 200 characters
 * - Requirement 6.7: Content must not exceed 100,000 characters
 * - Requirement 5.1: External URLs must be valid HTTP/HTTPS URLs
 */

import { ValidationError } from '../types/errors';

/**
 * Validates article title
 * 
 * @param title - The article title to validate
 * @throws ValidationError if title is invalid
 */
export function validateTitle(title: string): void {
  if (title === undefined || title === null) {
    throw new ValidationError('Title is required', 'title');
  }

  if (typeof title !== 'string') {
    throw new ValidationError('Title must be a string', 'title');
  }

  const trimmedTitle = title.trim();
  
  if (trimmedTitle.length === 0) {
    throw new ValidationError('Title cannot be empty', 'title');
  }

  if (title.length > 200) {
    throw new ValidationError('Title cannot exceed 200 characters', 'title');
  }
}

/**
 * Validates article content
 * 
 * @param content - The article content to validate
 * @throws ValidationError if content is invalid
 */
export function validateContent(content: string): void {
  if (content === undefined || content === null) {
    throw new ValidationError('Content is required', 'content');
  }

  if (typeof content !== 'string') {
    throw new ValidationError('Content must be a string', 'content');
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    throw new ValidationError('Content cannot be empty', 'content');
  }

  if (content.length > 100000) {
    throw new ValidationError('Content cannot exceed 100,000 characters', 'content');
  }
}

/**
 * Validates external URL
 * 
 * @param url - The external URL to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateExternalUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  const trimmedUrl = url.trim();
  
  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Check if URL starts with http:// or https://
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }

  // Try to parse the URL
  try {
    const parsedUrl = new URL(trimmedUrl);
    
    // Ensure protocol is http or https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'URL protocol must be HTTP or HTTPS' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates author UID
 * 
 * @param authorUid - The author UID to validate
 * @throws ValidationError if authorUid is invalid
 */
export function validateAuthorUid(authorUid: string): void {
  if (!authorUid || typeof authorUid !== 'string') {
    throw new ValidationError('Author UID is required', 'authorUid');
  }

  if (authorUid.trim().length === 0) {
    throw new ValidationError('Author UID cannot be empty', 'authorUid');
  }
}

/**
 * Validates article creation input
 * 
 * @param input - The article creation input to validate
 * @throws ValidationError if any field is invalid
 */
export function validateCreateArticleInput(input: {
  title: string;
  content: string;
  authorUid: string;
  categories: string[];
  externalUrl?: string;
  published: boolean;
}): void {
  validateTitle(input.title);
  validateContent(input.content);
  validateAuthorUid(input.authorUid);

  if (!Array.isArray(input.categories)) {
    throw new ValidationError('Categories must be an array', 'categories');
  }

  if (input.externalUrl !== undefined && input.externalUrl !== null && input.externalUrl !== '') {
    const urlValidation = validateExternalUrl(input.externalUrl);
    if (!urlValidation.valid) {
      throw new ValidationError(urlValidation.error || 'Invalid external URL', 'externalUrl');
    }
  }

  if (typeof input.published !== 'boolean') {
    throw new ValidationError('Published must be a boolean', 'published');
  }
}

/**
 * Validates article update input
 * 
 * @param input - The article update input to validate
 * @throws ValidationError if any field is invalid
 */
export function validateUpdateArticleInput(input: {
  title?: string;
  content?: string;
  categories?: string[];
  externalUrl?: string;
  published?: boolean;
}): void {
  if (input.title !== undefined) {
    validateTitle(input.title);
  }

  if (input.content !== undefined) {
    validateContent(input.content);
  }

  if (input.categories !== undefined && !Array.isArray(input.categories)) {
    throw new ValidationError('Categories must be an array', 'categories');
  }

  if (input.externalUrl !== undefined && input.externalUrl !== null && input.externalUrl !== '') {
    const urlValidation = validateExternalUrl(input.externalUrl);
    if (!urlValidation.valid) {
      throw new ValidationError(urlValidation.error || 'Invalid external URL', 'externalUrl');
    }
  }

  if (input.published !== undefined && typeof input.published !== 'boolean') {
    throw new ValidationError('Published must be a boolean', 'published');
  }
}
