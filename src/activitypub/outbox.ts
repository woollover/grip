import type { Database } from 'bun:sqlite';
import type { ApConfig } from './config';
import { buildNote, buildCreateActivity, buildOrderedCollection } from './objects';
import type { MicroPostRow } from './objects';
import { ulid } from 'ulidx';

export function buildOutbox(db: Database, cfg: ApConfig): object {
  const posts = db
    .query(
      "SELECT id, body_html, body_md, created_at FROM micro_posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 20",
    )
    .all() as MicroPostRow[];

  const totalCount = db
    .query("SELECT COUNT(*) as cnt FROM micro_posts WHERE status = 'active'")
    .get() as { cnt: number };

  const items = posts.map((post) => {
    const note = buildNote(cfg, post);
    const activityId = `${cfg.baseUrl}/activitypub/activities/${ulid()}`;
    return buildCreateActivity(cfg, note, activityId);
  });

  return buildOrderedCollection(`${cfg.actorUrl}/outbox`, items, totalCount.cnt);
}
