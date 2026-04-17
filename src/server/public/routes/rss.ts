import type { GripDb } from '../../data/index';
import type { Article } from '../../data/articles';
import type { MicroPost } from '../../data/micro';

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
    pubDate: new Date(a.published_at).toUTCString(),
    description: a.body_html,
  };
}

function microItem(m: MicroPost, baseUrl: string): FeedItem {
  const text = m.body_html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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

export function renderRssAll(db: GripDb, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;
  const { articles } = db.articles.list({ pageSize: 20 });
  const { posts } = db.micro.list({ pageSize: 20 });

  const merged = [
    ...articles.map(a => ({ item: articleItem(a, baseUrl), date: new Date(a.published_at).getTime() })),
    ...posts.map(m => ({ item: microItem(m, baseUrl), date: new Date(m.created_at).getTime() })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 20)
    .map(x => x.item);

  return buildFeed(merged, `${baseUrl}/rss.xml`, baseUrl, siteTitle, siteDescription);
}

export function renderRssArticles(db: GripDb, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;
  const { articles } = db.articles.list({ pageSize: 20 });
  return buildFeed(
    articles.map(a => articleItem(a, baseUrl)),
    `${baseUrl}/articles/rss.xml`,
    baseUrl,
    siteTitle,
    siteDescription,
    'Articles',
  );
}

export function renderRssMicro(db: GripDb, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;
  const { posts } = db.micro.list({ pageSize: 20 });
  return buildFeed(
    posts.map(m => microItem(m, baseUrl)),
    `${baseUrl}/micro/rss.xml`,
    baseUrl,
    siteTitle,
    siteDescription,
    'Notes',
  );
}
