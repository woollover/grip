import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { slugify } from '../../../core/utils';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { paginationNav, fmtDate, esc } from '../../../views/shared';
import { getSiteHost } from './shared';
import { editorImageWidget } from './media';

const PAGE_SIZE = 20;

const EDITOR_SCRIPT = `(function(){
  var ta=document.getElementById('body');
  var wc=document.getElementById('word-count');
  if(ta&&wc){
    function upd(){var w=ta.value.trim()?ta.value.trim().split(/\\s+/).length:0;wc.textContent=w.toLocaleString()+' word'+(w!==1?'s':'');}
    ta.addEventListener('input',upd);upd();
  }
  // Ctrl+S
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();var f=document.querySelector('.editor-shell form');if(f)f.requestSubmit();}
  });
  // Preview toggle
  var toggleBtn=document.getElementById('preview-toggle-btn');
  var writePane=document.getElementById('write-pane');
  var previewPane=document.getElementById('preview-pane');
  var toolbar=document.getElementById('editor-toolbar');
  var inPreview=false;
  if(toggleBtn&&ta){
    toggleBtn.addEventListener('click',function(){
      inPreview=!inPreview;
      writePane.style.display=inPreview?'none':'';
      previewPane.style.display=inPreview?'':'none';
      if(toolbar)toolbar.style.display=inPreview?'none':'';
      toggleBtn.textContent=inPreview?'\\u2715 Write':'Preview';
    });
  }
  // Formatting helpers
  function wrap(b,a,ph){var s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.slice(s,e)||ph;ta.setRangeText(b+sel+(a||b),s,e,'select');ta.focus();ta.dispatchEvent(new Event('input'));}
  function wrapLine(p){var s=ta.selectionStart,ls=ta.value.lastIndexOf('\\n',s-1)+1,le=ta.value.indexOf('\\n',s);if(le===-1)le=ta.value.length;var line=ta.value.slice(ls,le);ta.setRangeText(line.startsWith(p)?line.slice(p.length):p+line,ls,le,'end');ta.focus();ta.dispatchEvent(new Event('input'));}
  window._edFmt={
    bold:function(){wrap('**','**','bold text');},
    italic:function(){wrap('*','*','italic text');},
    strike:function(){wrap('~~','~~','text');},
    code:function(){wrap('\`','\`','code');},
    h2:function(){wrapLine('## ');},
    h3:function(){wrapLine('### ');},
    hr:function(){ta.setRangeText('\\n\\n---\\n\\n',ta.selectionStart,ta.selectionEnd,'end');ta.focus();ta.dispatchEvent(new Event('input'));},
    link:function(){var s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.slice(s,e)||'link text';var url=prompt('URL:','https://');if(!url)return;ta.setRangeText('['+sel+']('+url+')',s,e,'end');ta.focus();ta.dispatchEvent(new Event('input'));}
  };
  // Keyboard shortcuts in textarea
  if(ta)ta.addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey){if(e.key==='b'){e.preventDefault();window._edFmt.bold();}if(e.key==='i'){e.preventDefault();window._edFmt.italic();}if(e.key==='k'){e.preventDefault();window._edFmt.link();}}});
})();`;

interface Article {
  id: string; slug: string; title: string; body_md: string;
  tags: string; status: string; created_at: number; updated_at: number; published_at: number | null;
}

type StatusFilter = 'all' | 'published' | 'draft' | 'unpublished';

