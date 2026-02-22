import type { Database } from 'bun:sqlite';
import { authorLayout } from './layout';

export function renderDashboard(db: Database): string {
  const articleCount = (db.prepare('SELECT COUNT(*) as n FROM articles').get() as { n: number }).n;
  const publishedCount = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'published'").get() as { n: number }).n;
  const microCount = (db.prepare('SELECT COUNT(*) as n FROM micro_posts').get() as { n: number }).n;
  const mediaCount = (db.prepare('SELECT COUNT(*) as n FROM media').get() as { n: number }).n;

  const recentEvents = db.prepare('SELECT id, type, created_at FROM events ORDER BY id DESC LIMIT 10').all() as
    { id: string; type: string; created_at: number }[];

  const content = `
    <h2>Dashboard</h2>
    <div class="grid">
      <div><a href="/articles"><strong>${articleCount}</strong> articles (${publishedCount} published)</a></div>
      <div><a href="/micro"><strong>${microCount}</strong> micro-posts</a></div>
      <div><a href="/media"><strong>${mediaCount}</strong> media files</a></div>
    </div>
    <h3>Recent events</h3>
    <table>
      <thead><tr><th>ID (ULID)</th><th>Type</th><th>When</th></tr></thead>
      <tbody>
        ${recentEvents.map(e => `
          <tr>
            <td><code>${e.id}</code></td>
            <td>${e.type}</td>
            <td>${new Date(e.created_at).toISOString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;

  return authorLayout('Dashboard', content, db);
}
