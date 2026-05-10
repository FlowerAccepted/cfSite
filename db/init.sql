-- 用户表
CREATE TABLE IF NOT EXISTS users (
  uid INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  create_time INTEGER NOT NULL,
  profile JSON NOT NULL DEFAULT '{}'
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  uid INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- 用户资料表（持久化 bio / intro）
CREATE TABLE IF NOT EXISTS user_profiles (
  uid INTEGER PRIMARY KEY,
  nickname TEXT,
  avatar TEXT,
  bio TEXT,
  intro TEXT,
  links TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- 可选：加速查 session
CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_uid INTEGER NOT NULL,
  url_name TEXT NOT NULL,
  external_url TEXT,
  published INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  CONSTRAINT title_length CHECK (length(title) > 0 AND length(title) <= 200),
  CONSTRAINT content_length CHECK (length(content) <= 100000),
  CONSTRAINT unique_url UNIQUE (author_uid, url_name),
  FOREIGN KEY (author_uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- 文章表索引
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_uid);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(author_uid, url_name);

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at INTEGER NOT NULL,
  
  CONSTRAINT name_not_empty CHECK (length(name) > 0)
);

-- 分类表索引
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- 文章分类关联表（多对多关系）
CREATE TABLE IF NOT EXISTS article_categories (
  article_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  
  PRIMARY KEY (article_id, category_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 文章分类关联表索引
CREATE INDEX IF NOT EXISTS idx_article_categories_article ON article_categories(article_id);
CREATE INDEX IF NOT EXISTS idx_article_categories_category ON article_categories(category_id);
