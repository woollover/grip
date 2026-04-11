import type { ApConfig } from './config';
import { buildNote, buildCreateActivity, buildOrderedCollection } from './objects';
import type { MicroPostRow } from './objects';
import { ulid } from 'ulidx';
import type { GripDb } from '../server/data/index';

const outboxUrl = (cfg: ApConfig) => `${cfg.baseUrl}/activitypub/outbox`;

export function buildOutbox(db: GripDb, cfg: ApConfig): object {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: outboxUrl(cfg),
    type: 'OrderedCollection',
    totalItems: db.micro.count(),
    first: `${outboxUrl(cfg)}?page=true`,
  };
}

export function buildOutboxPage(db: GripDb, cfg: ApConfig): object {
  const posts = db.micro.listForAp(20) as MicroPostRow[];

  const items = posts.map((post) => {
    const note = buildNote(cfg, post);
    const activityId = `${cfg.baseUrl}/activitypub/activities/${ulid()}`;
    return buildCreateActivity(cfg, note, activityId);
  });

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${outboxUrl(cfg)}?page=true`,
    type: 'OrderedCollectionPage',
    partOf: outboxUrl(cfg),
    orderedItems: items,
  };
}
