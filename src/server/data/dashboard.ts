import type { Database } from 'bun:sqlite';

export interface DashboardStats {
  articleCount: number;
  publishedCount: number;
  draftCount: number;
  microCount: number;
  microActiveCount: number;
  pageCount: number;
  pagePublishedCount: number;
  mediaCount: number;
  imageCount: number;
}

export interface EventRow {
  id: string;
  type: string;
  created_at: number;
  payload: string;
}

export class DashboardRepo {
  constructor(private db: Database) {}

  getStats(): DashboardStats {
    const n = (q: string) => (this.db.prepare(q).get() as { n: number }).n;
    return {
      articleCount:        n('SELECT COUNT(*) as n FROM articles'),
      publishedCount:      n("SELECT COUNT(*) as n FROM articles WHERE status = 'published'"),
      draftCount:          n("SELECT COUNT(*) as n FROM articles WHERE status = 'draft'"),
      microCount:          n('SELECT COUNT(*) as n FROM micro_posts'),
      microActiveCount:    n("SELECT COUNT(*) as n FROM micro_posts WHERE status = 'active'"),
      pageCount:           n('SELECT COUNT(*) as n FROM pages'),
      pagePublishedCount:  n("SELECT COUNT(*) as n FROM pages WHERE status = 'published'"),
      mediaCount:          n('SELECT COUNT(*) as n FROM media'),
      imageCount:          n("SELECT COUNT(*) as n FROM media WHERE mime_type LIKE 'image/%'"),
    };
  }

  getRecentEvents(limit = 10): EventRow[] {
    return this.db.prepare(
      "SELECT id, type, created_at, payload FROM events WHERE type != 'AuthAttempt' ORDER BY id DESC LIMIT ?"
    ).all(limit) as EventRow[];
  }
}
