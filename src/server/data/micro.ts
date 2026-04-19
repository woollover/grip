import type { Database } from 'bun:sqlite';
import { fmtDate } from '../../views/shared';

interface MicroRow {
  id: string;
  body_md: string;
  body_html: string;
  status: string;
  created_at: number;
}

export interface MicroPost {
  id: string;
  body_html: string;
  created_at: string; // ISO 8601
  date: string;
}

export interface MicroPostAdmin {
  id: string;
  body_md: string;
  body_html: string;
  status: string;
  created_at: number;
}

// Shape used by activitypub/objects.ts (MicroPostRow)
export interface MicroPostAp {
  id: string;
  body_html: string;
  body_md: string;
  created_at: number;
}

function toPublic(row: MicroRow): MicroPost {
  return {
    id:         row.id,
    body_html:  row.body_html,
    created_at: new Date(row.created_at).toISOString(),
    date:       fmtDate(row.created_at),
  };
}

export class MicroRepo {
  constructor(private db: Database) {}

  // ── Public reads ──────────────────────────────────────────────────────────

  list(opts: { page?: number; pageSize?: number } = {}): { posts: MicroPost[]; total: number } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const total = (this.db.prepare(`SELECT COUNT(*) as n FROM micro_posts WHERE status = 'active'`).get() as { n: number }).n;
    const rows = this.db.prepare(`
      SELECT * FROM micro_posts WHERE status = 'active'
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(pageSize, offset) as MicroRow[];

    return { posts: rows.map(toPublic), total };
  }

  get(id: string): MicroPost | null {
    const row = this.db.prepare(`SELECT * FROM micro_posts WHERE id = ? AND status = 'active'`).get(id) as MicroRow | null;
    return row ? toPublic(row) : null;
  }

  // ── Author panel reads ────────────────────────────────────────────────────

  getById(id: string): MicroPostAdmin | null {
    const row = this.db.prepare('SELECT * FROM micro_posts WHERE id = ?').get(id) as MicroRow | null;
    if (!row) return null;
    return { id: row.id, body_md: row.body_md, body_html: row.body_html, status: row.status, created_at: row.created_at };
  }

  listAdmin(opts: { page?: number; pageSize?: number } = {}): { posts: MicroPostAdmin[]; total: number } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const total = (this.db.prepare('SELECT COUNT(*) as n FROM micro_posts').get() as { n: number }).n;
    const rows = this.db.prepare('SELECT * FROM micro_posts ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset) as MicroRow[];

    return {
      posts: rows.map(r => ({ id: r.id, body_md: r.body_md, body_html: r.body_html, status: r.status, created_at: r.created_at })),
      total,
    };
  }

  // ── AP-specific helpers ───────────────────────────────────────────────────

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM micro_posts WHERE status = 'active'").get() as { n: number }).n;
  }

  getLatest(): MicroPostAp | null {
    return this.db.prepare(
      "SELECT id, body_html, body_md, created_at FROM micro_posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1",
    ).get() as MicroPostAp | null;
  }

  listForAp(limit: number): MicroPostAp[] {
    return this.db.prepare(
      "SELECT id, body_html, body_md, created_at FROM micro_posts WHERE status = 'active' ORDER BY created_at DESC LIMIT ?",
    ).all(limit) as MicroPostAp[];
  }

  getForAp(id: string): MicroPostAp | null {
    return this.db.prepare(
      'SELECT id, body_html, body_md, created_at FROM micro_posts WHERE id = ?',
    ).get(id) as MicroPostAp | null;
  }
}
