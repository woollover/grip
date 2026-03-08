import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { authorLayout } from './layout';
import {
  type ThemeName, type ThemeCustom,
  PRESET_DEFAULTS, readThemeCustom,
} from '../../../core/themes';
import { version as currentVersion } from '../../../../package.json';

function getConfig(db: Database): { title: string; description: string; domain: string } {
  const get = (key: string, fallback: string) => {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null;
    return row?.value ?? fallback;
  };
  return {
    title:       get('site_title', 'My GRIP'),
    description: get('site_description', ''),
    domain:      get('domain', 'localhost'),
  };
}

function getPublicitySettings(db: Database) {
  const get = (key: string, fallback: string) =>
    (db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null)?.value ?? fallback;
  return {
    mode:         get('publicity_mode', 'public') as 'public' | 'private',
    showArticles: get('show_articles',  '1') === '1',
    showMicro:    get('show_micro',     '1') === '1',
    rssEnabled:   get('rss_enabled',    '1') === '1',
  };
}

export function handlePublicityUpdate(db: Database, body: any): void {
  const mode         = body.publicity_mode === 'private' ? 'private' : 'public';
  const showArticles = body.show_articles  === '1' ? '1' : '0';
  const showMicro    = body.show_micro     === '1' ? '1' : '0';
  const rssEnabled   = body.rss_enabled    === '1' ? '1' : '0';
  const set = (k: string, v: string) =>
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(k, v);
  set('publicity_mode', mode);
  set('show_articles',  showArticles);
  set('show_micro',     showMicro);
  set('rss_enabled',    rssEnabled);
}

function getApStatus(db: Database): { enabled: boolean; username: string; domain: string; contacts: number } | null {
  const enabled = (db.prepare("SELECT value FROM config WHERE key = 'ap_enabled'").get() as { value: string } | null)?.value;
  if (!enabled) return null;
  const username = (db.prepare("SELECT value FROM config WHERE key = 'ap_username'").get() as { value: string } | null)?.value ?? '';
  const domain = (db.prepare("SELECT value FROM config WHERE key = ?").get('domain') as { value: string } | null)?.value ?? '';
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM ap_followers').get() as { cnt: number };
  return { enabled: true, username, domain, contacts: cnt };
}

