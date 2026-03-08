import { describe, it, expect } from 'bun:test';
import { parseFeed, stripHtml } from '../../src/reader/rss';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const RSS2_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Test RSS Feed</title>
    <link>https://example.com</link>
    <description>A test RSS 2.0 feed</description>
    <item>
      <title>First Post</title>
      <link>https://example.com/first</link>
      <guid>https://example.com/first</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <description><![CDATA[<p>Hello <strong>world</strong></p>]]></description>
    </item>
    <item>
      <title>Second Post &amp; More</title>
      <link>https://example.com/second</link>
      <guid>https://example.com/second</guid>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>Full content here</p>]]></content:encoded>
      <description>Plain text description</description>
      <dc:creator>Jane Doe</dc:creator>
    </item>
    <item>
      <title>Post Without Date</title>
      <link>https://example.com/noddate</link>
      <guid>https://example.com/nodate</guid>
      <description>No date on this one</description>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <subtitle>A test Atom 1.0 feed</subtitle>
  <link href="https://example.com" rel="alternate"/>
  <entry>
    <title>First Entry</title>
    <link href="https://example.com/entry1"/>
    <id>https://example.com/entry1</id>
    <published>2024-01-01T12:00:00Z</published>
    <content type="html"><![CDATA[<p>Atom entry content</p>]]></content>
    <author><name>Alice Smith</name></author>
  </entry>
  <entry>
    <title>Entry With Summary Only</title>
    <link href="https://example.com/entry2"/>
    <id>https://example.com/entry2</id>
    <updated>2024-01-02T10:00:00Z</updated>
    <summary>Just a summary here.</summary>
    <author><name>Bob Jones</name></author>
  </entry>
