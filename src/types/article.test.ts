/**
 * Basic tests to verify type definitions and testing setup
 */
import { describe, it, expect } from 'vitest';
import type { Article, Category, User } from './article';

describe('Article System Types', () => {
  it('should create a valid Article object', () => {
    const article: Article = {
      id: 'test-id',
      title: 'Test Article',
      content: 'Test content',
      authorUid: 'user-123',
      urlName: 'test-article',
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    expect(article.id).toBe('test-id');
    expect(article.title).toBe('Test Article');
    expect(article.published).toBe(true);
  });
  
  it('should create a valid Category object', () => {
    const category: Category = {
      id: 'cat-1',
      name: 'Technology',
      description: 'Tech articles',
      createdAt: new Date(),
    };
    
    expect(category.id).toBe('cat-1');
    expect(category.name).toBe('Technology');
  });
  
  it('should create a valid User object', () => {
    const user: User = {
      uid: 'user-123',
      username: 'testuser',
    };
    
    expect(user.uid).toBe('user-123');
    expect(user.username).toBe('testuser');
  });
});
