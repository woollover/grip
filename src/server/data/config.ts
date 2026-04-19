import type { Database } from 'bun:sqlite';

export interface PublicityConfig {
  isPrivate: boolean;
  showArticles: boolean;
  showMicro: boolean;
  rssEnabled: boolean;
}

export interface SiteConfig {
  title: string;
  description: string;
  domain: string;
  theme: string;
  rssEnabled: boolean;
  showArticles: boolean;
  showMicro: boolean;
  homeIntro: string;
  isPrivate: boolean;
}

export class ConfigRepo {
  constructor(private db: Database) {}

  get(key: string, fallback?: string): string | null {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null;
    return row?.value ?? fallback ?? null;
  }

  set(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM config WHERE key = ?').run(key);
  }

  getPublicity(): PublicityConfig {
    const get = (key: string, fallback: string): string => this.get(key) ?? fallback;
    const isPrivate = get('publicity_mode', 'public') === 'private';
    return {
      isPrivate,
      showArticles: !isPrivate && get('show_articles', '1') === '1',
      showMicro:    !isPrivate && get('show_micro',    '1') === '1',
      rssEnabled:   !isPrivate && get('rss_enabled',   '1') === '1',
    };
  }

  getSite(): SiteConfig {
    const get = (key: string, fallback: string): string => this.get(key) ?? fallback;
    const pub = this.getPublicity();
    return {
      title:        get('site_title',       'My GRIP'),
      description:  get('site_description', ''),
      domain:       get('domain',           'localhost'),
      theme:        get('theme',            'default'),
      homeIntro:    get('home_intro', ''),
      ...pub,
    };
  }
}
