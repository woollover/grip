// GRIP theme system — CSS token overrides for grip.css
// Themes override --g-* semantic tokens. No PicoCSS dependency.

function configVal(
  db: import("bun:sqlite").Database,
  key: string,
): string | null {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as {
    value: string;
  } | null;
  return row?.value ?? null;
}

export type ThemeName =
  | "terracotta"
  | "obsidian"
  | "studio"
  | "paper"
  | "terminal"
  | "neon";

// Dark-first presets (data-theme="dark" will be set on <html>)
const DARK_THEMES: ThemeName[] = ["obsidian", "terminal", "neon"];

// Base theme CSS — each preset overrides --g-* tokens defined in grip.css.
// selector html[data-theme] has specificity (0,1,1) > html (0,0,1) in grip.css base.
export const THEMES: Record<ThemeName, string> = {
  terracotta: `/* GRIP — Terracotta (default) */
/* Light mode is the base; grip.css html{} block handles defaults. */
:root { color-scheme: light; }
`,

  obsidian: `/* GRIP — Obsidian */
html[data-theme] {
  color-scheme: dark;
  --g-bg:           #0f0f0e;
  --g-surface:      #161614;
  --g-surface-2:    #1e1e1c;
  --g-border:       #252420;
  --g-border-faint: rgba(37, 36, 32, 0.6);
  --g-text:         #e8e4de;
  --g-text-muted:   #6e6a64;
  --g-text-strong:  #f0ece6;
  --g-accent:       #5b8fd4;
  --g-accent-hover: #4478bc;
  --g-accent-fg:    #0f0f0e;
  --g-accent-muted: rgba(91, 143, 212, 0.12);
  --g-code-bg:      #161614;
  --g-code-text:    #a8c4e8;
  --g-danger:       #ff6b6b;
  --g-success:      #69db7c;
  --g-warn:         #ffd43b;
  --g-font-heading: 'Fraunces', Georgia, serif;
  --g-font-body:    'Source Serif 4', Charter, Georgia, serif;
  --g-font-mono:    'JetBrains Mono', 'Fira Code', monospace;
}
`,

  studio: `/* GRIP — Studio */
html[data-theme] {
  color-scheme: light;
  --g-bg:           #f8f7fc;
  --g-surface:      #efecf7;
  --g-surface-2:    #e4e0f0;
  --g-border:       #ddd8ed;
  --g-border-faint: rgba(221, 216, 237, 0.5);
  --g-text:         #1a1726;
  --g-text-muted:   #6b6480;
  --g-text-strong:  #0f0c1a;
  --g-accent:       #6148a2;
  --g-accent-hover: #4f3a8a;
  --g-accent-fg:    #ffffff;
  --g-accent-muted: rgba(97, 72, 162, 0.1);
  --g-code-bg:      #efecf7;
  --g-code-text:    #4f3a8a;
  --g-font-heading: 'DM Sans', system-ui, sans-serif;
  --g-font-body:    'DM Sans', system-ui, sans-serif;
  --g-font-mono:    'JetBrains Mono', 'Fira Code', monospace;
  --g-lh:           1.7;
}
`,

  paper: `/* GRIP — Paper */
html[data-theme] {
  color-scheme: light;
  --g-bg:           #ffffff;
  --g-surface:      #f5f5f5;
  --g-surface-2:    #ebebeb;
  --g-border:       #e5e5e5;
  --g-border-faint: rgba(229, 229, 229, 0.5);
  --g-text:         #111111;
  --g-text-muted:   #666666;
  --g-text-strong:  #000000;
  --g-accent:       #000000;
  --g-accent-hover: #333333;
  --g-accent-fg:    #ffffff;
  --g-accent-muted: rgba(0, 0, 0, 0.06);
  --g-code-bg:      #f5f5f5;
  --g-code-text:    #333333;
  --g-font-heading: Georgia, Charter, 'Bitstream Charter', serif;
  --g-font-body:    Georgia, Charter, 'Bitstream Charter', serif;
  --g-font-mono:    'Courier New', Courier, monospace;
  --g-lh:           1.85;
}
`,

  terminal: `/* GRIP — Terminal */
html[data-theme] {
  color-scheme: dark;
  --g-bg:           #0d1117;
  --g-surface:      #161b22;
  --g-surface-2:    #21262d;
  --g-border:       #30363d;
  --g-border-faint: rgba(48, 54, 61, 0.5);
  --g-text:         #c9d1d9;
  --g-text-muted:   #6e7681;
  --g-text-strong:  #f0f6fc;
  --g-accent:       #3fb950;
  --g-accent-hover: #2ea043;
  --g-accent-fg:    #0d1117;
  --g-accent-muted: rgba(63, 185, 80, 0.12);
  --g-code-bg:      #161b22;
  --g-code-text:    #7ee787;
  --g-danger:       #ff7b72;
  --g-success:      #3fb950;
  --g-warn:         #d29922;
  --g-font-heading: 'JetBrains Mono', 'Fira Code', monospace;
  --g-font-body:    'DM Sans', system-ui, sans-serif;
  --g-font-mono:    'JetBrains Mono', 'Fira Code', monospace;
  --g-r:            2px;
  --g-r-sm:         1px;
  --g-r-lg:         4px;
  --g-r-input:      2px;
}
`,

  neon: `/* GRIP — Neon */
html[data-theme] {
  color-scheme: dark;
  --g-bg:           #0a0011;
  --g-surface:      #130021;
  --g-surface-2:    #1c0030;
  --g-border:       #2a1540;
  --g-border-faint: rgba(42, 21, 64, 0.6);
  --g-text:         #f0e8ff;
  --g-text-muted:   #9975cc;
  --g-text-strong:  #ffffff;
  --g-accent:       #e040fb;
  --g-accent-hover: #ea80ff;
  --g-accent-fg:    #0a0011;
  --g-accent-muted: rgba(224, 64, 251, 0.12);
  --g-code-bg:      #0d001a;
  --g-code-text:    #00e5ff;
  --g-danger:       #ff5555;
  --g-success:      #00e5a0;
  --g-warn:         #ffcc00;
  --g-font-heading: 'DM Sans', system-ui, sans-serif;
  --g-font-body:    'DM Sans', system-ui, sans-serif;
  --g-font-mono:    'JetBrains Mono', 'Fira Code', monospace;
  --g-r:            0px;
  --g-r-sm:         0px;
  --g-r-lg:         0px;
  --g-r-input:      0px;
}
`,
};

