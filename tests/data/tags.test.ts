import { describe, it, expect, beforeEach } from 'bun:test';
import { TagRepo } from '../../src/server/data/tags';
import { makeDb, insertArticle } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: TagRepo;

beforeEach(() => {
  db = makeDb();
  repo = new TagRepo(db);
});

describe('TagRepo.list', () => {
  it('returns empty when no published articles', () => {
    expect(repo.list()).toHaveLength(0);
  });

  it('ignores tags from non-published articles', () => {
    insertArticle(db, { slug: 'draft', status: 'draft', tags: ['hidden'] });
    expect(repo.list()).toHaveLength(0);
  });

  it('returns distinct tags from published articles', () => {
    insertArticle(db, { slug: 'a', status: 'published', tags: ['bun', 'sqlite'] });
    insertArticle(db, { slug: 'b', status: 'published', tags: ['bun', 'typescript'] });
    const tags = repo.list();
    expect(tags).toContain('bun');
    expect(tags).toContain('sqlite');
    expect(tags).toContain('typescript');
    expect(tags.filter(t => t === 'bun')).toHaveLength(1); // no duplicates
  });

  it('returns tags sorted alphabetically', () => {
    insertArticle(db, { slug: 'a', status: 'published', tags: ['zebra', 'apple', 'mango'] });
    const tags = repo.list();
    expect(tags).toEqual([...tags].sort());
  });

  it('returns empty for articles with no tags', () => {
    insertArticle(db, { slug: 'a', status: 'published', tags: [] });
    expect(repo.list()).toHaveLength(0);
  });
});
