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
