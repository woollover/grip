import type { Database } from "bun:sqlite";
import type { EventStore } from "../../../core/events";
import { commitEvent } from "../../../core/projections";
import { authorLayout } from "./layout";
import {
  type ThemeName,
  type ThemeCustom,
  PRESET_DEFAULTS,
  readThemeCustom,
} from "../../../core/themes";
import { version as currentVersion } from "../../../../package.json";

function getConfig(db: Database): {
  title: string;
  description: string;
  domain: string;
  homeIntro: string;
} {
  const get = (key: string, fallback: string) => {
    const row = db
      .prepare("SELECT value FROM config WHERE key = ?")
      .get(key) as { value: string } | null;
    return row?.value ?? fallback;
  };
  return {
    title: get("site_title", "My GRIP"),
    description: get("site_description", ""),
    domain: get("domain", "localhost"),
    homeIntro: get("home_intro", ""),
  };
}

function getPublicitySettings(db: Database) {
  const get = (key: string, fallback: string) =>
    (
      db.prepare("SELECT value FROM config WHERE key = ?").get(key) as {
        value: string;
      } | null
    )?.value ?? fallback;
  return {
    mode: get("publicity_mode", "public") as "public" | "private",
    showArticles: get("show_articles", "1") === "1",
    showMicro: get("show_micro", "1") === "1",
    rssEnabled: get("rss_enabled", "1") === "1",
  };
}

export function handlePublicityUpdate(db: Database, body: any): void {
  const mode = body.publicity_mode === "private" ? "private" : "public";
  const showArticles = body.show_articles === "1" ? "1" : "0";
  const showMicro = body.show_micro === "1" ? "1" : "0";
  const rssEnabled = body.rss_enabled === "1" ? "1" : "0";
  const set = (k: string, v: string) =>
    db
      .prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
      .run(k, v);
  set("publicity_mode", mode);
  set("show_articles", showArticles);
  set("show_micro", showMicro);
  set("rss_enabled", rssEnabled);
}

