const ALLOWED_TAGS = new Set([
  'a', 'strong', 'em', 'b', 'i', 'p', 'br', 'ul', 'ol', 'li',
  'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span',
]);

/**
 * Allowlist-based HTML sanitizer for untrusted content (e.g. inbound AP notes).
 * Strips all tags not in ALLOWED_TAGS. On <a>, keeps href only if not javascript:/data:.
 * All other attributes are stripped.
 */
export function sanitizeHtml(html: string): string {
  return html.replace(/<(\/?)(\w+)([^>]*)>/g, (match, slash, tag, attrs) => {
    const lower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) return '';

    if (slash) return `</${lower}>`;

    if (lower === 'a') {
      const hrefMatch = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
      if (hrefMatch) {
        const href = hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '';
        const trimmed = href.trim().toLowerCase();
        if (!trimmed.startsWith('javascript:') && !trimmed.startsWith('data:')) {
          return `<a href="${href.replace(/"/g, '&quot;')}">`;
        }
      }
      return '<a>';
    }

    return `<${lower}>`;
  });
}
