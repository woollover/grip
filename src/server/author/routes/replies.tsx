import type { Database } from 'bun:sqlite';
import { authorLayout } from './layout';
import { paginationNav } from '../../../views/shared';

const PAGE_SIZE = 20;

export function renderContactsIndex(db: Database, page = 1): JSX.Element {
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM ap_followers').get() as { cnt: number }).cnt;
  const offset = (page - 1) * PAGE_SIZE;

  const followers = db
    .prepare('SELECT actor_uri, inbox_url, followed_at FROM ap_followers ORDER BY followed_at DESC LIMIT ? OFFSET ?')
    .all(PAGE_SIZE, offset) as { actor_uri: string; inbox_url: string; followed_at: number }[];

  const content = (
    <div>
      <div class="page-hd">
        <h2 style="margin:0">Contacts</h2>
        <small style="color:var(--pico-muted-color)">{total} contact{total !== 1 ? 's' : ''}</small>
      </div>
      {followers.length === 0
        ? <p style="color:var(--pico-muted-color)">No contacts yet.</p>
        : (
          <table>
            <thead>
              <tr><th>Actor</th><th>Inbox</th><th>Since</th></tr>
            </thead>
            <tbody>
              {followers.map(f => (
                <tr>
                  <td><a href={f.actor_uri} target="_blank" rel="noopener noreferrer" safe>{f.actor_uri}</a></td>
                  <td><small safe>{f.inbox_url}</small></td>
                  <td><small>{new Date(f.followed_at).toISOString().slice(0, 10)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      {paginationNav(page, total, PAGE_SIZE, '/contacts')}
    </div>
  );

  return authorLayout('Contacts', content, db);
}

export function renderRepliesIndex(db: Database, page = 1): JSX.Element {
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM ap_replies').get() as { cnt: number }).cnt;
  const offset = (page - 1) * PAGE_SIZE;

  const replies = db
    .prepare(
      'SELECT id, note_id, actor_uri, actor_name, content, published_at, status FROM ap_replies ORDER BY published_at DESC LIMIT ? OFFSET ?',
    )
    .all(PAGE_SIZE, offset) as {
    id: string;
    note_id: string;
    actor_uri: string;
    actor_name: string;
    content: string;
    published_at: number;
    status: string;
  }[];

  const content = (
    <div>
      <div class="page-hd">
        <h2 style="margin:0">Replies</h2>
        <small style="color:var(--pico-muted-color)">{total} total</small>
      </div>
      {replies.length === 0
        ? <p style="color:var(--pico-muted-color)">No replies yet.</p>
        : (
          <table>
            <thead>
              <tr>
                <th>Post</th><th>Author</th><th>Content</th>
                <th>Date</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {replies.map(r => {
                const truncated = r.content.length > 100 ? r.content.slice(0, 100) + '…' : r.content;
                return (
                  <tr>
                    <td><code>{r.note_id.slice(0, 8)}</code></td>
                    <td>
                      <a href={r.actor_uri} rel="noopener noreferrer" target="_blank" safe>
                        {r.actor_name}
                      </a>
                    </td>
                    <td safe>{truncated}</td>
                    <td><small>{new Date(r.published_at).toISOString().slice(0, 10)}</small></td>
                    <td>{r.status}</td>
                    <td>
                      <form method="POST"
                        action={`/replies/${encodeURIComponent(r.id)}/toggle`}
                        style="margin:0">
                        {r.status === 'visible'
                          ? <button class="outline secondary" style="padding:0.2rem 0.6rem">Hide</button>
                          : <button class="outline" style="padding:0.2rem 0.6rem">Show</button>
                        }
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      }
      {paginationNav(page, total, PAGE_SIZE, '/replies')}
    </div>
  );

  return authorLayout('Replies', content, db);
}

export function handleReplyToggle(db: Database, id: string): void {
  const row = db
    .prepare('SELECT status FROM ap_replies WHERE id = ?')
    .get(id) as { status: string } | null;
  if (row) {
    const newStatus = row.status === 'visible' ? 'hidden' : 'visible';
    db.prepare('UPDATE ap_replies SET status = ? WHERE id = ?').run(newStatus, id);
  }
}
