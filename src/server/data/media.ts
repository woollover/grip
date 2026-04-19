import type { Database } from 'bun:sqlite';

export interface MediaFile {
  id: string;
  filename: string;
  mime_type: string;
  path: string;
  alt_text: string;
  tags: string[];
  uploaded_at: number;
}

interface MediaRow {
  id: string;
  filename: string;
  mime_type: string;
  path: string;
  alt_text: string;
  tags: string;
  uploaded_at: number;
}

function toMedia(row: MediaRow): MediaFile {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags ?? '[]') as string[]; } catch { /* empty */ }
  return { ...row, tags };
}

export class MediaRepo {
  constructor(private db: Database) {}

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) as n FROM media').get() as { n: number }).n;
  }

  list(opts: { page?: number; pageSize?: number } = {}): { files: MediaFile[]; total: number } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = opts.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    const total = this.count();
    const rows = this.db.prepare('SELECT * FROM media ORDER BY uploaded_at DESC LIMIT ? OFFSET ?').all(pageSize, offset) as MediaRow[];
    return { files: rows.map(toMedia), total };
  }

  listAll(): MediaFile[] {
    return (this.db.prepare('SELECT * FROM media ORDER BY uploaded_at DESC').all() as MediaRow[]).map(toMedia);
  }

  getById(id: string): MediaFile | null {
    const row = this.db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | null;
    return row ? toMedia(row) : null;
  }
}