function getApStatus(db: Database): {
  enabled: boolean;
  username: string;
  domain: string;
  contacts: number;
} | null {
  const enabled = (
    db.prepare("SELECT value FROM config WHERE key = 'ap_enabled'").get() as {
      value: string;
    } | null
  )?.value;
  if (!enabled) return null;
  const username =
    (
      db
        .prepare("SELECT value FROM config WHERE key = 'ap_username'")
        .get() as { value: string } | null
    )?.value ?? "";
  const domain =
    (
      db.prepare("SELECT value FROM config WHERE key = ?").get("domain") as {
        value: string;
      } | null
    )?.value ?? "";
  const { cnt } = db
    .prepare("SELECT COUNT(*) as cnt FROM ap_followers")
    .get() as { cnt: number };
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
          <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--g-accent);border:1px solid var(--g-accent);border-radius:3px;padding:0.1rem 0.4rem">
            Active
          </span>
        </h3>
        <a href="/contacts" class="btn btn-ghost btn-sm">Contacts →</a>
      </div>
      <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0 0 0.4rem">
        Federated as <strong safe>{`@${ap.username}@${ap.domain}`}</strong> ·{" "}
        {ap.contacts} contact{ap.contacts !== 1 ? "s" : ""}
      </p>
      <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0">
        Managed via <code>grip.toml</code> — restart required to change
        settings.
      </p>
    </section>
  ) : (
    <section>
      <div class="page-hd" style="margin-bottom:0.5rem">
        <h3>ActivityPub</h3>
      </div>
      <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0 0 0.75rem">
        Federate with Mastodon and the wider Fediverse. People can follow your
        notes from any ActivityPub server.
      </p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">
        To enable, add to <code>grip.toml</code> and restart:
      </p>
      <pre style="font-size:0.75rem;margin:0;padding:0.65rem 0.85rem;border-radius:4px;background:var(--g-code-bg)">{`[activitypub]
enabled        = true
username       = "you"
accept_replies = true`}</pre>
    </section>
  );

  const content = (
    <div>
      <div class="page-hd">
        <h2>Settings</h2>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start">
        {/* Left — Site identity */}
        <section>
          <form method="POST" action="/settings/site">
            <div class="page-hd" style="margin-bottom:1rem">
              <h3>Site identity</h3>
              <button type="submit" class="btn btn-outline btn-sm">Save</button>
            </div>
            <label>
              Site title
              <input type="text" name="title" value={config.title} required />
            </label>
            <label>
              Description
              <input
                type="text"
                name="description"
                value={config.description}
                placeholder="A short description of your site"
              />
            </label>
            <label>
              Domain{" "}
              <small style="font-weight:normal;opacity:0.7">
                {" "}
                — used in RSS and ActivityPub URLs
              </small>
              <input
                type="text"
                name="domain"
                value={config.domain}
                placeholder="example.com"
              />
            </label>
            <label>
              Home page intro{" "}
              <small style="font-weight:normal;opacity:0.7">— shown above content on the home page</small>
              <textarea
                name="homeIntro"
                rows="3"
                placeholder="A sentence or two about yourself or this space…"
              >{config.homeIntro}</textarea>
            </label>
          </form>
        </section>

        {/* Right — Theme, ActivityPub, Updates */}
        <div style="display:flex;flex-direction:column;gap:1.5rem">
          <section>
            <div class="page-hd">
              <h3>Theme</h3>
              <a href="/settings/theme" class="btn btn-ghost btn-sm">Customize →</a>
            </div>
            <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0">
              Fonts, colours, and visual style.
            </p>
          </section>

          <hr style="margin:0" />

          <section>
            <form method="POST" action="/settings/publicity">
              <div class="page-hd" style="margin-bottom:0.75rem">
                <h3>Publicity</h3>
                <button type="submit" class="btn btn-outline btn-sm">Save</button>
              </div>
              <label>
                Visibility
                <select name="publicity_mode">
                  <option value="public" selected={pub.mode === "public"}>
                    Public
                  </option>
                  <option value="private" selected={pub.mode === "private"}>
                    Private
                  </option>
                </select>
              </label>
              <p style="font-size:0.73rem;color:var(--g-text-muted);margin:-0.25rem 0 0.85rem">
                {pub.mode === "private"
                  ? "Only published pages are visible to visitors."
                  : "Choose what content to expose publicly."}
              </p>
              <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-bottom:0.4rem">
                <input
                  type="checkbox"
                  name="show_articles"
                  value="1"
                  checked={pub.showArticles}
                  disabled={pub.mode === "private"}
                />
                Show articles
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-bottom:0.4rem">
                <input
                  type="checkbox"
                  name="show_micro"
                  value="1"
                  checked={pub.showMicro}
                  disabled={pub.mode === "private"}
                />
                Show micro posts
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal">
                <input
                  type="checkbox"
                  name="rss_enabled"
                  value="1"
                  checked={pub.rssEnabled}
                  disabled={pub.mode === "private"}
                />
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
                class="btn btn-ghost btn-sm"
                hx-get="/update-check"
                hx-target="#update-result"
                hx-swap="innerHTML"
                hx-indicator="#update-result"
              >
                Check
              </button>
            </div>
            <p style="color:var(--g-text-muted);font-size:0.78rem;margin:0 0 0.5rem">
              Current version: <code safe>v{currentVersion}</code>
            </p>
            <p
              id="update-result"
              style="font-size:0.78rem;margin:0;color:var(--g-text-muted)"
            ></p>
          </section>
        </div>
      </div>
    </div>
  );

  return authorLayout("Settings", content, db, '/settings');
}

// ── Theme editor ──────────────────────────────────────────────────────────────

const ALL_PRESETS: { name: ThemeName; label: string; desc: string }[] = [
  { name: "terracotta", label: "Terracotta", desc: "Earthy, warm, personal" },
  { name: "obsidian",   label: "Obsidian",   desc: "Deep, focused, night-writing" },
  { name: "studio",     label: "Studio",     desc: "Creative, confident, spacious" },
  { name: "paper",      label: "Paper",      desc: "Disappear into the text" },
  { name: "terminal",   label: "Terminal",   desc: "Developer aesthetic, compact" },
  { name: "neon",       label: "Neon",       desc: "Electric, synthetic, high contrast" },
];

