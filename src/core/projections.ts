import type { Database } from 'bun:sqlite';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import type { GripEvent } from './event-types';
import type { StoredEvent, EventStore } from './events';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(str, { language: lang }).value; } catch {}
    }
    return '';
  },
});

export function renderMd(src: string): string {
  return md.render(src);
}

export function rebuild(db: Database, events: StoredEvent[]): void {
  db.transaction(() => {
    db.exec(`
      DELETE FROM articles;
      DELETE FROM micro_posts;
      DELETE FROM pages;
      DELETE FROM media;
    `);

    for (const stored of events) {
      const event = JSON.parse(stored.payload) as GripEvent;
      applyEvent(db, event, stored.created_at);
    }
  })();
}

export function commitEvent(db: Database, store: EventStore, event: GripEvent): void {
  db.transaction(() => {
    store.append(event);
    applyEvent(db, event, Date.now());
  })();
}

export function applyEvent(db: Database, event: GripEvent, createdAt: number): void {
  switch (event.type) {
    case 'ArticleCreated': {
      db.prepare(`
        INSERT OR REPLACE INTO articles (id, slug, title, body_md, body_html, tags, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `).run(
        event.id, event.slug, event.title,
        event.body, renderMd(event.body),
        JSON.stringify(event.tags),
        createdAt, createdAt
      );
      break;
    }
    case 'ArticleRevised': {
      db.prepare(`
        UPDATE articles
        SET title = ?, body_md = ?, body_html = ?, tags = ?, updated_at = ?
        WHERE id = ?
      `).run(
        event.title, event.body, renderMd(event.body),
        JSON.stringify(event.tags), createdAt, event.id
      );
      break;
    }
    case 'ArticlePublished': {
      db.prepare(`
        UPDATE articles SET status = 'published', published_at = ? WHERE id = ?
      `).run(createdAt, event.id);
      break;
    }
    case 'ArticleUnpublished': {
      db.prepare(`
        UPDATE articles SET status = 'unpublished' WHERE id = ?
      `).run(event.id);
      break;
    }
    case 'MicroPostCreated': {
      db.prepare(`
        INSERT OR REPLACE INTO micro_posts (id, body_md, body_html, status, created_at)
        VALUES (?, ?, ?, 'active', ?)
      `).run(event.id, event.body, renderMd(event.body), createdAt);
      break;
    }
    case 'MicroPostRetracted': {
      db.prepare(`
        UPDATE micro_posts SET status = 'retracted' WHERE id = ?
      `).run(event.id);
      break;
    }
    case 'MicroPostRestored': {
      db.prepare(`
        UPDATE micro_posts SET status = 'active' WHERE id = ?
      `).run(event.id);
      break;
    }
    case 'PageCreated': {
      db.prepare(`
        INSERT OR REPLACE INTO pages (id, slug, title, body_md, body_html, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
      `).run(
        event.id, event.slug, event.title,
        event.body, renderMd(event.body),
        createdAt, createdAt
      );
      break;
    }
    case 'PageRevised': {
      const current = db.prepare('SELECT * FROM pages WHERE id = ?').get(event.id) as
        { title: string; slug: string; body_md: string } | null;
      if (!current) break;
      const newTitle = event.title ?? current.title;
      const newSlug  = event.slug  ?? current.slug;
      const newBody  = event.body  ?? current.body_md;
      db.prepare(`
        UPDATE pages SET title = ?, slug = ?, body_md = ?, body_html = ?, updated_at = ? WHERE id = ?
      `).run(newTitle, newSlug, newBody, renderMd(newBody), createdAt, event.id);
      break;
    }
    case 'PagePublished': {
      db.prepare(`UPDATE pages SET status = 'published' WHERE id = ?`).run(event.id);
      break;
    }
    case 'PageUnpublished': {
      db.prepare(`UPDATE pages SET status = 'unpublished' WHERE id = ?`).run(event.id);
      break;
    }
    case 'MediaUploaded': {
      db.prepare(`
        INSERT OR REPLACE INTO media (id, filename, mime_type, path, alt_text, tags, uploaded_at)
        VALUES (?, ?, ?, ?, ?, '[]', ?)
      `).run(event.id, event.filename, event.mimeType, event.path, event.altText ?? null, createdAt);
      break;
    }
    case 'MediaTagged': {
      db.prepare(`UPDATE media SET tags = ? WHERE id = ?`)
        .run(JSON.stringify(event.tags), event.id);
      break;
    }
    case 'AuthAttempt': {
      // Audit log only — no projection state changed
      break;
    }
    case 'SiteConfigUpdated': {
      const setConfig = (k: string, v: string) =>
        db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(k, v);
      if (event.title !== undefined) setConfig('site_title', event.title);
      if (event.description !== undefined) setConfig('site_description', event.description);
      if (event.domain !== undefined) setConfig('domain', event.domain);
      if (event.homeIntro !== undefined) setConfig('home_intro', event.homeIntro);
      break;
    }
  }
}
