/**
 * ActivityPub outbox reader.
 *
 * Two modes:
 *   - No AP configured: fetch public outboxes without signing (read-only, no federation)
 *   - AP enabled: sign GET requests (better server compatibility) and send Follow activities
 *
 * The design is intentionally pull-based and human-paced: nothing fetches
 * automatically. The author triggers refreshes manually.
 */

import type { Database } from 'bun:sqlite';
import type { ApConfig } from '../activitypub/config';
import { isSafeApUrl, signGetRequest, signRequest } from '../activitypub/signatures';
import { getKeyPair } from '../activitypub/keys';
import { ulid } from 'ulidx';
import { log } from '../core/logger';

const TIMEOUT_MS = 10_000;

export interface ActorInfo {
  actorUrl: string;
  username: string;
  displayName: string;
  domain: string;
  avatarUrl: string;
  inboxUrl: string;
  outboxUrl: string;
}

export interface ApItem {
  guid: string;
  itemUrl: string;
  title: string;
  contentHtml: string;
  author: string;
  publishedAt: Date;
}

// ── Actor resolution ───────────────────────────────────────────────────────────

/**
 * Resolve an ActivityPub actor URL or @handle@domain to an ActorInfo.
 * Supports:
 *   - Full HTTPS URL: https://mastodon.social/users/foo
 *   - WebFinger handle: @foo@mastodon.social or foo@mastodon.social
 */
export async function resolveActor(
  input: string,
  db?: Database,
  apCfg?: ApConfig | null,
): Promise<ActorInfo> {
  let actorUrl: string;

  const handleMatch = input.trim().match(/^@?([^@]+)@(.+)$/);
  if (handleMatch) {
    actorUrl = await resolveWebfinger(handleMatch[1], handleMatch[2]);
  } else if (input.startsWith('https://')) {
    actorUrl = input.trim();
  } else {
    throw new Error(`Cannot parse actor input: "${input}". Use a URL or @handle@domain format.`);
  }

  if (!isSafeApUrl(actorUrl)) throw new Error(`Unsafe actor URL: ${actorUrl}`);

  const actor = await fetchJson(actorUrl, db, apCfg);
  return actorDocToInfo(actor);
}

