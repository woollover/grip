import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { authorLayout } from './layout';

type Theme = 'light' | 'dark' | 'cyberpunk';

function getConfig(db: Database): { title: string; description: string; domain: string; theme: Theme } {
  const get = (key: string, fallback: string) => {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null;
    return row?.value ?? fallback;
  };
  return {
    title:       get('site_title', 'My GRIP'),
    description: get('site_description', ''),
    domain:      get('domain', 'localhost'),
    theme:       get('theme', 'light') as Theme,
  };
}

export function renderSettings(db: Database): string {
  const config = getConfig(db);

  const themeOptions: { value: Theme; label: string; description: string }[] = [
    { value: 'light',     label: 'Light',     description: 'Clean, minimal — PicoCSS default light' },
    { value: 'dark',      label: 'Dark',       description: 'Easy on the eyes, dark background' },
    { value: 'cyberpunk', label: 'Cyberpunk',  description: 'Neon green & magenta on near-black' },
  ];

  const content = `
    <h2>Settings</h2>

    <section>
      <h3>Site identity</h3>
      <form method="POST" action="/settings/site">
        <label>
          Site title
          <input type="text" name="title" value="${config.title}" required>
        </label>
        <label>
          Description
          <input type="text" name="description" value="${config.description}" placeholder="A short description of your site">
        </label>
        <label>
          Domain <small style="font-weight:normal">(used in RSS feed URLs)</small>
          <input type="text" name="domain" value="${config.domain}" placeholder="example.com">
        </label>
        <button type="submit">Save site settings</button>
      </form>
    </section>

    <section style="margin-top:2rem">
      <h3>Theme</h3>
      <p style="color:var(--pico-muted-color)">Changes apply to both the public site and this interface.</p>
      <form method="POST" action="/settings/theme">
        <fieldset>
          ${themeOptions.map(t => `
            <label>
              <input type="radio" name="theme" value="${t.value}" ${config.theme === t.value ? 'checked' : ''}>
              <strong>${t.label}</strong> — <span style="color:var(--pico-muted-color)">${t.description}</span>
            </label>
          `).join('')}
        </fieldset>
        <button type="submit">Apply theme</button>
      </form>
    </section>
  `;

  return authorLayout('Settings', content, db);
}

export function handleSiteConfigUpdate(
  db: Database,
  store: EventStore,
  body: { title?: string; description?: string; domain?: string }
): void {
  const event = {
    type: 'SiteConfigUpdated' as const,
    title:       body.title?.trim(),
    description: body.description?.trim(),
    domain:      body.domain?.trim(),
  };
  store.append(event);
  applyEvent(db, event, Date.now());
}

// Theme is a cosmetic preference, not a meaningful act — written directly to config, not the event store.
export function handleThemeChange(
  db: Database,
  _store: EventStore,
  body: { theme?: string }
): void {
  const allowed: Theme[] = ['light', 'dark', 'cyberpunk'];
  const theme = allowed.includes(body.theme as Theme) ? (body.theme as Theme) : 'light';
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('theme', theme);
}
