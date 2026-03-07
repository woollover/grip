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

  const apSection = ap ? (
    <section>
      <div class="page-hd" style="margin-bottom:0.5rem">
        <h3 style="display:flex;align-items:center;gap:0.5rem">
          ActivityPub
          <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--pico-primary);border:1px solid var(--pico-primary);border-radius:3px;padding:0.1rem 0.4rem">Active</span>
        </h3>
        <a href="/contacts" role="button" class="outline secondary">Contacts →</a>
      </div>
      <p style="color:var(--pico-muted-color);font-size:0.78rem;margin:0 0 0.4rem">
        Federated as <strong safe>{`@${ap.username}@${ap.domain}`}</strong> · {ap.contacts} contact{ap.contacts !== 1 ? 's' : ''}
      </p>
      <p style="color:var(--pico-muted-color);font-size:0.78rem;margin:0">
        Managed via <code>grip.toml</code> — restart required to change settings.
      </p>
    </section>
  ) : (
    <section>
      <div class="page-hd" style="margin-bottom:0.5rem">
        <h3>ActivityPub</h3>
      </div>
      <p style="color:var(--pico-muted-color);font-size:0.78rem;margin:0 0 0.75rem">
        Federate with Mastodon and the wider Fediverse. People can follow your notes from any ActivityPub server.
      </p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">To enable, add to <code>grip.toml</code> and restart:</p>
      <pre style="font-size:0.75rem;margin:0;padding:0.65rem 0.85rem;border-radius:4px;background:var(--pico-code-background)">{`[activitypub]
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
            <p style="color:var(--pico-muted-color);font-size:0.78rem;margin:0">Fonts, colours, and visual style.</p>
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
            <p style="color:var(--pico-muted-color);font-size:0.78rem;margin:0 0 0.5rem">
              Current version: <code safe>v{currentVersion}</code>
            </p>
            <p id="update-result" style="font-size:0.78rem;margin:0;color:var(--pico-muted-color)"></p>
          </section>

        </div>
      </div>
    </div>
  );

  return authorLayout('Settings', content, db);
}

// ── Theme editor ──────────────────────────────────────────────────────────────

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

export function renderThemeSettings(db: Database): JSX.Element {
  const themeRow = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const currentTheme = (themeRow?.value ?? 'light') as ThemeName;
  const custom = readThemeCustom(db);
  const defaults = PRESET_DEFAULTS[currentTheme] ?? PRESET_DEFAULTS.light;

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

  const lightPresets: { name: ThemeName; label: string }[] = [
    { name: 'literary',  label: 'Literary'  },
    { name: 'ink',       label: 'Ink'       },
  ];
  const darkPresets: { name: ThemeName; label: string }[] = [
    { name: 'coder',     label: 'Coder'     },
    { name: 'cyberpunk', label: 'Cyberpunk' },
  ];

  const themeScript = `
(function() {
  const PRESETS = ${JSON.stringify(PRESET_DEFAULTS)};

  const VAR_MAP = {
    fontBody:    '--pico-font-family',
    fontMono:    '--pico-font-family-monospace',
    colorAccent: '--pico-primary',
    colorBg:     '--pico-background-color',
    colorText:   '--pico-color',
    colorMuted:  '--pico-muted-color',
  };

  function applyLivePreview() {
    const form = document.getElementById('theme-form');
    const root = document.documentElement;

    for (const [name, cssVar] of Object.entries(VAR_MAP)) {
      const val = form.elements[name] && form.elements[name].value;
      if (val) root.style.setProperty(cssVar, val);
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

  const form = document.getElementById('theme-form');
  form.addEventListener('input', applyLivePreview);
  form.addEventListener('change', applyLivePreview);
  applyLivePreview();
})();
`;

  const colorInput = (name: string, label: string, value: string) => (
    <label style="margin-bottom:0">
      <span style="font-size:0.72rem;opacity:0.7">{label}</span>
      <input type="color" name={name} value={value}
        style="width:100%;height:1.9rem;padding:0.1rem 0.2rem;cursor:pointer;border-radius:3px;margin-top:0.2rem" />
    </label>
  );

  const content = (
    <div style="max-width:860px;margin:0 auto">
      <div class="page-hd" style="margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <a href="/settings" class="outline secondary" role="button">← Back</a>
          <h2 style="margin:0">Theme</h2>
        </div>
        <button type="submit" form="theme-form">Save theme</button>
      </div>

      <section style="margin-bottom:1rem;display:flex;gap:1.5rem;align-items:flex-start">
        <div>
          <p style="font-size:0.65rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.5;margin-bottom:0.4rem">Light</p>
          <div style="display:flex;gap:0.3rem">
            {lightPresets.map(p => (
              <button type="button"
                class={`outline${currentTheme === p.name ? '' : ' secondary'}`}
                style="padding:0.2rem 0.65rem;font-size:0.75rem"
                onclick={`applyPreset('${p.name}')`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style="font-size:0.65rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.5;margin-bottom:0.4rem">Dark</p>
          <div style="display:flex;gap:0.3rem">
            {darkPresets.map(p => (
              <button type="button"
                class={`outline${currentTheme === p.name ? '' : ' secondary'}`}
                style="padding:0.2rem 0.65rem;font-size:0.75rem"
                onclick={`applyPreset('${p.name}')`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <form id="theme-form" method="POST" action="/settings/theme">
        <input type="hidden" name="theme" id="theme-hidden" value={currentTheme} />

        <div style="display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:1.5rem;align-items:start">

          <section style="margin:0">
            <p style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;margin-bottom:0.6rem">Typography</p>
            <label style="margin-bottom:0.6rem">
              Body
              <select name="fontBody" style="margin-top:0.2rem">
                <FontOptions options={[
                  ['system-ui, sans-serif',                                        'System sans-serif'],
                  ["Georgia, 'Times New Roman', serif",                            'Georgia'],
                  ["Palatino, 'Palatino Linotype', 'Book Antiqua', serif",         'Palatino'],
                  ["Optima, Candara, 'Noto Sans', sans-serif",                     'Optima'],
                  ["'Courier New', Courier, monospace",                            'Courier New'],
                ]} current={eff.fontBody} />
              </select>
            </label>
            <label style="margin-bottom:0.6rem">
              Headings
              <select name="fontHeading" style="margin-top:0.2rem">
                <FontOptions options={[
                  ['',                                                              'Same as body'],
                  ['system-ui, sans-serif',                                        'System sans-serif'],
                  ["Georgia, 'Times New Roman', serif",                            'Georgia'],
                  ["Palatino, 'Palatino Linotype', 'Book Antiqua', serif",         'Palatino'],
                  ["Optima, Candara, 'Noto Sans', sans-serif",                     'Optima'],
                ]} current={eff.fontHeading} />
              </select>
            </label>
            <label style="margin-bottom:0">
              Code
              <select name="fontMono" style="margin-top:0.2rem">
                <FontOptions options={[
                  ["ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",  'System mono'],
                  ["'Courier New', Courier, monospace",                            'Courier New'],
                  ["'Fira Code', 'Fira Mono', 'DejaVu Sans Mono', monospace",      'Fira Code'],
                ]} current={eff.fontMono} />
              </select>
            </label>
          </section>

          <section style="margin:0">
            <p style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;margin-bottom:0.6rem">Colours</p>
            <div style="display:flex;gap:1rem;margin-bottom:0.75rem">
              <label style="display:flex;align-items:center;gap:0.35rem;font-weight:normal;font-size:0.8rem;margin:0">
                <input type="radio" name="colorScheme" value="light"
                  checked={eff.colorScheme === 'light'} style="margin:0" /> Light
              </label>
              <label style="display:flex;align-items:center;gap:0.35rem;font-weight:normal;font-size:0.8rem;margin:0">
                <input type="radio" name="colorScheme" value="dark"
                  checked={eff.colorScheme === 'dark'} style="margin:0" /> Dark
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
              {colorInput('colorAccent', 'Accent', eff.colorAccent)}
              {colorInput('colorBg', 'Background', eff.colorBg)}
              {colorInput('colorText', 'Text', eff.colorText)}
              {colorInput('colorMuted', 'Muted', eff.colorMuted)}
            </div>
          </section>

          <section style="margin:0">
            <p style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;margin-bottom:0.5rem">Preview</p>
            <div style="padding:1rem 1.25rem;border:1px solid var(--pico-border-color);border-radius:4px;font-size:0.85rem;height:100%">
              <p style="font-size:1.1rem;font-weight:700;margin-bottom:0.35rem">The quick brown fox</p>
              <p style="margin-bottom:0.35rem">Body text with a <a href="#">hyperlink</a>, <strong>bold</strong> and <em>italic</em>.</p>
              <p style="margin-bottom:0.35rem"><code>const grip = "sovereign";</code></p>
              <p style="color:var(--pico-muted-color);font-size:0.8rem;margin-bottom:0.5rem">A muted caption.</p>
              <button type="button" style="margin:0;padding:0.2rem 0.65rem;font-size:0.78rem">Button</button>
            </div>
          </section>

        </div>

      </form>

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
  const validThemes: ThemeName[] = ['literary', 'ink', 'coder', 'cyberpunk', 'light', 'dark'];
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
