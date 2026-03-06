// GRIP theme presets — CSS variable overrides for PicoCSS v2

export type ThemeName = 'light' | 'dark' | 'coder' | 'cyberpunk' | 'literary' | 'ink';

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

  coder: `/* GRIP — Coder theme — minimal dark, GitHub-palette */
:root {
  color-scheme: dark;
  --pico-background-color: #0d1117;
  --pico-card-background-color: #0d1117;
  --pico-card-sectioning-background-color: #161b22;
  --pico-color: #e6edf3;
  --pico-muted-color: #8b949e;
  --pico-muted-border-color: #30363d;
  --pico-border-color: #30363d;
  --pico-h1-color: #e6edf3;
  --pico-h2-color: #e6edf3;
  --pico-h3-color: #e6edf3;
  --pico-h4-color: #e6edf3;
  --pico-h5-color: #e6edf3;
  --pico-h6-color: #e6edf3;
  --pico-primary: #58a6ff;
  --pico-primary-background: #1f6feb;
  --pico-primary-border: #58a6ff;
  --pico-primary-underline: #58a6ff80;
  --pico-primary-hover: #79c0ff;
  --pico-primary-hover-background: #388bfd;
  --pico-primary-hover-border: #79c0ff;
  --pico-primary-focus: #58a6ff40;
  --pico-primary-inverse: #0d1117;
  --pico-font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --pico-font-family-monospace: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
  --pico-form-element-background-color: #161b22;
  --pico-form-element-border-color: #30363d;
  --pico-form-element-color: #e6edf3;
  --pico-form-element-focus-color: #58a6ff;
  --pico-table-border-color: #30363d;
  --pico-table-row-stripped-background-color: #161b22;
}
/* Links */
a { color: #58a6ff; }
a:hover { color: #79c0ff; text-decoration: underline; }
/* Code blocks */
pre {
  background: #161b22;
  border: 1px solid #30363d;
  border-left: 3px solid #58a6ff;
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.65;
}
pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}
code:not(pre code) {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 0.15em 0.45em;
  font-size: 0.875em;
  color: #e6edf3;
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
:root {
  color-scheme: light;
  --pico-background-color: #faf8f3;
  --pico-card-background-color: #faf8f3;
  --pico-color: #2c2a24;
  --pico-muted-color: #9a9080;
  --pico-muted-border-color: #9a908059;
  --pico-border-color: #9a908059;
  --pico-primary: #8b5e3c;
  --pico-primary-background: #8b5e3c;
  --pico-primary-border: #8b5e3c;
  --pico-primary-underline: #8b5e3c80;
  --pico-primary-hover: #7a5234;
  --pico-primary-hover-background: #7a5234;
  --pico-primary-focus: #8b5e3c40;
  --pico-primary-inverse: #fff;
  --pico-font-family: Palatino, 'Palatino Linotype', 'Book Antiqua', serif;
  --pico-font-family-monospace: 'Courier New', Courier, monospace;
}
h1,h2,h3,h4,h5,h6 { font-family: Optima, Candara, 'Noto Sans', sans-serif; }
`,

  ink: `/* GRIP — Ink theme */
:root {
  color-scheme: light;
  --pico-background-color: #ffffff;
  --pico-card-background-color: #ffffff;
  --pico-color: #111111;
  --pico-muted-color: #666666;
  --pico-muted-border-color: #66666659;
  --pico-border-color: #66666659;
  --pico-primary: #1a3a6e;
  --pico-primary-background: #1a3a6e;
  --pico-primary-border: #1a3a6e;
  --pico-primary-underline: #1a3a6e80;
  --pico-primary-hover: #142d57;
  --pico-primary-hover-background: #142d57;
  --pico-primary-focus: #1a3a6e40;
  --pico-primary-inverse: #fff;
  --pico-font-family: Georgia, 'Times New Roman', serif;
  --pico-font-family-monospace: 'Courier New', Courier, monospace;
}
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
  coder: {
    colorScheme: 'dark',
    fontBody:    'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif',
    fontHeading: '',
    fontMono:    "'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
    colorAccent: '#58a6ff',
    colorBg:     '#0d1117',
    colorText:   '#e6edf3',
    colorMuted:  '#8b949e',
  },
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

  // Accent colour — set the full Pico primary family so buttons & links look right
  if (custom.colorAccent) {
    const a = custom.colorAccent;
    lines.push(`  --pico-primary: ${a};`);
    lines.push(`  --pico-primary-background: ${a};`);
    lines.push(`  --pico-primary-border: ${a};`);
    lines.push(`  --pico-primary-underline: ${a}80;`);   // 50 % opacity
    lines.push(`  --pico-primary-hover: ${a};`);
    lines.push(`  --pico-primary-hover-background: ${a};`);
    lines.push(`  --pico-primary-hover-border: ${a};`);
    lines.push(`  --pico-primary-focus: ${a}40;`);       // 25 % opacity
    lines.push(`  --pico-primary-inverse: #fff;`);
    lines.push(`  --pico-form-element-focus-color: ${a};`);
  }

  // Background — keep cards/dropdowns consistent with the page background
  if (custom.colorBg) {
    const bg = custom.colorBg;
    lines.push(`  --pico-background-color: ${bg};`);
    lines.push(`  --pico-card-background-color: ${bg};`);
    lines.push(`  --pico-card-sectioning-background-color: ${bg};`);
    lines.push(`  --pico-dropdown-background-color: ${bg};`);
    lines.push(`  --pico-form-element-background-color: ${bg};`);
  }

  // Text colour — also apply to headings so they inherit the chosen colour
  if (custom.colorText) {
    const t = custom.colorText;
    lines.push(`  --pico-color: ${t};`);
    lines.push(`  --pico-h1-color: ${t};`);
    lines.push(`  --pico-h2-color: ${t};`);
    lines.push(`  --pico-h3-color: ${t};`);
    lines.push(`  --pico-h4-color: ${t};`);
    lines.push(`  --pico-h5-color: ${t};`);
    lines.push(`  --pico-h6-color: ${t};`);
    lines.push(`  --pico-form-element-color: ${t};`);
  }

  // Muted colour — derive border from it at 35 % opacity
  if (custom.colorMuted) {
    const m = custom.colorMuted;
    lines.push(`  --pico-muted-color: ${m};`);
    lines.push(`  --pico-muted-border-color: ${m}59;`);  // ~35 % opacity
    lines.push(`  --pico-border-color: ${m}59;`);
    lines.push(`  --pico-table-border-color: ${m}59;`);
    lines.push(`  --pico-form-element-border-color: ${m}80;`);
  }

  let css = '';
  // Use both :root and html[data-theme="dark"] so our overrides win at both
  // specificities — PicoCSS dark vars live under html[data-theme="dark"] (0,1,1)
  // which beats :root (0,1,0), so we need both selectors to reliably override.
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

export function getColorScheme(db: import('bun:sqlite').Database): 'dark' | 'light' {
  const custom = readThemeCustom(db);
  if (custom?.colorScheme === 'dark')  return 'dark';
  if (custom?.colorScheme === 'light') return 'light';
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const theme = row?.value ?? 'light';
  if (theme === 'dark' || theme === 'cyberpunk') return 'dark';
  return 'light';
}

/** @deprecated use getColorScheme */
export function getThemeAttr(db: import('bun:sqlite').Database): string {
  return getColorScheme(db);
}
