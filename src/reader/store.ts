/**
 * Database operations for the reader subsystem.
 * Tables: rss_subscriptions, ap_following, reader_items
 */

import type { Database } from 'bun:sqlite';
import { ulid } from 'ulidx';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RssSub {
  id: string;
  url: string;
  title: string;
  description: string;
  site_url: string;
  last_fetched_at: number | null;
  created_at: number;
  item_count?: number;
}

export interface ApFollowing {
  id: string;
  actor_url: string;
  username: string;
  display_name: string;
  domain: string;
  avatar_url: string;
  inbox_url: string;
  follow_state: 'none' | 'pending' | 'accepted' | 'rejected';
  follows_us: number; // 0 | 1
  last_fetched_at: number | null;
  created_at: number;
  item_count?: number;
}

export interface ReaderItem {
  id: string;
  source_type: 'rss' | 'ap';
  source_id: string;
  guid: string;
  item_url: string;
  title: string;
  content_html: string;
  author: string;
  published_at: number;
  fetched_at: number;
  // joined fields
  source_name?: string;
}

// ── RSS Subscriptions ──────────────────────────────────────────────────────────

export function addRssSub(
  db: Database,
  url: string,
  title: string,
  description: string,
  siteUrl: string,
): string {
  const id = ulid();
  db.prepare(
    'INSERT INTO rss_subscriptions (id, url, title, description, site_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, url, title, description, siteUrl, Date.now());
  return id;
}

export function updateRssSubMeta(
  db: Database,
  id: string,
  title: string,
  description: string,
  siteUrl: string,
): void {
  db.prepare(
    'UPDATE rss_subscriptions SET title = ?, description = ?, site_url = ?, last_fetched_at = ? WHERE id = ?',
  ).run(title, description, siteUrl, Date.now(), id);
}

export function getRssSubs(db: Database): RssSub[] {
  return db.prepare(`
    SELECT s.*, COUNT(i.id) as item_count
    FROM rss_subscriptions s
    LEFT JOIN reader_items i ON i.source_type = 'rss' AND i.source_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at ASC
  `).all() as RssSub[];
}

export function getRssSubById(db: Database, id: string): RssSub | null {
  return db.prepare('SELECT * FROM rss_subscriptions WHERE id = ?').get(id) as RssSub | null;
}

export function getRssSubByUrl(db: Database, url: string): RssSub | null {
  return db.prepare('SELECT * FROM rss_subscriptions WHERE url = ?').get(url) as RssSub | null;
}

export function deleteRssSub(db: Database, id: string): void {
  db.prepare('DELETE FROM reader_items WHERE source_type = ? AND source_id = ?').run('rss', id);
  db.prepare('DELETE FROM rss_subscriptions WHERE id = ?').run(id);
}

// ── AP Following ──────────────────────────────────────────────────────────────

export function addApFollowing(
  db: Database,
  actorUrl: string,
  username: string,
  displayName: string,
  domain: string,
  avatarUrl: string,
  inboxUrl: string,
  followState: ApFollowing['follow_state'],
): string {
  const id = ulid();
  const followsUs = checkFollowsUs(db, actorUrl) ? 1 : 0;
  db.prepare(`
    INSERT INTO ap_following
      (id, actor_url, username, display_name, domain, avatar_url, inbox_url, follow_state, follows_us, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, actorUrl, username, displayName, domain, avatarUrl, inboxUrl, followState, followsUs, Date.now());
  return id;
}

export function updateApFollowingState(
  db: Database,
  actorUrl: string,
  followState: ApFollowing['follow_state'],
): void {
  db.prepare('UPDATE ap_following SET follow_state = ? WHERE actor_url = ?').run(followState, actorUrl);
}

export function updateApFollowingFetched(
  db: Database,
  id: string,
  lastFetchedAt: number,
): void {
  db.prepare('UPDATE ap_following SET last_fetched_at = ? WHERE id = ?').run(lastFetchedAt, id);
}

export function updateApFollowsUs(db: Database, actorUrl: string, followsUs: boolean): void {
  db.prepare('UPDATE ap_following SET follows_us = ? WHERE actor_url = ?').run(followsUs ? 1 : 0, actorUrl);
}

export function getApFollowing(db: Database): ApFollowing[] {
  return db.prepare(`
    SELECT f.*, COUNT(i.id) as item_count
    FROM ap_following f
    LEFT JOIN reader_items i ON i.source_type = 'ap' AND i.source_id = f.id
    GROUP BY f.id
    ORDER BY f.created_at ASC
  `).all() as ApFollowing[];
}

export function getApFollowingById(db: Database, id: string): ApFollowing | null {
  return db.prepare('SELECT * FROM ap_following WHERE id = ?').get(id) as ApFollowing | null;
}

export function getApFollowingByActorUrl(db: Database, actorUrl: string): ApFollowing | null {
  return db.prepare('SELECT * FROM ap_following WHERE actor_url = ?').get(actorUrl) as ApFollowing | null;
}

export function deleteApFollowing(db: Database, id: string): void {
  db.prepare('DELETE FROM reader_items WHERE source_type = ? AND source_id = ?').run('ap', id);
  db.prepare('DELETE FROM ap_following WHERE id = ?').run(id);
}

function checkFollowsUs(db: Database, actorUrl: string): boolean {
  const row = db.prepare('SELECT 1 FROM ap_followers WHERE actor_uri = ?').get(actorUrl);
  return !!row;
}

// Called from inbox.ts when someone follows us
export function syncFollowsUs(db: Database, actorUri: string, followsUs: boolean): void {
  db.prepare('UPDATE ap_following SET follows_us = ? WHERE actor_url = ?').run(followsUs ? 1 : 0, actorUri);
}

// ── Reader Items ───────────────────────────────────────────────────────────────

export function upsertReaderItems(
  db: Database,
  sourceType: 'rss' | 'ap',
  sourceId: string,
  items: Array<{
    guid: string;
    itemUrl: string;
    title: string;
    contentHtml: string;
    author: string;
    publishedAt: Date;
  }>,
): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO reader_items
      (id, source_type, source_id, guid, item_url, title, content_html, author, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  let inserted = 0;
  for (const item of items) {
    const result = stmt.run(
      ulid(),
      sourceType,
      sourceId,
      item.guid,
      item.itemUrl,
      item.title,
      item.contentHtml,
      item.author,
      item.publishedAt.getTime(),
      now,
    );
    inserted += result.changes;
  }
  return inserted;
}

export interface ReaderItemsQuery {
  sourceType?: 'rss' | 'ap';
  sourceId?: string;
  limit?: number;
  offset?: number;
}

export function getReaderItems(db: Database, opts: ReaderItemsQuery = {}): ReaderItem[] {
  const { sourceType, sourceId, limit = 20, offset = 0 } = opts;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (sourceType) { conditions.push('i.source_type = ?'); params.push(sourceType); }
  if (sourceId)   { conditions.push('i.source_id = ?');   params.push(sourceId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT
      i.*,
      COALESCE(r.title, f.display_name, f.username) as source_name
    FROM reader_items i
    LEFT JOIN rss_subscriptions r ON i.source_type = 'rss' AND i.source_id = r.id
    LEFT JOIN ap_following f ON i.source_type = 'ap' AND i.source_id = f.id
    ${where}
    ORDER BY i.published_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ReaderItem[];

  return rows;
}

export function countReaderItems(db: Database, opts: Omit<ReaderItemsQuery, 'limit' | 'offset'> = {}): number {
  const { sourceType, sourceId } = opts;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (sourceType) { conditions.push('source_type = ?'); params.push(sourceType); }
  if (sourceId)   { conditions.push('source_id = ?');   params.push(sourceId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM reader_items ${where}`).get(...params) as { cnt: number };
  return row.cnt;
}
