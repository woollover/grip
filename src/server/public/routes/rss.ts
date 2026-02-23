import type { Database } from 'bun:sqlite';

interface Article {
  id: string; slug: string; title: string; body_html: string;
  published_at: number | null;
}

interface MicroPost {
  id: string; body_md: string; body_html: string;
  created_at: number;
}

interface FeedItem {
  title: string;
  link: string;
  guid: string;
  isPermaLink: boolean;
  pubDate: string;
  description: string;
}

function articleItem(a: Article, baseUrl: string): FeedItem {
  return {
    title: a.title,
    link: `${baseUrl}/articles/${a.slug}`,
    guid: `${baseUrl}/articles/${a.slug}`,
    isPermaLink: true,
    pubDate: a.published_at ? new Date(a.published_at).toUTCString() : '',
    description: a.body_html,
  };
}

function microItem(m: MicroPost, baseUrl: string): FeedItem {
  const text = m.body_md.replace(/\s+/g, ' ').trim();
  const title = text.length > 80 ? text.slice(0, 77) + '…' : text;
  return {
    title,
    link: `${baseUrl}/micro`,
    guid: `${baseUrl}/micro#${m.id}`,
    isPermaLink: false,
    pubDate: new Date(m.created_at).toUTCString(),
    description: m.body_html,
  };
}

function buildFeed(
  items: FeedItem[],
  feedUrl: string,
  baseUrl: string,
  siteTitle: string,
  siteDescription: string,
  feedLabel?: string,
): string {
  const title = feedLabel ? `${siteTitle} — ${feedLabel}` : siteTitle;
  const itemsXml = items.map(i => `
    <item>
      <title><![CDATA[${i.title}]]></title>
      <link>${i.link}</link>
      <guid isPermaLink="${i.isPermaLink}">${i.guid}</guid>
      <pubDate>${i.pubDate}</pubDate>
      <description><![CDATA[${i.description}]]></description>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${title}]]></title>
    <link>${baseUrl}</link>
    <description><![CDATA[${siteDescription}]]></description>
    <language>en</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;
}

export function renderRssAll(db: Database, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;

  const articles = db.prepare(`
    SELECT id, slug, title, body_html, published_at
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 20
  `).all() as Article[];

  const posts = db.prepare(`
    SELECT id, body_md, body_html, created_at
    FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC LIMIT 20
  `).all() as MicroPost[];

  const merged = [
    ...articles.map(a => ({ item: articleItem(a, baseUrl), date: a.published_at ?? 0 })),
    ...posts.map(m => ({ item: microItem(m, baseUrl), date: m.created_at })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 20)
    .map(x => x.item);

  return buildFeed(merged, `${baseUrl}/rss.xml`, baseUrl, siteTitle, siteDescription);
}

export function renderRssArticles(db: Database, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;

  const articles = db.prepare(`
    SELECT id, slug, title, body_html, published_at
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 20
  `).all() as Article[];

  return buildFeed(
    articles.map(a => articleItem(a, baseUrl)),
    `${baseUrl}/articles/rss.xml`,
    baseUrl,
    siteTitle,
    siteDescription,
    'Articles',
  );
}

export function renderRssMicro(db: Database, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;

  const posts = db.prepare(`
    SELECT id, body_md, body_html, created_at
    FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC LIMIT 20
  `).all() as MicroPost[];

  return buildFeed(
    posts.map(m => microItem(m, baseUrl)),
    `${baseUrl}/micro/rss.xml`,
    baseUrl,
    siteTitle,
    siteDescription,
    'Notes',
  );
}
