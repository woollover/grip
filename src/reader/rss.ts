/**
 * Minimal RSS 2.0 / Atom 1.0 / JSON Feed parser.
 * Zero external dependencies — handles the vast majority of real-world feeds.
 */

export interface FeedMeta {
  title: string;
  description: string;
  siteUrl: string;
}

export interface FeedItem {
  guid: string;       // canonical ID for deduplication
  url: string;        // link to the item
  title: string;
  contentHtml: string;
  author: string;
  publishedAt: Date;
}

export interface FetchedFeed {
  meta: FeedMeta;
  items: FeedItem[];
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function fetchFeed(url: string): Promise<FetchedFeed> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*' },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  return parseFeed(text, contentType);
}

export function parseFeed(content: string, contentType: string = ''): FetchedFeed {
  const ct = contentType.toLowerCase();
  const trimmed = content.trimStart();

  // JSON Feed detection
  if (ct.includes('json') || trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(content);
      if (obj.version?.startsWith('https://jsonfeed.org') || obj.items) {
        return parseJsonFeed(obj);
      }
    } catch { /* fall through to XML */ }
  }

  // Atom detection
  if (trimmed.includes('<feed') && trimmed.includes('w3.org/2005/Atom')) {
    return parseAtom(content);
  }

  // RSS 2.0 (default)
  return parseRss2(content);
}

// ── XML helpers ────────────────────────────────────────────────────────────────

/**
 * Extract text from the first matching tag in an XML string.
 * Handles CDATA sections and basic entity decoding.
 */
function getTag(xml: string, tag: string): string {
  // CDATA: <tag><![CDATA[...]]></tag>
  const cdataRe = new RegExp(`<${tag}(?:\\s[^>]*)?><![\\s]*\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const m1 = xml.match(cdataRe);
  if (m1) return m1[1].trim();

  // Regular: <tag ...>text</tag>
  const textRe = new RegExp(`<${tag}(?:\\s[^>]*)?>((?:(?!<${tag})[\\s\\S])*?)<\\/${tag}>`, 'i');
  const m2 = xml.match(textRe);
  if (!m2) return '';
  return decodeXmlEntities(m2[1].trim());
}

/**
 * Get the value of an attribute from the first matching tag.
 * e.g. getAttr(xml, 'link', 'href') → 'https://...'
 */
function getAttr(xml: string, tag: string, attr: string): string {
  // Self-closing or opening tag
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*?)["'][^>]*>`, 'i');
  const m = xml.match(re);
  return m ? decodeXmlEntities(m[1]) : '';
}

/** Split XML into segments between open/close tag pairs. */
function splitSegments(xml: string, tag: string): string[] {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const result: string[] = [];
  let pos = 0;
  while (true) {
    const s = xml.indexOf(open, pos);
    if (s === -1) break;
    const e = xml.indexOf(close, s);
    if (e === -1) break;
    result.push(xml.slice(s, e + close.length));
    pos = e + close.length;
  }
  return result;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseDate(s: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Strip HTML tags for preview generation. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ── RSS 2.0 ───────────────────────────────────────────────────────────────────

function parseRss2(xml: string): FetchedFeed {
  // Channel block (before first <item>)
  const channelStart = xml.indexOf('<channel');
  const firstItem = xml.indexOf('<item', channelStart);
  const channelHead = channelStart !== -1
    ? xml.slice(channelStart, firstItem !== -1 ? firstItem : undefined)
    : xml;

  const title = getTag(channelHead, 'title');
  const desc = getTag(channelHead, 'description');
  // RSS <link> is a text element: <link>https://...</link>
  const siteUrl = getTag(channelHead, 'link');

  const itemSegments = splitSegments(xml, 'item');
  const items: FeedItem[] = itemSegments.map(seg => {
    const itemTitle = getTag(seg, 'title');
    const link = getTag(seg, 'link');
    const guid = getTag(seg, 'guid') || link;
    const pubDate = getTag(seg, 'pubDate') || getTag(seg, 'dc:date') || getTag(seg, 'pubdate');
    // Prefer content:encoded over description for full HTML
    const contentEncoded = getTag(seg, 'content:encoded') || getTag(seg, 'content');
    const description = getTag(seg, 'description');
    const contentHtml = contentEncoded || description;
    const author = getTag(seg, 'author') || getTag(seg, 'dc:creator');

    return {
      guid: guid || itemTitle,
      url: link,
      title: itemTitle,
      contentHtml,
      author,
      publishedAt: parseDate(pubDate),
    };
  });

  return { meta: { title, description: desc, siteUrl }, items };
}

// ── Atom 1.0 ──────────────────────────────────────────────────────────────────

function parseAtom(xml: string): FetchedFeed {
  // Feed-level metadata (before first <entry>)
  const feedStart = xml.indexOf('<feed');
  const firstEntry = xml.indexOf('<entry', feedStart);
  const feedHead = feedStart !== -1
    ? xml.slice(feedStart, firstEntry !== -1 ? firstEntry : undefined)
    : xml;

  const title = getTag(feedHead, 'title');
  const description = getTag(feedHead, 'subtitle');
  // Atom uses <link href="..." rel="alternate"/> for site URL
  const siteUrl = getAttr(feedHead.match(/<link[^>]*rel=["']alternate["'][^>]*>/i)?.[0] ?? feedHead, 'link', 'href')
    || getAttr(feedHead, 'link', 'href');

  const entries = splitSegments(xml, 'entry');
  const items: FeedItem[] = entries.map(seg => {
    const entryTitle = getTag(seg, 'title');
    // Atom <link> is self-closing with href attribute
    const linkTag = seg.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const url = linkTag ? decodeXmlEntities(linkTag[1]) : '';
    const id = getTag(seg, 'id') || url;
    const published = getTag(seg, 'published') || getTag(seg, 'updated');
    // Prefer <content> over <summary>
    const contentHtml = getTag(seg, 'content') || getTag(seg, 'summary');
    const authorName = getTag(seg, 'name'); // inside <author><name>...</name></author>

    return {
      guid: id || entryTitle,
      url,
      title: entryTitle,
      contentHtml,
      author: authorName,
      publishedAt: parseDate(published),
    };
  });

  return { meta: { title, description, siteUrl }, items };
}

// ── JSON Feed ─────────────────────────────────────────────────────────────────

function parseJsonFeed(obj: any): FetchedFeed {
  const meta: FeedMeta = {
    title: String(obj.title ?? ''),
    description: String(obj.description ?? ''),
    siteUrl: String(obj.home_page_url ?? ''),
  };

  const rawItems: any[] = Array.isArray(obj.items) ? obj.items : [];
  const items: FeedItem[] = rawItems.map(item => {
    const contentHtml = String(item.content_html ?? item.content_text ?? '');
    const authors: any[] = Array.isArray(item.authors) ? item.authors : item.author ? [item.author] : [];
    const author = authors.map((a: any) => a.name ?? '').filter(Boolean).join(', ');

    return {
      guid: String(item.id ?? item.url ?? ''),
      url: String(item.url ?? item.external_url ?? ''),
      title: String(item.title ?? ''),
      contentHtml,
      author,
      publishedAt: parseDate(item.date_published ?? item.date_modified ?? ''),
    };
  });

  return { meta, items };
}