export function renderSettings(db: Database): JSX.Element {
  const config = getConfig(db);
  const ap = getApStatus(db);
  const pub = getPublicitySettings(db);

  const apSection = ap ? (
    <section>
      <div class="page-hd" style="margin-bottom:0.5rem">
        <h3 style="display:flex;align-items:center;gap:0.5rem">
          ActivityPub
          <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--g-accent);border:1px solid var(--g-accent);border-radius:3px;padding:0.1rem 0.4rem">Active</span>
        </h3>
        <a href="/contacts" role="button" class="outline secondary">Contacts →</a>
      </div>
      <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0 0 0.4rem">
        Federated as <strong safe>{`@${ap.username}@${ap.domain}`}</strong> · {ap.contacts} contact{ap.contacts !== 1 ? 's' : ''}
      </p>
      <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0">
        Managed via <code>grip.toml</code> — restart required to change settings.
      </p>
    </section>
  ) : (
    <section>
      <div class="page-hd" style="margin-bottom:0.5rem">
        <h3>ActivityPub</h3>
      </div>
      <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0 0 0.75rem">
        Federate with Mastodon and the wider Fediverse. People can follow your notes from any ActivityPub server.
      </p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">To enable, add to <code>grip.toml</code> and restart:</p>
      <pre style="font-size:0.75rem;margin:0;padding:0.65rem 0.85rem;border-radius:4px;background:var(--g-code-bg)">{`[activitypub]
enabled        = true
username       = "you"
accept_replies = true`}</pre>
    </section>
  );

  const content = (
    <div>
      <h2 style="margin-bottom:1.5rem">Settings</h2>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start">

        {/* Left — Site identity */}
        <section>
          <form method="POST" action="/settings/site">
            <div class="page-hd" style="margin-bottom:1rem">
              <h3>Site identity</h3>
              <button type="submit" class="outline">Save</button>
            </div>
            <label>
              Site title
              <input type="text" name="title" value={config.title} required />
            </label>
            <label>
              Description
              <input type="text" name="description" value={config.description}
                placeholder="A short description of your site" />
            </label>
            <label>
              Domain <small style="font-weight:normal;opacity:0.7"> — used in RSS and ActivityPub URLs</small>
              <input type="text" name="domain" value={config.domain} placeholder="example.com" />
            </label>
          </form>
        </section>

        {/* Right — Theme, ActivityPub, Updates */}
        <div style="display:flex;flex-direction:column;gap:1.5rem">

          <section>
            <div class="page-hd">
              <h3>Theme</h3>
              <a href="/settings/theme" role="button" class="outline secondary">Customize →</a>
            </div>
            <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0">Fonts, colours, and visual style.</p>
          </section>

          <hr style="margin:0" />

          <section>
            <form method="POST" action="/settings/publicity">
              <div class="page-hd" style="margin-bottom:0.75rem">
                <h3>Publicity</h3>
                <button type="submit" class="outline">Save</button>
              </div>
              <label>
                Visibility
                <select name="publicity_mode">
                  <option value="public"  selected={pub.mode === 'public'}>Public</option>
                  <option value="private" selected={pub.mode === 'private'}>Private</option>
                </select>
              </label>
              <p style="font-size:0.73rem;color:var(--g-text-muted);margin:-0.25rem 0 0.85rem">
                {pub.mode === 'private'
                  ? 'Only published pages are visible to visitors.'
                  : 'Choose what content to expose publicly.'}
              </p>
              <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-bottom:0.4rem">
                <input type="checkbox" name="show_articles" value="1"
                  checked={pub.showArticles} disabled={pub.mode === 'private'} />
                Show articles
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-bottom:0.4rem">
                <input type="checkbox" name="show_micro" value="1"
                  checked={pub.showMicro} disabled={pub.mode === 'private'} />
                Show micro posts
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal">
                <input type="checkbox" name="rss_enabled" value="1"
                  checked={pub.rssEnabled} disabled={pub.mode === 'private'} />
                Enable RSS feeds
              </label>
            </form>
          </section>

          <hr style="margin:0" />

          {apSection}

          <hr style="margin:0" />

          <section>
            <div class="page-hd" style="margin-bottom:0.5rem">
              <h3>Updates</h3>
              <button
                class="outline secondary"
                hx-get="/update-check"
                hx-target="#update-result"
                hx-swap="innerHTML"
                hx-indicator="#update-result"
              >Check</button>
            </div>
            <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0 0 0.5rem">
              Current version: <code safe>v{currentVersion}</code>
            </p>
            <p id="update-result" style="font-size:0.78rem;margin:0;color:var(--g-text-muted)"></p>
          </section>

        </div>
      </div>
    </div>
  );

  return authorLayout('Settings', content, db);
}

// ── Theme editor ──────────────────────────────────────────────────────────────

const ALL_PRESETS: { name: ThemeName; label: string }[] = [
  { name: 'literary',  label: 'Literary'  },
  { name: 'ink',       label: 'Ink'       },
  { name: 'coder',     label: 'Coder'     },
  { name: 'cyberpunk', label: 'Cyberpunk' },
];

function FontOptions({ options, current }: {
  options: [value: string, label: string][];
  current: string;
}): JSX.Element {
  return (
    <>
      {options.map(([value, label]) => (
        <option value={value} selected={value === current}>{label}</option>
      ))}
    </>
  );
}

function KsSectionLabel({ children }: { children: string }): JSX.Element {
  return (
    <p style="font-size:0.55rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--g-text-muted);opacity:0.55;margin:1.5rem 0 0.6rem;border-top:1px solid var(--g-border-faint);padding-top:0.75rem">
      {children}
    </p>
  );
}

