import { Elysia } from 'elysia';
import type { Database } from 'bun:sqlite';
import type { ApConfig } from './config';
import { getKeyPair } from './keys';
import { buildActor, buildNote, buildOrderedCollection } from './objects';
import type { MicroPostRow } from './objects';
import { buildOutbox } from './outbox';
import { handleInbox } from './inbox';

function wantsActivityJson(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('application/activity+json') || accept.includes('application/ld+json');
}

const AP_CONTENT_TYPE = 'application/activity+json; charset=utf-8';

export function mountApRoutes(app: Elysia, db: Database, cfg: ApConfig): void {
  // WebFinger
  app.get('/.well-known/webfinger', ({ query }) => {
    const resource = query.resource;
    if (resource !== `acct:${cfg.username}@${cfg.domain}`) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(
      JSON.stringify({
        subject: `acct:${cfg.username}@${cfg.domain}`,
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: cfg.actorUrl,
          },
        ],
      }),
      {
        headers: { 'Content-Type': 'application/jrd+json' },
      },
    );
  });

  // Actor
  app.get('/activitypub/actor', async ({ request }) => {
    if (!wantsActivityJson(request)) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/micro' },
      });
    }
    const { publicKeyPem } = await getKeyPair(db);
    return new Response(JSON.stringify(buildActor(cfg, publicKeyPem)), {
      headers: { 'Content-Type': AP_CONTENT_TYPE },
    });
  });

  // Outbox
  app.get('/activitypub/outbox', ({ request }) => {
    if (!wantsActivityJson(request)) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/micro' },
      });
    }
    return new Response(JSON.stringify(buildOutbox(db, cfg)), {
      headers: { 'Content-Type': AP_CONTENT_TYPE },
    });
  });

  // Followers
  app.get('/activitypub/followers', () => {
    const row = db.query('SELECT COUNT(*) as cnt FROM ap_followers').get() as { cnt: number };
    const collection = buildOrderedCollection(`${cfg.actorUrl}/followers`, [], row.cnt);
    return new Response(JSON.stringify(collection), {
      headers: { 'Content-Type': AP_CONTENT_TYPE },
    });
  });

  // Individual Note
  app.get('/activitypub/notes/:id', ({ params, request }) => {
    const post = db
      .query('SELECT id, body_html, body_md, created_at FROM micro_posts WHERE id = ?')
      .get(params.id) as MicroPostRow | null;

    if (!post) {
      return new Response('Not Found', { status: 404 });
    }

    if (!wantsActivityJson(request)) {
      return new Response(null, {
        status: 302,
        headers: { Location: `/micro#${params.id}` },
      });
    }

    return new Response(JSON.stringify(buildNote(cfg, post)), {
      headers: { 'Content-Type': AP_CONTENT_TYPE },
    });
  });

  // Inbox
  app.post('/activitypub/inbox', ({ request }) => {
    return handleInbox(db, cfg, request);
  });
}
