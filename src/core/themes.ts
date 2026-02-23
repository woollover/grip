// GRIP theme presets — CSS variable overrides for PicoCSS v2

export type ThemeName = 'light' | 'dark' | 'cyberpunk' | 'literary' | 'ink';

export const THEMES: Record<ThemeName, string> = {

  light: `/* GRIP — Light theme (PicoCSS default) */
:root { color-scheme: light; }
`,

  dark: `/* GRIP — Dark theme */
:root { color-scheme: dark; }
html[data-theme="dark"] {
  --pico-background-color: #13171f;
  --pico-card-background-color: #1c2030;
  --pico-card-sectioning-background-color: #1c2030;
}
`,

  cyberpunk: `/* GRIP — Cyberpunk theme */
:root {
  color-scheme: dark;
  --pico-font-family: 'Courier New', 'Lucida Console', monospace;
  --pico-background-color: #0a0a12;
  --pico-card-background-color: #12121e;
  --pico-card-sectioning-background-color: #1a1a2e;
  --pico-color: #c8c8e8;
  --pico-muted-color: #6868a0;
  --pico-muted-border-color: #2a2a40;
  --pico-border-color: #2a2a40;
  --pico-primary: #00ff88;
  --pico-primary-background: #00cc6e;
  --pico-primary-border: #00ff88;
  --pico-primary-underline: rgba(0,255,136,0.5);
  --pico-primary-hover: #00ff88;
  --pico-primary-hover-background: #00ee7a;
  --pico-primary-focus: rgba(0,255,136,0.3);
  --pico-primary-inverse: #0a0a12;
  --pico-secondary: #ff00aa;
  --pico-secondary-hover: #ff33bb;
  --pico-secondary-focus: rgba(255,0,170,0.3);
  --pico-secondary-inverse: #0a0a12;
  --pico-h1-color: #00ff88;
  --pico-h2-color: #00d4ff;
  --pico-h3-color: #ff00aa;
  --pico-h4-color: #c8c8e8;
  --pico-ins-color: #00ff88;
  --pico-del-color: #ff3366;
  --pico-code-color: #ff00aa;
  --pico-code-background-color: #1a1a2e;
  --pico-form-element-background-color: #12121e;
  --pico-form-element-border-color: #3a3a5e;
  --pico-form-element-color: #c8c8e8;
  --pico-form-element-focus-color: #00ff88;
  --pico-table-border-color: #2a2a40;
  --pico-table-row-stripped-background-color: #1a1a2e;
}
a { color: #00d4ff; }
a:hover { color: #00ff88; }
`,

  literary: `/* GRIP — Literary theme */
:root { color-scheme: light; }
`,

  ink: `/* GRIP — Ink theme */
:root { color-scheme: light; }
`,
};

// ── Custom overrides ──────────────────────────────────────────────────────────

export interface ThemeCustom {
  colorScheme?: 'light' | 'dark';
  fontBody?:    string;
  fontHeading?: string;
  fontMono?:    string;
  colorAccent?: string;
  colorBg?:     string;
  colorText?:   string;
  colorMuted?:  string;
}

// Default field values for the theme editor form, per preset.
export const PRESET_DEFAULTS: Record<ThemeName, Required<ThemeCustom>> = {
  light: {
    colorScheme: 'light',
    fontBody:    'system-ui, sans-serif',
    fontHeading: '',
    fontMono:    "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
    colorAccent: '#1095c1',
    colorBg:     '#ffffff',
    colorText:   '#373c3f',
    colorMuted:  '#767b7e',
  },
  dark: {
    colorScheme: 'dark',
    fontBody:    'system-ui, sans-serif',
    fontHeading: '',
    fontMono:    "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
    colorAccent: '#1095c1',
    colorBg:     '#13171f',
    colorText:   '#c0c8d0',
    colorMuted:  '#767b8a',
  },
  cyberpunk: {
    colorScheme: 'dark',
    fontBody:    "'Courier New', Courier, monospace",
    fontHeading: '',
    fontMono:    "'Courier New', Courier, monospace",
    colorAccent: '#00ff88',
    colorBg:     '#0a0a12',
    colorText:   '#c8c8e8',
    colorMuted:  '#6868a0',
  },
  literary: {
    colorScheme: 'light',
    fontBody:    "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
    fontHeading: "Optima, Candara, 'Noto Sans', sans-serif",
    fontMono:    "'Courier New', Courier, monospace",
    colorAccent: '#8b5e3c',
    colorBg:     '#faf8f3',
    colorText:   '#2c2a24',
    colorMuted:  '#9a9080',
  },
  ink: {
    colorScheme: 'light',
    fontBody:    "Georgia, 'Times New Roman', serif",
    fontHeading: '',
    fontMono:    "'Courier New', Courier, monospace",
    colorAccent: '#1a3a6e',
    colorBg:     '#ffffff',
    colorText:   '#111111',
    colorMuted:  '#666666',
  },
};

export function buildOverrideCss(custom: ThemeCustom): string {
  const lines: string[] = [];
  if (custom.colorScheme) lines.push(`  color-scheme: ${custom.colorScheme};`);
  if (custom.fontBody)    lines.push(`  --pico-font-family: ${custom.fontBody};`);
  if (custom.fontMono)    lines.push(`  --pico-font-family-monospace: ${custom.fontMono};`);
  if (custom.colorAccent) lines.push(`  --pico-primary: ${custom.colorAccent};`);
  if (custom.colorBg)     lines.push(`  --pico-background-color: ${custom.colorBg};`);
  if (custom.colorText)   lines.push(`  --pico-color: ${custom.colorText};`);
  if (custom.colorMuted)  lines.push(`  --pico-muted-color: ${custom.colorMuted};`);

  let css = '';
  // Use both :root and html[data-theme="dark"] so our overrides win regardless
  // of color scheme. PicoCSS defines dark-mode vars under html[data-theme="dark"]
  // (specificity 0,1,1), which beats :root (0,1,0). Grouping both selectors gives
  // our rule the higher specificity in dark mode while still applying in light mode.
  if (lines.length) css += `:root, html[data-theme="dark"] {\n${lines.join('\n')}\n}\n`;
  if (custom.fontHeading) css += `h1,h2,h3,h4,h5,h6 { font-family: ${custom.fontHeading}; }\n`;
  return css;
}

export function readThemeCustom(db: import('bun:sqlite').Database): ThemeCustom | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('theme_custom') as { value: string } | null;
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

export function getThemeCss(db: import('bun:sqlite').Database): string {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const theme = (row?.value ?? 'light') as ThemeName;
  const base = THEMES[theme] ?? THEMES.light;
  const custom = readThemeCustom(db);
  if (!custom) return base;
  return base + '\n/* Custom overrides */\n' + buildOverrideCss(custom);
}

export function getThemeAttr(db: import('bun:sqlite').Database): string {
  const custom = readThemeCustom(db);
  if (custom?.colorScheme) return custom.colorScheme === 'dark' ? 'data-theme="dark"' : '';
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const theme = row?.value ?? 'light';
  if (theme === 'dark' || theme === 'cyberpunk') return 'data-theme="dark"';
  return '';
}
