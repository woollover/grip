import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';

interface MicroPost {
  id: string; body_md: string; body_html: string; status: string; created_at: number;
}

export function renderMicroIndex(db: Database): JSX.Element {
  const posts = db.prepare('SELECT * FROM micro_posts ORDER BY created_at DESC').all() as MicroPost[];

  const content = (
    <div>
      <h2>Micro-posts</h2>
      <form method="POST" action="/micro">
        <label>
          New micro-post
          <textarea name="body" rows="4" placeholder="What's on your mind?" required />
        </label>
        <button type="submit">Post</button>
      </form>
      <hr />
      {posts.map(p => (
        <article style="margin-bottom:1rem">
          <small>{new Date(p.created_at).toISOString()} · {p.status}</small>
          <div safe>{p.body_html}</div>
          {p.status === 'active'
            ? (
              <form method="POST" action={`/micro/${p.id}/retract`}>
                <button class="outline secondary" style="padding:0.2rem 0.6rem">Retract</button>
              </form>
            )
            : <em>(retracted)</em>
          }
        </article>
      ))}
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
  store.append(event);
  applyEvent(db, event, Date.now());
}

export function handleMicroRetract(
  db: Database, store: EventStore,
  id: string
): void {
  const event = { type: 'MicroPostRetracted' as const, id };
  store.append(event);
  applyEvent(db, event, Date.now());
}
