import type { ApConfig } from './config';

const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

export interface MicroPostRow {
  id: string;
  body_html: string;
  body_md: string;
  created_at: number;
}

export function buildActor(cfg: ApConfig, publicKeyPem: string): object {
  return {
    '@context': [AS_CONTEXT, 'https://w3id.org/security/v1'],
    id: cfg.actorUrl,
    type: 'Person',
    preferredUsername: cfg.username,
    name: cfg.username,
    url: cfg.baseUrl,
    inbox: `${cfg.baseUrl}/activitypub/inbox`,
    outbox: `${cfg.baseUrl}/activitypub/outbox`,
    followers: `${cfg.actorUrl}/followers`,
    publicKey: {
      id: `${cfg.actorUrl}#main-key`,
      owner: cfg.actorUrl,
      publicKeyPem,
    },
  };
}

export function buildNote(cfg: ApConfig, post: MicroPostRow): object {
  return {
    '@context': AS_CONTEXT,
    id: `${cfg.baseUrl}/activitypub/notes/${post.id}`,
    type: 'Note',
    attributedTo: cfg.actorUrl,
    content: post.body_html,
    published: new Date(post.created_at).toISOString(),
    to: [AS_PUBLIC],
    cc: [`${cfg.actorUrl}/followers`],
    url: `${cfg.baseUrl}/micro#${post.id}`,
  };
}

export function buildCreateActivity(cfg: ApConfig, note: object, activityId: string): object {
  const n = note as any;
  return {
    '@context': AS_CONTEXT,
    id: activityId,
    type: 'Create',
    actor: cfg.actorUrl,
    published: n.published,
    to: n.to,
    cc: n.cc,
    object: note,
  };
}

export function buildAcceptActivity(cfg: ApConfig, followActivity: object, activityId: string): object {
  return {
    '@context': AS_CONTEXT,
    id: activityId,
    type: 'Accept',
    actor: cfg.actorUrl,
    object: followActivity,
  };
}

export function buildOrderedCollection(collectionUrl: string, items: object[], totalItems: number): object {
  return {
    '@context': AS_CONTEXT,
    id: collectionUrl,
    type: 'OrderedCollection',
    totalItems,
    orderedItems: items,
  };
}
