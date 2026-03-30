# Design System — GRIP

## Product Context
- **What this is:** A sovereign, locally-first personal web publishing space. Not a blog engine, not a CMS — a person's place on the internet.
- **Who it's for:** Developers and writers who write for themselves. People who tried WordPress, got burned, and want to own their infrastructure.
- **Space/industry:** Personal publishing / indie web. Reference competitor: Ghost (post-AP beta), Bear.blog.
- **Project type:** Editorial web — public reading experience + author panel.

## Design Philosophy
The design system exists to enable self-expression, not to enforce a look. The default
theme (Terracotta) is a starting point — a blank canvas, not a brand. The owner diverges
from it. The act of choosing a preset and customizing from there is how someone declares
who they are.

Six preset identities are defined. Each is coherent — fonts, colors, spacing, and a
one-line description of the person it's for. None is privileged. The owner picks the
one that resonates, adjusts, and the result is theirs.

The three design rules that must hold across ALL presets:
1. **Content first.** The writing is the product. Design exists to serve it.
2. **Readable at rest.** Every preset must pass WCAG AA contrast. Line-length capped
   at 70-72ch for body text.
3. **Invites ownership.** Every CSS custom property is named to be understood and
   changed by a non-designer. The DESIGN.md teaches the system as it documents it.

---

## Base Token Layer (universal across all presets)

These structural tokens don't change between presets. They define GRIP's layout geometry.

```css
--measure:        68ch;       /* Article reading width */
--measure-wide:   800px;      /* Full layout container */
--max-width:      1100px;     /* Outer container */

--space-xs:       4px;
--space-sm:       8px;
--space-md:       16px;
--space-lg:       24px;
--space-xl:       32px;
--space-2xl:      48px;
--space-3xl:      64px;

--radius:         4px;        /* Default — inputs, small elements */
--radius-md:      8px;        /* Cards, code blocks */
--radius-pill:    9999px;     /* Tags, badges */

--lh-body:        1.8;        /* Long-form prose */
--lh-heading:     1.2;        /* Display / headings */
--lh-ui:          1.5;        /* Labels, navigation */
```

---

## Aesthetic Direction
- **Direction:** Editorial Minimalist
- **Decoration level:** Intentional — warm paper grain texture (5% opacity noise overlay), no decorative chrome, no gradients
- **Mood:** A person's considered choices, not a product's brand. Each preset should feel like you're reading something made by someone specific.
- **Reference sites:** Craig Mod's site, Gwern.net (density), Robin Sloan's newsletter, Paul Graham's essays

---

## Typography (per-preset font stacks)

### How GRIP fonts work
- Display: headings, article titles, site name — emotional weight, first impression
- Body: article prose, micro-posts — must read at 17-18px/1.8lh for long form
- UI: navigation, labels, dates, metadata — DM Sans is the one constant across all presets
- Code: inline and block code — monospace with tabular nums

### Font loading
All fonts served from Google Fonts via `<link rel="preconnect">` + single `<link>` tag.
System font fallback chains defined per-preset for offline resilience.

### Per-preset stacks

**Terracotta (default):**
- Display: `'Instrument Serif', Georgia, serif` — italic editorial, personal choice signal
- Body: `'Source Serif 4', Charter, Georgia, serif` — optical sizes, warm, long-form
- UI: `'DM Sans', system-ui, sans-serif`
- Code: `'JetBrains Mono', 'Fira Code', monospace`

**Obsidian:**
- Display: `'Fraunces', Georgia, serif` — high contrast, noir, slightly melancholic
- Body: `'Source Serif 4', Charter, Georgia, serif`
- UI: `'Geist', 'DM Sans', system-ui, sans-serif`
- Code: `'JetBrains Mono', monospace`

**Studio:**
- Display: `'Cabinet Grotesk', 'General Sans', system-ui, sans-serif` — bold, creative professional
- Body: `'DM Sans', system-ui, sans-serif`
- UI: `'DM Sans', system-ui, sans-serif`
- Code: `'JetBrains Mono', monospace`

**Paper:**
- Display: `Georgia, Charter, 'Bitstream Charter', serif` — intentional: no CDN, no load, system fallback as philosophy
- Body: `Georgia, Charter, 'Bitstream Charter', serif`
- UI: `system-ui, sans-serif`
- Code: `'Courier New', monospace`

**Terminal:**
- Display: `'Geist Mono', 'JetBrains Mono', monospace` — monospace as display, developer aesthetic
- Body: `'Geist', 'DM Sans', system-ui, sans-serif`
- UI: `'Geist', system-ui, sans-serif`
- Code: `'JetBrains Mono', 'Fira Code', monospace`

