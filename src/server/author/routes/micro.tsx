import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { paginationNav, fmtDate, esc } from '../../../views/shared';
import type { GripDb } from '../../data/index';

const PAGE_SIZE = 20;

function fmtRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return fmtDate(ms);
}

export function renderMicroIndex(db: GripDb, page = 1): JSX.Element {
  const { posts, total } = db.micro.listAdmin({ page, pageSize: PAGE_SIZE });

  const content = (
    <div>
      <div class="page-hd" style="margin-bottom:1.25rem"><h2>Notes</h2></div>

      <div class="composer">
        <form method="POST" action="/micro" id="micro-form">
          <div id="micro-body-mount" style="min-height:90px;padding:.9rem 1rem;cursor:text" onclick="document.querySelector('#micro-body-mount .cm-content')?.focus()"></div>
          <textarea name="body" id="micro-body" style="display:none"></textarea>
          <div class="composer-footer">
            <span class="char-count" id="micro-char-count">0 / 500</span>
            <button type="submit" class="btn btn-primary btn-sm">Post</button>
          </div>
        </form>
      </div>
      <div class="note-stream-hd">
        <span>Your notes</span>
        <span style="font-weight:400;text-transform:none;letter-spacing:0">{total} total</span>
      </div>

      <div>
        {posts.map(p => (
          <div class={`note-stream-item${p.status === 'retracted' ? ' retracted' : ''}`}>
            <div class="note-stream-meta">
              <a href={`/micro/${p.id}`}>{fmtRelative(p.created_at)}</a>
              <span>·</span>
              <span>{p.status}</span>
            </div>
            <div class="note-body">{p.body_html}</div>
            <div class="note-stream-actions">
              {p.status === 'active'
                ? (
                  <>
                    <a href={`/micro/${p.id}`} style="color:var(--g-accent)">↗ permalink</a>
                    <span>·</span>
                    <form method="POST" action={`/micro/${p.id}/retract`} style="margin:0;display:inline">
                      <button type="submit">retract</button>
                    </form>
                  </>
                )
                : (
                  <form method="POST" action={`/micro/${p.id}/restore`} style="margin:0;display:inline">
                    <button type="submit" style="color:var(--g-accent)">↩ restore</button>
                  </form>
                )
              }
            </div>
          </div>
        ))}
      </div>

      {paginationNav(page, total, PAGE_SIZE, '/micro')}
    </div>
  );

  return authorLayout('Notes', content, db, '/micro', false, false, true);
}

export function handleMicroCreate(
  db: GripDb, store: EventStore,
  body: { body: string }
): void {
  const id = ulid();
  const event = { type: 'MicroPostCreated' as const, id, body: body.body };
  commitEvent(db.raw, store, event);
}

export function handleMicroRetract(
  db: GripDb, store: EventStore,
  id: string
): void {
  const event = { type: 'MicroPostRetracted' as const, id };
  commitEvent(db.raw, store, event);
}

export function handleMicroRestore(
  db: GripDb, store: EventStore,
  id: string
): void {
  const event = { type: 'MicroPostRestored' as const, id };
  commitEvent(db.raw, store, event);
}
