# JUICT Agentic OS — UI Redesign Spec

**Date:** 2026-04-21  
**Branch:** feature/ui-update  
**Source:** `design_handoff_agentic_os/` (README.md + prototypes/)  
**Approach:** Token-swap + targeted component updates (Approach A)

---

## Scope

Full visual redesign of the Electron/React frontend to match the JUICT Agentic OS design handoff. All 10 screens. No new application logic — only styling, token replacement, and structural HTML/JSX updates where the prototype structure differs from the existing components.

---

## Design System Changes

### Fonts

Add **Exo 2** (weights 300/400/500/600/700) to the Google Fonts `<link>` in `src/renderer/index.html`. Existing Inter and JetBrains Mono stay.

CSS variables (in `globals.css`):
```
--font-display: 'Exo 2', 'Helvetica Neue', sans-serif;
--font-ui:      'Inter', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', monospace;
```

### Color Tokens

Replace all 7 existing color-theme blocks with two JUICT variants. The `:root` block becomes dark, `.light` becomes the light override. No `[data-theme="*"]` selector blocks remain.

**Brand constants (theme-independent):**
```
--brand-navy:     #002345
--brand-magenta:  #ff3862
--brand-cyan:     #009fe3
--brand-gradient: linear-gradient(25deg,#002345 0%,#002345 28%,#4a1252 62%,#ff3862 100%)
```

**Dark tokens (`:root`):**
```
--bg / --bg-elev / --surface / --surface-hi
--border / --border-strong
--text / --text-dim / --text-mute
--primary (#009fe3) / --primary-wash (rgba(0,159,227,0.12))
--accent (#ff3862)
--success (#22c55e) / --warn (#f59e0b) / --danger (#ef4444)
--sidebar (#050b14) / --sidebar-border (rgba(255,255,255,0.05))
```

**Light tokens (`.light`):**
- Background: `#f5f3ee` (warm paper)
- Text: `#002345` (navy)
- Sidebar: `#ffffff`
- Success/warn/danger: slightly darker variants for light

### Theme System Simplification

- Remove `ColorThemeDefinition` array and all 7 theme entries from `themes.ts`
- Replace with a single exported constant `JUICT_THEME` (informational only)
- Remove `colorTheme` field from settings — the theme picker UI in Settings disappears
- The dark/light toggle remains as a simple boolean in `settings-store`
- Theme is persisted to `localStorage` and applied as `.light` class on `<html>` (dark = no class)

### Spacing, Radius, Elevation

Border radius tokens (replace existing):
```
--radius-input:  4px
--radius-btn:    5px
--radius-card:   6px
--radius-dialog: 7px
--radius-modal:  10px
--radius-pill:   999px
```

Key shadows:
```
--shadow-cta:   0 4px 14px rgba(255,56,98,0.25)
--shadow-modal: 0 20px 60px rgba(0,0,0,0.35)
--shadow-panel: 0 10px 40px rgba(0,0,0,0.6)
```

---

## Brand Assets

Copy all SVGs from `design_handoff_agentic_os/brand/` into `apps/frontend/src/renderer/assets/brand/`:
- `juict-mark-gradient.svg` — sidebar logo tile (dark mode)
- `juict-mark-navy.svg` — sidebar logo tile (light mode)
- `juict-mark-light.svg` — light-surface variant
- `juict-wordmark-stacked.svg` / `juict-wordmark-inline.svg`

The `Mesh` SVG component (from `tokens.jsx`) is ported as `src/renderer/components/ui/MeshMark.tsx` — a pure SVG React component with `size`, `stroke`, `accent`, `animate` props.

---

## Screen-by-Screen Changes

### 1. Sidebar (`components/Sidebar.tsx`)

Structural changes (beyond token swap):
- **Header row (48px):** Replace existing logo area with 28px gradient tile containing `<MeshMark>` + "JUICT" / "AGENTIC OS" stacked wordmark (Exo 2). `ThemeSwitch` pill pushed right.
- **Workspace switcher pill:** Status dot (cyan glowing) + repo name + branch + caret.
- **Nav items:** Active item gets `--primary-wash` background + 2px left cyan bar + keyboard shortcut chip (mono, 9px) on the right. All 10 nav items per the spec (current 13→10, mapping: github-issues/gitlab-issues/github-prs/gitlab-merge-requests → keep as-is, map to existing routes).
- **Rate-limit card:** Above the bottom block. Eyebrow "RATE LIMIT" + pct/reset time + 3px `--brand-gradient` progress bar inside a `--surface` card.
- **Bottom block:** `claude-code ready` green dot pill + 3 icon buttons (settings, clock, star) + gradient "New task" button with `Ctrl N` mono chip.
- **Collapsed state (60px):** Labels/pill/rate-limit card hidden. Compact `ThemeSwitch` button shown. Nav icons centred.
- **Transition:** `width 200ms ease` on the aside.

### 2. Tab Bar (`components/ProjectTabBar.tsx`)

- Height: 36px, `--bg-elev` background, `--border` bottom.
- Each tab: 6px status dot (green=main, amber=feature), name (12px/600 when active), branch in mono (10px, `--text-mute`), close ×.
- Active tab: 2px `--primary` top border, `--bg` background.
- Right side: `+` button + live-status strip ("4 agents running · 12 tools connected") in mono/10px/mute.

### 3. Kanban Board (`components/KanbanBoard.tsx` + `TaskCard.tsx`)

Column layout: Backlog · Queued · Running · Review · Done (280px each, horizontal scroll).

