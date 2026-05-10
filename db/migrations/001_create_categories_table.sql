-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at INTEGER NOT NULL,
  
  CONSTRAINT name_not_empty CHECK (length(name) > 0)
);

-- Categories table index
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
