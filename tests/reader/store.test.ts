import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  addRssSub, getRssSubs, getRssSubById, getRssSubByUrl,
  updateRssSubMeta, deleteRssSub,
  addApFollowing, getApFollowing, getApFollowingById, getApFollowingByActorUrl,
  updateApFollowingState, deleteApFollowing,
  upsertReaderItems, getReaderItems, countReaderItems,
} from '../../src/reader/store';

// ── In-memory DB with reader schema ──────────────────────────────────────────

function makeDb(): Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE rss_subscriptions (
      id           TEXT PRIMARY KEY,
      url          TEXT UNIQUE NOT NULL,
      title        TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      site_url     TEXT NOT NULL DEFAULT '',
      last_fetched_at INTEGER,
      created_at   INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE ap_followers (
      actor_uri    TEXT PRIMARY KEY,
      inbox_url    TEXT NOT NULL,
      followed_at  INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE ap_following (
      id           TEXT PRIMARY KEY,
      actor_url    TEXT UNIQUE NOT NULL,
      username     TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      domain       TEXT NOT NULL DEFAULT '',
      avatar_url   TEXT NOT NULL DEFAULT '',
      inbox_url    TEXT NOT NULL DEFAULT '',
      follow_state TEXT NOT NULL DEFAULT 'none',
      follows_us   INTEGER NOT NULL DEFAULT 0,
      last_fetched_at INTEGER,
      created_at   INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE reader_items (
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

    CREATE UNIQUE INDEX reader_items_dedup ON reader_items(source_type, source_id, guid);
    CREATE INDEX reader_items_pub ON reader_items(published_at DESC);
  `);
  return db;
}

let db: Database;

beforeEach(() => {
  db = makeDb();
});

// ── RSS Subscriptions ──────────────────────────────────────────────────────────

describe('RSS subscriptions', () => {
  it('adds a subscription and retrieves it', () => {
    const id = addRssSub(db, 'https://example.com/rss.xml', 'Test Feed', 'A feed', 'https://example.com');
    expect(id).toBeTruthy();

    const subs = getRssSubs(db);
    expect(subs.length).toBe(1);
    expect(subs[0].url).toBe('https://example.com/rss.xml');
    expect(subs[0].title).toBe('Test Feed');
  });

  it('retrieves by ID', () => {
    const id = addRssSub(db, 'https://example.com/rss.xml', 'Feed', '', '');
    const sub = getRssSubById(db, id);
    expect(sub).not.toBeNull();
    expect(sub!.id).toBe(id);
  });

  it('retrieves by URL', () => {
    addRssSub(db, 'https://example.com/rss.xml', 'Feed', '', '');
    const sub = getRssSubByUrl(db, 'https://example.com/rss.xml');
    expect(sub).not.toBeNull();
    expect(sub!.url).toBe('https://example.com/rss.xml');
  });

  it('returns null for missing ID', () => {
    expect(getRssSubById(db, 'nonexistent')).toBeNull();
  });

  it('returns null for missing URL', () => {
    expect(getRssSubByUrl(db, 'https://nothere.com')).toBeNull();
  });

  it('updates metadata', () => {
    const id = addRssSub(db, 'https://example.com/rss.xml', 'Old Title', '', '');
    updateRssSubMeta(db, id, 'New Title', 'New desc', 'https://new.com');
    const sub = getRssSubById(db, id)!;
    expect(sub.title).toBe('New Title');
    expect(sub.description).toBe('New desc');
    expect(sub.last_fetched_at).not.toBeNull();
  });

  it('deletes subscription and its items', () => {
    const id = addRssSub(db, 'https://example.com/rss.xml', 'Feed', '', '');
    upsertReaderItems(db, 'rss', id, [
      { guid: 'g1', itemUrl: 'https://example.com/1', title: 'Post 1', contentHtml: '', author: '', publishedAt: new Date() },
    ]);
    expect(countReaderItems(db)).toBe(1);

    deleteRssSub(db, id);

    expect(getRssSubs(db).length).toBe(0);
    expect(countReaderItems(db)).toBe(0);
  });

  it('enforces URL uniqueness', () => {
    addRssSub(db, 'https://example.com/rss.xml', 'Feed', '', '');
    expect(() => {
      addRssSub(db, 'https://example.com/rss.xml', 'Duplicate', '', '');
    }).toThrow();
  });
});

// ── AP Following ───────────────────────────────────────────────────────────────

describe('AP following', () => {
  it('adds a following entry', () => {
    const id = addApFollowing(db, 'https://mastodon.social/users/foo', 'foo', 'Foo Bar', 'mastodon.social', '', 'https://mastodon.social/inbox', 'none');
    expect(id).toBeTruthy();

    const all = getApFollowing(db);
    expect(all.length).toBe(1);
    expect(all[0].actor_url).toBe('https://mastodon.social/users/foo');
    expect(all[0].username).toBe('foo');
    expect(all[0].follow_state).toBe('none');
  });

  it('retrieves by ID', () => {
    const id = addApFollowing(db, 'https://mastodon.social/users/foo', 'foo', '', 'mastodon.social', '', '', 'none');
    const f = getApFollowingById(db, id);
    expect(f).not.toBeNull();
    expect(f!.id).toBe(id);
  });

  it('retrieves by actor URL', () => {
    addApFollowing(db, 'https://mastodon.social/users/bar', 'bar', '', 'mastodon.social', '', '', 'pending');
    const f = getApFollowingByActorUrl(db, 'https://mastodon.social/users/bar');
    expect(f).not.toBeNull();
    expect(f!.follow_state).toBe('pending');
  });

  it('updates follow state', () => {
    addApFollowing(db, 'https://mastodon.social/users/baz', 'baz', '', 'mastodon.social', '', '', 'pending');
    updateApFollowingState(db, 'https://mastodon.social/users/baz', 'accepted');
    const f = getApFollowingByActorUrl(db, 'https://mastodon.social/users/baz');
    expect(f!.follow_state).toBe('accepted');
  });

  it('detects follows_us from ap_followers table', () => {
    // Insert into ap_followers first
    db.prepare('INSERT INTO ap_followers (actor_uri, inbox_url, followed_at) VALUES (?, ?, ?)').run(
      'https://mastodon.social/users/mutual',
      'https://mastodon.social/inbox',
      Date.now(),
    );

    const id = addApFollowing(db, 'https://mastodon.social/users/mutual', 'mutual', '', 'mastodon.social', '', '', 'accepted');
    const f = getApFollowingById(db, id)!;
    expect(f.follows_us).toBe(1);
  });

  it('sets follows_us=0 when not in ap_followers', () => {
    const id = addApFollowing(db, 'https://example.com/users/stranger', 'stranger', '', 'example.com', '', '', 'none');
    const f = getApFollowingById(db, id)!;
    expect(f.follows_us).toBe(0);
  });

  it('deletes following and its items', () => {
    const id = addApFollowing(db, 'https://example.com/users/x', 'x', '', 'example.com', '', '', 'none');
    upsertReaderItems(db, 'ap', id, [
      { guid: 'note:1', itemUrl: '', title: '', contentHtml: '<p>hi</p>', author: 'x', publishedAt: new Date() },
    ]);
    expect(countReaderItems(db)).toBe(1);

    deleteApFollowing(db, id);

    expect(getApFollowing(db).length).toBe(0);
    expect(countReaderItems(db)).toBe(0);
  });

  it('enforces actor URL uniqueness', () => {
    addApFollowing(db, 'https://mastodon.social/users/dup', 'dup', '', 'mastodon.social', '', '', 'none');
    expect(() => {
      addApFollowing(db, 'https://mastodon.social/users/dup', 'dup2', '', 'mastodon.social', '', '', 'none');
    }).toThrow();
  });
});

// ── Reader items ───────────────────────────────────────────────────────────────

describe('reader items', () => {
  it('inserts and retrieves items', () => {
    const subId = addRssSub(db, 'https://example.com/rss', 'Feed', '', '');
    const now = new Date('2024-01-15T10:00:00Z');

    const inserted = upsertReaderItems(db, 'rss', subId, [
      { guid: 'item-1', itemUrl: 'https://example.com/1', title: 'Post 1', contentHtml: '<p>Hello</p>', author: 'Author', publishedAt: now },
      { guid: 'item-2', itemUrl: 'https://example.com/2', title: 'Post 2', contentHtml: '', author: '', publishedAt: now },
    ]);
    expect(inserted).toBe(2);

    const items = getReaderItems(db);
    expect(items.length).toBe(2);
  });

  it('deduplicates by (source_type, source_id, guid)', () => {
    const subId = addRssSub(db, 'https://example.com/rss', 'Feed', '', '');
    const item = { guid: 'same-guid', itemUrl: 'https://example.com/1', title: 'Post', contentHtml: '', author: '', publishedAt: new Date() };

    upsertReaderItems(db, 'rss', subId, [item]);
    const second = upsertReaderItems(db, 'rss', subId, [item]);

    expect(second).toBe(0); // no new rows
    expect(countReaderItems(db)).toBe(1);
  });

  it('orders by published_at descending', () => {
    const subId = addRssSub(db, 'https://example.com/rss', 'Feed', '', '');
    upsertReaderItems(db, 'rss', subId, [
      { guid: 'old', itemUrl: '', title: 'Old', contentHtml: '', author: '', publishedAt: new Date('2024-01-01') },
      { guid: 'new', itemUrl: '', title: 'New', contentHtml: '', author: '', publishedAt: new Date('2024-06-01') },
    ]);

    const items = getReaderItems(db);
    expect(items[0].title).toBe('New');
    expect(items[1].title).toBe('Old');
  });

  it('filters by source_type', () => {
    const rssId = addRssSub(db, 'https://example.com/rss', 'RSS', '', '');
    const apId  = addApFollowing(db, 'https://example.com/actor', 'user', '', 'example.com', '', '', 'none');

    upsertReaderItems(db, 'rss', rssId, [{ guid: 'r1', itemUrl: '', title: 'RSS item', contentHtml: '', author: '', publishedAt: new Date() }]);
    upsertReaderItems(db, 'ap',  apId,  [{ guid: 'a1', itemUrl: '', title: 'AP item',  contentHtml: '', author: '', publishedAt: new Date() }]);

    expect(getReaderItems(db, { sourceType: 'rss' }).length).toBe(1);
    expect(getReaderItems(db, { sourceType: 'ap' }).length).toBe(1);
    expect(getReaderItems(db).length).toBe(2);
  });

  it('filters by source_id', () => {
    const id1 = addRssSub(db, 'https://feed1.com/rss', 'Feed 1', '', '');
    const id2 = addRssSub(db, 'https://feed2.com/rss', 'Feed 2', '', '');

    upsertReaderItems(db, 'rss', id1, [{ guid: 'f1', itemUrl: '', title: 'From 1', contentHtml: '', author: '', publishedAt: new Date() }]);
    upsertReaderItems(db, 'rss', id2, [{ guid: 'f2', itemUrl: '', title: 'From 2', contentHtml: '', author: '', publishedAt: new Date() }]);

    const fromId1 = getReaderItems(db, { sourceId: id1 });
    expect(fromId1.length).toBe(1);
    expect(fromId1[0].title).toBe('From 1');
  });

  it('paginates correctly', () => {
    const subId = addRssSub(db, 'https://example.com/rss', 'Feed', '', '');
    const items = Array.from({ length: 5 }, (_, i) => ({
      guid: `item-${i}`,
      itemUrl: '',
      title: `Item ${i}`,
      contentHtml: '',
      author: '',
      publishedAt: new Date(2024, 0, i + 1),
    }));
    upsertReaderItems(db, 'rss', subId, items);

    const page1 = getReaderItems(db, { limit: 3, offset: 0 });
    const page2 = getReaderItems(db, { limit: 3, offset: 3 });

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(2);
    expect(countReaderItems(db)).toBe(5);
  });

  it('includes source_name in results', () => {
    const subId = addRssSub(db, 'https://example.com/rss', 'My Feed', '', '');
    upsertReaderItems(db, 'rss', subId, [{ guid: 'x', itemUrl: '', title: 'T', contentHtml: '', author: '', publishedAt: new Date() }]);

    const items = getReaderItems(db);
    expect(items[0].source_name).toBe('My Feed');
  });
});
