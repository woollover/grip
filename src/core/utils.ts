/**
 * Shared utilities for GRIP.
 */

/** Convert a string to a URL-safe slug. */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
