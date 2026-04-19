// GripContext — the template context shape passed to all LiquidJS templates.
// Canonical file. This is a compatibility surface: keys/types must not be
// renamed or removed without a major version bump.

export interface GripContext {
  site: {
    title: string;
    description: string;
    domain: string;
    theme: string;
    rss_enabled: boolean;
    showArticles: boolean;
    showMicro: boolean;
    home_intro: string;
  };
  page: {
    title: string;
    url: string;
  };
  // List pages (articles.liquid, micro.liquid)
  articles?: Array<{
    id: string;
    slug: string;
    title: string;
    body_html: string;
    excerpt: string;
    tags: string[];
    published_at: string; // ISO 8601
    date: string;         // formatted display, e.g. "30 Mar 2026"
  }>;
  // Single article or page
  article?: {
    id: string;
    slug: string;
    title: string;
    body_html: string;
    tags: string[];
    published_at: string;
    date: string;
  };
  micro?: Array<{
    id: string;
    body_html: string;
    created_at: string; // ISO 8601
    date: string;
  }>;
  pagination?: {
    page: number;
    total_pages: number;
    prev_url: string | null;
    next_url: string | null;
  };
  nav_pages?: Array<{ title: string; slug: string }>;
}
