import { describe, it, expect, beforeEach } from 'bun:test';
import { MediaRepo } from '../../src/server/data/media';
import { makeDb } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: MediaRepo;

const TS = 1743340800000;

function insertMedia(db: Database, opts: {
  id?: string;
  filename?: string;
  mimeType?: string;
  tags?: string[];
} = {}): string {
  const id = opts.id ?? crypto.randomUUID();
  db.prepare('INSERT INTO media (id, filename, mime_type, path, alt_text, tags, uploaded_at) VALUES (?, ?, ?, ?, NULL, ?, ?)')
    .run(id, opts.filename ?? 'test.jpg', opts.mimeType ?? 'image/jpeg', `/media/${id}`, JSON.stringify(opts.tags ?? []), TS);
  return id;
}

beforeEach(() => {
  db = makeDb();
  repo = new MediaRepo(db);
});

describe('MediaRepo.count', () => {
  it('returns 0 when empty', () => {
    expect(repo.count()).toBe(0);
  });

  it('counts all media', () => {
    insertMedia(db);
    insertMedia(db);
    expect(repo.count()).toBe(2);
  });
});

describe('MediaRepo.list', () => {
  it('returns empty when no media', () => {
    const { files, total } = repo.list();
    expect(files).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('paginates correctly', () => {
    for (let i = 0; i < 5; i++) insertMedia(db);
    const p1 = repo.list({ page: 1, pageSize: 2 });
    expect(p1.files).toHaveLength(2);
    expect(p1.total).toBe(5);
  });

  it('parses tags from JSON string', () => {
    insertMedia(db, { tags: ['photo', 'landscape'] });
    const { files } = repo.list();
    expect(files[0].tags).toEqual(['photo', 'landscape']);
  });
});

describe('MediaRepo.getById', () => {
  it('returns null when not found', () => {
    expect(repo.getById('missing')).toBeNull();
  });

  it('returns media file by id', () => {
    const id = insertMedia(db, { filename: 'photo.jpg', mimeType: 'image/jpeg' });
    const file = repo.getById(id);
    expect(file).not.toBeNull();
    expect(file!.id).toBe(id);
    expect(file!.filename).toBe('photo.jpg');
    expect(file!.mime_type).toBe('image/jpeg');
  });
});
