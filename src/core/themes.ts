// GRIP theme system — CSS token overrides for grip.css
// Themes override --g-* semantic tokens. No PicoCSS dependency.

function configVal(db: import('bun:sqlite').Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null;
  return row?.value ?? null;
}

export type ThemeName = 'light' | 'dark' | 'coder' | 'cyberpunk' | 'literary' | 'ink';

// Base theme CSS — each preset overrides the --g-* tokens defined in grip.css.
// The :root block handles both light[data-theme] and dark[data-theme] specificity.
export const THEMES: Record<ThemeName, string> = {

  light: `/* GRIP — Light (default) */
:root { color-scheme: light; }
`,

  dark: `/* GRIP — Dark */
:root { color-scheme: dark; }
html { --g-bg: #1a1d23; --g-surface: #22262d; --g-surface-2: #2c3038;
  --g-border: #373d47; --g-border-faint: rgba(100,112,130,.2);
  --g-text: #ced4da; --g-text-muted: #868e96; --g-text-strong: #f1f3f5;
  --g-accent: #74c0fc; --g-accent-hover: #a5d8ff; --g-accent-fg: #1a1d23;
  --g-accent-muted: rgba(116,192,252,.12);
  --g-code-bg: #2c3038; --g-code-text: #ff8787;
  --g-danger: #ff6b6b; --g-success: #69db7c; }
`,

  coder: `/* GRIP — Coder (GitHub dark) */
html {
  color-scheme: dark;
  --g-bg:           #0d1117;
  --g-surface:      #161b22;
  --g-surface-2:    #21262d;
  --g-border:       #30363d;
  --g-border-faint: rgba(48,54,61,.5);
  --g-text:         #e6edf3;
  --g-text-muted:   #8b949e;
  --g-text-strong:  #f0f6fc;
  --g-accent:       #58a6ff;
  --g-accent-hover: #79c0ff;
  --g-accent-fg:    #0d1117;
  --g-accent-muted: rgba(88,166,255,.12);
  --g-code-bg:      #161b22;
  --g-code-text:    #79c0ff;
  --g-font-body:    system-ui, -apple-system, 'Segoe UI', sans-serif;
  --g-font-mono:    'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
}
`,

  cyberpunk: `/* GRIP — Cyberpunk */
html {
  color-scheme: dark;
  --g-bg:           #0a0a12;
  --g-surface:      #12121e;
  --g-surface-2:    #1a1a2e;
  --g-border:       #2a2a40;
  --g-border-faint: rgba(42,42,64,.5);
  --g-text:         #c8c8e8;
  --g-text-muted:   #6868a0;
  --g-text-strong:  #e0e0f8;
  --g-accent:       #00ff88;
  --g-accent-hover: #33ffaa;
  --g-accent-fg:    #0a0a12;
  --g-accent-muted: rgba(0,255,136,.1);
  --g-code-bg:      #1a1a2e;
  --g-code-text:    #ff00aa;
  --g-font-body:    'Courier New', 'Lucida Console', monospace;
  --g-font-heading: 'Courier New', 'Lucida Console', monospace;
  --g-font-mono:    'Courier New', 'Lucida Console', monospace;
}
`,

  literary: `/* GRIP — Literary (warm serif) */
html {
  color-scheme: light;
  --g-bg:           #faf8f3;
  --g-surface:      #f3f0e8;
  --g-surface-2:    #ece8dc;
  --g-border:       rgba(154,144,128,.35);
  --g-border-faint: rgba(154,144,128,.18);
  --g-text:         #2c2a24;
  --g-text-muted:   #9a9080;
  --g-text-strong:  #1a1814;
  --g-accent:       #8b5e3c;
  --g-accent-hover: #7a5234;
  --g-accent-fg:    #fff;
  --g-accent-muted: rgba(139,94,60,.1);
  --g-code-bg:      #ece8dc;
  --g-code-text:    #6b4226;
  --g-font-body:    Palatino, 'Palatino Linotype', 'Book Antiqua', serif;
  --g-font-heading: Optima, Candara, 'Noto Sans', sans-serif;
  --g-font-mono:    'Courier New', Courier, monospace;
  --g-lh:           1.85;
}
`,

  ink: `/* GRIP — Ink (editorial black & white) */
html {
  color-scheme: light;
  --g-bg:           #ffffff;
  --g-surface:      #f8f9fa;
  --g-surface-2:    #f1f3f5;
  --g-border:       rgba(102,102,102,.3);
  --g-border-faint: rgba(102,102,102,.15);
  --g-text:         #111111;
  --g-text-muted:   #666666;
  --g-text-strong:  #000000;
  --g-accent:       #1a3a6e;
  --g-accent-hover: #142d57;
  --g-accent-fg:    #fff;
  --g-accent-muted: rgba(26,58,110,.08);
  --g-code-bg:      #f1f3f5;
  --g-code-text:    #1a3a6e;
  --g-font-body:    Georgia, 'Times New Roman', serif;
  --g-font-mono:    'Courier New', Courier, monospace;
  --g-lh:           1.8;
}
`,
};

