import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { authorLayout } from './layout';
import {
  type ThemeName, type ThemeCustom,
  PRESET_DEFAULTS, readThemeCustom,
} from '../../../core/themes';

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

export function renderSettings(db: Database): JSX.Element {
  const config = getConfig(db);

  const content = (
    <div>
      <h2>Settings</h2>

      <section>
        <h3>Site identity</h3>
        <form method="POST" action="/settings/site">
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
            Domain <small style="font-weight:normal">(used in RSS feed URLs)</small>
            <input type="text" name="domain" value={config.domain} placeholder="example.com" />
          </label>
          <button type="submit">Save site settings</button>
        </form>
      </section>

      <section style="margin-top:2rem">
        <h3>Theme</h3>
        <p style="color:var(--pico-muted-color)">Customize fonts, colors, and visual style.</p>
        <a href="/settings/theme" role="button" class="outline">Customize theme →</a>
      </section>
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

  const presetMeta: { name: ThemeName; label: string }[] = [
    { name: 'coder',     label: 'Coder'     },
    { name: 'light',     label: 'Light'     },
    { name: 'dark',      label: 'Dark'      },
    { name: 'literary',  label: 'Literary'  },
    { name: 'ink',       label: 'Ink'       },
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

  const content = (
    <div>
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem">
        <a href="/settings" role="button" class="outline secondary"
          style="padding:0.3rem 0.8rem;font-size:0.875rem">← Settings</a>
        <h2 style="margin:0">Theme</h2>
      </div>

      <section style="margin-bottom:1.5rem">
        <h4 style="margin-bottom:0.75rem">Presets</h4>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          {presetMeta.map(p => (
            <button type="button"
              class={`outline${currentTheme === p.name ? '' : ' secondary'}`}
              style="padding:0.35rem 1rem"
              onclick={`applyPreset('${p.name}')`}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <form id="theme-form" method="POST" action="/settings/theme">
        <input type="hidden" name="theme" id="theme-hidden" value={currentTheme} />

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;align-items:start">

          <section>
            <h4>Typography</h4>

            <label>
              Body font
              <select name="fontBody">
                <FontOptions options={[
                  ['system-ui, sans-serif',                                         'System sans-serif'],
                  ["Georgia, 'Times New Roman', serif",                             'Georgia'],
                  ["Palatino, 'Palatino Linotype', 'Book Antiqua', serif",          'Palatino'],
                  ["Optima, Candara, 'Noto Sans', sans-serif",                      'Optima / Candara'],
                  ["'Courier New', Courier, monospace",                             'Courier New'],
                ]} current={eff.fontBody} />
              </select>
            </label>

            <label>
              Heading font
              <small style="font-weight:normal;color:var(--pico-muted-color)"> — empty = same as body</small>
              <select name="fontHeading">
                <FontOptions options={[
                  ['',                                                               'Same as body'],
                  ['system-ui, sans-serif',                                         'System sans-serif'],
                  ["Georgia, 'Times New Roman', serif",                             'Georgia'],
                  ["Palatino, 'Palatino Linotype', 'Book Antiqua', serif",          'Palatino'],
                  ["Optima, Candara, 'Noto Sans', sans-serif",                      'Optima / Candara'],
                ]} current={eff.fontHeading} />
              </select>
            </label>

            <label>
              Code font
              <select name="fontMono">
                <FontOptions options={[
                  ["ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",   'System monospace'],
                  ["'Courier New', Courier, monospace",                             'Courier New'],
                  ["'Fira Code', 'Fira Mono', 'DejaVu Sans Mono', monospace",       'Fira Code'],
                ]} current={eff.fontMono} />
              </select>
            </label>
          </section>

          <section>
            <h4>Colours</h4>

            <label style="margin-bottom:1.25rem">
              Mode
              <div style="display:flex;gap:1.5rem;margin-top:0.4rem">
                <label style="display:flex;align-items:center;gap:0.4rem;font-weight:normal;margin:0">
                  <input type="radio" name="colorScheme" value="light"
                    checked={eff.colorScheme === 'light'} style="margin:0" />
                  Light
                </label>
                <label style="display:flex;align-items:center;gap:0.4rem;font-weight:normal;margin:0">
                  <input type="radio" name="colorScheme" value="dark"
                    checked={eff.colorScheme === 'dark'} style="margin:0" />
                  Dark
                </label>
              </div>
            </label>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <label>
                Accent
                <input type="color" name="colorAccent" value={eff.colorAccent}
                  style="width:100%;height:2.75rem;padding:0.2rem;cursor:pointer;border-radius:var(--pico-border-radius)" />
              </label>
              <label>
                Background
                <input type="color" name="colorBg" value={eff.colorBg}
                  style="width:100%;height:2.75rem;padding:0.2rem;cursor:pointer;border-radius:var(--pico-border-radius)" />
              </label>
              <label>
                Text
                <input type="color" name="colorText" value={eff.colorText}
                  style="width:100%;height:2.75rem;padding:0.2rem;cursor:pointer;border-radius:var(--pico-border-radius)" />
              </label>
              <label>
                Muted
                <input type="color" name="colorMuted" value={eff.colorMuted}
                  style="width:100%;height:2.75rem;padding:0.2rem;cursor:pointer;border-radius:var(--pico-border-radius)" />
              </label>
            </div>
          </section>

        </div>

        <section style="margin-top:2rem">
          <h4>Preview</h4>
          <div style="padding:2rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius)">
            <h1 style="margin-top:0">The quick brown fox</h1>
            <h2>A secondary heading</h2>
            <p>Body text with a <a href="#">hyperlink</a>, some <strong>bold</strong>
            {' '}and <em>italic</em> words. The quick brown fox jumps over the lazy dog.</p>
            <p><code>const grip = "sovereign";</code> — monospaced text</p>
            <p><small style="color:var(--pico-muted-color)">A muted footnote or caption.</small></p>
            <button type="button" style="margin:0">Primary button</button>
          </div>
        </section>

        <div style="margin-top:1.5rem">
          <button type="submit">Save theme</button>
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
  store.append(event);
  applyEvent(db, event, Date.now());
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
  const validThemes: ThemeName[] = ['light', 'dark', 'coder', 'cyberpunk', 'literary', 'ink'];
  const theme = validThemes.includes(body.theme as ThemeName) ? (body.theme as ThemeName) : 'light';
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
