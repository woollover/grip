import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { paginationNav } from '../../../views/shared';

const PAGE_SIZE = 20;

interface MicroPost {
  id: string; body_md: string; body_html: string; status: string; created_at: number;
}

export function renderMicroIndex(db: Database, page = 1): JSX.Element {
  const total = (db.prepare('SELECT COUNT(*) as n FROM micro_posts').get() as { n: number }).n;
  const offset = (page - 1) * PAGE_SIZE;
  const posts = db.prepare(
    'SELECT * FROM micro_posts ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(PAGE_SIZE, offset) as MicroPost[];

  const content = (
    <div>
      <h2>Micro-posts</h2>
      <form method="POST" action="/micro">
        <label>
          New micro-post
          <textarea name="body" rows="4" placeholder="What's on your mind?" required data-md-editor="mini" />
        </label>
        <button type="submit">Post</button>
      </form>
      <script src="/static/grip-editor.js" defer />
      <hr />
      {posts.map(p => (
        <article style="margin-bottom:1rem">
          <small>{new Date(p.created_at).toISOString()} · {p.status}</small>
          <div>{p.body_html}</div>
          {p.status === 'active'
            ? (
              <form method="POST" action={`/micro/${p.id}/retract`}>
                <button class="outline secondary" style="padding:0.2rem 0.6rem">Retract</button>
              </form>
            )
            : (
              <form method="POST" action={`/micro/${p.id}/restore`}>
                <button class="outline" style="padding:0.2rem 0.6rem">Restore</button>
              </form>
            )
          }
        </article>
      ))}
      {paginationNav(page, total, PAGE_SIZE, '/micro')}
    </div>
  );

  return authorLayout('Micro-posts', content, db);
}

export function handleMicroCreate(
  db: Database, store: EventStore,
  body: { body: string }
): void {
  const id = ulid();
  const event = { type: 'MicroPostCreated' as const, id, body: body.body };
  commitEvent(db, store, event);
}

export function handleMicroRetract(
  db: Database, store: EventStore,
  id: string
): void {
  const event = { type: 'MicroPostRetracted' as const, id };
  commitEvent(db, store, event);
}

export function handleMicroRestore(
  db: Database, store: EventStore,
  id: string
): void {
  const event = { type: 'MicroPostRestored' as const, id };
  commitEvent(db, store, event);
}