Column header:
- Title + count in mono + optional `wip x/y` chip + pulsing cyan dot if running items.

Card (`TaskCard.tsx`):
- Row 1: mono ID (10px), priority dot, UPPERCASE priority chip, optional tag chip.
- Title: 13px/500.
- Running: 3px gradient progress bar + `%  ETA` row in mono.
- Review/Done: `+N / -M` diff stats in success/danger colours.
- Avatar stack (right) + optional sparkline.
- Running cards: 2px `--primary` left border.

Toolbar: view title + active-runs chip + search field (Ctrl+K hint) + Mine/All/Failed segmented filter.

### 4. Task Detail Modal (`components/TaskDetailModal.tsx`)

- Scrim: `rgba(0,35,69,0.55)` + `backdrop-filter: blur(10px)`.
- Panel: 900px wide, 88vh tall, `--radius-modal`, `--border-strong` border.
- Header: ID + priority chip + status chip (pulsing dot) + run# / elapsed + Pause (secondary) + Abort (danger-washed) + close ×.
- Title (28px/700, Exo 2) + description (body dim).
- Body: left pane 340px (agent timeline) + right pane (terminal log on `#05080f`).
- Timeline step: 14px circle (filled green + checkmark = done; hollow cyan ring = running; flat = queued) + eyebrow + duration + title + file sub-cards.
- Log: cyan prompts, dim output, magenta orchestrator lines, blinking cursor last line.

### 5. Terminals Grid (`components/TerminalGrid.tsx`)

- 2×2 grid on `#05080f` (override existing bg).
- Each panel: header row (status dot, title mono, branch dim mono) + scrolling terminal output, prompt `›` in magenta.

### 6. Insights (`components/Insights.tsx`)

Two-pane layout:
- Left: 4-metric stat cards (eyebrow, Display L number, mono delta in success/warn) + throughput area chart (cyan stroke, gradient fill, magenta latest dot).
- Right (340px): "Ask" chat panel. User bubble right (primary-wash, cyan border, radius `10 10 2 10`). Orchestrator reply left (surface bg, radius `10 10 10 2`). Input + gradient send button. `<MeshMark>` icon in panel header.

### 7. Roadmap (`components/Roadmap.tsx`)

- Toolbar: view title + quarter chip + Week/Month/Quarter segmented control.
- Header row: 7 week columns (`W42–W48`), current week cyan label + vertical glow line.
- Swim lanes (Auth, UI, Infra, Docs): 32px bars, lane-colour bg (`22` alpha) + `88` alpha border, 3px leading pip, title, agent avatar stack.

### 8. Welcome Screen (`components/WelcomeScreen.tsx`)

- Full-screen dark only. Centered.
- 72px gradient tile with animated `<MeshMark animate>` + radial magenta glow halo.
- Display XL (42px/700, Exo 2) two-line headline + dim body.
- Primary "Open workspace" gradient button + secondary "Import from GitHub".
- Mono shortcut hints row at bottom.

### 9. Onboarding (`components/OnboardingWizard.tsx`)

Step 3/6 "Pick your agents" layout:
- Left 260px: logo lockup + "Setup · 3/6" eyebrow + 6-step list (filled green = past, cyan ring = current, muted = future).
- Right: heading (Display L, Exo 2) + help copy + 2-col grid of 6 agent cards (Planner, Researcher, Editor, Tester, Reviewer, Docs) each with avatar glyph, name, description, iOS-style toggle.
- Back + Continue gradient buttons at bottom.

### 10. Settings — MCP Tools (`components/AppSettingsDialog.tsx`)

- Left nav (200px): General / Agents / Models / MCP tools / Rate limits / Keybindings / **Appearance** (theme toggle only — no colour picker) / Team.
- Right: view heading + helper copy + tool rows.
- Each row: letter-badge, name (mono), description, usage counter, status chip (success/warn/neutral), Configure button.
- Dashed `+ Add MCP server` button below.
- Appearance section: only dark/light toggle remains; colour theme picker is removed.

---

## i18n

All new UI strings (new labels, chips, headings) must be added to `en/*.json`. French (`fr/`) is not required for this redesign — add keys to `en/` only, use the same English string as fallback. No new i18n namespaces needed; use existing `navigation`, `common`, `settings`, `tasks`, `kanban`, `onboarding`, `welcome`.

---

## Order of Work

1. Copy brand SVG assets into `src/renderer/assets/brand/`
2. Add Exo 2 to `index.html` + update font CSS vars
3. Replace token layer in `globals.css` (dark + light only)
4. Simplify `themes.ts` + `settings-store` (remove colorTheme)
5. Port `MeshMark` as `components/ui/MeshMark.tsx`
6. Update `Sidebar.tsx`
7. Update `ProjectTabBar.tsx`
8. Update `KanbanBoard.tsx` + `TaskCard.tsx`
9. Update `TaskDetailModal.tsx`
10. Update `TerminalGrid.tsx`
11. Update `Insights.tsx`
12. Update `Roadmap.tsx`
13. Update `WelcomeScreen.tsx`
14. Update `OnboardingWizard.tsx`
15. Update `AppSettingsDialog.tsx` (remove theme picker, keep toggle)
16. Remove `colorTheme` settings field from all stores/types/IPC handlers

---

## Out of Scope

- No new application features, IPC handlers, or backend changes.
- No drag-and-drop rewiring (existing dnd-kit stays as-is).
- No command palette (Ctrl+K) implementation — search field UI only.
- No streaming/live data wiring — existing data bindings stay.
- French translations not required for this sprint.
