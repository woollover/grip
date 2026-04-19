import type { Database } from 'bun:sqlite';

export interface Follower {
  actor_uri: string;
  inbox_url: string;
  followed_at: number;
}

export interface Reply {
  id: string;
  note_id: string;
  actor_uri: string;
  actor_name: string;
  content: string;
  published_at: number;
  status: string;
}

export interface NoteReply {
  id: string;
  actor_uri: string;
  actor_name: string;
  content: string;
  published_at: number;
}

export class ActivityRepo {
  constructor(private db: Database) {}

  // ── Followers ─────────────────────────────────────────────────────────────

  countFollowers(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM ap_followers').get() as { cnt: number }).cnt;
  }

  listFollowers(opts: { page?: number; pageSize?: number } = {}): Follower[] {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    return this.db.prepare(
      'SELECT actor_uri, inbox_url, followed_at FROM ap_followers ORDER BY followed_at DESC LIMIT ? OFFSET ?'
    ).all(pageSize, offset) as Follower[];
  }

  listAllFollowers(): { actor_uri: string; inbox_url: string }[] {
    return this.db.prepare('SELECT actor_uri, inbox_url FROM ap_followers').all() as { actor_uri: string; inbox_url: string }[];
  }

  insertFollower(actorUri: string, inboxUrl: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO ap_followers (actor_uri, inbox_url, followed_at) VALUES (?, ?, ?)'
    ).run(actorUri, inboxUrl, Date.now());
  }

  deleteFollower(actorUri: string): void {
    this.db.prepare('DELETE FROM ap_followers WHERE actor_uri = ?').run(actorUri);
  }

  // ── Replies ───────────────────────────────────────────────────────────────

  countReplies(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM ap_replies').get() as { cnt: number }).cnt;
  }

  listReplies(opts: { page?: number; pageSize?: number } = {}): Reply[] {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    return this.db.prepare(
      'SELECT id, note_id, actor_uri, actor_name, content, published_at, status FROM ap_replies ORDER BY published_at DESC LIMIT ? OFFSET ?'
    ).all(pageSize, offset) as Reply[];
  }

  listRepliesByNote(noteId: string): NoteReply[] {
    return this.db.prepare(`
      SELECT id, actor_uri, actor_name, content, published_at
      FROM ap_replies WHERE note_id = ? AND status = 'visible'
      ORDER BY published_at ASC
    `).all(noteId) as NoteReply[];
  }

  insertReply(
    id: string,
    noteId: string,
    actorUri: string,
    actorName: string,
    content: string,
    publishedAt: number,
    status: string,
  ): void {
    this.db.prepare(
      'INSERT OR IGNORE INTO ap_replies (id, note_id, actor_uri, actor_name, content, published_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, noteId, actorUri, actorName, content, publishedAt, status);
  }

  deleteReply(id: string): void {
    this.db.prepare('DELETE FROM ap_replies WHERE id = ?').run(id);
  }

  toggleReplyStatus(id: string): void {
    const row = this.db.prepare('SELECT status FROM ap_replies WHERE id = ?').get(id) as { status: string } | null;
    if (row) {
      this.db.prepare('UPDATE ap_replies SET status = ? WHERE id = ?').run(
        row.status === 'visible' ? 'hidden' : 'visible',
        id,
      );
    }
  }
}
