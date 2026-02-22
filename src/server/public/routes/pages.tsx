import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';

interface Page {
  id: string; slug: string; title: string; body_html: string;
  status: string; created_at: number; updated_at: number;
}

export function renderPage(db: Database, slug: string, siteTitle: string): string | null {
  const page = db.prepare(`
    SELECT * FROM pages WHERE slug = ? AND status = 'published'
  `).get(slug) as Page | null;

  if (!page) return null;

  const content = `
    <article>
      <h1>${page.title}</h1>
      <div>${page.body_html}</div>
    </article>
  `;

  return publicLayout({ title: page.title, siteTitle, db }, content);
}