function FontOptions({
  options,
  current,
}: {
  options: [value: string, label: string][];
  current: string;
}): JSX.Element {
  return (
    <>
      {options.map(([value, label]) => (
        <option value={value} selected={value === current}>
          {label}
        </option>
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
      <h3 style="margin-bottom:0.2rem">
        Heading 3 — Pack my box with five dozen
      </h3>
      <h4 style="margin-bottom:0.75rem">Heading 4 — How vexingly quick</h4>
      <p>
        Body text. A paragraph with <a href="#">a hyperlink</a>,{" "}
        <strong>bold text</strong>, <em>italic text</em>, and{" "}
        <code>inline code</code>. Muted text below.
      </p>
      <p style="color:var(--g-text-muted);font-size:0.8rem">
        A muted caption or secondary line of text.
      </p>
      <blockquote style="margin:0.75rem 0">
        A blockquote. The sovereign web belongs to those who tend it.
      </blockquote>

      {/* Buttons */}
      <KsSectionLabel>Buttons</KsSectionLabel>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
        <button type="button">Primary</button>
        <button type="button" class="outline">
          Outline
        </button>
        <button type="button" class="outline secondary">
          Secondary
        </button>
        <button type="button" disabled>
          Disabled
        </button>
      </div>

      {/* Forms */}
      <KsSectionLabel>Forms</KsSectionLabel>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
        <label style="margin:0">
          Text input
          <input
            type="text"
            placeholder="Placeholder…"
            style="margin-top:0.2rem"
          />
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
        <textarea rows="2" placeholder="Some text…" style="margin-top:0.2rem" />
      </label>

      {/* Code block */}
      <KsSectionLabel>Code</KsSectionLabel>
      <pre style="margin:0;border-radius:var(--g-r-input)">{`function greet(name: string) {
  return \`Hello, \${name}!\`;
}`}</pre>

      {/* Tags */}
      <KsSectionLabel>Tags</KsSectionLabel>
      <div class="tag-cloud">
        <a href="#" class="tag">
          design
        </a>
        <a href="#" class="tag tag--active">
          active
        </a>
        <a href="#" class="tag">
          writing
        </a>
        <a href="#" class="tag">
          code
        </a>
      </div>

      {/* Post list */}
      <KsSectionLabel>Post list</KsSectionLabel>
      <ul class="post-list">
        <li>
          <span class="post-date">12 Jan 2025</span>
          <span class="post-title">
            <a href="#">On the art of slow writing</a>
          </span>
        </li>
        <li>
          <span class="post-date">3 Dec 2024</span>
          <span class="post-title">
            <a href="#">A field guide to digital sovereignty</a>
          </span>
        </li>
      </ul>

      {/* Note */}
      <KsSectionLabel>Note stream</KsSectionLabel>
      <ul class="note-stream">
        <li>
          <div class="note-meta">2 hours ago</div>
          <div class="note-body">
            <p>
              A micro post. Short, direct, unadorned. The web at human pace.
            </p>
          </div>
        </li>
      </ul>

      {/* Table */}
      <KsSectionLabel>Table</KsSectionLabel>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>On slowness</td>
            <td>Published</td>
            <td>Jan 2025</td>
          </tr>
          <tr>
            <td>Draft notes</td>
            <td>Draft</td>
            <td>—</td>
          </tr>
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
  const themeRow = db
    .prepare("SELECT value FROM config WHERE key = ?")
    .get("theme") as { value: string } | null;
  const currentTheme = (themeRow?.value ?? "terracotta") as ThemeName;
  const custom = readThemeCustom(db);
  const defaults = PRESET_DEFAULTS[currentTheme] ?? PRESET_DEFAULTS.terracotta;

  const eff = {
    colorScheme: custom?.colorScheme ?? defaults.colorScheme,
    fontBody: custom?.fontBody ?? defaults.fontBody,
    fontHeading: custom?.fontHeading ?? defaults.fontHeading,
    fontMono: custom?.fontMono ?? defaults.fontMono,
    colorAccent: custom?.colorAccent ?? defaults.colorAccent,
    colorBg: custom?.colorBg ?? defaults.colorBg,
    colorText: custom?.colorText ?? defaults.colorText,
    colorMuted: custom?.colorMuted ?? defaults.colorMuted,
    radius: custom?.radius ?? defaults.radius,
    spacing: custom?.spacing ?? defaults.spacing,
  };

  const themeScript = `
(function() {
  const PRESETS = ${JSON.stringify(PRESET_DEFAULTS)};

  function getLuminance(hex) {
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function pickFg(hex) {
    const l = getLuminance(hex);
    return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#ffffff' : '#000000';
  }

  const VAR_MAP = {
    colorAccent: '--g-accent',
    colorBg:     '--g-bg',
    colorText:   '--g-text',
    colorMuted:  '--g-text-muted',
    fontBody:    '--g-font-body',
    fontMono:    '--g-font-mono',
  };

  const SPACING_MAP = {
    compact: { py: '0.28rem', px: '0.75rem' },
    default: { py: '0.45rem', px: '1rem'    },
    relaxed: { py: '0.65rem', px: '1.25rem' },
  };

  let currentScheme = '${eff.colorScheme}';

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

    // Radius
    const r = form.elements['radius']?.value;
    if (r) {
      const rNum = parseFloat(r);
      const unit = r.replace(/[\\d.]/g, '') || 'px';
      root.style.setProperty('--g-r',       r);
      root.style.setProperty('--g-r-sm',    Math.max(0, rNum / 2) + unit);
      root.style.setProperty('--g-r-lg',    (rNum * 2) + unit);
      root.style.setProperty('--g-r-input', Math.min(rNum, 10) + unit);
    }

    // Spacing / density
    const sp = form.elements['spacing']?.value;
    const spVals = SPACING_MAP[sp] ?? SPACING_MAP.default;
    root.style.setProperty('--g-pad-y', spVals.py);
    root.style.setProperty('--g-pad-x', spVals.px);

    // color-scheme
    const isDark = currentScheme === 'dark';
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Derived surface / border / accent vars (mirrors buildOverrideCss logic)
    const bg     = form.elements['colorBg']?.value;
    const accent = form.elements['colorAccent']?.value;
    const muted  = form.elements['colorMuted']?.value;
    const text   = form.elements['colorText']?.value;
    const mix    = isDark ? 'white' : 'black';
    if (bg) {
      root.style.setProperty('--g-surface',   \`color-mix(in srgb, \${bg} 85%, \${mix})\`);
      root.style.setProperty('--g-surface-2', \`color-mix(in srgb, \${bg} 75%, \${mix})\`);
      root.style.setProperty('--g-code-bg',   \`color-mix(in srgb, \${bg} 80%, \${mix})\`);
    }
    if (accent) {
      root.style.setProperty('--g-accent-hover',  \`color-mix(in srgb, \${accent} 80%, black)\`);
      root.style.setProperty('--g-accent-muted', \`color-mix(in srgb, \${accent} 12%, transparent)\`);
      root.style.setProperty('--g-accent-fg', pickFg(accent));
    }
    if (muted) {
      root.style.setProperty('--g-border',       \`color-mix(in srgb, \${muted} 40%, transparent)\`);
      root.style.setProperty('--g-border-faint', \`color-mix(in srgb, \${muted} 18%, transparent)\`);
    }
    if (text) {
      root.style.setProperty('--g-text-strong', text);
    }
  }

  window.applyPreset = function(name) {
    const p = PRESETS[name];
    if (!p) return;
    const form = document.getElementById('theme-form');
    document.getElementById('theme-hidden').value = name;
    currentScheme = p.colorScheme;
    form.elements['fontBody'].value    = p.fontBody;
    form.elements['fontHeading'].value = p.fontHeading;
    form.elements['fontMono'].value    = p.fontMono;
    form.elements['colorAccent'].value = p.colorAccent;
    form.elements['colorBg'].value     = p.colorBg;
    form.elements['colorText'].value   = p.colorText;
    form.elements['colorMuted'].value  = p.colorMuted;
    form.elements['radius'].value      = p.radius  ?? '6px';
    form.elements['spacing'].value     = p.spacing ?? 'default';
    applyLivePreview();
  };

  window.scramble = function() {
    const form = document.getElementById('theme-form');
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randHsl = (h, sl, ll) => {
      const hue = h ?? Math.floor(Math.random() * 360);
      const s   = sl ?? (40 + Math.floor(Math.random() * 50));
      const l   = ll ?? (20 + Math.floor(Math.random() * 60));
      return hslToHex(hue, s, l);
    };
    function hslToHex(h, s, l) {
      s /= 100; l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); return Math.round(255 * c).toString(16).padStart(2, '0'); };
      return '#' + f(0) + f(8) + f(4);
    }

    currentScheme = pick(['light', 'dark']);
    const isDark = currentScheme === 'dark';
    
    // Update the theme hidden input to match the chosen scheme
    document.getElementById('theme-hidden').value = currentScheme;
    
    const hue = Math.floor(Math.random() * 360);
    const bg  = isDark ? randHsl(hue, 15, 8 + Math.floor(Math.random() * 14))
                       : randHsl(hue, 10, 88 + Math.floor(Math.random() * 10));
    const accent = randHsl(hue, 55 + Math.floor(Math.random() * 35), isDark ? 55 + Math.floor(Math.random() * 25) : 30 + Math.floor(Math.random() * 25));
    const text   = isDark ? randHsl(hue, 8, 75 + Math.floor(Math.random() * 20))
                          : randHsl(hue, 8, 5  + Math.floor(Math.random() * 20));
    const muted  = isDark ? randHsl(hue, 12, 45 + Math.floor(Math.random() * 20))
                          : randHsl(hue, 12, 45 + Math.floor(Math.random() * 20));

    const fonts = ['var(--font-system-ui)','var(--font-sans)','var(--font-neo-grotesque)',
      'var(--font-humanist)','var(--font-geometric-humanist)','var(--font-classical-humanist)',
      'var(--font-rounded-sans)','var(--font-transitional)','var(--font-old-style)',
      'var(--font-serif)','var(--font-slab-serif)','var(--font-antique)',
      'var(--font-didone)','var(--font-handwritten)','var(--font-industrial)'];
    const radii   = ['0px','2px','4px','6px','10px','16px','999px'];
    const spacings = ['compact','default','relaxed'];

    form.elements['colorAccent'].value = accent;
    form.elements['colorBg'].value     = bg;
    form.elements['colorText'].value   = text;
    form.elements['colorMuted'].value  = muted;
    form.elements['fontBody'].value    = pick(fonts);
    form.elements['fontHeading'].value = Math.random() < 0.4 ? '' : pick(fonts);
    form.elements['fontMono'].value    = pick(['var(--font-mono)','var(--font-monospace-code)','var(--font-monospace-slab-serif)']);
    form.elements['radius'].value      = pick(radii);
    form.elements['spacing'].value     = pick(spacings);
    applyLivePreview();
  };

  function clearLivePreview() {
    const root = document.documentElement;
    for (const cssVar of Object.values(VAR_MAP)) {
      root.style.removeProperty(cssVar);
    }
    for (const v of ['--g-font-heading','--g-r','--g-r-sm','--g-r-lg','--g-r-input',
                      '--g-pad-y','--g-pad-x','--g-surface','--g-surface-2','--g-code-bg',
                      '--g-accent-fg','--g-accent-hover','--g-accent-muted',
                      '--g-border','--g-border-faint','--g-text-strong']) {
      root.style.removeProperty(v);
    }
    const hs = document.getElementById('grip-heading-live');
    if (hs) hs.remove();
  }

  // Clear preview on load so saved theme CSS takes precedence
  clearLivePreview();

  // Apply live preview only when user is actively changing things
  document.getElementById('theme-form').addEventListener('input', applyLivePreview);
  document.getElementById('theme-form').addEventListener('change', applyLivePreview);
  
  // Handle form submission to prevent UI glitch
  document.getElementById('theme-form').addEventListener('submit', function() {
    // Keep the live preview active during form submission to avoid visual glitch
    // The page will reload with the saved theme anyway
  });
})();
`;

  const colorInput = (name: string, label: string, value: string) => (
    <label style="margin-bottom:0.5rem">
      <span style="font-size:0.72rem;opacity:0.65;font-weight:normal">
        {label}
      </span>
      <input type="color" name={name} value={value} style="margin-top:0.2rem" />
    </label>
  );

  const panelLabel = (text: string) => (
    <p style="font-size:0.58rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--g-text-muted);opacity:0.5;margin:1.25rem 0 0.55rem">
      {text}
    </p>
  );

  const content = (
    <div>
      <div class="page-hd" style="margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <a href="/settings" class="btn btn-ghost btn-sm">← Back</a>
          <h2 style="margin:0">Theme</h2>
        </div>
        <button type="submit" form="theme-form" class="btn btn-primary btn-sm">Save theme</button>
      </div>

      <div style="display:grid;grid-template-columns:240px 1fr;gap:2rem;align-items:start">
        {/* ── Left: controls ── */}
        <form
          id="theme-form"
          method="POST"
          action="/settings/theme"
          style="position:sticky;top:1rem"
        >
          <input
            type="hidden"
            name="theme"
            id="theme-hidden"
            value={currentTheme}
          />

          {panelLabel("Preset")}
          <div style="margin-bottom:0.75rem">
            <select style="width:100%" onchange="applyPreset(this.value)">
              {ALL_PRESETS.map((p) => (
                <option value={p.name} selected={currentTheme === p.name}>
                  {p.label} — {p.desc}
                </option>
              ))}
            </select>
          </div>

          {panelLabel("Colours")}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">
            {colorInput("colorAccent", "Accent", eff.colorAccent)}
            {colorInput("colorBg", "Background", eff.colorBg)}
            {colorInput("colorText", "Text", eff.colorText)}
            {colorInput("colorMuted", "Muted", eff.colorMuted)}
          </div>

          {panelLabel("Typography")}
          <label style="margin-bottom:0.5rem">
            Body
            <select name="fontBody">
              <FontOptions
                options={[
                  ["var(--font-system-ui)", "System UI"],
                  ["var(--font-sans)", "System sans-serif"],
                  [
                    "var(--font-neo-grotesque)",
                    "Neo-grotesque (Helvetica-like)",
                  ],
                  ["var(--font-humanist)", "Humanist (Gill Sans-like)"],
                  ["var(--font-geometric-humanist)", "Geometric (Futura-like)"],
                  [
                    "var(--font-classical-humanist)",
                    "Classical humanist (Optima-like)",
                  ],
                  ["var(--font-rounded-sans)", "Rounded sans"],
                  ["var(--font-industrial)", "Industrial"],
                  [
                    "var(--font-transitional)",
                    "Transitional serif (Times-like)",
                  ],
                  ["var(--font-old-style)", "Old-style serif (Garamond-like)"],
                  ["var(--font-serif)", "System serif"],
                  ["var(--font-slab-serif)", "Slab serif"],
                  ["var(--font-antique)", "Antique"],
                  ["var(--font-didone)", "Didone (Bodoni-like)"],
                  ["var(--font-handwritten)", "Handwritten"],
                ]}
                current={eff.fontBody}
              />
            </select>
          </label>
          <label style="margin-bottom:0.5rem">
            Headings
            <select name="fontHeading">
              <FontOptions
                options={[
                  ["", "Same as body"],
                  ["var(--font-system-ui)", "System UI"],
                  ["var(--font-sans)", "System sans-serif"],
                  [
                    "var(--font-neo-grotesque)",
                    "Neo-grotesque (Helvetica-like)",
                  ],
                  ["var(--font-humanist)", "Humanist (Gill Sans-like)"],
                  ["var(--font-geometric-humanist)", "Geometric (Futura-like)"],
                  [
                    "var(--font-classical-humanist)",
                    "Classical humanist (Optima-like)",
                  ],
                  ["var(--font-rounded-sans)", "Rounded sans"],
                  ["var(--font-industrial)", "Industrial"],
                  [
                    "var(--font-transitional)",
                    "Transitional serif (Times-like)",
                  ],
                  ["var(--font-old-style)", "Old-style serif (Garamond-like)"],
                  ["var(--font-serif)", "System serif"],
                  ["var(--font-slab-serif)", "Slab serif"],
                  ["var(--font-antique)", "Antique"],
                  ["var(--font-didone)", "Didone (Bodoni-like)"],
                  ["var(--font-handwritten)", "Handwritten"],
                ]}
                current={eff.fontHeading}
              />
            </select>
          </label>
          <label style="margin-bottom:1rem">
            Code font
            <select name="fontMono">
              <FontOptions
                options={[
                  ["var(--font-mono)", "System mono"],
                  ["var(--font-monospace-code)", "Monospace code"],
                  ["var(--font-monospace-slab-serif)", "Monospace slab serif"],
                ]}
                current={eff.fontMono}
              />
            </select>
          </label>

          {panelLabel("Shape")}
          <label style="margin-bottom:0.75rem">
            Corner radius
            <select name="radius">
              {(
                [
                  ["0px", "Flat"],
                  ["2px", "Subtle"],
                  ["4px", "Default"],
                  ["6px", "Soft"],
                  ["10px", "Rounded"],
                  ["16px", "Pillowy"],
                  ["999px", "Pill"],
                ] as [string, string][]
              ).map(([v, l]) => (
                <option value={v} selected={eff.radius === v}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          {panelLabel("Density")}
          <label style="margin-bottom:1rem">
            Spacing
            <select name="spacing">
              {(
                [
                  ["compact", "Compact"],
                  ["default", "Default"],
                  ["relaxed", "Relaxed"],
                ] as [string, string][]
              ).map(([v, l]) => (
                <option value={v} selected={eff.spacing === v}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
            <button type="submit" class="btn btn-primary" style="flex:1">Save theme</button>
            <button type="button" onclick="scramble()" class="btn btn-outline" style="flex:1">🎲 Scramble</button>
          </div>
        </form>

        {/* ── Right: kitchen sink ── */}
        <div class="ks-preview" style="border:1px solid var(--g-border);border-radius:6px;padding:1.5rem;min-height:60vh;overflow:auto">
          <KitchenSink />
        </div>
      </div>

      <script>{themeScript}</script>
    </div>
  );

  return authorLayout("Theme", content, db, '/settings');
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export function handleSiteConfigUpdate(
  db: Database,
  store: EventStore,
  body: { title?: string; description?: string; domain?: string; homeIntro?: string },
): void {
  const event = {
    type: "SiteConfigUpdated" as const,
    title: body.title?.trim(),
    description: body.description?.trim(),
    domain: body.domain?.trim(),
    homeIntro: body.homeIntro?.trim(),
  };
  commitEvent(db, store, event);
}

export function handleThemeChange(
  db: Database,
  _store: EventStore,
  body: {
    theme?: string;
    colorScheme?: string;
    fontBody?: string;
    fontHeading?: string;
    fontMono?: string;
    colorAccent?: string;
    colorBg?: string;
    colorText?: string;
    colorMuted?: string;
    radius?: string;
    spacing?: string;
  },
): void {
  const validThemes: ThemeName[] = [
    "terracotta",
    "obsidian",
    "studio",
    "paper",
    "terminal",
    "neon",
  ];
  const theme = validThemes.includes(body.theme as ThemeName)
    ? (body.theme as ThemeName)
    : "terracotta";
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(
    "theme",
    theme,
  );

  const custom: ThemeCustom = {};
  // colorScheme is derived from the preset, not user-editable directly
  if (body.fontBody?.trim()) custom.fontBody = body.fontBody.trim();
  custom.fontHeading = body.fontHeading?.trim() ?? "";
  if (body.fontMono?.trim()) custom.fontMono = body.fontMono.trim();
  if (isHexColor(body.colorAccent)) custom.colorAccent = body.colorAccent!;
  if (isHexColor(body.colorBg)) custom.colorBg = body.colorBg!;
  if (isHexColor(body.colorText)) custom.colorText = body.colorText!;
  if (isHexColor(body.colorMuted)) custom.colorMuted = body.colorMuted!;
  if (isValidRadius(body.radius)) custom.radius = body.radius!;
  if (["compact", "default", "relaxed"].includes(body.spacing ?? ""))
    custom.spacing = body.spacing as "compact" | "default" | "relaxed";

  // Derive colorScheme from preset identity
  const darkPresets: ThemeName[] = ["obsidian", "terminal", "neon"];
  custom.colorScheme = darkPresets.includes(theme) ? "dark" : "light";

  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(
    "theme_custom",
    JSON.stringify(custom),
  );
}

function isHexColor(s: string | undefined): boolean {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

function isValidRadius(s: string | undefined): boolean {
  return typeof s === "string" && /^\d+(\.\d+)?(px|rem|em)$/.test(s);
}
