import type { Database } from 'bun:sqlite';
import { authorLayout } from './layout';

export function renderRepliesIndex(db: Database): JSX.Element {
  const replies = db
    .prepare(
      "SELECT id, note_id, actor_uri, actor_name, content, published_at, status FROM ap_replies ORDER BY published_at DESC",
    )
    .all() as {
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
      <h2>Replies</h2>
      {replies.length === 0
        ? <p>No replies yet.</p>
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
                const truncated = r.content.length > 100
                  ? r.content.slice(0, 100) + '…'
                  : r.content;
                return (
                  <tr>
                    <td><code>{r.note_id.slice(0, 8)}</code></td>
                    <td>
                      <a href={r.actor_uri} rel="noopener noreferrer" target="_blank" safe>
                        {r.actor_name}
                      </a>
                    </td>
                    <td safe>{truncated}</td>
                    <td><small>{new Date(r.published_at).toISOString()}</small></td>
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
    </div>
  );

  return authorLayout('Replies', content, db);
}

export function handleReplyToggle(db: Database, id: string): void {
  const row = db
    .prepare("SELECT status FROM ap_replies WHERE id = ?")
    .get(id) as { status: string } | null;
  if (row) {
    const newStatus = row.status === "visible" ? "hidden" : "visible";
    db.prepare("UPDATE ap_replies SET status = ? WHERE id = ?").run(newStatus, id);
  }
}
