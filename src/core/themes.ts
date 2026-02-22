// GRIP theme presets — CSS variable overrides for PicoCSS v2

export type ThemeName = 'light' | 'dark' | 'cyberpunk';

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
code, kbd { text-shadow: 0 0 6px rgba(255, 0, 170, 0.4); }
h1 { text-shadow: 0 0 16px rgba(0, 255, 136, 0.5); }
h2 { text-shadow: 0 0 12px rgba(0, 212, 255, 0.4); }
`,
};

export function getThemeCss(db: import('bun:sqlite').Database): string {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const theme = (row?.value ?? 'light') as ThemeName;
  return THEMES[theme] ?? THEMES.light;
}

export function getThemeAttr(db: import('bun:sqlite').Database): string {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('theme') as { value: string } | null;
  const theme = row?.value ?? 'light';
  if (theme === 'dark' || theme === 'cyberpunk') return 'data-theme="dark"';
  return '';
}
