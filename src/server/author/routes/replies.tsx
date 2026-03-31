import type { Database } from 'bun:sqlite';
import { authorLayout } from './layout';
import { paginationNav, esc } from '../../../views/shared';
import { countFollowers, listFollowers, countReplies, listReplies, toggleReplyStatus } from '../../data/activity';

const PAGE_SIZE = 20;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function renderContactsIndex(db: Database, page = 1): JSX.Element {
  const total = countFollowers(db);
  const followers = listFollowers(db, { page, pageSize: PAGE_SIZE });

  function handleToDisplay(uri: string): string {
    try {
      const u = new URL(uri);
      const parts = u.pathname.replace(/^\/users?\//, '').replace(/^\//, '');
      return `@${parts}@${u.hostname}`;
    } catch {
      return uri;
    }
  }

  const content = (
    <div>
      <div class="page-hd">
        <h2>Contacts</h2>
        <span style="font-size:.78rem;color:var(--g-text-muted)">{total} follower{total !== 1 ? 's' : ''}</span>
      </div>

      {total === 0 && (
        <div style="color:var(--g-text-muted);font-size:.88rem;padding:1.5rem 0">
          <p style="margin:0 0 .5rem">No one is following you yet.</p>
          <p style="margin:0;font-size:.8rem">Once ActivityPub is enabled and people follow you from the fediverse, they'll appear here.</p>
        </div>
      )}

      <div>
        {followers.map(f => {
          const handle = handleToDisplay(f.actor_uri);
          return (
            <div class="article-row">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--g-accent-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.78rem;font-weight:700;color:var(--g-accent)">
                {handle.slice(1, 2).toUpperCase()}
              </div>
              <div class="article-info">
                <a class="article-row-title" href={f.actor_uri} target="_blank" rel="noopener noreferrer" safe>{handle}</a>
                <div class="article-row-meta">
                  <span>Following since {fmtDate(f.followed_at)}</span>
                  <span>·</span>
                  <a href={f.actor_uri} target="_blank" rel="noopener noreferrer" style="font-size:.7rem;color:var(--g-text-muted)" safe>{f.actor_uri}</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {paginationNav(page, total, PAGE_SIZE, '/contacts')}
    </div>
  );

  return authorLayout('Contacts', content, db, '/contacts');
}

export function renderRepliesIndex(db: Database, page = 1): JSX.Element {
  const total = countReplies(db);
  const replies = listReplies(db, { page, pageSize: PAGE_SIZE });

  const content = (
    <div>
      <div class="page-hd">
        <h2>Replies</h2>
        <span style="font-size:.78rem;color:var(--g-text-muted)">{total} total</span>
      </div>

      {total === 0 && (
        <div style="color:var(--g-text-muted);font-size:.88rem;padding:1.5rem 0">
          <p style="margin:0">No replies yet.</p>
        </div>
      )}

      <div>
        {replies.map(r => (
          <div class={`note-stream-item${r.status === 'hidden' ? '' : ''}`} style={r.status === 'hidden' ? 'opacity:.45' : ''}>
            <div class="note-stream-meta" style="justify-content:space-between">
              <div style="display:flex;align-items:center;gap:.5rem">
                <a href={r.actor_uri} target="_blank" rel="noopener noreferrer" safe>{r.actor_name || r.actor_uri}</a>
                <span>·</span>
                <span>{fmtDate(r.published_at)}</span>
                <span>·</span>
                <span>in reply to <code style="font-size:.68rem">{r.note_id.slice(0, 8)}…</code></span>
              </div>
              {r.status === 'hidden' && (
                <span style="font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--g-text-muted);border:1px solid var(--g-border);border-radius:2px;padding:.05rem .35rem">hidden</span>
              )}
            </div>
            <div class="note-body" style="margin-top:.25rem" safe>{r.content}</div>
            <div class="note-stream-actions" style="margin-top:.4rem">
              <form method="POST" action={`/replies/${encodeURIComponent(r.id)}/toggle`} style="margin:0">
                <button type="submit" style={`color:${r.status === 'visible' ? 'var(--g-text-muted)' : 'var(--g-accent)'}`}>
                  {r.status === 'visible' ? 'Hide' : 'Show'}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {paginationNav(page, total, PAGE_SIZE, '/replies')}
    </div>
  );

  return authorLayout('Replies', content, db, '/replies');
}

export function handleReplyToggle(db: Database, id: string): void {
  toggleReplyStatus(db, id);
}
