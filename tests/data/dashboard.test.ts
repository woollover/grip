import { describe, it, expect, beforeEach } from 'bun:test';
import { DashboardRepo } from '../../src/server/data/dashboard';
import { makeDb, insertArticle, insertMicro, insertPage } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: DashboardRepo;

beforeEach(() => {
  db = makeDb();
  // DashboardRepo needs the events table, which makeDb doesn't include.
  db.exec(`
    CREATE TABLE events (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;
  `);
  repo = new DashboardRepo(db);
});

describe('DashboardRepo.getStats', () => {
  it('returns zero counts when empty', () => {
    const s = repo.getStats();
    expect(s.articleCount).toBe(0);
    expect(s.publishedCount).toBe(0);
    expect(s.draftCount).toBe(0);
    expect(s.microCount).toBe(0);
    expect(s.microActiveCount).toBe(0);
    expect(s.pageCount).toBe(0);
    expect(s.pagePublishedCount).toBe(0);
    expect(s.mediaCount).toBe(0);
    expect(s.imageCount).toBe(0);
  });

  it('counts articles, micro, pages correctly', () => {
    insertArticle(db, { slug: 'pub', status: 'published' });
    insertArticle(db, { slug: 'draft', status: 'draft' });
    insertMicro(db, { status: 'active' });
    insertMicro(db, { status: 'retracted' });
    insertPage(db, { slug: 'p1', status: 'published' });
    insertPage(db, { slug: 'p2', status: 'draft' });
    const s = repo.getStats();
    expect(s.articleCount).toBe(2);
    expect(s.publishedCount).toBe(1);
    expect(s.draftCount).toBe(1);
    expect(s.microCount).toBe(2);
    expect(s.microActiveCount).toBe(1);
    expect(s.pageCount).toBe(2);
    expect(s.pagePublishedCount).toBe(1);
  });

  it('counts images correctly', () => {
    db.prepare('INSERT INTO media (id, filename, mime_type, path, alt_text, tags, uploaded_at) VALUES (?, ?, ?, ?, NULL, ?, ?)')
      .run('img1', 'photo.jpg', 'image/jpeg', '/media/img1', '[]', Date.now());
    db.prepare('INSERT INTO media (id, filename, mime_type, path, alt_text, tags, uploaded_at) VALUES (?, ?, ?, ?, NULL, ?, ?)')
      .run('doc1', 'file.pdf', 'application/pdf', '/media/doc1', '[]', Date.now());
    const s = repo.getStats();
    expect(s.mediaCount).toBe(2);
    expect(s.imageCount).toBe(1);
  });
});

describe('DashboardRepo.getRecentEvents', () => {
  it('returns empty when no events', () => {
    expect(repo.getRecentEvents()).toHaveLength(0);
  });

  it('returns up to limit events in reverse order', () => {
    for (let i = 1; i <= 5; i++) {
      db.prepare('INSERT INTO events (id, type, payload, created_at) VALUES (?, ?, ?, ?)')
        .run(`ev${i}`, 'TestEvent', '{}', i * 1000);
    }
    const events = repo.getRecentEvents(3);
    expect(events).toHaveLength(3);
    // Ordered DESC by id (ULID) — ev5, ev4, ev3
    expect(events[0].id).toBe('ev5');
  });
});