// ── Custom overrides ───────────────────────────────────────────────────────────

export interface ThemeCustom {
  colorScheme?: "light" | "dark";
  fontBody?: string;
  fontHeading?: string;
  fontMono?: string;
  colorAccent?: string;
  colorBg?: string;
  colorText?: string;
  colorMuted?: string;
  radius?: string; // CSS length value for --g-r
  spacing?: string; // named density: 'compact' | 'default' | 'relaxed'
}

// Default field values for the theme editor form, per preset.
export const PRESET_DEFAULTS: Record<ThemeName, Required<ThemeCustom>> = {
  terracotta: {
    colorScheme: "light",
    fontBody: "'Source Serif 4', Charter, Georgia, serif",
    fontHeading: "'Instrument Serif', Georgia, serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    colorAccent: "#b85c38",
    colorBg: "#faf8f5",
    colorText: "#1c1916",
    colorMuted: "#6b6560",
    radius: "4px",
    spacing: "default",
  },
  obsidian: {
    colorScheme: "dark",
    fontBody: "'Source Serif 4', Charter, Georgia, serif",
    fontHeading: "'Fraunces', Georgia, serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    colorAccent: "#5b8fd4",
    colorBg: "#0f0f0e",
    colorText: "#e8e4de",
    colorMuted: "#6e6a64",
    radius: "4px",
    spacing: "default",
  },
  studio: {
    colorScheme: "light",
    fontBody: "'DM Sans', system-ui, sans-serif",
    fontHeading: "'DM Sans', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    colorAccent: "#6148a2",
    colorBg: "#f8f7fc",
    colorText: "#1a1726",
    colorMuted: "#6b6480",
    radius: "6px",
    spacing: "relaxed",
  },
  paper: {
    colorScheme: "light",
    fontBody: "Georgia, Charter, 'Bitstream Charter', serif",
    fontHeading: "Georgia, Charter, 'Bitstream Charter', serif",
    fontMono: "'Courier New', Courier, monospace",
    colorAccent: "#000000",
    colorBg: "#ffffff",
    colorText: "#111111",
    colorMuted: "#666666",
    radius: "2px",
    spacing: "relaxed",
  },
  terminal: {
    colorScheme: "dark",
    fontBody: "'DM Sans', system-ui, sans-serif",
    fontHeading: "'JetBrains Mono', 'Fira Code', monospace",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    colorAccent: "#3fb950",
    colorBg: "#0d1117",
    colorText: "#c9d1d9",
    colorMuted: "#6e7681",
    radius: "2px",
    spacing: "compact",
  },
  neon: {
    colorScheme: "dark",
    fontBody: "'DM Sans', system-ui, sans-serif",
    fontHeading: "'DM Sans', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    colorAccent: "#e040fb",
    colorBg: "#0a0011",
    colorText: "#f0e8ff",
    colorMuted: "#9975cc",
    radius: "0px",
    spacing: "compact",
  },
};

function wcagLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function pickAccentFg(hex: string): string {
  const l = wcagLuminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

export function buildOverrideCss(custom: ThemeCustom): string {
  const lines: string[] = [];

  if (custom.colorScheme) lines.push(`  color-scheme: ${custom.colorScheme};`);
  if (custom.fontBody) lines.push(`  --g-font-body: ${custom.fontBody};`);
  if (custom.fontMono) lines.push(`  --g-font-mono: ${custom.fontMono};`);
  if (custom.fontHeading !== undefined)
    lines.push(custom.fontHeading
      ? `  --g-font-heading: ${custom.fontHeading};`
      : `  --g-font-heading: unset;`);

  if (custom.colorAccent) {
    const a = custom.colorAccent;
    lines.push(`  --g-accent: ${a};`);
    lines.push(`  --g-accent-hover: color-mix(in srgb, ${a} 80%, black);`);
    lines.push(
      `  --g-accent-muted: color-mix(in srgb, ${a} 12%, transparent);`,
    );
    lines.push(`  --g-accent-fg: ${pickAccentFg(a)};`);
  }

  if (custom.colorBg) {
    const bg = custom.colorBg;
    const mix = custom.colorScheme === "dark" ? "white" : "black";
    lines.push(`  --g-bg: ${bg};`);
    lines.push(`  --g-surface: color-mix(in srgb, ${bg} 85%, ${mix} 15%);`);
    lines.push(`  --g-surface-2: color-mix(in srgb, ${bg} 75%, ${mix} 25%);`);
    lines.push(`  --g-code-bg: color-mix(in srgb, ${bg} 80%, ${mix} 20%);`);
  }

  if (custom.colorText) {
    lines.push(`  --g-text: ${custom.colorText};`);
    lines.push(`  --g-text-strong: ${custom.colorText};`);
  }

  if (custom.colorMuted) {
    const m = custom.colorMuted;
    lines.push(`  --g-text-muted: ${m};`);
    lines.push(`  --g-border: color-mix(in srgb, ${m} 40%, transparent);`);
    lines.push(
      `  --g-border-faint: color-mix(in srgb, ${m} 18%, transparent);`,
    );
  }

  if (custom.radius) {
    const r = custom.radius;
    const rNum = parseFloat(r);
    const unit = r.replace(/[\d.]/g, "") || "px";
    const rInput = Math.min(rNum, 10);
    lines.push(`  --g-r:       ${r};`);
    lines.push(`  --g-r-sm:    ${Math.max(0, rNum / 2)}${unit};`);
    lines.push(`  --g-r-lg:    ${rNum * 2}${unit};`);
    lines.push(`  --g-r-input: ${rInput}${unit};`);
  }

  if (custom.spacing) {
    const densities: Record<string, [string, string, string]> = {
      compact: ["0.28rem", "0.75rem", "0.75rem"],
      default: ["0.45rem", "1rem", "1rem"],
      relaxed: ["0.65rem", "1.25rem", "1.25rem"],
    };
    const [py, px, space] = densities[custom.spacing] ?? densities.default;
    lines.push(`  --g-pad-y: ${py};`);
    lines.push(`  --g-pad-x: ${px};`);
    lines.push(`  --g-space: ${space};`);
    lines.push(`  --g-space-sm: ${parseFloat(space) * 0.5}rem;`);
    lines.push(`  --g-space-lg: ${parseFloat(space) * 1.5}rem;`);
    lines.push(`  --g-space-xl: ${parseFloat(space) * 2}rem;`);
  }

  if (!lines.length) return "";
  return `html[data-theme] {\n${lines.join("\n")}\n}\n`;
}

export function readThemeCustom(
  db: import("bun:sqlite").Database,
): ThemeCustom | null {
  const val = configVal(db, "theme_custom");
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export function getThemeCss(db: import("bun:sqlite").Database): string {
  const theme = (configVal(db, "theme") ?? "terracotta") as ThemeName;
  const base = THEMES[theme] ?? THEMES.terracotta;
  const custom = readThemeCustom(db);
  if (!custom) return base;
  return base + "\n/* Custom overrides */\n" + buildOverrideCss(custom);
}

export function getColorScheme(
  db: import("bun:sqlite").Database,
): "dark" | "light" {
  const custom = readThemeCustom(db);
  if (custom?.colorScheme === "dark") return "dark";
  if (custom?.colorScheme === "light") return "light";
  const theme = configVal(db, "theme") ?? "terracotta";
  if (DARK_THEMES.includes(theme as ThemeName)) return "dark";
  return "light";
}

export function getThemeVersion(db: import("bun:sqlite").Database): string {
  // Generate a hash based on theme and custom settings to bust browser cache
  const theme = configVal(db, "theme") ?? "terracotta";
  const custom = configVal(db, "theme_custom") ?? "";
  const combined = theme + "|" + custom;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
