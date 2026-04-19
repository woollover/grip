import { describe, it, expect, beforeEach } from 'bun:test';
import { ArticleRepo } from '../../src/server/data/articles';
import { GripDb } from '../../src/server/data/index';
import { applyEvent } from '../../src/core/projections';
import { handleArticleAutosave } from '../../src/server/author/routes/articles';
import { makeDb, insertArticle } from './helpers';
import type { Database } from 'bun:sqlite';

const fakeStore = { append: () => {} } as any;

let db: Database;
let repo: ArticleRepo;

const TS = 1743340800000; // 2026-03-30T00:00:00.000Z (stable reference timestamp)

beforeEach(() => {
  db = makeDb();
  repo = new ArticleRepo(db);
});

describe('ArticleRepo.list', () => {
  it('returns empty when no articles', () => {
    const { articles, total } = repo.list();
    expect(articles).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('returns only published articles', () => {
    insertArticle(db, { slug: 'pub', status: 'published' });
    insertArticle(db, { slug: 'draft', status: 'draft' });
    insertArticle(db, { slug: 'unpub', status: 'unpublished' });
    const { articles, total } = repo.list();
    expect(total).toBe(1);
    expect(articles[0].slug).toBe('pub');
  });

  it('paginates correctly', () => {
    for (let i = 0; i < 5; i++) {
      insertArticle(db, { slug: `a${i}`, status: 'published', published_at: TS + i * 1000 });
    }
    const p1 = repo.list({ page: 1, pageSize: 2 });
    expect(p1.articles).toHaveLength(2);
    expect(p1.total).toBe(5);

    const p3 = repo.list({ page: 3, pageSize: 2 });
    expect(p3.articles).toHaveLength(1);
  });

  it('normalizes page 0 to page 1', () => {
    insertArticle(db, { slug: 'a', status: 'published' });
    const r = repo.list({ page: 0 });
    expect(r.articles).toHaveLength(1);
  });

  it('filters by tag', () => {
    insertArticle(db, { slug: 'tagged', status: 'published', tags: ['bun', 'sqlite'] });
    insertArticle(db, { slug: 'other', status: 'published', tags: ['react'] });
    const { articles, total } = repo.list({ tag: 'bun' });
    expect(total).toBe(1);
    expect(articles[0].slug).toBe('tagged');
  });

  it('returns empty when tag filter matches nothing', () => {
    insertArticle(db, { slug: 'a', status: 'published', tags: ['foo'] });
    const { articles, total } = repo.list({ tag: 'notexist' });
    expect(total).toBe(0);
    expect(articles).toHaveLength(0);
  });

  it('parses tags from JSON string', () => {
    insertArticle(db, { slug: 'tagged', status: 'published', tags: ['a', 'b'] });
    const { articles } = repo.list();
    expect(articles[0].tags).toEqual(['a', 'b']);
  });

  it('returns empty array for null tags', () => {
    // Insert with null tags directly
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO articles (id, slug, title, body_md, body_html, tags, status, created_at, updated_at, published_at)
      VALUES (?, 'null-tags', 'T', '', '', '[]', 'published', ?, ?, ?)
    `).run(id, now, now, now);
    const { articles } = repo.list();
    expect(articles[0].tags).toEqual([]);
  });

  it('sets published_at as ISO 8601 string', () => {
    insertArticle(db, { slug: 'a', status: 'published', published_at: TS });
    const { articles } = repo.list();
    expect(articles[0].published_at).toBe(new Date(TS).toISOString());
  });

  it('sets date as a non-empty formatted string', () => {
    insertArticle(db, { slug: 'a', status: 'published', published_at: TS });
    const { articles } = repo.list();
    expect(typeof articles[0].date).toBe('string');
    expect(articles[0].date.length).toBeGreaterThan(0);
  });

  it('excerpt strips HTML tags', () => {
    insertArticle(db, { slug: 'a', status: 'published', body_html: '<p>Hello <strong>world</strong></p>' });
    const { articles } = repo.list();
    expect(articles[0].excerpt).toBe('Hello world');
  });

  it('excerpt unescapes HTML entities', () => {
    insertArticle(db, { slug: 'a', status: 'published', body_html: '<p>A &amp; B &lt;test&gt;</p>' });
    const { articles } = repo.list();
    expect(articles[0].excerpt).toBe('A & B <test>');
  });

  it('excerpt truncates to 200 chars', () => {
    const long = '<p>' + 'x'.repeat(300) + '</p>';
    insertArticle(db, { slug: 'a', status: 'published', body_html: long });
    const { articles } = repo.list();
    expect(articles[0].excerpt).toHaveLength(200);
  });

  it('orders by published_at descending', () => {
    insertArticle(db, { slug: 'old', status: 'published', published_at: TS });
    insertArticle(db, { slug: 'new', status: 'published', published_at: TS + 10000 });
    const { articles } = repo.list();
    expect(articles[0].slug).toBe('new');
  });
});

describe('ArticleRepo.get', () => {
  it('returns null when not found', () => {
    expect(repo.get('nope')).toBeNull();
  });

  it('returns null for unpublished article', () => {
    insertArticle(db, { slug: 'draft', status: 'draft' });
    expect(repo.get('draft')).toBeNull();
  });

  it('returns article when published', () => {
    insertArticle(db, { slug: 'hello', title: 'Hello', status: 'published' });
    const article = repo.get('hello');
    expect(article).not.toBeNull();
    expect(article!.slug).toBe('hello');
    expect(article!.title).toBe('Hello');
  });
});

describe('ArticleRepo.listRecent', () => {
  it('returns max n published articles in desc order', () => {
    for (let i = 0; i < 5; i++) {
      insertArticle(db, { slug: `a${i}`, status: 'published', published_at: TS + i * 1000 });
    }
    const recent = repo.listRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].slug).toBe('a4'); // newest first
  });

  it('excludes non-published articles', () => {
    insertArticle(db, { slug: 'pub', status: 'published' });
    insertArticle(db, { slug: 'draft', status: 'draft' });
    expect(repo.listRecent(10)).toHaveLength(1);
  });

  it('returns empty when no published articles', () => {
    expect(repo.listRecent(5)).toHaveLength(0);
  });
});

describe('ArticleRepo.countByStatus', () => {
  it('returns zero counts when empty', () => {
    const counts = repo.countByStatus();
    expect(counts.all).toBe(0);
    expect(counts.published).toBe(0);
    expect(counts.draft).toBe(0);
    expect(counts.unpublished).toBe(0);
  });

  it('counts by status correctly', () => {
    insertArticle(db, { slug: 'a', status: 'published' });
    insertArticle(db, { slug: 'b', status: 'draft' });
    insertArticle(db, { slug: 'c', status: 'draft' });
    insertArticle(db, { slug: 'd', status: 'unpublished' });
    const counts = repo.countByStatus();
    expect(counts.all).toBe(4);
    expect(counts.published).toBe(1);
    expect(counts.draft).toBe(2);
    expect(counts.unpublished).toBe(1);
  });
});

describe('ArticleRepo.getById', () => {
  it('returns null when not found', () => {
    expect(repo.getById('missing')).toBeNull();
  });

  it('returns admin article regardless of status', () => {
    const id = insertArticle(db, { slug: 'draft-art', status: 'draft', title: 'Draft' });
    const a = repo.getById(id);
    expect(a).not.toBeNull();
    expect(a!.status).toBe('draft');
    expect(a!.title).toBe('Draft');
  });
});

describe('ArticleRevised projection: slug handling', () => {
  it('updates slug when provided', () => {
    const id = insertArticle(db, { slug: 'original', status: 'draft', title: 'T' });
    applyEvent(db, {
      type: 'ArticleRevised', id, title: 'T', body: 'body', tags: [], slug: 'updated-slug',
    }, Date.now());
    const row = db.prepare('SELECT slug FROM articles WHERE id = ?').get(id) as { slug: string };
    expect(row.slug).toBe('updated-slug');
  });

  it('preserves existing slug when not provided', () => {
    const id = insertArticle(db, { slug: 'keep-me', status: 'draft', title: 'T' });
    applyEvent(db, {
      type: 'ArticleRevised', id, title: 'T', body: 'body', tags: [],
    }, Date.now());
    const row = db.prepare('SELECT slug FROM articles WHERE id = ?').get(id) as { slug: string };
    expect(row.slug).toBe('keep-me');
  });
});

describe('handleArticleAutosave', () => {
  it('saves body and returns true on happy path', () => {
    const grip = new GripDb(db);
    const id = insertArticle(db, { slug: 'auto', status: 'draft', title: 'My Title' });
    const ok = handleArticleAutosave(grip, fakeStore, id, { body: 'Updated body content' });
    expect(ok).toBe(true);
    const row = db.prepare('SELECT body_md, title, slug FROM articles WHERE id = ?').get(id) as any;
    expect(row.body_md).toBe('Updated body content');
    expect(row.title).toBe('My Title');
    expect(row.slug).toBe('auto');
  });

  it('returns false when article not found', () => {
    const grip = new GripDb(db);
    const ok = handleArticleAutosave(grip, fakeStore, 'nonexistent', { body: 'x' });
    expect(ok).toBe(false);
  });
});
