import type { Database } from 'bun:sqlite';
import { fmtDate } from '../../views/shared';

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  body_html: string;
  tags: string;
  status: string;
  created_at: number;
  updated_at: number;
  published_at: number | null;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  body_html: string;
  excerpt: string;
  tags: string[];
  published_at: string; // ISO 8601
  date: string;
}

export interface ArticleAdmin {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  body_html: string;
  tags: string[];
  status: string;
  created_at: number;
  updated_at: number;
  published_at: number | null;
}

export interface ArticleCounts {
  all: number;
  published: number;
  draft: number;
  unpublished: number;
}

function parseTags(raw: string | null): string[] {
  try { return JSON.parse(raw ?? '[]') as string[]; } catch { return []; }
}

function excerpt(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .slice(0, 200);
}

function toPublicArticle(row: ArticleRow): Article {
  const ts = row.published_at ?? row.created_at;
  return {
    id:           row.id,
    slug:         row.slug,
    title:        row.title,
    body_html:    row.body_html,
    excerpt:      excerpt(row.body_html),
    tags:         parseTags(row.tags),
    published_at: new Date(ts).toISOString(),
    date:         fmtDate(ts),
  };
}

function toAdminArticle(row: ArticleRow): ArticleAdmin {
  return {
    id:           row.id,
    slug:         row.slug,
    title:        row.title,
    body_md:      row.body_md,
    body_html:    row.body_html,
    tags:         parseTags(row.tags),
    status:       row.status,
    created_at:   row.created_at,
    updated_at:   row.updated_at,
    published_at: row.published_at,
  };
}

export class ArticleRepo {
  constructor(private db: Database) {}

  // ── Public reads ──────────────────────────────────────────────────────────

  list(opts: { page?: number; tag?: string; pageSize?: number } = {}): { articles: Article[]; total: number } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    if (opts.tag) {
      const total = (this.db.prepare(`
        SELECT COUNT(*) as n FROM articles
        WHERE status = 'published'
          AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
      `).get(opts.tag) as { n: number }).n;

      const rows = this.db.prepare(`
        SELECT * FROM articles
        WHERE status = 'published'
          AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
        ORDER BY published_at DESC LIMIT ? OFFSET ?
      `).all(opts.tag, pageSize, offset) as ArticleRow[];

      return { articles: rows.map(toPublicArticle), total };
    }

    const total = (this.db.prepare(`SELECT COUNT(*) as n FROM articles WHERE status = 'published'`).get() as { n: number }).n;
    const rows = this.db.prepare(`
      SELECT * FROM articles WHERE status = 'published'
      ORDER BY published_at DESC LIMIT ? OFFSET ?
    `).all(pageSize, offset) as ArticleRow[];

    return { articles: rows.map(toPublicArticle), total };
  }

  get(slug: string): Article | null {
    const row = this.db.prepare(`SELECT * FROM articles WHERE slug = ? AND status = 'published'`).get(slug) as ArticleRow | null;
    return row ? toPublicArticle(row) : null;
  }

  listRecent(limit: number): { title: string; slug: string }[] {
    return this.db.prepare(`
      SELECT title, slug FROM articles
      WHERE status = 'published'
      ORDER BY published_at DESC LIMIT ?
    `).all(limit) as { title: string; slug: string }[];
  }

  // ── Author panel reads ────────────────────────────────────────────────────

  countByStatus(): ArticleCounts {
    const n = (q: string) =>
      (this.db.prepare(q).get() as { n: number }).n;
    return {
      all:         n('SELECT COUNT(*) as n FROM articles'),
      published:   n("SELECT COUNT(*) as n FROM articles WHERE status = 'published'"),
      draft:       n("SELECT COUNT(*) as n FROM articles WHERE status = 'draft'"),
      unpublished: n("SELECT COUNT(*) as n FROM articles WHERE status = 'unpublished'"),
    };
  }

  listAdmin(opts: { page?: number; status?: string; pageSize?: number } = {}): { articles: ArticleAdmin[]; total: number } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    if (opts.status && opts.status !== 'all') {
      const total = (this.db.prepare('SELECT COUNT(*) as n FROM articles WHERE status = ?').get(opts.status) as { n: number }).n;
      const rows = this.db.prepare('SELECT * FROM articles WHERE status = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(opts.status, pageSize, offset) as ArticleRow[];
      return { articles: rows.map(toAdminArticle), total };
    }

    const total = (this.db.prepare('SELECT COUNT(*) as n FROM articles').get() as { n: number }).n;
    const rows = this.db.prepare('SELECT * FROM articles ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(pageSize, offset) as ArticleRow[];
    return { articles: rows.map(toAdminArticle), total };
  }

  getById(id: string): ArticleAdmin | null {
    const row = this.db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as ArticleRow | null;
    return row ? toAdminArticle(row) : null;
  }
}