**Neon:**
- Display: `'Clash Grotesk', 'Cabinet Grotesk', system-ui, sans-serif` — geometric, synthetic
- Body: `'DM Sans', system-ui, sans-serif`
- UI: `'DM Sans', system-ui, sans-serif`
- Code: `'JetBrains Mono', monospace`

---

## Color Presets

Six complete palettes. Each has light + dark mode variants.

### PRESET 1: Terracotta (default)
*"I made something and it's mine." — earthy, grounded, warm. The staple.*

```css
/* Light */
--color-bg:         #faf8f5;
--color-surface:    #f0ece5;
--color-text:       #1c1916;
--color-muted:      #6b6560;
--color-accent:     #b85c38;
--color-accent-h:   #9c4c2e;
--color-border:     #e2ddd8;
--color-border-s:   #d4cec7;

/* Dark */
--color-bg:         #1a1816;
--color-surface:    #242018;
--color-text:       #e8e4de;
--color-muted:      #8a847e;
--color-accent:     #c96b44;
--color-accent-h:   #db7a52;
--color-border:     #2e2a26;
--color-border-s:   #3a3530;
```

### PRESET 2: Obsidian
*"I work when it's quiet." — deep, focused, night-writing energy.*

```css
/* Dark-first (light mode is inversion) */
--color-bg:         #0f0f0e;
--color-surface:    #161614;
--color-text:       #e8e4de;
--color-muted:      #6e6a64;
--color-accent:     #5b8fd4;   /* cool blue */
--color-accent-h:   #4478bc;
--color-border:     #252420;
--color-border-s:   #302e28;

/* Light variant */
--color-bg:         #f5f4f2;
--color-surface:    #edece8;
--color-text:       #1a1918;
--color-muted:      #706c65;
--color-accent:     #3a6eb0;
--color-accent-h:   #2d5a96;
--color-border:     #e0ddd8;
--color-border-s:   #d2cec8;
```

### PRESET 3: Studio
*"I have opinions about typography." — creative professional, confident, not corporate.*

```css
/* Light */
--color-bg:         #f8f7fc;
--color-surface:    #efecf7;
--color-text:       #1a1726;
--color-muted:      #6b6480;
--color-accent:     #6148a2;
--color-accent-h:   #4f3a8a;
--color-border:     #ddd8ed;
--color-border-s:   #cec8e2;

/* Dark */
--color-bg:         #12101c;
--color-surface:    #1c1828;
--color-text:       #e4e0f4;
--color-muted:      #8880aa;
--color-accent:     #9b7fd8;
--color-accent-h:   #b299e8;
--color-border:     #2a2438;
--color-border-s:   #38304a;
```

### PRESET 4: Paper
*"Disappear into the text." — pure writer. No chrome. System fonts only.*

```css
/* Light */
--color-bg:         #ffffff;
--color-surface:    #f5f5f5;
--color-text:       #111111;
--color-muted:      #666666;
--color-accent:     #000000;
--color-accent-h:   #333333;
--color-border:     #e5e5e5;
--color-border-s:   #cccccc;

/* Dark */
--color-bg:         #0a0a0a;
--color-surface:    #141414;
--color-text:       #eeeeee;
--color-muted:      #888888;
--color-accent:     #ffffff;
--color-accent-h:   #cccccc;
--color-border:     #222222;
--color-border-s:   #333333;
```

### PRESET 5: Terminal
*"I treat my website like my dotfiles." — developer aesthetic, monospace-forward.*

```css
/* Dark-first */
--color-bg:         #0d1117;   /* GitHub dark */
--color-surface:    #161b22;
--color-text:       #c9d1d9;
--color-muted:      #6e7681;
--color-accent:     #3fb950;   /* green — classic terminal */
--color-accent-h:   #2ea043;
--color-border:     #21262d;
--color-border-s:   #30363d;

/* Light variant */
--color-bg:         #f6f8fa;
--color-surface:    #eef1f4;
--color-text:       #1f2328;
--color-muted:      #656d76;
--color-accent:     #1a7f37;
--color-accent-h:   #116329;
--color-border:     #d0d7de;
--color-border-s:   #b0b8c3;
```

### PRESET 6: Neon
*"My writing is my signal in the noise." — synthetic, electric, high contrast.*

