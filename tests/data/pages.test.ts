import { describe, it, expect, beforeEach } from 'bun:test';
import { PageRepo } from '../../src/server/data/pages';
import { makeDb, insertPage } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: PageRepo;

beforeEach(() => {
  db = makeDb();
  repo = new PageRepo(db);
});

describe('PageRepo.list', () => {
  it('returns empty when no pages', () => {
    expect(repo.list()).toHaveLength(0);
  });

  it('returns only published pages', () => {
    insertPage(db, { slug: 'pub', status: 'published' });
    insertPage(db, { slug: 'draft', status: 'draft' });
    const pages = repo.list();
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe('pub');
  });

  it('returns title and slug only', () => {
    insertPage(db, { slug: 'about', title: 'About', status: 'published' });
    const pages = repo.list();
    expect(pages[0]).toEqual({ title: 'About', slug: 'about' });
  });

  it('orders by title', () => {
    insertPage(db, { slug: 'z-page', title: 'Zebra', status: 'published' });
    insertPage(db, { slug: 'a-page', title: 'Apple', status: 'published' });
    const pages = repo.list();
    expect(pages[0].title).toBe('Apple');
    expect(pages[1].title).toBe('Zebra');
  });
});

describe('PageRepo.get', () => {
  it('returns null when not found', () => {
    expect(repo.get('nope')).toBeNull();
  });

  it('returns null for unpublished page', () => {
    insertPage(db, { slug: 'draft', status: 'draft' });
    expect(repo.get('draft')).toBeNull();
  });

  it('returns page when published', () => {
    insertPage(db, { slug: 'about', title: 'About', body_html: '<p>Hi</p>', status: 'published' });
    const page = repo.get('about');
    expect(page).not.toBeNull();
    expect(page!.slug).toBe('about');
    expect(page!.title).toBe('About');
    expect(page!.body_html).toBe('<p>Hi</p>');
  });
});

describe('PageRepo.listAdmin', () => {
  it('returns all pages regardless of status', () => {
    insertPage(db, { slug: 'pub', status: 'published' });
    insertPage(db, { slug: 'draft', status: 'draft' });
    expect(repo.listAdmin()).toHaveLength(2);
  });
});

describe('PageRepo.getById', () => {
  it('returns null when not found', () => {
    expect(repo.getById('missing')).toBeNull();
  });

  it('returns page admin view by id', () => {
    const id = insertPage(db, { slug: 'test', title: 'Test', status: 'draft' });
    const page = repo.getById(id);
    expect(page).not.toBeNull();
    expect(page!.id).toBe(id);
    expect(page!.status).toBe('draft');
  });
});
