import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';

interface MicroPost {
  id: string; body_html: string; status: string; created_at: number;
}

export function renderMicroList(db: Database, siteTitle: string): string {
  const posts = db.prepare(`
    SELECT * FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC
  `).all() as MicroPost[];

  const content = `
    <h1>Notes</h1>
    ${posts.length === 0 ? '<p>No notes yet.</p>' : ''}
    ${posts.map(p => `
      <article>
        <div>${p.body_html}</div>
        <footer><small>${new Date(p.created_at).toISOString()}</small></footer>
      </article>`).join('')}
  `;

  return publicLayout({ title: 'Notes', siteTitle, db }, content);
}
