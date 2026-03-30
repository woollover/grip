import type { Database } from 'bun:sqlite';
import { listArticles } from '../../data/articles';
import { listMicroPosts } from '../../data/micro';

interface FeedItem {
  title: string;
  link: string;
  guid: string;
  isPermaLink: boolean;
  pubDate: string;
  description: string;
}

function articleItem(a: ReturnType<typeof listArticles>['articles'][number], baseUrl: string): FeedItem {
  return {
    title: a.title,
    link: `${baseUrl}/articles/${a.slug}`,
    guid: `${baseUrl}/articles/${a.slug}`,
    isPermaLink: true,
    pubDate: new Date(a.published_at).toUTCString(),
    description: a.body_html,
  };
}

function microItem(m: ReturnType<typeof listMicroPosts>['posts'][number], baseUrl: string): FeedItem {
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
  const { articles } = listArticles(db, { pageSize: 20 });
  const { posts } = listMicroPosts(db, { pageSize: 20 });

  const merged = [
    ...articles.map(a => ({ item: articleItem(a, baseUrl), date: new Date(a.published_at).getTime() })),
    ...posts.map(m => ({ item: microItem(m, baseUrl), date: new Date(m.created_at).getTime() })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 20)
    .map(x => x.item);

  return buildFeed(merged, `${baseUrl}/rss.xml`, baseUrl, siteTitle, siteDescription);
}

export function renderRssArticles(db: Database, domain: string, siteTitle: string, siteDescription: string): string {
  const baseUrl = `https://${domain}`;
  const { articles } = listArticles(db, { pageSize: 20 });
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
  const { posts } = listMicroPosts(db, { pageSize: 20 });
  return buildFeed(
    posts.map(m => microItem(m, baseUrl)),
    `${baseUrl}/micro/rss.xml`,
    baseUrl,
    siteTitle,
    siteDescription,
    'Notes',
  );
}
