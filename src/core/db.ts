import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let _db: Database | null = null;

export function getDb(dbPath?: string): Database {
  if (_db) return _db;

  const path = dbPath ?? `${process.cwd()}/data/grip.sqlite`;
  mkdirSync(dirname(path), { recursive: true });

  _db = new Database(path, { create: true });
  _db.exec('PRAGMA journal_mode=WAL;');
  _db.exec('PRAGMA foreign_keys=ON;');

  initSchema(_db);
  return _db;
}

function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS events_type_idx    ON events(type);
    CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at);

    CREATE TABLE IF NOT EXISTS articles (
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

    CREATE TABLE IF NOT EXISTS micro_posts (
      id           TEXT PRIMARY KEY,
      body_md      TEXT NOT NULL,
      body_html    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',
      created_at   INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS pages (
      id           TEXT PRIMARY KEY,
      slug         TEXT UNIQUE NOT NULL,
      title        TEXT NOT NULL,
      body_md      TEXT NOT NULL,
      body_html    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS media (
      id           TEXT PRIMARY KEY,
      filename     TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      path         TEXT NOT NULL,
      alt_text     TEXT,
      tags         TEXT NOT NULL DEFAULT '[]',
      uploaded_at  INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS config (
      key          TEXT PRIMARY KEY,
      value        TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS ap_followers (
      actor_uri    TEXT PRIMARY KEY,
      inbox_url    TEXT NOT NULL,
      followed_at  INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS ap_keys (
      id           TEXT PRIMARY KEY,
      public_pem   TEXT NOT NULL,
      private_pem  TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS ap_replies (
      id           TEXT PRIMARY KEY,
      note_id      TEXT NOT NULL,
      actor_uri    TEXT NOT NULL,
      actor_name   TEXT NOT NULL,
      content      TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'visible'
    ) STRICT;

    CREATE TABLE IF NOT EXISTS rss_subscriptions (
      id              TEXT PRIMARY KEY,
      url             TEXT UNIQUE NOT NULL,
      title           TEXT NOT NULL DEFAULT '',
      description     TEXT NOT NULL DEFAULT '',
      site_url        TEXT NOT NULL DEFAULT '',
      last_fetched_at INTEGER,
      created_at      INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS ap_following (
      id              TEXT PRIMARY KEY,
      actor_url       TEXT UNIQUE NOT NULL,
      username        TEXT NOT NULL DEFAULT '',
      display_name    TEXT NOT NULL DEFAULT '',
      domain          TEXT NOT NULL DEFAULT '',
      avatar_url      TEXT NOT NULL DEFAULT '',
      inbox_url       TEXT NOT NULL DEFAULT '',
      follow_state    TEXT NOT NULL DEFAULT 'none',
      follows_us      INTEGER NOT NULL DEFAULT 0,
      last_fetched_at INTEGER,
      created_at      INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS reader_items (
      id           TEXT PRIMARY KEY,
      source_type  TEXT NOT NULL,
      source_id    TEXT NOT NULL,
      guid         TEXT NOT NULL,
      item_url     TEXT NOT NULL DEFAULT '',
      title        TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL DEFAULT '',
      author       TEXT NOT NULL DEFAULT '',
      published_at INTEGER NOT NULL,
      fetched_at   INTEGER NOT NULL
    ) STRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS reader_items_dedup ON reader_items(source_type, source_id, guid);
    CREATE INDEX IF NOT EXISTS reader_items_pub ON reader_items(published_at DESC);

    CREATE TABLE IF NOT EXISTS auth_lockouts (
      ip           TEXT PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0
    ) STRICT;
  `);
}