// ── Custom overrides ───────────────────────────────────────────────────────────

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
    fontBody:    'system-ui, -apple-system, sans-serif',
    fontHeading: '',
    fontMono:    "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
    colorAccent: '#1971c2',
    colorBg:     '#ffffff',
    colorText:   '#343a40',
    colorMuted:  '#868e96',
  },
  dark: {
    colorScheme: 'dark',
    fontBody:    'system-ui, -apple-system, sans-serif',
    fontHeading: '',
    fontMono:    "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
    colorAccent: '#74c0fc',
    colorBg:     '#1a1d23',
    colorText:   '#ced4da',
    colorMuted:  '#868e96',
  },
  coder: {
    colorScheme: 'dark',
    fontBody:    "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontHeading: '',
    fontMono:    "'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
    colorAccent: '#58a6ff',
    colorBg:     '#0d1117',
    colorText:   '#e6edf3',
    colorMuted:  '#8b949e',
  },
  cyberpunk: {
    colorScheme: 'dark',
    fontBody:    "'Courier New', Courier, monospace",
    fontHeading: "'Courier New', Courier, monospace",
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
  if (custom.fontBody)    lines.push(`  --g-font-body: ${custom.fontBody};`);
  if (custom.fontMono)    lines.push(`  --g-font-mono: ${custom.fontMono};`);
  if (custom.fontHeading) lines.push(`  --g-font-heading: ${custom.fontHeading};`);

  if (custom.colorAccent) {
    const a = custom.colorAccent;
    lines.push(`  --g-accent: ${a};`);
    lines.push(`  --g-accent-hover: color-mix(in srgb, ${a} 80%, black);`);
    lines.push(`  --g-accent-muted: color-mix(in srgb, ${a} 12%, transparent);`);
    // fg: white unless accent is very light
    lines.push(`  --g-accent-fg: #ffffff;`);
  }

  if (custom.colorBg) {
    const bg = custom.colorBg;
    lines.push(`  --g-bg: ${bg};`);
    lines.push(`  --g-surface: color-mix(in srgb, ${bg} 85%, ${custom.colorScheme === 'dark' ? 'white' : 'black'} 15%);`);
    lines.push(`  --g-code-bg: color-mix(in srgb, ${bg} 80%, ${custom.colorScheme === 'dark' ? 'white' : 'black'} 20%);`);
  }

  if (custom.colorText) {
    lines.push(`  --g-text: ${custom.colorText};`);
    lines.push(`  --g-text-strong: ${custom.colorText};`);
  }

  if (custom.colorMuted) {
    const m = custom.colorMuted;
    lines.push(`  --g-text-muted: ${m};`);
    lines.push(`  --g-border: color-mix(in srgb, ${m} 40%, transparent);`);
    lines.push(`  --g-border-faint: color-mix(in srgb, ${m} 18%, transparent);`);
  }

  if (!lines.length) return '';
  return `html {\n${lines.join('\n')}\n}\n`;
}

export function readThemeCustom(db: import('bun:sqlite').Database): ThemeCustom | null {
  const val = configVal(db, 'theme_custom');
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

export function getThemeCss(db: import('bun:sqlite').Database): string {
  const theme = (configVal(db, 'theme') ?? 'literary') as ThemeName;
  const base = THEMES[theme] ?? THEMES.literary;
  const custom = readThemeCustom(db);
  if (!custom) return base;
  return base + '\n/* Custom overrides */\n' + buildOverrideCss(custom);
}

export function getColorScheme(db: import('bun:sqlite').Database): 'dark' | 'light' {
  const custom = readThemeCustom(db);
  if (custom?.colorScheme === 'dark')  return 'dark';
  if (custom?.colorScheme === 'light') return 'light';
  const theme = configVal(db, 'theme') ?? 'literary';
  if (theme === 'dark' || theme === 'coder' || theme === 'cyberpunk') return 'dark';
  return 'light';
}
