import type { Database } from 'bun:sqlite';

interface Article {
  id: string; slug: string; title: string; body_html: string;
  published_at: number | null;
}

export function renderRss(db: Database, domain: string, siteTitle: string, siteDescription: string): string {
  const articles = db.prepare(`
    SELECT id, slug, title, body_html, published_at
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 20
  `).all() as Article[];

  const baseUrl = `https://${domain}`;
  const items = articles.map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${baseUrl}/articles/${a.slug}</link>
      <guid isPermaLink="true">${baseUrl}/articles/${a.slug}</guid>
      <pubDate>${a.published_at ? new Date(a.published_at).toUTCString() : ''}</pubDate>
      <description><![CDATA[${a.body_html}]]></description>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${siteTitle}]]></title>
    <link>${baseUrl}</link>
    <description><![CDATA[${siteDescription}]]></description>
    <language>en</language>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}
