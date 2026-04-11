import { publicLayout } from '../../../views/layout';
import type { ApConfig } from '../../../activitypub/config';
import { paginationNav, esc } from '../../../views/shared';
import type { GripDb } from '../../data/index';

const PAGE_SIZE = 20;

function renderReplies(db: GripDb, noteId: string): JSX.Element {
  const replies = db.activity.listRepliesByNote(noteId);
  if (replies.length === 0) return '' as unknown as JSX.Element;

  return (
    <section style="margin-top:1rem;padding-left:1rem;border-left:2px solid var(--g-border-faint)">
      {replies.map(r => (
        <div style="margin-bottom:0.75rem">
          <small style="color:var(--g-text-muted)">
            <a href={r.actor_uri} rel="noopener noreferrer" target="_blank">{esc(r.actor_name)}</a>
            {' · '}{new Date(r.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </small>
          <div style="margin-top:0.25rem;font-size:0.9rem">{r.content}</div>
        </div>
      ))}
    </section>
  );
}

export function renderMicroList(db: GripDb, siteTitle: string, apCfg?: ApConfig | null, page = 1): JSX.Element {
  const { posts, total } = db.micro.list({ page, pageSize: PAGE_SIZE });
  const showReplies = apCfg?.acceptReplies === true;

  const content = (
    <div>
      <h1 style="margin-top:0;margin-bottom:1.5rem">Notes</h1>
      {posts.length === 0 && <p style="color:var(--g-text-muted)">No notes yet.</p>}
      <ul class="note-stream">
        {posts.map(p => (
          <li id={p.id}>
            <div class="note-meta">
              <a href={`/micro/${p.id}`} style="color:inherit;text-decoration:none" title="Permalink">
                {p.date}
              </a>
            </div>
            <div class="note-body">{p.body_html}</div>
            {showReplies ? renderReplies(db, p.id) : ''}
          </li>
        ))}
      </ul>
      {paginationNav(page, total, PAGE_SIZE, '/micro')}
    </div>
  );

  return publicLayout({ title: 'Notes', siteTitle, db, activePath: '/micro' }, content);
}

export function renderMicroPost(db: GripDb, id: string, siteTitle: string, apCfg?: ApConfig | null): JSX.Element | null {
  const post = db.micro.get(id);
  if (!post) return null;

  const showReplies = apCfg?.acceptReplies === true;

  const content = (
    <div>
      <p style="margin-top:0;font-size:0.8rem;color:var(--g-text-muted)">
        <a href="/micro">← All notes</a>
        {' · '}
        <span>{post.date}</span>
      </p>
      <div class="note-body" style="font-size:1.05rem">{post.body_html}</div>
      {showReplies ? renderReplies(db, post.id) : ''}
    </div>
  );

  return publicLayout(
    { title: 'Note', siteTitle, db, hideSidebar: true, activePath: '/micro' },
    content,
  );
}
