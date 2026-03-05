import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';
import type { ApConfig } from '../../../activitypub/config';

interface MicroPost {
  id: string; body_html: string; status: string; created_at: number;
}

interface ReplyRow {
  id: string; actor_uri: string; actor_name: string; content: string; published_at: number;
}

function renderReplies(db: Database, noteId: string): JSX.Element {
  const replies = db.prepare(`
    SELECT id, actor_uri, actor_name, content, published_at
    FROM ap_replies WHERE note_id = ? AND status = 'visible'
    ORDER BY published_at ASC
  `).all(noteId) as ReplyRow[];

  if (replies.length === 0) return '' as unknown as JSX.Element;

  return (
    <section class="replies">
      {replies.map(r => (
        <article>
          <footer>
            <small>
              <a href={r.actor_uri} rel="noopener noreferrer" target="_blank">{r.actor_name}</a>
              {' · '}{new Date(r.published_at).toISOString()}
            </small>
          </footer>
          {/* r.content is untrusted AP content — auto-escaped, no safe() */}
          <div>{r.content}</div>
        </article>
      ))}
    </section>
  );
}

export function renderMicroList(db: Database, siteTitle: string, apCfg?: ApConfig | null): JSX.Element {
  const posts = db.prepare(`
    SELECT * FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC
  `).all() as MicroPost[];

  const showReplies = apCfg?.acceptReplies === true;

  const content = (
    <div>
      <h1>Notes</h1>
      {posts.length === 0 && <p>No notes yet.</p>}
      {posts.map(p => (
        <div>
          <article id={p.id}>
            <div safe>{p.body_html}</div>
            <footer><small>{new Date(p.created_at).toISOString()}</small></footer>
          </article>
          {showReplies ? renderReplies(db, p.id) : ''}
        </div>
      ))}
    </div>
  );

  return publicLayout({ title: 'Notes', siteTitle, db }, content);
}
