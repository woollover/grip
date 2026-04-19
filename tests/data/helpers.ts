import { Database } from 'bun:sqlite';

/** Minimal GRIP schema for unit tests. Matches src/core/db.ts initSchema(). */
export function makeDb(): Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE articles (
      id           TEXT PRIMARY KEY,
      slug         TEXT UNIQUE NOT NULL,
      title        TEXT NOT NULL,
      body_md      TEXT NOT NULL,
      body_html    TEXT NOT NULL,
      tags         TEXT NOT NULL DEFAULT '[]',
      status       TEXT NOT NULL DEFAULT 'draft',
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      published_at INTEGER
    ) STRICT;

    CREATE TABLE micro_posts (
      id         TEXT PRIMARY KEY,
      body_md    TEXT NOT NULL,
      body_html  TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE pages (
      id         TEXT PRIMARY KEY,
      slug       TEXT UNIQUE NOT NULL,
      title      TEXT NOT NULL,
      body_md    TEXT NOT NULL,
      body_html  TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE media (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      path        TEXT NOT NULL,
      alt_text    TEXT,
      tags        TEXT NOT NULL DEFAULT '[]',
      uploaded_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE ap_followers (
      actor_uri   TEXT PRIMARY KEY,
      inbox_url   TEXT NOT NULL,
      followed_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE ap_replies (
      id           TEXT PRIMARY KEY,
      note_id      TEXT NOT NULL,
      actor_uri    TEXT NOT NULL,
      actor_name   TEXT NOT NULL,
      content      TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'visible'
    ) STRICT;
  `);
  return db;
}

/** Insert a published article. Returns inserted id. */
export function insertArticle(
  db: Database,
  opts: {
    id?: string;
    slug?: string;
    title?: string;
    body_html?: string;
    tags?: string[];
    status?: string;
    created_at?: number;
    published_at?: number | null;
  } = {},
): string {
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO articles (id, slug, title, body_md, body_html, tags, status, created_at, updated_at, published_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    opts.slug ?? `slug-${id}`,
    opts.title ?? 'Test Article',
    opts.body_html ?? '<p>Hello</p>',
    JSON.stringify(opts.tags ?? []),
    opts.status ?? 'published',
    opts.created_at ?? now,
    now,
    opts.published_at !== undefined ? opts.published_at : now,
  );
  return id;
}

/** Insert a micro post. Returns inserted id. */
export function insertMicro(
  db: Database,
  opts: {
    id?: string;
    body_html?: string;
    status?: string;
    created_at?: number;
  } = {},
): string {
  const id = opts.id ?? crypto.randomUUID();
  db.prepare(`
    INSERT INTO micro_posts (id, body_md, body_html, status, created_at)
    VALUES (?, '', ?, ?, ?)
  `).run(
    id,
    opts.body_html ?? '<p>Note</p>',
    opts.status ?? 'active',
    opts.created_at ?? Date.now(),
  );
  return id;
}

/** Insert a page. Returns inserted id. */
export function insertPage(
  db: Database,
  opts: {
    id?: string;
    slug?: string;
    title?: string;
    body_html?: string;
    status?: string;
  } = {},
): string {
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO pages (id, slug, title, body_md, body_html, status, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?)
  `).run(
    id,
    opts.slug ?? `page-${id}`,
    opts.title ?? 'Test Page',
    opts.body_html ?? '<p>Content</p>',
    opts.status ?? 'published',
    now,
    now,
  );
  return id;
}