function KitchenSink(): JSX.Element {
  return (
    <div style="font-size:0.875rem;line-height:1.65">

      {/* Typography */}
      <KsSectionLabel>Typography</KsSectionLabel>
      <h1 style="margin-bottom:0.2rem">Heading 1 — The quick brown fox</h1>
      <h2 style="margin-bottom:0.2rem">Heading 2 — Jumps over the lazy dog</h2>
      <h3 style="margin-bottom:0.2rem">Heading 3 — Pack my box with five dozen</h3>
      <h4 style="margin-bottom:0.75rem">Heading 4 — How vexingly quick</h4>
      <p>Body text. A paragraph with <a href="#">a hyperlink</a>, <strong>bold text</strong>, <em>italic text</em>, and <code>inline code</code>. Muted text below.</p>
      <p style="color:var(--g-text-muted);font-size:0.8rem">A muted caption or secondary line of text.</p>
      <blockquote style="margin:0.75rem 0">
        A blockquote. The sovereign web belongs to those who tend it.
      </blockquote>

      {/* Buttons */}
      <KsSectionLabel>Buttons</KsSectionLabel>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
        <button type="button">Primary</button>
        <button type="button" class="outline">Outline</button>
        <button type="button" class="outline secondary">Secondary</button>
        <button type="button" disabled>Disabled</button>
      </div>

      {/* Forms */}
      <KsSectionLabel>Forms</KsSectionLabel>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
        <label style="margin:0">
          Text input
          <input type="text" placeholder="Placeholder…" style="margin-top:0.2rem" />
        </label>
        <label style="margin:0">
          Select
          <select style="margin-top:0.2rem">
            <option>Option A</option>
            <option>Option B</option>
          </select>
        </label>
      </div>
      <label style="margin-top:0.5rem;margin-bottom:0;display:block">
        Textarea
        <textarea rows={2} placeholder="Some text…" style="margin-top:0.2rem" />
      </label>

      {/* Code block */}
      <KsSectionLabel>Code</KsSectionLabel>
      <pre style="margin:0">{`function greet(name: string) {
  return \`Hello, \${name}!\`;
}`}</pre>

      {/* Tags */}
      <KsSectionLabel>Tags</KsSectionLabel>
      <div class="tag-cloud">
        <a href="#" class="tag">design</a>
        <a href="#" class="tag tag--active">active</a>
        <a href="#" class="tag">writing</a>
        <a href="#" class="tag">code</a>
      </div>

      {/* Post list */}
      <KsSectionLabel>Post list</KsSectionLabel>
      <ul class="post-list">
        <li>
          <span class="post-date">12 Jan 2025</span>
          <span class="post-title"><a href="#">On the art of slow writing</a></span>
        </li>
        <li>
          <span class="post-date">3 Dec 2024</span>
          <span class="post-title"><a href="#">A field guide to digital sovereignty</a></span>
        </li>
      </ul>

      {/* Note */}
      <KsSectionLabel>Note stream</KsSectionLabel>
      <ul class="note-stream">
        <li>
          <div class="note-meta">2 hours ago</div>
          <div class="note-body"><p>A micro post. Short, direct, unadorned. The web at human pace.</p></div>
        </li>
      </ul>

      {/* Table */}
      <KsSectionLabel>Table</KsSectionLabel>
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          <tr><td>On slowness</td><td>Published</td><td>Jan 2025</td></tr>
          <tr><td>Draft notes</td><td>Draft</td><td>—</td></tr>
        </tbody>
      </table>

      {/* Pagination */}
      <KsSectionLabel>Pagination</KsSectionLabel>
      <nav class="pagination">
        <span class="pagination-disabled">← Newer</span>
        <span class="pagination-info">Page 1 of 4</span>
        <a href="#">Older →</a>
      </nav>

    </div>
  );
}

