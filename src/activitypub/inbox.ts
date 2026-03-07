import type { Database } from 'bun:sqlite';
import type { ApConfig } from './config';
import { verifyInboundSignature, signRequest, signGetRequest, isSafeApUrl } from './signatures';
import { buildAcceptActivity, buildNote, buildCreateActivity } from './objects';
import type { MicroPostRow } from './objects';
import { getKeyPair } from './keys';
import { ulid } from 'ulidx';

export async function handleInbox(
  db: Database,
  cfg: ApConfig,
  request: Request,
): Promise<Response> {
  let actorUri: string;
  try {
    const { privateKey } = await getKeyPair(db);
    const ownKeyId = `${cfg.actorUrl}#main-key`;
    actorUri = await verifyInboundSignature(request, ownKeyId, privateKey);
  } catch (err) {
    console.error('[activitypub] Signature verification failed:', err);
    return new Response('Unauthorized', { status: 401 });
  }

  let activity: any;
  try {
    activity = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (!activity || !activity.type) {
    return new Response('Bad Request', { status: 400 });
  }

  // Ensure the activity claims to be from the verified key owner
  if (activity.actor && activity.actor !== actorUri) {
    return new Response('Forbidden', { status: 403 });
  }

  switch (activity.type) {
    case 'Follow':
      await handleFollow(db, cfg, activity, actorUri);
      break;
    case 'Undo':
      handleUndo(db, activity, actorUri);
      break;
    case 'Create':
      if (cfg.acceptReplies) {
        await handleCreateReply(db, cfg, activity, actorUri);
      }
      break;
    case 'Delete':
      handleDelete(db, activity);
      break;
    default:
      break;
  }

  return new Response('Accepted', { status: 202 });
}

async function handleFollow(
  db: Database,
  cfg: ApConfig,
  activity: any,
  actorUri: string,
): Promise<void> {
  // Validate actor URL before fetching
  if (!isSafeApUrl(actorUri)) {
    console.error('[activitypub] Unsafe actor URL in Follow:', actorUri);
    return;
  }

  // Fetch the follower's actor document to get their inbox URL
  let inboxUrl: string;
  try {
    const { privateKey } = await getKeyPair(db);
    const ownKeyId = `${cfg.actorUrl}#main-key`;
    const fetchHeaders: Record<string, string> = { Accept: 'application/activity+json' };
    await signGetRequest({ url: new URL(actorUri), keyId: ownKeyId, privateKey, headers: fetchHeaders });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    let resp: Response;
    try {
      resp = await fetch(actorUri, { headers: fetchHeaders, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
    if (!resp.ok) throw new Error(`Failed to fetch actor: ${resp.status}`);
    const actor = await resp.json() as any;
    inboxUrl = actor.inbox;
    if (!inboxUrl || !isSafeApUrl(inboxUrl)) throw new Error('Missing or unsafe inbox URL');
  } catch (err) {
    console.error('[activitypub] Failed to fetch follower actor:', err);
    return;
  }

  // Upsert follower
  db.query(
    'INSERT OR REPLACE INTO ap_followers (actor_uri, inbox_url, followed_at) VALUES (?, ?, ?)',
  ).run(actorUri, inboxUrl, Date.now());

  // Build and send Accept
  const acceptId = `${cfg.baseUrl}/activitypub/activities/${ulid()}`;
  const accept = buildAcceptActivity(cfg, activity, acceptId);
  const body = JSON.stringify(accept);

  try {
    const keyPair = await getKeyPair(db);
    const url = new URL(inboxUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/activity+json',
    };

    await signRequest({
      method: 'POST',
      url,
      body,
      keyId: `${cfg.actorUrl}#main-key`,
      privateKey: keyPair.privateKey,
      headers,
    });

    fetch(url.toString(), { method: 'POST', headers, body }).catch((err) => {
      console.error('[activitypub] Failed to deliver Accept:', err);
    });
  } catch (err) {
    console.error('[activitypub] Failed to sign Accept:', err);
  }

  // Backfill recent posts to the new follower
  deliverBackfill(db, cfg, inboxUrl).catch((err) => {
    console.error('[activitypub] Backfill failed:', err);
  });
}

async function deliverBackfill(db: Database, cfg: ApConfig, inboxUrl: string): Promise<void> {
  const posts = db
    .query("SELECT id, body_html, body_md, created_at FROM micro_posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 10")
    .all() as MicroPostRow[];
  if (posts.length === 0) return;

  const keyPair = await getKeyPair(db);
  const keyId = `${cfg.actorUrl}#main-key`;
  const url = new URL(inboxUrl);

  for (const post of posts) {
    const note = buildNote(cfg, post);
    const activity = buildCreateActivity(cfg, note, `${cfg.baseUrl}/activitypub/activities/${ulid()}`);
    const body = JSON.stringify(activity);
    const headers: Record<string, string> = { 'Content-Type': 'application/activity+json' };
    await signRequest({ method: 'POST', url, body, keyId, privateKey: keyPair.privateKey, headers });
    await fetch(url.toString(), { method: 'POST', headers, body });
  }
}

function handleUndo(db: Database, activity: any, actorUri: string): void {
  const inner = activity.object;
  if (!inner || inner.type !== 'Follow') return;
  db.query('DELETE FROM ap_followers WHERE actor_uri = ?').run(actorUri);
}

async function handleCreateReply(
  db: Database,
  cfg: ApConfig,
  activity: any,
  actorUri: string,
): Promise<void> {
  const note = activity.object;
  if (!note || note.type !== 'Note') return;

  const inReplyTo: string | undefined = note.inReplyTo;
  if (!inReplyTo) return;

  const notePrefix = `${cfg.baseUrl}/activitypub/notes/`;
  if (!inReplyTo.startsWith(notePrefix)) return;

  const noteId = inReplyTo.slice(notePrefix.length);
  const content = (note.content || '').replace(/<[^>]+>/g, '');

  let actorName = actorUri;
  if (isSafeApUrl(actorUri)) {
    try {
      const { privateKey } = await getKeyPair(db);
      const ownKeyId = `${cfg.actorUrl}#main-key`;
      const fetchHeaders: Record<string, string> = { Accept: 'application/activity+json' };
      await signGetRequest({ url: new URL(actorUri), keyId: ownKeyId, privateKey, headers: fetchHeaders });
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      try {
        const resp = await fetch(actorUri, { headers: fetchHeaders, signal: ctrl.signal });
        if (resp.ok) {
          const actor = await resp.json() as any;
          actorName = actor.name || actor.preferredUsername || actorUri;
        }
      } finally {
        clearTimeout(t);
      }
    } catch {
      // fall back to actor URI
    }
  }

  db.query(
    'INSERT OR IGNORE INTO ap_replies (id, note_id, actor_uri, actor_name, content, published_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    note.id || ulid(),
    noteId,
    actorUri,
    actorName,
    content,
    Date.now(),
    'visible',
  );
}

function handleDelete(db: Database, activity: any): void {
  const objectId =
    typeof activity.object === 'string' ? activity.object : activity.object?.id;
  if (!objectId) return;

  db.query('DELETE FROM ap_replies WHERE id = ?').run(objectId);
}
