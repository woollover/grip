import { describe, it, expect, beforeEach } from 'bun:test';
import { MicroRepo } from '../../src/server/data/micro';
import { makeDb, insertMicro } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: MicroRepo;

const TS = 1743340800000; // stable reference timestamp

beforeEach(() => {
  db = makeDb();
  repo = new MicroRepo(db);
});

describe('MicroRepo.list', () => {
  it('returns empty when no posts', () => {
    const { posts, total } = repo.list();
    expect(posts).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('returns only active posts', () => {
    insertMicro(db, { status: 'active' });
    insertMicro(db, { status: 'retracted' });
    const { posts, total } = repo.list();
    expect(total).toBe(1);
    expect(posts).toHaveLength(1);
  });

  it('paginates correctly', () => {
    for (let i = 0; i < 5; i++) {
      insertMicro(db, { created_at: TS + i * 1000 });
    }
    const p1 = repo.list({ page: 1, pageSize: 2 });
    expect(p1.posts).toHaveLength(2);
    expect(p1.total).toBe(5);

    const p3 = repo.list({ page: 3, pageSize: 2 });
    expect(p3.posts).toHaveLength(1);
  });

  it('orders by created_at descending', () => {
    const id1 = insertMicro(db, { created_at: TS });
    const id2 = insertMicro(db, { created_at: TS + 5000 });
    const { posts } = repo.list();
    expect(posts[0].id).toBe(id2);
  });

  it('sets created_at as ISO 8601 string', () => {
    insertMicro(db, { created_at: TS });
    const { posts } = repo.list();
    expect(posts[0].created_at).toBe(new Date(TS).toISOString());
  });

  it('sets date as a non-empty formatted string', () => {
    insertMicro(db, { created_at: TS });
    const { posts } = repo.list();
    expect(typeof posts[0].date).toBe('string');
    expect(posts[0].date.length).toBeGreaterThan(0);
  });
});

describe('MicroRepo.get', () => {
  it('returns null when not found', () => {
    expect(repo.get('nope')).toBeNull();
  });

  it('returns null for retracted post', () => {
    const id = insertMicro(db, { status: 'retracted' });
    expect(repo.get(id)).toBeNull();
  });

  it('returns post when active', () => {
    const id = insertMicro(db, { body_html: '<p>Hello</p>', status: 'active' });
    const post = repo.get(id);
    expect(post).not.toBeNull();
    expect(post!.id).toBe(id);
  });
});

describe('MicroRepo.count', () => {
  it('counts only active posts', () => {
    insertMicro(db, { status: 'active' });
    insertMicro(db, { status: 'active' });
    insertMicro(db, { status: 'retracted' });
    expect(repo.count()).toBe(2);
  });
});

describe('MicroRepo.getLatest', () => {
  it('returns null when empty', () => {
    expect(repo.getLatest()).toBeNull();
  });

  it('returns null when all retracted', () => {
    insertMicro(db, { status: 'retracted' });
    expect(repo.getLatest()).toBeNull();
  });

  it('returns most recent active post', () => {
    const old = insertMicro(db, { created_at: TS });
    const newest = insertMicro(db, { created_at: TS + 10000 });
    insertMicro(db, { status: 'retracted', created_at: TS + 20000 });
    const latest = repo.getLatest();
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(newest);
  });
});

describe('MicroRepo.listForAp', () => {
  it('returns up to limit active posts', () => {
    for (let i = 0; i < 5; i++) insertMicro(db);
    insertMicro(db, { status: 'retracted' });
    const results = repo.listForAp(3);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('body_html');
      expect(r).toHaveProperty('created_at');
    }
  });
});

describe('MicroRepo.getForAp', () => {
  it('returns null for missing id', () => {
    expect(repo.getForAp('missing')).toBeNull();
  });

  it('returns post by id regardless of status', () => {
    const id = insertMicro(db, { status: 'retracted' });
    const result = repo.getForAp(id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
  });
});
