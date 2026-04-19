import { describe, it, expect, beforeEach } from 'bun:test';
import { ActivityRepo } from '../../src/server/data/activity';
import { makeDb } from './helpers';
import type { Database } from 'bun:sqlite';

let db: Database;
let repo: ActivityRepo;

const TS = 1743340800000;

function insertFollower(db: Database, actorUri: string, inboxUrl = 'https://example.com/inbox'): void {
  db.prepare('INSERT INTO ap_followers (actor_uri, inbox_url, followed_at) VALUES (?, ?, ?)')
    .run(actorUri, inboxUrl, TS);
}

function insertReply(db: Database, opts: {
  id?: string;
  noteId?: string;
  actorUri?: string;
  actorName?: string;
  content?: string;
  publishedAt?: number;
  status?: string;
}): string {
  const id = opts.id ?? crypto.randomUUID();
  db.prepare('INSERT INTO ap_replies (id, note_id, actor_uri, actor_name, content, published_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, opts.noteId ?? 'note1', opts.actorUri ?? 'https://remote/user', opts.actorName ?? 'Remote User', opts.content ?? 'Hello', opts.publishedAt ?? TS, opts.status ?? 'visible');
  return id;
}

beforeEach(() => {
  db = makeDb();
  repo = new ActivityRepo(db);
});

// ── Followers ─────────────────────────────────────────────────────────────────

describe('ActivityRepo.countFollowers', () => {
  it('returns 0 when no followers', () => {
    expect(repo.countFollowers()).toBe(0);
  });

  it('counts all followers', () => {
    insertFollower(db, 'https://a.social/users/a');
    insertFollower(db, 'https://b.social/users/b');
    expect(repo.countFollowers()).toBe(2);
  });
});

describe('ActivityRepo.listFollowers', () => {
  it('returns empty when no followers', () => {
    expect(repo.listFollowers()).toHaveLength(0);
  });

  it('paginates followers', () => {
    for (let i = 0; i < 5; i++) {
      insertFollower(db, `https://a.social/users/${i}`);
    }
    const p1 = repo.listFollowers({ page: 1, pageSize: 2 });
    expect(p1).toHaveLength(2);
    const p3 = repo.listFollowers({ page: 3, pageSize: 2 });
    expect(p3).toHaveLength(1);
  });
});

describe('ActivityRepo.listAllFollowers', () => {
  it('returns actor_uri and inbox_url for all followers', () => {
    insertFollower(db, 'https://a.social/users/a', 'https://a.social/inbox');
    const all = repo.listAllFollowers();
    expect(all).toHaveLength(1);
    expect(all[0].actor_uri).toBe('https://a.social/users/a');
    expect(all[0].inbox_url).toBe('https://a.social/inbox');
  });
});

describe('ActivityRepo.insertFollower', () => {
  it('inserts a new follower', () => {
    repo.insertFollower('https://a.social/users/x', 'https://a.social/inbox');
    expect(repo.countFollowers()).toBe(1);
  });

  it('replaces existing follower (upsert)', () => {
    repo.insertFollower('https://a.social/users/x', 'https://a.social/inbox');
    repo.insertFollower('https://a.social/users/x', 'https://a.social/inbox2');
    expect(repo.countFollowers()).toBe(1);
    const [f] = repo.listAllFollowers();
    expect(f.inbox_url).toBe('https://a.social/inbox2');
  });
});

describe('ActivityRepo.deleteFollower', () => {
  it('removes a follower', () => {
    insertFollower(db, 'https://a.social/users/a');
    repo.deleteFollower('https://a.social/users/a');
    expect(repo.countFollowers()).toBe(0);
  });

  it('is a no-op when follower does not exist', () => {
    expect(() => repo.deleteFollower('https://nope')).not.toThrow();
  });
});

// ── Replies ───────────────────────────────────────────────────────────────────

describe('ActivityRepo.countReplies', () => {
  it('returns 0 when no replies', () => {
    expect(repo.countReplies()).toBe(0);
  });

  it('counts all replies', () => {
    insertReply(db, {});
    insertReply(db, {});
    expect(repo.countReplies()).toBe(2);
  });
});

describe('ActivityRepo.listRepliesByNote', () => {
  it('returns only visible replies for the given note', () => {
    insertReply(db, { noteId: 'note1', status: 'visible' });
    insertReply(db, { noteId: 'note1', status: 'hidden' });
    insertReply(db, { noteId: 'note2', status: 'visible' });
    const replies = repo.listRepliesByNote('note1');
    expect(replies).toHaveLength(1);
  });

  it('orders by published_at ascending', () => {
    insertReply(db, { noteId: 'n', publishedAt: TS + 2000 });
    insertReply(db, { noteId: 'n', publishedAt: TS });
    const replies = repo.listRepliesByNote('n');
    expect(replies[0].published_at).toBe(TS);
  });
});

describe('ActivityRepo.insertReply', () => {
  it('inserts reply with correct fields', () => {
    repo.insertReply('reply1', 'note1', 'https://actor', 'Actor', 'Hello!', TS, 'visible');
    expect(repo.countReplies()).toBe(1);
  });

  it('ignores duplicate insert (INSERT OR IGNORE)', () => {
    repo.insertReply('reply1', 'note1', 'https://actor', 'Actor', 'Hello!', TS, 'visible');
    repo.insertReply('reply1', 'note1', 'https://actor', 'Actor', 'Updated', TS, 'visible');
    expect(repo.countReplies()).toBe(1);
    // content unchanged — it was ignored
    const replies = repo.listRepliesByNote('note1');
    expect(replies[0].content).toBe('Hello!');
  });
});

describe('ActivityRepo.deleteReply', () => {
  it('removes a reply', () => {
    const id = insertReply(db, {});
    repo.deleteReply(id);
    expect(repo.countReplies()).toBe(0);
  });
});

describe('ActivityRepo.toggleReplyStatus', () => {
  it('hides a visible reply', () => {
    const id = insertReply(db, { noteId: 'n', status: 'visible' });
    repo.toggleReplyStatus(id);
    // visible → hidden means listRepliesByNote returns 0
    expect(repo.listRepliesByNote('n')).toHaveLength(0);
  });

  it('shows a hidden reply', () => {
    const id = insertReply(db, { noteId: 'n', status: 'hidden' });
    repo.toggleReplyStatus(id);
    expect(repo.listRepliesByNote('n')).toHaveLength(1);
  });

  it('is a no-op when reply does not exist', () => {
    expect(() => repo.toggleReplyStatus('missing')).not.toThrow();
  });
});