export function renderArticlesIndex(db: Database, page = 1, statusFilter: StatusFilter = 'all'): JSX.Element {
  // Count per status
  const countAll       = (db.prepare('SELECT COUNT(*) as n FROM articles').get() as { n: number }).n;
  const countPublished = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'published'").get() as { n: number }).n;
  const countDraft     = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'draft'").get() as { n: number }).n;
  const countUnpub     = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'unpublished'").get() as { n: number }).n;

  let total: number;
  let articles: Article[];
  const offset = (page - 1) * PAGE_SIZE;

  if (statusFilter === 'all') {
    total = countAll;
    articles = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(PAGE_SIZE, offset) as Article[];
  } else {
    total = statusFilter === 'published' ? countPublished : statusFilter === 'draft' ? countDraft : countUnpub;
    articles = db.prepare(
      'SELECT * FROM articles WHERE status = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).all(statusFilter, PAGE_SIZE, offset) as Article[];
  }

  function tabLink(filter: StatusFilter, label: string, count: number): JSX.Element {
    const isActive = statusFilter === filter;
    return (
      <a href={`/articles?status=${filter}`} class={`ftab${isActive ? ' active' : ''}`}>
        {label} <span class="ftab-count">{count}</span>
      </a>
    );
  }

  function statusDot(status: string): JSX.Element {
    if (status === 'published')   return <span class="sdot sdot-pub" />;
    if (status === 'draft')       return <span class="sdot sdot-draft" />;
    return <span class="sdot sdot-unpub" />;
  }

  const content = (
    <div>
      <div class="page-hd">
        <h2>Articles</h2>
        <a href="/articles/new" class="btn btn-primary btn-sm">+ New article</a>
      </div>

      <div class="filter-tabs">
        {tabLink('all',         'All',         countAll)}
        {tabLink('published',   'Published',   countPublished)}
        {tabLink('draft',       'Drafts',      countDraft)}
        {tabLink('unpublished', 'Unpublished', countUnpub)}
      </div>

      {articles.length === 0 && (
        <p style="color:var(--g-text-muted);font-size:.88rem">No articles found.</p>
      )}

      <div>
        {articles.map(a => {
          const tags: string[] = (() => { try { return JSON.parse(a.tags); } catch { return []; } })();
          const dateLabel = a.published_at ? fmtDate(a.published_at) : fmtDate(a.updated_at);
          return (
            <div class="article-row">
              <div class="article-dot">{statusDot(a.status)}</div>
              <div class="article-info">
                <a class="article-row-title" href={`/articles/${a.id}/edit`}>{esc(a.title)}</a>
                <div class="article-row-meta">
                  <span>{dateLabel}</span>
                  {tags.length > 0 && <span>·</span>}
                  {tags.map(t => (
                    <a href={`/articles?tag=${encodeURIComponent(t)}`} class="tag" style="font-size:.68rem">{esc(t)}</a>
                  ))}
                  {a.status !== 'published' && (
                    <span style={`color:var(${a.status === 'draft' ? '--g-text-muted' : '--g-warn'});font-size:.7rem`}>{a.status}</span>
                  )}
                </div>
              </div>
              <div class="article-row-actions">
                <a href={`/articles/${a.id}/edit`} class="btn btn-outline btn-sm">Edit</a>
                <form method="POST" action={`/articles/${a.id}/${a.status === 'published' ? 'unpublish' : 'publish'}`} style="margin:0">
                  <button class="btn btn-ghost btn-sm" type="submit">
                    {a.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {paginationNav(page, total, PAGE_SIZE, `/articles?status=${statusFilter}`)}
    </div>
  );

  return authorLayout('Articles', content, db, '/articles');
}

export function renderArticleNew(db: Database): JSX.Element {
  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span class="editor-topbar-sep">›</span>
        <a href="/articles" class="editor-topbar-crumb">Articles</a>
        <div class="editor-spacer" />
        <button type="submit" form="article-form" class="btn btn-primary btn-sm">Save draft</button>
        <a href="/articles" class="btn btn-ghost btn-sm">Cancel</a>
      </div>

      <form id="article-form" method="POST" action="/articles">
        <div class="editor-titlebar">
          <input class="editor-title-input" type="text" name="title" placeholder="Article title…" required autofocus />
        </div>
        <div class="editor-metabar">
          <span class="editor-meta-label">Tags</span>
          <input type="text" name="tags" placeholder="tag1, tag2…" class="editor-meta-input" />
        </div>

        <div class="editor-toolbar" id="editor-toolbar">
          <button type="button" class="editor-toolbar-btn" title="Bold (Ctrl+B)" onclick="_edFmt.bold()"><strong>B</strong></button>
          <button type="button" class="editor-toolbar-btn" title="Italic (Ctrl+I)" onclick="_edFmt.italic()"><em>I</em></button>
          <button type="button" class="editor-toolbar-btn" title="Strikethrough" onclick="_edFmt.strike()"><s>S</s></button>
          <button type="button" class="editor-toolbar-btn" title="Inline code" onclick="_edFmt.code()"><code style="font-size:.75rem">`</code></button>
          <span class="editor-toolbar-sep" />
          <button type="button" class="editor-toolbar-btn" title="Heading 2" onclick="_edFmt.h2()">H2</button>
          <button type="button" class="editor-toolbar-btn" title="Heading 3" onclick="_edFmt.h3()">H3</button>
          <span class="editor-toolbar-sep" />
          <button type="button" class="editor-toolbar-btn" title="Horizontal rule" onclick="_edFmt.hr()">—</button>
          <button type="button" class="editor-toolbar-btn" title="Link (Ctrl+K)" onclick="_edFmt.link()">🔗</button>
          <span class="editor-toolbar-sep" />
          {editorImageWidget()}
        </div>

        <div class="editor-body">
          <div class="editor-write" id="write-pane">
            <textarea
              name="body"
              id="body"
              hx-post="/preview"
              hx-trigger="input changed delay:400ms"
              hx-target="#preview-pane"
              hx-swap="innerHTML"
              placeholder="Write in Markdown…"
            />
          </div>
          <div class="editor-preview" id="preview-pane" style="display:none">
            <p class="editor-preview-empty">Nothing to preview yet.</p>
          </div>
        </div>

        <div class="editor-footerbar">
          <span id="word-count">0 words</span>
          <div class="editor-footerbar-spacer" />
          <button type="button" id="preview-toggle-btn" class="btn btn-ghost btn-sm" style="font-size:.7rem;height:22px">Preview</button>
          <span class="editor-footerbar-hint">Ctrl+S</span>
        </div>
      </form>
      <script src="/static/grip-editor.js" defer />
      <script>{EDITOR_SCRIPT}</script>
    </div>
  );

  return authorLayout('New article', content, db, '/articles', true, true);
}

export function handleArticleCreate(
  db: Database, store: EventStore,
  body: { title: string; slug?: string; body: string; tags?: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleCreated' as const, id, title: body.title, slug, body: body.body, tags };
  commitEvent(db, store, event);
  return id;
}

export function renderArticleEdit(db: Database, id: string): JSX.Element {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | null;
  if (!article) return authorLayout('Not found', <p>Article not found.</p>, db, '/articles');
  const siteHost = getSiteHost(db);
  const tags: string[] = (() => { try { return JSON.parse(article.tags); } catch { return []; } })();

  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span class="editor-topbar-sep">›</span>
        <a href="/articles" class="editor-topbar-crumb">Articles</a>
        <div class="editor-spacer" />
        <span class={`editor-status-pill status-${article.status}`}>{article.status}</span>
        <button type="submit" form="article-form" class="btn btn-outline btn-sm">Save</button>
        {article.status !== 'published'
          ? <button type="submit" form="publish-form" class="btn btn-primary btn-sm">Publish</button>
          : <button type="submit" form="unpublish-form" class="btn btn-ghost btn-sm">Unpublish</button>
        }
        {article.status === 'published' && (
          <a href={`//${siteHost}/articles/${esc(article.slug)}`} target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View ↗</a>
        )}
      </div>

      <form id="article-form" method="POST" action={`/articles/${id}/revise`}>
        <div class="editor-titlebar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            value={esc(article.title)}
            required
            autofocus
          />
        </div>
        <div class="editor-metabar">
          <span class="editor-meta-label">Tags</span>
          <input
            type="text"
            name="tags"
            value={tags.join(', ')}
            placeholder="tag1, tag2…"
            class="editor-meta-input"
          />
          <div class="editor-meta-sep" />
          <span class="editor-meta-label">Slug</span>
          <code class="editor-meta-slug">/{esc(article.slug)}</code>
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div class="editor-pane-tools">{editorImageWidget()}</div>
            </div>
            <div class="editor-pane-body">
              <textarea
                name="body"
                id="body"
                data-md-editor
                hx-post="/preview"
                hx-trigger="load, keyup changed delay:300ms"
                hx-target="#preview"
              >{article.body_md}</textarea>
            </div>
          </div>
          <div class="editor-pane">
            <div class="editor-pane-header"><span>Preview</span></div>
            <div class="editor-pane-body editor-preview" id="preview">
              <p class="editor-preview-empty">Loading…</p>
            </div>
          </div>
        </div>

        <div class="editor-footerbar">
          <span id="word-count">— words</span>
          <div class="editor-footerbar-spacer" />
          <span class="editor-footerbar-hint">Ctrl+S to save</span>
        </div>
      </form>

      <form id="publish-form" method="POST" action={`/articles/${id}/publish`} style="display:none" />
      <form id="unpublish-form" method="POST" action={`/articles/${id}/unpublish`} style="display:none" />

      <script src="/static/grip-editor.js" defer />
      <script>{EDITOR_SCRIPT}</script>
    </div>
  );

  return authorLayout(`Edit: ${article.title}`, content, db, '/articles', true, true);
}

export function handleArticleRevise(
  db: Database, store: EventStore, id: string,
  body: { title: string; body: string; tags?: string }
): void {
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleRevised' as const, id, title: body.title, body: body.body, tags };
  commitEvent(db, store, event);
}

export function handleArticlePublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'ArticlePublished' as const, id };
  commitEvent(db, store, event);
}

export function handleArticleUnpublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'ArticleUnpublished' as const, id };
  commitEvent(db, store, event);
}
