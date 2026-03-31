/**
 * Shared view utilities for public routes.
 *
 * JSX RENDERING MODEL — READ THIS FIRST
 * ══════════════════════════════════════
 * GRIP uses @kitajs/html as the JSX factory — NOT React.
 * JSX compiles to HTML strings at build time via Bun.
 * There is no browser JS, no virtual DOM, no hydration.
 *
 * Escaping convention:
 *   {value}        →  raw string, passed through as-is (NO auto-escape)
 *   {esc(value)}   →  explicit HTML-escape for untrusted/user-controlled strings
 *   {raw(html)}    →  explicit passthrough for pre-rendered HTML (trusted markdown output only)
 *
 * Rule: if the value comes from the author's own DB content (titles, body_html),
 * it is trusted. If it comes from the internet (AP actor names, fediverse content),
 * use esc() or ensure it passed through sanitizeHtml() before storage.
 */

import type { Database } from 'bun:sqlite';
import { getConfigValue } from '../server/data/config';

// ── Escaping helpers ────────────────────────────────────────────────────────

/** Explicitly escape a string for safe HTML interpolation. */
export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Mark a pre-rendered HTML string for raw interpolation.
 * Only use for trusted, sanitized output (e.g. markdown-it rendered HTML).
 */
export function raw(html: string): string {
  return html;
}

// ── Publicity config (single source of truth) ────────────────────────────────

export interface PublicityConfig {
  showArticles: boolean;
  showMicro: boolean;
  rssEnabled: boolean;
}

export function readPublicity(db: Database): PublicityConfig {
  const get = (key: string, fallback: string) => getConfigValue(db, key, fallback)!;
  const isPrivate = get('publicity_mode', 'public') === 'private';
  return {
    showArticles: !isPrivate && get('show_articles', '1') === '1',
    showMicro:    !isPrivate && get('show_micro',    '1') === '1',
    rssEnabled:   !isPrivate && get('rss_enabled',   '1') === '1',
  };
}

// ── Date formatting ──────────────────────────────────────────────────────────

/** Format a Unix millisecond timestamp as '1 Jan 2025'. */
export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Pagination ───────────────────────────────────────────────────────────────

/** Prev/next pagination nav. Returns empty string if only one page. */
export function paginationNav(page: number, total: number, pageSize: number, baseHref: string): JSX.Element {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return '' as unknown as JSX.Element;
  const sep = baseHref.includes('?') ? '&' : '?';
  return (
    <nav class="pagination">
      {page > 1
        ? <a href={`${baseHref}${sep}page=${page - 1}`}>← Newer</a>
        : <span class="pagination-disabled">← Newer</span>}
      <span class="pagination-info">Page {page} of {totalPages}</span>
      {page < totalPages
        ? <a href={`${baseHref}${sep}page=${page + 1}`}>Older →</a>
        : <span class="pagination-disabled">Older →</span>}
    </nav>
  );
}
