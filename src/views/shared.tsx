/**
 * Shared view utilities for public routes.
 */

/** Format a Unix millisecond timestamp as '1 Jan 2025'. */
export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