</feed>`;

const JSON_FEED_FIXTURE = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'Test JSON Feed',
  home_page_url: 'https://example.com',
  description: 'A JSON Feed test',
  items: [
    {
      id: 'https://example.com/json-1',
      url: 'https://example.com/json-1',
      title: 'JSON Item',
      content_html: '<p>JSON content</p>',
      date_published: '2024-01-01T12:00:00Z',
      authors: [{ name: 'Charlie Brown' }],
    },
    {
      id: 'https://example.com/json-2',
      url: 'https://example.com/json-2',
      content_text: 'No title item, text only',
      date_published: '2024-01-02T08:00:00Z',
    },
  ],
});

// ── RSS 2.0 tests ──────────────────────────────────────────────────────────────

describe('parseFeed — RSS 2.0', () => {
  it('parses channel metadata', () => {
    const feed = parseFeed(RSS2_FIXTURE, 'application/rss+xml');
    expect(feed.meta.title).toBe('Test RSS Feed');
    expect(feed.meta.description).toBe('A test RSS 2.0 feed');
    expect(feed.meta.siteUrl).toBe('https://example.com');
  });

  it('returns correct item count', () => {
    const feed = parseFeed(RSS2_FIXTURE);
    expect(feed.items.length).toBe(3);
  });

  it('parses first item correctly', () => {
    const item = parseFeed(RSS2_FIXTURE).items[0];
    expect(item.title).toBe('First Post');
    expect(item.url).toBe('https://example.com/first');
    expect(item.guid).toBe('https://example.com/first');
    expect(item.contentHtml).toContain('<p>Hello');
    expect(item.publishedAt.getFullYear()).toBe(2024);
  });

  it('prefers content:encoded over description', () => {
    const item = parseFeed(RSS2_FIXTURE).items[1];
    expect(item.contentHtml).toContain('<p>Full content here</p>');
  });

  it('decodes XML entities in titles', () => {
    const item = parseFeed(RSS2_FIXTURE).items[1];
    expect(item.title).toBe('Second Post & More');
  });

  it('extracts dc:creator as author', () => {
    const item = parseFeed(RSS2_FIXTURE).items[1];
    expect(item.author).toBe('Jane Doe');
  });

  it('falls back to current date when pubDate is missing', () => {
    const item = parseFeed(RSS2_FIXTURE).items[2];
    const now = Date.now();
    expect(item.publishedAt.getTime()).toBeGreaterThan(now - 5000);
    expect(item.publishedAt.getTime()).toBeLessThanOrEqual(now);
  });
});

// ── Atom 1.0 tests ─────────────────────────────────────────────────────────────

describe('parseFeed — Atom 1.0', () => {
  it('detects Atom format and parses metadata', () => {
    const feed = parseFeed(ATOM_FIXTURE, 'application/atom+xml');
    expect(feed.meta.title).toBe('Test Atom Feed');
    expect(feed.meta.description).toBe('A test Atom 1.0 feed');
    expect(feed.meta.siteUrl).toBe('https://example.com');
  });

  it('returns correct item count', () => {
    const feed = parseFeed(ATOM_FIXTURE);
    expect(feed.items.length).toBe(2);
  });

  it('parses entry link from href attribute', () => {
    const item = parseFeed(ATOM_FIXTURE).items[0];
    expect(item.url).toBe('https://example.com/entry1');
  });

  it('parses entry id as guid', () => {
    const item = parseFeed(ATOM_FIXTURE).items[0];
    expect(item.guid).toBe('https://example.com/entry1');
  });

  it('parses published date', () => {
    const item = parseFeed(ATOM_FIXTURE).items[0];
    expect(item.publishedAt.toISOString()).toBe('2024-01-01T12:00:00.000Z');
  });

  it('falls back to summary when content is missing', () => {
    const item = parseFeed(ATOM_FIXTURE).items[1];
    expect(item.contentHtml).toBe('Just a summary here.');
  });

  it('extracts author name', () => {
    const item = parseFeed(ATOM_FIXTURE).items[0];
    expect(item.author).toBe('Alice Smith');
  });

  it('uses updated when published is missing', () => {
    const item = parseFeed(ATOM_FIXTURE).items[1];
    expect(item.publishedAt.getFullYear()).toBe(2024);
  });
});

// ── JSON Feed tests ────────────────────────────────────────────────────────────

describe('parseFeed — JSON Feed', () => {
  it('detects JSON Feed format', () => {
    const feed = parseFeed(JSON_FEED_FIXTURE, 'application/feed+json');
    expect(feed.meta.title).toBe('Test JSON Feed');
    expect(feed.meta.siteUrl).toBe('https://example.com');
    expect(feed.meta.description).toBe('A JSON Feed test');
  });

  it('parses items correctly', () => {
    const feed = parseFeed(JSON_FEED_FIXTURE, 'application/json');
    expect(feed.items.length).toBe(2);
  });

  it('extracts content_html', () => {
    const item = parseFeed(JSON_FEED_FIXTURE).items[0];
    expect(item.contentHtml).toBe('<p>JSON content</p>');
  });

  it('falls back to content_text when no content_html', () => {
    const item = parseFeed(JSON_FEED_FIXTURE).items[1];
    expect(item.contentHtml).toBe('No title item, text only');
  });

  it('extracts authors array', () => {
    const item = parseFeed(JSON_FEED_FIXTURE).items[0];
    expect(item.author).toBe('Charlie Brown');
  });

  it('returns empty string for missing title', () => {
    const item = parseFeed(JSON_FEED_FIXTURE).items[1];
    expect(item.title).toBe('');
  });
});

// ── stripHtml ─────────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('collapses whitespace', () => {
    expect(stripHtml('<p>Line   one</p>\n<p>Line two</p>')).toBe('Line one Line two');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles plain text passthrough', () => {
    expect(stripHtml('no tags here')).toBe('no tags here');
  });
});

// ── Format detection ───────────────────────────────────────────────────────────

describe('parseFeed — format detection', () => {
  it('auto-detects RSS from content without content-type', () => {
    const feed = parseFeed(RSS2_FIXTURE);
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.meta.title).toBe('Test RSS Feed');
  });

  it('auto-detects Atom from content without content-type', () => {
    const feed = parseFeed(ATOM_FIXTURE);
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.meta.title).toBe('Test Atom Feed');
  });

  it('auto-detects JSON Feed from JSON content', () => {
    const feed = parseFeed(JSON_FEED_FIXTURE);
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.meta.title).toBe('Test JSON Feed');
  });
});
