import type { Database } from 'bun:sqlite';
import type { ApConfig } from './config';
import type { MicroPostRow } from './objects';
import { buildNote, buildCreateActivity } from './objects';
import { signRequest } from './signatures';
import { getKeyPair } from './keys';
import { ulid } from 'ulidx';

interface FollowerRow {
  actor_uri: string;
  inbox_url: string;
}

export async function deliverNewPost(
  db: Database,
  cfg: ApConfig,
  post: MicroPostRow,
): Promise<void> {
  let keyPair: { privateKey: CryptoKey; publicKeyPem: string };
  try {
    keyPair = await getKeyPair(db);
  } catch (err) {
    console.error('[activitypub] Failed to load key pair for delivery:', err);
    return;
  }

  const note = buildNote(cfg, post);
  const activityId = `${cfg.baseUrl}/activitypub/activities/${ulid()}`;
  const activity = buildCreateActivity(cfg, note, activityId);
  const body = JSON.stringify(activity);

  const followers = db
    .query('SELECT actor_uri, inbox_url FROM ap_followers')
    .all() as FollowerRow[];

  if (followers.length === 0) return;

  const keyId = `${cfg.actorUrl}#main-key`;

  const results = await Promise.allSettled(
    followers.map(async (follower) => {
      const url = new URL(follower.inbox_url);
      const headers: Record<string, string> = {
        'Content-Type': 'application/activity+json',
      };

      await signRequest({
        method: 'POST',
        url,
        body,
        keyId,
        privateKey: keyPair.privateKey,
        headers,
      });

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      let resp: Response;
      try {
        resp = await fetch(url.toString(), { method: 'POST', headers, body, signal: ctrl.signal });
      } finally {
        clearTimeout(t);
      }

      if (!resp.ok) {
        throw new Error(
          `Delivery to ${follower.inbox_url} failed: ${resp.status}`,
        );
      }
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[activitypub] Delivery failed:', result.reason);
    }
  }
}