```css
/* Dark-first (light mode is optional — this is a dark preset) */
--color-bg:         #0a0011;
--color-surface:    #130021;
--color-text:       #f0e8ff;
--color-muted:      #7855aa;
--color-accent:     #e040fb;   /* electric magenta */
--color-accent-h:   #ea80ff;
--color-accent-2:   #00e5ff;   /* cyan — code, borders, highlights */
--color-border:     #2a1540;
--color-border-s:   #3d2060;

/* Code block treatment (unique to Neon) */
--color-code-bg:    #0d001a;
--color-code-text:  #00e5ff;   /* cyan on black */
```

---

## Spacing Density

Each preset can adjust spacing density by overriding these multipliers:

| Preset | Density | Multiplier |
|--------|---------|------------|
| Terracotta | Comfortable | 1× |
| Obsidian | Comfortable | 1× |
| Studio | Spacious | 1.2× |
| Paper | Spacious | 1.25× |
| Terminal | Compact | 0.85× |
| Neon | Compact | 0.85× |

---

## Layout
- **Approach:** Grid-disciplined, content-first
- **Article view:** Single column, max-width `var(--measure)` (68ch), centered
- **Home / list pages:** Two columns — main (1fr) + sidebar (260px) — sidebar collapses below 860px
- **Max outer width:** 1100px
- **Border radius scale:** `var(--radius)` (4px) for inputs/small elements, `var(--radius-md)` (8px) for cards/code blocks, `var(--radius-pill)` (9999px) for tags/badges

---

## Motion
- **Approach:** Minimal-functional
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`
- **Duration:** micro 50-100ms, short 150-250ms (page transitions)
- **Rule:** Animation only if it aids comprehension or smooths state change. Not for personality. The preset is for personality; motion stays neutral.

---

## Implementation Notes

### How presets map to the theme engine
The settings panel presents **7 options**: the 6 presets defined in this document + a
**Custom** option. Custom is not a preset — it means the owner's own values, entered
directly via the CSS variable editor in the settings panel.

Selecting a preset:
1. Loads the preset's token values into the settings panel inputs
2. Writes the preset name to the `config` table (`theme_preset` key)
3. Generates and saves a `theme.css` override file from the preset values

Selecting Custom:
1. The settings panel inputs are editable freely
2. No preset is applied — the owner's values are used directly
3. The existing live CSS variable editor (`src/server/author/routes/settings.tsx`)
   remains the mechanism for Custom. **Do not remove or replace this editor.**

The live preview JS (`root.style.setProperty()` pattern) and the `buildOverrideCss`
function in `src/core/themes.ts` both stay intact. Presets feed into the same pipeline
as custom values — they just pre-populate the inputs.

**Progression:** pick a preset → adjust individual tokens → graduate to Custom when
the preset is no longer a useful anchor. The design system is designed to be replaced.

### Token naming contract
The following names are stable — they MUST NOT be renamed without a major version bump:
`--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`,
`--color-border`, `--font-display`, `--font-body`, `--font-ui`, `--font-mono`,
`--measure`, `--space-*`, `--radius`, `--radius-md`, `--radius-pill`

### What the settings editor can override
Any token in the stable set above. The live preview JS uses `root.style.setProperty()`
to apply changes immediately. Committed changes write to the `theme_overrides` config key.
Custom `html[data-theme] {}` rules in a custom theme's CSS beat the editor's overrides.

---

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-30 | Six preset identities defined | Design system is about self-expression, not brand. Six personas = six starting points for different kinds of owners. |
| 2026-03-30 | Terracotta as default | Earthy, warm, personal. Clearly a choice, not a generic. Pairs with Instrument Serif editorial aesthetic. |
| 2026-03-30 | Instrument Serif (italic) for Terracotta display | Every Ghost theme uses Inter/system-ui. Instrument Serif signals that a person made a specific typographic choice. |
| 2026-03-30 | Neon preset added | Requested — cyberpunk/neon aesthetic has its own complete identity: deep space background, electric magenta + cyan, Clash Grotesk. |
| 2026-03-30 | Terracotta accent (#b85c38) | Earthy, personal, distinctly non-SaaS. Ghost, Bear, Micro.blog all use safe blues/neutrals. Terracotta reads as "chosen." |
| 2026-03-30 | Paper preset uses system fonts only | No CDN load. The performance-as-aesthetic philosophy of Bear.blog extended to be intentional rather than accidental. |
| 2026-03-30 | Motion stays neutral across all presets | Personality comes from color/type choices. Motion should not compete with that expression. |
| 2026-03-30 | Initial design system created | /design-consultation, based on competitive research + product context from office-hours sessions. |