export function renderThemeSettings(db: Database): JSX.Element {
  const themeRow = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const currentTheme = (themeRow?.value ?? 'literary') as ThemeName;
  const custom = readThemeCustom(db);
  const defaults = PRESET_DEFAULTS[currentTheme] ?? PRESET_DEFAULTS.literary;

  const eff = {
    colorScheme: custom?.colorScheme ?? defaults.colorScheme,
    fontBody:    custom?.fontBody    ?? defaults.fontBody,
    fontHeading: custom?.fontHeading ?? defaults.fontHeading,
    fontMono:    custom?.fontMono    ?? defaults.fontMono,
    colorAccent: custom?.colorAccent ?? defaults.colorAccent,
    colorBg:     custom?.colorBg     ?? defaults.colorBg,
    colorText:   custom?.colorText   ?? defaults.colorText,
    colorMuted:  custom?.colorMuted  ?? defaults.colorMuted,
  };

  const themeScript = `
(function() {
  const PRESETS = ${JSON.stringify(PRESET_DEFAULTS)};

  const VAR_MAP = {
    colorAccent: '--g-accent',
    colorBg:     '--g-bg',
    colorText:   '--g-text',
    colorMuted:  '--g-text-muted',
    fontBody:    '--g-font-body',
    fontMono:    '--g-font-mono',
  };

  function applyLivePreview() {
    const form = document.getElementById('theme-form');
    if (!form) return;
    const root = document.documentElement;

    for (const [name, cssVar] of Object.entries(VAR_MAP)) {
      const el = form.elements[name];
      if (el && el.value) root.style.setProperty(cssVar, el.value);
    }

    const headingFont = form.elements['fontHeading'] && form.elements['fontHeading'].value;
    let hs = document.getElementById('grip-heading-live');
    if (!hs) {
      hs = document.createElement('style');
      hs.id = 'grip-heading-live';
      document.head.appendChild(hs);
    }
    hs.textContent = headingFont
      ? 'h1,h2,h3,h4,h5,h6 { font-family: ' + headingFont + ' !important; }'
      : '';

    const scheme = form.querySelector('[name=colorScheme]:checked');
    root.setAttribute('data-theme', scheme && scheme.value === 'dark' ? 'dark' : 'light');
  }

  window.applyPreset = function(name) {
    const p = PRESETS[name];
    if (!p) return;
    const form = document.getElementById('theme-form');
    document.getElementById('theme-hidden').value = name;
    form.elements['fontBody'].value    = p.fontBody;
    form.elements['fontHeading'].value = p.fontHeading;
    form.elements['fontMono'].value    = p.fontMono;
    form.elements['colorAccent'].value = p.colorAccent;
    form.elements['colorBg'].value     = p.colorBg;
    form.elements['colorText'].value   = p.colorText;
    form.elements['colorMuted'].value  = p.colorMuted;
    const radio = form.querySelector('[name=colorScheme][value="' + p.colorScheme + '"]');
    if (radio) radio.checked = true;
    applyLivePreview();
  };

  document.getElementById('theme-form').addEventListener('input', applyLivePreview);
  document.getElementById('theme-form').addEventListener('change', applyLivePreview);
  applyLivePreview();
})();
`;

  const colorInput = (name: string, label: string, value: string) => (
    <label style="margin-bottom:0.5rem">
      <span style="font-size:0.72rem;opacity:0.65;font-weight:normal">{label}</span>
      <input type="color" name={name} value={value} style="margin-top:0.2rem" />
    </label>
  );

  const panelLabel = (text: string) => (
    <p style="font-size:0.58rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--g-text-muted);opacity:0.5;margin:1.25rem 0 0.55rem">{text}</p>
  );

  const content = (
    <div>
      <div class="page-hd" style="margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <a href="/settings" class="outline secondary" role="button">← Back</a>
          <h2 style="margin:0">Theme</h2>
        </div>
        <button type="submit" form="theme-form">Save theme</button>
      </div>

      <div style="display:grid;grid-template-columns:240px 1fr;gap:2rem;align-items:start">

        {/* ── Left: controls ── */}
        <form id="theme-form" method="POST" action="/settings/theme"
          style="position:sticky;top:1rem">
          <input type="hidden" name="theme" id="theme-hidden" value={currentTheme} />

          {panelLabel('Preset')}
          <div style="display:flex;flex-wrap:wrap;gap:0.3rem">
            {ALL_PRESETS.map(p => (
              <button type="button"
                class={`outline${currentTheme === p.name ? '' : ' secondary'}`}
                style="padding:0.18rem 0.6rem;font-size:0.73rem"
                onclick={`applyPreset("${p.name}")`}>
                {p.label}
              </button>
            ))}
          </div>

          {panelLabel('Color scheme')}
          <div style="display:flex;gap:1rem">
            <label style="display:flex;align-items:center;gap:0.35rem;font-weight:normal;font-size:0.8rem;margin:0">
              <input type="radio" name="colorScheme" value="light"
                checked={eff.colorScheme === 'light'} style="margin:0;width:auto" /> Light
            </label>
            <label style="display:flex;align-items:center;gap:0.35rem;font-weight:normal;font-size:0.8rem;margin:0">
              <input type="radio" name="colorScheme" value="dark"
                checked={eff.colorScheme === 'dark'} style="margin:0;width:auto" /> Dark
            </label>
          </div>

          {panelLabel('Colours')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">
            {colorInput('colorAccent', 'Accent',     eff.colorAccent)}
            {colorInput('colorBg',     'Background', eff.colorBg)}
            {colorInput('colorText',   'Text',       eff.colorText)}
            {colorInput('colorMuted',  'Muted',      eff.colorMuted)}
          </div>

          {panelLabel('Typography')}
          <label style="margin-bottom:0.5rem">
            Body
            <select name="fontBody">
              <FontOptions options={[
                ['system-ui, sans-serif',                                        'System sans-serif'],
                ["Georgia, 'Times New Roman', serif",                            'Georgia'],
                ["Palatino, 'Palatino Linotype', 'Book Antiqua', serif",         'Palatino'],
                ["Optima, Candara, 'Noto Sans', sans-serif",                     'Optima'],
                ["'Courier New', Courier, monospace",                            'Courier New'],
              ]} current={eff.fontBody} />
            </select>
          </label>
          <label style="margin-bottom:0.5rem">
            Headings
            <select name="fontHeading">
              <FontOptions options={[
                ['',                                                              'Same as body'],
                ['system-ui, sans-serif',                                        'System sans-serif'],
                ["Georgia, 'Times New Roman', serif",                            'Georgia'],
                ["Palatino, 'Palatino Linotype', 'Book Antiqua', serif",         'Palatino'],
                ["Optima, Candara, 'Noto Sans', sans-serif",                     'Optima'],
              ]} current={eff.fontHeading} />
            </select>
          </label>
          <label style="margin-bottom:1rem">
            Code font
            <select name="fontMono">
              <FontOptions options={[
                ["ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",  'System mono'],
                ["'Courier New', Courier, monospace",                            'Courier New'],
                ["'Fira Code', 'Fira Mono', 'DejaVu Sans Mono', monospace",      'Fira Code'],
              ]} current={eff.fontMono} />
            </select>
          </label>

          <button type="submit" style="width:100%">Save theme</button>
        </form>

        {/* ── Right: kitchen sink ── */}
        <div style="border:1px solid var(--g-border);border-radius:6px;padding:1.5rem;min-height:60vh;overflow:auto">
          <KitchenSink />
        </div>

      </div>

      <script>{themeScript}</script>
    </div>
  );

  return authorLayout('Theme', content, db);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

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
  commitEvent(db, store, event);
}

export function handleThemeChange(
  db: Database,
  _store: EventStore,
  body: {
    theme?: string;
    colorScheme?: string;
    fontBody?: string; fontHeading?: string; fontMono?: string;
    colorAccent?: string; colorBg?: string; colorText?: string; colorMuted?: string;
  }
): void {
  const validThemes: ThemeName[] = ['literary', 'ink', 'coder', 'cyberpunk'];
  const theme = validThemes.includes(body.theme as ThemeName) ? (body.theme as ThemeName) : 'literary';
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('theme', theme);

  const custom: ThemeCustom = {};
  if (body.colorScheme === 'light' || body.colorScheme === 'dark') custom.colorScheme = body.colorScheme;
  if (body.fontBody?.trim())    custom.fontBody    = body.fontBody.trim();
  if (body.fontHeading?.trim()) custom.fontHeading = body.fontHeading.trim();
  if (body.fontMono?.trim())    custom.fontMono    = body.fontMono.trim();
  if (isHexColor(body.colorAccent)) custom.colorAccent = body.colorAccent!;
  if (isHexColor(body.colorBg))     custom.colorBg     = body.colorBg!;
  if (isHexColor(body.colorText))   custom.colorText   = body.colorText!;
  if (isHexColor(body.colorMuted))  custom.colorMuted  = body.colorMuted!;

  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
    .run('theme_custom', JSON.stringify(custom));
}

function isHexColor(s: string | undefined): boolean {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}
