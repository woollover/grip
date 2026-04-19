import type { Database } from 'bun:sqlite';

interface PageRow {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  body_html: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  body_html: string;
}

export interface PageAdmin {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  body_html: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export class PageRepo {
  constructor(private db: Database) {}

  // ── Public reads ──────────────────────────────────────────────────────────

  list(): Array<{ title: string; slug: string }> {
    return this.db.prepare(`SELECT title, slug FROM pages WHERE status = 'published' ORDER BY title`)
      .all() as Array<{ title: string; slug: string }>;
  }

  get(slug: string): Page | null {
    const row = this.db.prepare(`SELECT * FROM pages WHERE slug = ? AND status = 'published'`).get(slug) as PageRow | null;
    if (!row) return null;
    return { id: row.id, slug: row.slug, title: row.title, body_html: row.body_html };
  }

  // ── Author panel reads ────────────────────────────────────────────────────

  listAdmin(): PageAdmin[] {
    return (this.db.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all() as PageRow[])
      .map(r => ({ id: r.id, slug: r.slug, title: r.title, body_md: r.body_md, body_html: r.body_html, status: r.status, created_at: r.created_at, updated_at: r.updated_at }));
  }

  getById(id: string): PageAdmin | null {
    const row = this.db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow | null;
    if (!row) return null;
    return { id: row.id, slug: row.slug, title: row.title, body_md: row.body_md, body_html: row.body_html, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
  }
}
