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
    <section style="margin-top:1rem;padding-left:1rem;border-left:2px solid var(--pico-muted-border-color)">
      {replies.map(r => (
        <div style="margin-bottom:0.75rem">
          <small style="color:var(--pico-muted-color)">
            <a href={r.actor_uri} rel="noopener noreferrer" target="_blank" safe>{r.actor_name}</a>
            {' · '}{new Date(r.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </small>
          <div style="margin-top:0.25rem;font-size:0.9rem" safe>{r.content}</div>
        </div>
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

  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const content = (
    <div>
      <h1 style="margin-top:0;margin-bottom:1.5rem">Notes</h1>
      {posts.length === 0 && <p style="color:var(--pico-muted-color)">No notes yet.</p>}
      <ul class="note-stream">
        {posts.map(p => (
          <li id={p.id}>
            <div class="note-meta">{fmt(p.created_at)}</div>
            <div class="note-body">{p.body_html}</div>
            {showReplies ? renderReplies(db, p.id) : ''}
          </li>
        ))}
      </ul>
    </div>
  );

  return publicLayout({ title: 'Notes', siteTitle, db }, content);
}
