import type { Database } from 'bun:sqlite';

export class TagRepo {
  constructor(private db: Database) {}

  list(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT value as tag
      FROM articles, json_each(tags)
      WHERE status = 'published'
      ORDER BY value
    `).all() as { tag: string }[];
    return rows.map(r => r.tag);
  }
}