async function resolveWebfinger(username: string, domain: string): Promise<string> {
  const wfUrl = `https://${domain}/.well-known/webfinger?resource=acct:${encodeURIComponent(username)}@${encodeURIComponent(domain)}`;
  if (!isSafeApUrl(wfUrl)) throw new Error(`Unsafe WebFinger URL: ${wfUrl}`);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(wfUrl, {
      headers: { Accept: 'application/jrd+json, application/json' },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`WebFinger lookup failed: ${res.status}`);
  const jrd = await res.json() as any;

  const selfLink = (jrd.links ?? []).find(
    (l: any) => l.rel === 'self' && (l.type === 'application/activity+json' || l.type === 'application/ld+json'),
  );
  if (!selfLink?.href) throw new Error(`No ActivityPub self link in WebFinger for @${username}@${domain}`);
  return selfLink.href as string;
}

function actorDocToInfo(actor: any): ActorInfo {
  const url = new URL(actor.id ?? actor.url);
  const avatarUrl: string = actor.icon?.url ?? actor.icon ?? '';
  return {
    actorUrl: actor.id,
    username: actor.preferredUsername ?? actor.id,
    displayName: actor.name ?? actor.preferredUsername ?? actor.id,
    domain: url.hostname,
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : '',
    inboxUrl: actor.inbox ?? '',
    outboxUrl: actor.outbox ?? '',
  };
}

// ── Outbox fetching ────────────────────────────────────────────────────────────

/**
 * Fetch the first page of an actor's public outbox and return Note items.
 * Works without AP configured (unsigned GET). With AP configured, signs requests
 * for better Mastodon compatibility.
 */
export async function fetchActorOutbox(
  actorUrl: string,
  db?: Database,
  apCfg?: ApConfig | null,
): Promise<ApItem[]> {
  if (!isSafeApUrl(actorUrl)) throw new Error(`Unsafe actor URL: ${actorUrl}`);

  // Fetch actor to get outbox URL
  const actor = await fetchJson(actorUrl, db, apCfg);
  const outboxUrl: string = actor.outbox;
  if (!outboxUrl || !isSafeApUrl(outboxUrl)) throw new Error('Actor has no accessible public outbox');

  // Fetch outbox (OrderedCollection)
  const outbox = await fetchJson(outboxUrl, db, apCfg);

  // Resolve first page
  let pageUrl: string | null = null;
  if (outbox.type === 'OrderedCollectionPage') {
    // Some servers return the page directly
    return extractNotesFromPage(outbox, actor.preferredUsername ?? '');
  } else if (outbox.first) {
    pageUrl = typeof outbox.first === 'string' ? outbox.first : outbox.first?.id;
  }

  if (!pageUrl) return [];
  if (!isSafeApUrl(pageUrl)) throw new Error(`Unsafe outbox page URL: ${pageUrl}`);

  const page = await fetchJson(pageUrl, db, apCfg);
  return extractNotesFromPage(page, actor.preferredUsername ?? '');
}

function extractNotesFromPage(page: any, actorUsername: string): ApItem[] {
  const activities: any[] = page.orderedItems ?? page.items ?? [];
  const items: ApItem[] = [];

  for (const activity of activities) {
    // Handle Create { object: Note } or bare Note
    const note = activity.type === 'Create' ? activity.object : activity;
    if (!note || note.type !== 'Note') continue;

    // Skip non-public notes
    const to: string[] = Array.isArray(note.to) ? note.to : [note.to ?? ''];
    const cc: string[] = Array.isArray(note.cc) ? note.cc : [note.cc ?? ''];
    const isPublic = [...to, ...cc].some(u => u?.includes('activitystreams#Public') || u === 'as:Public');
    if (!isPublic) continue;

    // Skip replies (notes that are in reply to something else) — keep the feed clean
    if (note.inReplyTo) continue;

    const published = note.published ?? activity.published ?? '';
    const url = note.url ?? note.id ?? '';

    items.push({
      guid: note.id ?? url,
      itemUrl: typeof url === 'string' ? url : (url as any)?.href ?? '',
      title: '',  // AP Notes rarely have titles
      contentHtml: sanitizeHtml(note.content ?? note.summary ?? ''),
      author: actorUsername,
      publishedAt: published ? new Date(published) : new Date(),
    });
  }

  return items;
}

// ── Follow / Unfollow ─────────────────────────────────────────────────────────

export async function sendFollowActivity(
  db: Database,
  apCfg: ApConfig,
  targetActorUrl: string,
  targetInboxUrl: string,
): Promise<void> {
  const followId = `${apCfg.baseUrl}/activitypub/activities/${ulid()}`;
  const follow = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: followId,
    type: 'Follow',
    actor: apCfg.actorUrl,
    object: targetActorUrl,
  };

  const body = JSON.stringify(follow);
  const keyPair = await getKeyPair(db);
  const url = new URL(targetInboxUrl);
  const headers: Record<string, string> = { 'Content-Type': 'application/activity+json' };

  await signRequest({
    method: 'POST',
    url,
    body,
    keyId: `${apCfg.actorUrl}#main-key`,
    privateKey: keyPair.privateKey,
    headers,
  });

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok && res.status !== 202 && res.status < 500) {
    throw new Error(`Follow delivery failed: ${res.status}`);
  }
  if (!res.ok && res.status >= 500) {
    log.warn(`[reader] Follow delivery got ${res.status} (transient), follow stored as pending`);
  }
}

export async function sendUnfollowActivity(
  db: Database,
  apCfg: ApConfig,
  targetActorUrl: string,
  targetInboxUrl: string,
): Promise<void> {
  const followId = `${apCfg.baseUrl}/activitypub/activities/${ulid()}`;
  const undoId = `${apCfg.baseUrl}/activitypub/activities/${ulid()}`;
  const undo = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: undoId,
    type: 'Undo',
    actor: apCfg.actorUrl,
    object: {
      id: followId,
      type: 'Follow',
      actor: apCfg.actorUrl,
      object: targetActorUrl,
    },
  };

  const body = JSON.stringify(undo);
  const keyPair = await getKeyPair(db);
  const url = new URL(targetInboxUrl);
  const headers: Record<string, string> = { 'Content-Type': 'application/activity+json' };

  await signRequest({
    method: 'POST',
    url,
    body,
    keyId: `${apCfg.actorUrl}#main-key`,
    privateKey: keyPair.privateKey,
    headers,
  });

  // Fire and forget — the server may not send a confirmation
  fetch(url.toString(), {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  }).catch(err => log.error('[reader/ap] Unfollow delivery failed:', err));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function fetchJson(url: string, db?: Database, apCfg?: ApConfig | null): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: 'application/activity+json, application/ld+json' };

  // Sign GET request if we have AP configured (improves Mastodon compatibility)
  if (db && apCfg) {
    try {
      const keyPair = await getKeyPair(db);
      const keyId = `${apCfg.actorUrl}#main-key`;
      await signGetRequest({ url: new URL(url), keyId, privateKey: keyPair.privateKey, headers });
    } catch {
      // Key not available — proceed unsigned
    }
  }

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`AP fetch failed for ${url}: ${res.status}`);
  return res.json();
}

/** Minimal HTML sanitizer — removes script tags and inline event handlers. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}
