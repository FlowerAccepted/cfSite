import type { APIRoute } from 'astro';
import { ArticleService } from '../../services/articleService';
import { getDatabase } from '../../utils/db';
import { getCookie } from '../../middleware/auth';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function verifyToken(token: string): { uid: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string };
    return decoded;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async (context) => {
  try {
    // 获取用户认证信息
    const cookieHeader = context.request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/auth_token=([^;]*)/);
    const token = tokenMatch?.[1];

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取查询参数
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get('pageSize') || '12', 10) || 12));
    const authorUid = url.searchParams.get('authorUid');

    // 只能查询自己的文章
    if (authorUid && authorUid !== decoded.uid) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDatabase();
    const articleService = new ArticleService(db);

    const result = articleService.listArticles({
      page,
      pageSize,
      authorUid: authorUid || decoded.uid,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    return new Response(
      JSON.stringify({
        articles: result.articles.map((article) => ({
          id: article.id,
          title: article.title,
          content: article.content,
          excerpt: article.content.replace(/[#*`>\-_\[\]()!]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160),
          published: article.published,
          externalUrl: article.externalUrl,
          authorUid: article.authorUid,
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
          categories: article.categories,
        })),
        total: result.total,
        page,
        pageSize,
        totalPages: result.totalPages,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching articles:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
