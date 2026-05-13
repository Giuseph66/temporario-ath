# Artemis Bot — Interface Design System

Living registry. Update when tokens, components, or layout patterns change.
Last updated: 2026-05-13.

---

## CSS Tokens

### Surfaces
| Token | Role |
|-------|------|
| `--paper` | Primary background (warm near-white) |
| `--paper-2` | Secondary surface |
| `--paper-3` | Tertiary / disabled backgrounds |

### Ink
| Token | Role |
|-------|------|
| `--ink-1` | Primary text |
| `--ink-2` | Secondary text |
| `--ink-3` | Tertiary / labels |
| `--ink-4` | Meta / captions |
| `--ink-5` | Disabled |

### Borders
| Token | Role |
|-------|------|
| `--line` | Primary divider |
| `--line-2` | Stronger border / card edge |

### Semantic
| Token | Role |
|-------|------|
| `--accent` | Primary action green |
| `--accent-soft` | Accent background tint |
| `--accent-ink` | Accent text / icon on white |
| `--danger` | Destructive red |
| `--danger-soft` | Danger background tint |
| `--amber` | Warning / medium risk |
| `--amber-soft` | Warning background tint |

---

## Typography

| Face | Usage | Notes |
|------|-------|-------|
| `'Fraunces', serif` | Agent names, section titles, hero numbers, brand | weight 300–500, negative letterSpacing |
| `'Geist', system-ui` | UI body, labels, buttons | weight 400–600 |
| `'Geist Mono', monospace` | Timestamps, IDs, counts, uppercase meta | letterSpacing 0.5–0.8 |

Font size scale: 10 / 11 / 12 / 13 / 14 / 15 / 16 / 18 / 22 / 28 / 38 / 54px

---

## Layout Variants

### V1 — Cockpit
`grid: 1fr 320px` · Single-agent detail · Premium minimal
Hero: 84px avatar, Fraunces 38px name, powers in 3-col grid.

### V2 — Console  
`grid: 248px | 1fr | 380px` · List + detail + live feed · Dense, Linear-style
Dark log panel: `#191713` bg. Active sidebar row: `border-left: 2px solid var(--accent)`.

### V3 — Composer
`max-width: 980px, centered` · Configuration / setup · Editorial single-column
Large Fraunces 54px hero. Expandable power cards. Sub-config `160px | 1fr` grid.

---

## Component Inventory

### Agent Avatar
- Circle, 26–96px
- Earthtone persona colors: `#7a5b3a` `#34556a` `#5d3a55` `#3e5e3a` `#8a4a3a` `#4a4a4a`
- Letter in Fraunces
- Online dot: `var(--accent)`, `border: 3px solid var(--paper)`

### Card
- Active: `border: 1px solid #c9d8d0`, `background: #f6faf8`
- Default: `border: 1px solid var(--line)`, `background: var(--paper)`
- `borderRadius: 12–14`, `padding: 16–22px`

### Risk / Status Chip
- High: `danger-soft` bg, `danger` text
- Medium: `amber-soft` bg, `amber` text
- Low/OK: `accent-soft` bg, `accent-ink` text
- Neutral: `paper-2` bg, `ink-3` text
- Geist Mono, 10–11px, uppercase, `letterSpacing: 0.4–0.6`, `borderRadius: 4`

### Toggle
- 30×18px pill
- On: `var(--accent)`, knob `left: 14`
- Off: `var(--ink-5)`, knob `left: 2`
- Knob: 14px white circle, `transition: left 0.15s`

### Button — Primary
`background: var(--accent)`, `color: #fff`, `border: 1px solid var(--accent-ink)`, `borderRadius: 8`, `padding: 8px 16px`, `fontSize: 13`, `fontWeight: 500`

### Button — Secondary
`background: var(--paper)`, `color: var(--ink-1)`, `border: 1px solid var(--line-2)`, same sizing.

### Section Header
`display: flex`, `alignItems: baseline`, `justifyContent: space-between`
Title: Geist 14px fontWeight 600, or Fraunces 28px fontWeight 400
Count: Geist Mono 11px `ink-4`

---

## Spacing Rhythm

Padding / gap values in use: `4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 22 / 24 / 28 / 32 / 36 / 40px`

Border radius: `4` (chips) · `6–8` (buttons, small elements) · `12–14` (cards) · `16` (hero panels)

---

## Agent Persona Colors (defined)

| Agent | Color |
|-------|-------|
| Sofia | `#7a5b3a` |
| Caio | `#34556a` |
| Lara | `#5d3a55` |
| Bruno | `#3e5e3a` |
| Maya | `#8a4a3a` |
| Dora | `#4a4a4a` |

When adding a new agent, choose a muted earthtone not already in use.

---

## What NOT to Do

- No hardcoded hex for semantic values — use tokens
- No Inter, Roboto, Arial as primary fonts
- No purple gradients on white
- No generic card shadows without context
- No default blue `<a>` link colors without restyling
- No pixel values outside the spacing rhythm without justification
