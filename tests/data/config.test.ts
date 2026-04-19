import { describe, it, expect, beforeEach } from 'bun:test';
import { ConfigRepo } from '../../src/server/data/config';
import { makeDb } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: ConfigRepo;

beforeEach(() => {
  db = makeDb();
  repo = new ConfigRepo(db);
});

describe('ConfigRepo.get', () => {
  it('returns null when key missing and no fallback', () => {
    expect(repo.get('missing_key')).toBeNull();
  });

  it('returns fallback when key missing', () => {
    expect(repo.get('missing_key', 'default')).toBe('default');
  });

  it('returns stored value', () => {
    repo.set('site_title', 'My Blog');
    expect(repo.get('site_title')).toBe('My Blog');
  });

  it('returns stored value even when fallback is provided', () => {
    repo.set('site_title', 'My Blog');
    expect(repo.get('site_title', 'default')).toBe('My Blog');
  });
});

describe('ConfigRepo.set', () => {
  it('inserts new key', () => {
    repo.set('foo', 'bar');
    expect(repo.get('foo')).toBe('bar');
  });

  it('replaces existing key', () => {
    repo.set('foo', 'bar');
    repo.set('foo', 'baz');
    expect(repo.get('foo')).toBe('baz');
  });
});

describe('ConfigRepo.delete', () => {
  it('removes existing key', () => {
    repo.set('foo', 'bar');
    repo.delete('foo');
    expect(repo.get('foo')).toBeNull();
  });

  it('is a no-op when key does not exist', () => {
    // should not throw
    expect(() => repo.delete('nonexistent')).not.toThrow();
  });
});

describe('ConfigRepo.getPublicity', () => {
  it('defaults to public with everything enabled', () => {
    const p = repo.getPublicity();
    expect(p.isPrivate).toBe(false);
    expect(p.showArticles).toBe(true);
    expect(p.showMicro).toBe(true);
    expect(p.rssEnabled).toBe(true);
  });

  it('private mode gates all flags', () => {
    repo.set('publicity_mode', 'private');
    const p = repo.getPublicity();
    expect(p.isPrivate).toBe(true);
    expect(p.showArticles).toBe(false);
    expect(p.showMicro).toBe(false);
    expect(p.rssEnabled).toBe(false);
  });

  it('individual flags can be turned off in public mode', () => {
    repo.set('show_articles', '0');
    repo.set('rss_enabled', '0');
    const p = repo.getPublicity();
    expect(p.isPrivate).toBe(false);
    expect(p.showArticles).toBe(false);
    expect(p.showMicro).toBe(true);
    expect(p.rssEnabled).toBe(false);
  });
});

describe('ConfigRepo.getSite', () => {
  it('returns correct defaults when config is empty', () => {
    const s = repo.getSite();
    expect(s.title).toBe('My GRIP');
    expect(s.description).toBe('');
    expect(s.domain).toBe('localhost');
    expect(s.theme).toBe('default');
    expect(s.homeIntro).toBe('');
    expect(s.isPrivate).toBe(false);
    expect(s.showArticles).toBe(true);
    expect(s.showMicro).toBe(true);
    expect(s.rssEnabled).toBe(true);
  });

  it('returns stored values', () => {
    repo.set('site_title', 'GRIP Blog');
    repo.set('site_description', 'A personal space');
    repo.set('domain', 'example.com');
    repo.set('home_intro', 'Welcome!');
    const s = repo.getSite();
    expect(s.title).toBe('GRIP Blog');
    expect(s.description).toBe('A personal space');
    expect(s.domain).toBe('example.com');
    expect(s.homeIntro).toBe('Welcome!');
  });

  it('inherits privacy flags from getPublicity()', () => {
    repo.set('publicity_mode', 'private');
    const s = repo.getSite();
    expect(s.isPrivate).toBe(true);
    expect(s.showArticles).toBe(false);
    expect(s.showMicro).toBe(false);
    expect(s.rssEnabled).toBe(false);
  });
});
