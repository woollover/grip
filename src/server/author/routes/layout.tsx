import { getColorScheme, getThemeVersion } from "../../../core/themes";
import type { GripDb } from "../../data/index";

export function authorLayout(
  title: string,
  content: JSX.Element,
  db?: GripDb,
  activePath?: string,
  fullWidth?: boolean,
  bareLayout?: boolean,
): JSX.Element {
  const scheme = db ? getColorScheme(db.raw) : "light";
  const themeVersion = db ? getThemeVersion(db.raw) : "default";
  const apEnabled = db ? !!db.config.get("ap_enabled") : false;

  function navLink(href: string, label: string): JSX.Element {
    const isActive = activePath === href || (activePath !== undefined && activePath.startsWith(href) && href !== '/dashboard');
    return (
      <a href={href} class={isActive ? 'nav-active' : ''}>{label}</a>
    );
  }

  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GRIP — {title}</title>
        <link rel="stylesheet" href="/static/open-props.min.css" />
        <link rel="stylesheet" href="/static/grip.css" />
        <link rel="stylesheet" href={`/theme.css?v=${themeVersion}`} />
        <script src="/static/htmx.min.js" defer />
        <style>{`
/* ── Author top-rail nav ── */
body.g-author { margin: 0; }
.g-author-nav {
  height: 44px;
  border-bottom: 1px solid var(--g-border);
  background: var(--g-bg);
  display: flex;
  align-items: center;
  padding: 0 1.25rem;
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 0;
}
.g-author-nav-brand {
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--g-text-strong);
  text-decoration: none;
  margin-right: 1.5rem;
  flex-shrink: 0;
}
.g-author-nav-links {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.g-author-nav-links::-webkit-scrollbar { display: none; }
.g-author-nav-links a {
  font-size: .78rem;
  color: var(--g-text-muted);
  text-decoration: none;
  padding: 0 .7rem;
  height: 44px;
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  transition: color .12s, border-color .12s;
  white-space: nowrap;
}
.g-author-nav-links a:hover {
  color: var(--g-accent);
}
.g-author-nav-links a.nav-active {
  color: var(--g-accent);
  border-bottom-color: var(--g-accent);
  font-weight: 600;
}
.g-author-nav-links .nav-sep {
  color: var(--g-border);
  padding: 0 .5rem;
  height: 44px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  user-select: none;
}
.g-author-nav-end {
  margin-left: auto;
  position: relative;
  flex-shrink: 0;
}
.g-author-nav-end details {
  position: relative;
}
.g-author-nav-end summary {
  list-style: none;
  font-size: .78rem;
  color: var(--g-text-muted);
  cursor: pointer;
  padding: .3rem .5rem;
  border-radius: var(--g-r);
  border: none;
  background: none;
  font-family: inherit;
  transition: color .12s;
}
.g-author-nav-end summary:hover { color: var(--g-text); }
.g-author-nav-end summary::-webkit-details-marker { display: none; }
.g-author-nav-end .dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--g-bg);
  border: 1px solid var(--g-border);
  border-radius: var(--g-r);
  box-shadow: 0 4px 16px rgba(0,0,0,.1);
  min-width: 140px;
  z-index: 200;
  overflow: hidden;
}
body.g-author .g-author-nav-end .dropdown a,
body.g-author .g-author-nav-end .dropdown button {
  display: block;
  width: 100%;
  text-align: left;
  padding: .5rem .85rem;
  font-size: .78rem;
  color: var(--g-text);
  text-decoration: none;
  background: none;
  border: none;
  border-color: transparent;
  border-bottom: 1px solid var(--g-border-faint);
  cursor: pointer;
  font-family: inherit;
  font-weight: 400;
  border-radius: 0;
  transition: background .1s;
}
body.g-author .g-author-nav-end .dropdown a:last-child,
body.g-author .g-author-nav-end .dropdown button:last-child { border-bottom: none; }
body.g-author .g-author-nav-end .dropdown a:hover,
body.g-author .g-author-nav-end .dropdown button:hover { background: var(--g-surface); color: var(--g-text-strong); border-color: transparent; }

/* ── Author content area ── */
.g-author-content {
  padding: 2rem 1.5rem;
  max-width: 960px;
  margin: 0 auto;
}

/* ── Page header ── */
.page-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}
.page-hd h2 {
  margin: 0;
  font-size: 1.15rem;
}

/* ── Buttons (sized variants) ── */
body.g-author .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .3em;
  font-family: inherit;
  font-size: .82rem;
  font-weight: 500;
  line-height: 1;
  padding: .35rem .8rem;
  border-radius: var(--g-r);
  border: 1px solid var(--g-accent);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background .12s, border-color .12s, color .12s;
  background: var(--g-accent);
  color: var(--g-accent-fg);
}
body.g-author .btn:hover { background: var(--g-accent-hover); border-color: var(--g-accent-hover); }
body.g-author .btn-sm { font-size: .74rem; padding: .25rem .6rem; }
body.g-author .btn-primary { background: var(--g-accent); color: var(--g-accent-fg); border-color: var(--g-accent); }
body.g-author .btn-primary:hover { background: var(--g-accent-hover); border-color: var(--g-accent-hover); color: var(--g-accent-fg); }
body.g-author .btn-outline { background: transparent; color: var(--g-accent); border-color: var(--g-accent); }
body.g-author .btn-outline:hover { background: var(--g-accent-muted); }
body.g-author .btn-ghost { background: transparent; color: var(--g-text-muted); border-color: transparent; }
body.g-author .btn-ghost:hover { background: var(--g-surface-2); color: var(--g-text); border-color: transparent; }
body.g-author .btn-danger { background: var(--g-danger); color: #fff; border-color: var(--g-danger); }

/* ── Status dots ── */
.sdot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sdot-pub { background: var(--g-success); }
.sdot-draft { background: transparent; border: 1.5px solid var(--g-text-muted); }
.sdot-unpub { background: var(--g-warn); }

/* ── Filter tabs ── */
.filter-tabs { display: flex; border-bottom: 1px solid var(--g-border); margin-bottom: 1.25rem; }
.ftab {
  padding: .45rem .9rem;
  font-size: .78rem;
  font-weight: 500;
  color: var(--g-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  text-decoration: none;
  transition: color .12s, border-color .12s;
}
.ftab:hover { color: var(--g-text); }
.ftab.active { color: var(--g-accent); border-bottom-color: var(--g-accent); font-weight: 600; }
.ftab-count {
  font-size: .65rem; font-weight: 700;
  background: var(--g-surface-2); color: var(--g-text-muted);
  border-radius: 999px; padding: .05rem .4rem; margin-left: .3rem;
}
.ftab.active .ftab-count { background: var(--g-accent-muted); color: var(--g-accent); }

/* ── Article rows ── */
.article-row { display: flex; align-items: flex-start; gap: .85rem; padding: .75rem 0; border-bottom: 1px solid var(--g-border-faint); }
.article-row:last-child { border-bottom: none; }
.article-dot { padding-top: .3rem; flex-shrink: 0; }
.article-info { flex: 1; min-width: 0; }
.article-row-title { font-size: .9rem; font-weight: 600; color: var(--g-text-strong); text-decoration: none; display: block; margin-bottom: .2rem; }
.article-row-title:hover { color: var(--g-accent); }
.article-row-meta { display: flex; align-items: center; gap: .5rem; font-size: .73rem; color: var(--g-text-muted); flex-wrap: wrap; }
.article-row-actions { display: flex; align-items: center; gap: .4rem; flex-shrink: 0; }

/* ── Composer (micro) ── */
.composer { border: 1px solid var(--g-border); border-radius: 8px; background: var(--g-bg); margin-bottom: 2rem; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
.composer textarea { border: none; border-radius: 0; resize: none; padding: .9rem 1rem; font-size: .88rem; line-height: 1.65; min-height: 90px; width: 100%; font-family: inherit; background: var(--g-bg); color: var(--g-text); margin-top: 0; }
.composer textarea:focus { outline: none; box-shadow: none; border: none; }
.composer-footer { display: flex; align-items: center; justify-content: space-between; padding: .5rem .85rem; border-top: 1px solid var(--g-border-faint); background: var(--g-surface); }
.char-count { font-size: .72rem; color: var(--g-text-muted); }

/* ── Note stream ── */
.note-stream-hd { font-size: .68rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--g-text-muted); margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; }
.note-stream-item { padding: .9rem 0; border-bottom: 1px solid var(--g-border-faint); }
.note-stream-item:last-child { border-bottom: none; }
.note-stream-item.retracted { opacity: .45; }
.note-stream-item.retracted .note-body { text-decoration: line-through; color: var(--g-text-muted); }
.note-stream-meta { display: flex; align-items: center; gap: .5rem; font-size: .72rem; color: var(--g-text-muted); margin-bottom: .4rem; }
.note-stream-meta a { color: inherit; text-decoration: none; }
.note-stream-meta a:hover { color: var(--g-accent); }
.note-body { font-size: .88rem; line-height: 1.7; }
.note-body p { margin: 0; }
.note-stream-actions { margin-top: .35rem; display: flex; gap: .5rem; }
body.g-author .note-stream-actions a,
body.g-author .note-stream-actions button { font-size: .68rem; color: var(--g-text-muted); background: none; border: none; border-color: transparent; padding: 0; cursor: pointer; text-decoration: none; font-family: inherit; transition: color .12s; line-height: inherit; }
body.g-author .note-stream-actions a:hover,
body.g-author .note-stream-actions button:hover { color: var(--g-danger); background: none; border-color: transparent; }

/* ── Media ── */
.media-drop-zone { border: 2px dashed var(--g-border); border-radius: 8px; padding: 2rem; text-align: center; color: var(--g-text-muted); font-size: .85rem; margin-bottom: 1.5rem; cursor: pointer; }
.media-drop-zone:hover { border-color: var(--g-accent); background: var(--g-accent-muted); }
.filter-row { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.25rem; font-size: .78rem; }
.filter-btn { padding: .2rem .65rem; border: 1px solid var(--g-border); border-radius: 999px; background: var(--g-bg); color: var(--g-text-muted); cursor: pointer; font-size: .72rem; font-family: inherit; transition: background .12s, border-color .12s, color .12s; }
.filter-btn.active { background: var(--g-accent-muted); border-color: var(--g-accent); color: var(--g-accent); font-weight: 600; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: .85rem; }
.media-card { border: 1px solid var(--g-border); border-radius: 6px; overflow: hidden; background: var(--g-bg); transition: box-shadow .12s; }
.media-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.media-thumb { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 2rem; background: var(--g-surface-2); overflow: hidden; }
.media-thumb img { width: 100%; height: 100%; object-fit: cover; }
.media-card-info { padding: .45rem .55rem; }
.media-card-name { font-size: .72rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.media-card-sub { font-size: .65rem; color: var(--g-text-muted); }
body.g-author .media-copy-btn { display: flex; align-items: center; gap: .25rem; margin-top: .3rem; font-size: .65rem; color: var(--g-accent); cursor: pointer; background: none; border: none; border-color: transparent; padding: 0; font-family: inherit; line-height: inherit; }
body.g-author .media-copy-btn:hover { color: var(--g-accent-hover); background: none; border-color: transparent; }

/* ── Reader layout ── */
.reader-layout { display: grid; grid-template-columns: 220px 1fr; height: calc(100vh - 44px); overflow: hidden; }
.reader-sidebar { border-right: 1px solid var(--g-border); overflow-y: auto; background: var(--g-surface); }
.reader-sidebar-section { padding: .75rem .85rem; }
.reader-sidebar-label { font-size: .62rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--g-text-muted); margin-bottom: .5rem; }
.reader-sidebar-item { display: flex; align-items: center; justify-content: space-between; padding: .35rem .5rem; border-radius: var(--g-r); font-size: .8rem; color: var(--g-text); text-decoration: none; transition: background .1s; }
.reader-sidebar-item:hover { background: var(--g-surface-2); }
.reader-sidebar-item.active { background: var(--g-accent-muted); color: var(--g-accent); font-weight: 600; }
.reader-sidebar-count { font-size: .66rem; background: var(--g-accent); color: #fff; border-radius: 999px; padding: .05rem .4rem; font-weight: 700; }
.reader-sidebar-count.muted { background: var(--g-surface-2); color: var(--g-text-muted); }
.reader-sidebar-add { font-size: .72rem; color: var(--g-accent); padding: .25rem .5rem; text-decoration: none; }
.reader-sidebar-add:hover { color: var(--g-accent-hover); }
.reader-main { overflow-y: auto; }
.reader-toolbar { display: flex; align-items: center; gap: .75rem; padding: .75rem 1.25rem; border-bottom: 1px solid var(--g-border-faint); background: var(--g-bg); font-size: .78rem; position: sticky; top: 0; z-index: 10; }
.reader-toolbar .spacer { flex: 1; }
.reader-item-card { border-bottom: 1px solid var(--g-border-faint); padding: .85rem 1.25rem; transition: background .1s; }
.reader-item-card:hover { background: var(--g-surface); }
.reader-item-meta-row { display: flex; align-items: center; gap: .45rem; font-size: .7rem; color: var(--g-text-muted); margin-bottom: .35rem; }
.reader-source-badge { font-size: .6rem; font-weight: 700; letter-spacing: .04em; border: 1px solid; border-radius: 2px; padding: .05rem .3rem; }
.reader-source-badge.rss { border-color: #e0562f; color: #e0562f; }
.reader-source-badge.ap { border-color: var(--g-accent); color: var(--g-accent); }
.reader-item-title { font-size: .88rem; font-weight: 600; color: var(--g-text-strong); margin-bottom: .3rem; }
.reader-item-title a { color: inherit; text-decoration: none; }
.reader-item-title a:hover { color: var(--g-accent); }
.reader-item-preview { font-size: .8rem; color: var(--g-text-muted); line-height: 1.55; }
.reader-item-actions { display: flex; align-items: center; gap: .75rem; margin-top: .5rem; font-size: .72rem; }
.reader-item-actions a { color: var(--g-accent); text-decoration: none; }
body.g-author .reader-item-actions button { background: none; border: none; border-color: transparent; padding: 0; font-size: .72rem; color: var(--g-text-muted); cursor: pointer; font-family: inherit; }
body.g-author .reader-item-actions button:hover { color: var(--g-accent); background: none; border-color: transparent; }
.reader-item-body { margin: .75rem 0 .5rem; padding: .85rem 1rem; background: var(--g-bg); border: 1px solid var(--g-border); border-radius: var(--g-r); font-size: .85rem; line-height: 1.75; }
.reader-item-body p { margin: 0 0 .75em; }
.reader-item-body p:last-child { margin: 0; }
.reader-empty { color: var(--g-text-muted); font-size: .88rem; padding: 2rem 1.25rem; }
.reader-empty p { margin-bottom: .5rem; }

/* ── Split pane editor ── */
body.g-author { overflow-x: hidden; }
.editor-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.editor-shell > form { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.editor-topbar {
  height: 44px; border-bottom: 1px solid var(--g-border); background: var(--g-bg);
  display: flex; align-items: center; padding: 0 1rem; gap: .5rem; flex-shrink: 0;
}
.editor-topbar-brand { font-size: .7rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--g-text-muted); text-decoration: none; flex-shrink: 0; }
.editor-topbar-brand:hover { color: var(--g-text); }
.editor-topbar-sep { color: var(--g-border); font-size: .9rem; flex-shrink: 0; }
.editor-topbar-crumb { font-size: .78rem; color: var(--g-text-muted); text-decoration: none; flex-shrink: 0; }
.editor-topbar-crumb:hover { color: var(--g-text); }
.editor-spacer { flex: 1; }
.editor-status-pill { display: inline-flex; align-items: center; font-size: .68rem; font-weight: 600; padding: .18rem .6rem; border-radius: 999px; border: 1px solid var(--g-border); color: var(--g-text-muted); white-space: nowrap; flex-shrink: 0; }
.editor-status-pill.status-published { border-color: var(--g-success); color: var(--g-success); }
.editor-status-pill.status-unpublished { border-color: var(--g-warn); color: var(--g-warn); }
/* Title bar */
.editor-titlebar { padding: .9rem 1.25rem .6rem; border-bottom: 1px solid var(--g-border-faint); background: var(--g-bg); flex-shrink: 0; }
.editor-title-input { width: 100%; font-size: 1.35rem; font-weight: 700; border: none; background: transparent; padding: 0; color: var(--g-text-strong); font-family: var(--g-font-heading, var(--g-font-body)); outline: none; box-shadow: none; margin: 0; }
.editor-title-input::placeholder { color: var(--g-border); font-weight: 400; }
/* Meta bar */
.editor-metabar { display: flex; align-items: center; gap: .5rem; padding: .3rem 1.25rem; border-bottom: 1px solid var(--g-border-faint); background: var(--g-surface); flex-shrink: 0; min-height: 34px; }
.editor-meta-label { font-size: .68rem; font-weight: 600; color: var(--g-text-muted); white-space: nowrap; flex-shrink: 0; }
.editor-meta-input { font-size: .78rem; font-family: inherit; border: 1px solid transparent; background: transparent; padding: .15rem .35rem; border-radius: var(--g-r-sm); color: var(--g-text); margin: 0; min-width: 80px; flex: 1; max-width: 320px; }
.editor-meta-input:focus { outline: none; border-color: var(--g-border); background: var(--g-bg); box-shadow: none; }
.editor-meta-sep { width: 1px; height: 12px; background: var(--g-border); flex-shrink: 0; margin: 0 .1rem; }
.editor-meta-slug { font-size: .72rem; color: var(--g-text-muted); font-family: var(--g-font-mono, monospace); }
/* Formatting toolbar */
.editor-toolbar { display: flex; align-items: center; gap: .1rem; padding: .3rem .75rem; border-bottom: 1px solid var(--g-border-faint); background: var(--g-surface); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }
.editor-toolbar::-webkit-scrollbar { display: none; }
.editor-toolbar-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 .4rem; border: none; background: transparent; color: var(--g-text-muted); border-radius: var(--g-r-sm); font-size: .78rem; font-family: inherit; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.editor-toolbar-btn:hover { background: var(--g-surface-2); color: var(--g-text); }
.editor-toolbar-sep { width: 1px; height: 14px; background: var(--g-border-faint); margin: 0 .3rem; flex-shrink: 0; }
/* Writing body */
.editor-body { flex: 1; overflow-y: auto; background: var(--g-bg); min-height: 0; }
.editor-write { max-width: 720px; margin: 0 auto; padding: 1.5rem 2rem 4rem; }
.editor-write textarea { display: block; width: 100%; min-height: 60vh; border: none; outline: none; resize: none; font-family: var(--g-font-body, system-ui, sans-serif); font-size: 1rem; line-height: 1.85; background: transparent; color: var(--g-text); margin: 0; box-shadow: none; border-radius: 0; }
.editor-write textarea:focus { outline: none; box-shadow: none; }
.editor-write textarea::placeholder { color: var(--g-border); }
/* Preview */
.editor-preview { max-width: 720px; margin: 0 auto; padding: 1.5rem 2rem 4rem; font-size: 1rem; line-height: 1.85; }
.editor-preview h1 { font-size: 1.8rem; font-weight: 700; margin: 0 0 .75rem; }
.editor-preview h2 { font-size: 1.3rem; font-weight: 600; margin: 1.5em 0 .5rem; }
.editor-preview h3 { font-size: 1.1rem; font-weight: 600; margin: 1.2em 0 .4rem; }
.editor-preview p { margin: 0 0 1em; }
.editor-preview blockquote { border-left: 3px solid var(--g-accent); margin: 1.2em 0; padding: .4em 1em; color: var(--g-text-muted); }
.editor-preview code { font-family: var(--g-font-mono, monospace); font-size: .88em; background: var(--g-surface-2); padding: .1em .35em; border-radius: var(--g-r-sm); }
.editor-preview pre { background: var(--g-surface-2); border-radius: var(--g-r); padding: 1em 1.25em; overflow-x: auto; margin: 1.2em 0; }
.editor-preview pre code { background: none; padding: 0; }
.editor-preview img { max-width: 100%; height: auto; }
.editor-preview hr { border: none; border-top: 1px solid var(--g-border); margin: 2em 0; }
.editor-preview ul, .editor-preview ol { padding-left: 1.5em; margin: 0 0 1em; }
.editor-preview li { margin-bottom: .3em; }
.editor-preview-empty { color: var(--g-text-muted); font-style: italic; }
/* Footer bar */
.editor-footerbar { height: 32px; display: flex; align-items: center; padding: 0 1.25rem; gap: .75rem; border-top: 1px solid var(--g-border-faint); background: var(--g-surface); font-size: .7rem; color: var(--g-text-muted); flex-shrink: 0; }
.editor-footerbar-spacer { flex: 1; }
.editor-footerbar-hint { opacity: .4; font-size: .65rem; }

/* ── Dashboard stat cards ── */
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
.stat-card { border: 1px solid var(--g-border); border-radius: 6px; padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: .75rem; }
.stat-card-big { font-size: 1.6rem; font-weight: 800; color: var(--g-text-strong); line-height: 1; }
.stat-card-sub { font-size: .75rem; color: var(--g-text-muted); margin-top: .2rem; }
.greeting { font-size: 1.3rem; font-weight: 700; color: var(--g-text-strong); margin-bottom: 1.5rem; }
.activity-table { border: 1px solid var(--g-border); border-radius: 6px; padding: .25rem .75rem; }
.activity-row { display: grid; grid-template-columns: max-content 1fr max-content; gap: .5rem 1rem; padding: .6rem 0; border-bottom: 1px solid var(--g-border-faint); align-items: baseline; font-size: .82rem; }
.activity-row:last-child { border-bottom: none; }
.activity-ev-type { font-size: .68rem; font-weight: 700; letter-spacing: .05em; color: var(--g-accent); white-space: nowrap; }
.activity-ev-time { font-size: .72rem; color: var(--g-text-muted); white-space: nowrap; }

/* ── Pagination (author) ── */
.pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1.5rem; font-size: .78rem; color: var(--g-text-muted); }
.pagination a { color: var(--g-accent); text-decoration: none; }
.pagination-info { color: var(--g-text-muted); }
.pagination-disabled { color: var(--g-border); }

/* ── Remove old sidebar/nav styles ── */
.g-nav { display: none; }
        `}</style>
      </head>
      <body class="g-author">
        {!bareLayout && (
          <nav class="g-author-nav">
            <a class="g-author-nav-brand" href="/dashboard">GRIP</a>
            <div class="g-author-nav-links">
              {navLink('/articles', 'Articles')}
              {navLink('/micro', 'Micro')}
              {navLink('/pages', 'Pages')}
              {navLink('/media', 'Media')}
              <span class="nav-sep">|</span>
              {navLink('/reader', 'Reader')}
              <span class="nav-sep">|</span>
              {navLink('/settings', 'Settings')}
              {apEnabled && navLink('/contacts', 'Contacts')}
              {apEnabled && navLink('/replies', 'Replies')}
            </div>
            <div class="g-author-nav-end">
              <details>
                <summary>···</summary>
                <div class="dropdown">
                  <a href="/export">Export</a>
                  <a href="/backup">Backup</a>
                  <form method="POST" action="/logout" style="margin:0">
                    <button type="submit">Logout</button>
                  </form>
                </div>
              </details>
            </div>
          </nav>
        )}
        {fullWidth
          ? content
          : <div class="g-author-content">{content}</div>
        }
      </body>
    </html>
  );
  return ("<!DOCTYPE html>" + page) as unknown as JSX.Element;
}
