# Database Migrations

This directory contains SQL migration files for the article system database.

## Migration Files

### 001_create_categories_table.sql

Creates the `categories` table for the article classification system.

**Schema:**
- `id` (TEXT, PRIMARY KEY): Unique identifier for the category
- `name` (TEXT, NOT NULL, UNIQUE): Category name
- `description` (TEXT): Optional category description
- `created_at` (INTEGER, NOT NULL): Creation timestamp (Unix timestamp)

**Constraints:**
- `name_not_empty`: Ensures category name is not empty
- `UNIQUE` constraint on `name`: Prevents duplicate category names

**Indexes:**
- `idx_categories_name`: Index on the `name` field for fast lookups

**Conventions:**
- Uses TEXT for IDs (matching Articles table)
- Uses INTEGER for timestamps (Unix timestamps, matching Articles table)
- Uses snake_case naming convention

## Applying Migrations

For Cloudflare D1:
```bash
cd fa-worker
wrangler d1 execute fa-cf-site --file=../db/migrations/001_create_categories_table.sql
```

For local development, the schema is included in `db/init.sql`.
