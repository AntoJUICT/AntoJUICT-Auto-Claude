# JUICT Agentic OS UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing multi-theme design system with the JUICT brand design (navy/cyan/magenta) and update all 10 UI screens to match the design handoff.

**Architecture:** Token-swap approach — update CSS custom properties in `globals.css` to JUICT values, add JUICT-specific extras, remove all 7 `[data-theme="*"]` blocks; then surgically update each component's JSX structure where the prototype differs from the existing layout. Application logic (IPC, state, DnD, terminals) is untouched.

**Tech Stack:** React 19, TypeScript (strict), Electron 39, Tailwind CSS v4, Zustand 5, Radix UI, Vite 7

**Design reference:** `design_handoff_agentic_os/` — README.md for tokens/spec, `prototypes/ui/*.jsx` for component structure.

**Run commands from:** `apps/frontend/`

---

## Files Map

| File | Action |
|------|--------|
| `src/renderer/index.html` | Add Exo 2 to Google Fonts link |
| `src/renderer/styles/globals.css` | Replace `:root`/`.dark` tokens, delete `[data-theme]` blocks, add JUICT extras + animations |
| `src/shared/constants/themes.ts` | Remove 7-theme array, export brand constants |
| `src/shared/types/settings.ts` | Narrow `ColorTheme` to `'default'` only |
| `src/shared/constants/config.ts` | Remove `colorTheme` from `DEFAULT_APP_SETTINGS` |
| `src/renderer/App.tsx` | Remove `data-theme` application logic, remove `COLOR_THEMES` import |
| `src/renderer/components/settings/ThemeSelector.tsx` | Remove color grid, keep mode toggle only |
| `src/renderer/components/settings/hooks/useSettings.ts` | Remove `colorTheme` tracking |
| `src/renderer/assets/brand/` | **Create** — copy SVGs from design handoff |
| `src/renderer/components/ui/MeshMark.tsx` | **Create** — SVG mesh mark component |
| `src/renderer/components/Sidebar.tsx` | Structural rewrite of JSX (keep all TS logic) |
| `src/renderer/components/SortableProjectTab.tsx` | Update tab styling |
| `src/renderer/components/ProjectTabBar.tsx` | Update bar height + right-side strip |
| `src/renderer/components/KanbanBoard.tsx` | Update toolbar + column header JSX |
| `src/renderer/components/TaskCard.tsx` | Update card layout JSX |
| `src/renderer/components/task-detail/TaskDetailModal.tsx` | Update scrim + panel structure |
| `src/renderer/components/TerminalGrid.tsx` | Update background + panel header |
| `src/renderer/components/Insights.tsx` | Update chat bubble styles + panel header |
| `src/renderer/components/Roadmap.tsx` | Update header/toolbar wrapper |
| `src/renderer/components/WelcomeScreen.tsx` | Rewrite hero JSX |
| `src/renderer/components/onboarding/OnboardingWizard.tsx` | Update step layout |
| `src/renderer/components/settings/AppSettings.tsx` | Remove color theme picker section |

---

## Task 1: Copy brand SVG assets

**Files:**
- Create: `apps/frontend/src/renderer/assets/brand/` (directory + SVG files)

- [ ] **Step 1: Create assets directory and copy SVGs**

```bash
mkdir -p apps/frontend/src/renderer/assets/brand
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-mark-gradient.svg" apps/frontend/src/renderer/assets/brand/
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-mark-navy.svg" apps/frontend/src/renderer/assets/brand/
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-mark-light.svg" apps/frontend/src/renderer/assets/brand/
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-mark-mono.svg" apps/frontend/src/renderer/assets/brand/
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-mark-reverse.svg" apps/frontend/src/renderer/assets/brand/
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-wordmark-stacked.svg" apps/frontend/src/renderer/assets/brand/
cp "C:/Users/AntoteLintelo/Downloads/JUICT-Agentic-OS (1)/design_handoff_agentic_os/brand/juict-wordmark-inline.svg" apps/frontend/src/renderer/assets/brand/
```

- [ ] **Step 2: Verify files copied**

```bash
ls apps/frontend/src/renderer/assets/brand/
```
Expected: 7 SVG files listed.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/renderer/assets/brand/
git commit -m "feat: add JUICT brand SVG assets"
```

---

## Task 2: Add Exo 2 font to index.html

**Files:**
- Modify: `apps/frontend/src/renderer/index.html`

- [ ] **Step 1: Update the Google Fonts link to include Exo 2**

In `apps/frontend/src/renderer/index.html`, replace line 9:
```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```
With:
```html
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/renderer/index.html
git commit -m "feat: add Exo 2 font to Google Fonts link"
```

---

## Task 3: Replace CSS design tokens in globals.css

**Files:**
- Modify: `apps/frontend/src/renderer/styles/globals.css`

This task replaces lines 8–1033 (the `@theme` block + `:root` + `.dark` + all `[data-theme="*"]` blocks) with the JUICT design system. Lines 1034+ (base styles, utilities, component classes) are kept unchanged.

- [ ] **Step 1: Replace the @theme block (lines 8–98) with JUICT font vars and Tailwind mappings**

Replace lines 8–98 in `globals.css`:

```css
@theme {
  /* Font families */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-display: 'Exo 2', 'Helvetica Neue', sans-serif;

  /* Tailwind color mappings — point at CSS vars */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --radius-2xl: 12px;
  --radius-3xl: 16px;
  --radius-full: 9999px;

  /* Animations */
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
  --animate-fade-in: fade-in 0.25s cubic-bezier(0, 0, 0.2, 1);
  --animate-slide-up: slide-up 0.25s cubic-bezier(0, 0, 0.2, 1);
  --animate-scale-in: scale-in 0.2s cubic-bezier(0, 0, 0.2, 1);
  --animate-pulse-cyan: pulse-cyan 2.4s ease-in-out infinite;

  @keyframes accordion-down {
    from { height: 0 }
    to { height: var(--radix-accordion-content-height) }
  }
  @keyframes accordion-up {
    from { height: var(--radix-accordion-content-height) }
    to { height: 0 }
  }
  @keyframes fade-in {
    from { opacity: 0 }
    to { opacity: 1 }
  }
  @keyframes slide-up {
    from { transform: translateY(8px); opacity: 0 }
    to { transform: translateY(0); opacity: 1 }
  }
  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0 }
    to { transform: scale(1); opacity: 1 }
  }
  @keyframes pulse-cyan {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0, 159, 227, 0.5); }
    50% { opacity: 0.9; box-shadow: 0 0 0 4px rgba(0, 159, 227, 0.1); }
  }
  @keyframes indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  @keyframes blink-cursor {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
}
```

- [ ] **Step 2: Replace :root block (lines 110–166) with JUICT light tokens**

Replace lines 110–166 in `globals.css`:

```css
/* JUICT Light theme */
:root {
  /* Brand constants */
  --brand-navy:     #002345;
  --brand-magenta:  #ff3862;
  --brand-cyan:     #009fe3;
  --brand-gradient: linear-gradient(25deg, #002345 0%, #002345 28%, #4a1252 62%, #ff3862 100%);

  /* Tailwind-mapped tokens — light */
  --background:          #f5f3ee;
  --foreground:          #002345;
  --card:                #ffffff;
  --card-foreground:     #002345;
  --primary:             #009fe3;
  --primary-foreground:  #ffffff;
  --secondary:           #f0ede6;
  --secondary-foreground:#002345;
  --muted:               #ffffff;
  --muted-foreground:    rgba(0, 35, 69, 0.70);
  --accent:              rgba(0, 159, 227, 0.12);
  --accent-foreground:   #009fe3;
  --destructive:         #dc2626;
  --destructive-foreground: #ffffff;
  --border:              rgba(0, 35, 69, 0.08);
  --input:               rgba(0, 35, 69, 0.08);
  --ring:                #009fe3;
  --sidebar:             #ffffff;
  --sidebar-foreground:  #002345;
  --popover:             #ffffff;
  --popover-foreground:  #002345;
  --success:             #16a34a;
  --success-foreground:  #ffffff;
  --success-light:       #dcfce7;
  --warning:             #d97706;
  --warning-foreground:  #ffffff;
  --warning-light:       #fef3c7;
  --info:                #009fe3;
  --info-foreground:     #ffffff;
  --info-light:          rgba(0, 159, 227, 0.12);
  --error:               #dc2626;
  --error-light:         #fee2e2;

  /* JUICT-specific extras */
  --bg-elev:         #ffffff;
  --surface:         #ffffff;
  --surface-hi:      #f0ede6;
  --border-strong:   rgba(0, 35, 69, 0.16);
  --text-dim:        rgba(0, 35, 69, 0.70);
  --text-mute:       rgba(0, 35, 69, 0.45);
  --primary-wash:    rgba(0, 159, 227, 0.12);
  --sidebar-border:  rgba(0, 35, 69, 0.08);

  /* Shadows */
  --shadow-sm:    0 1px 2px 0 rgba(0, 35, 69, 0.06);
  --shadow-md:    0 4px 6px -1px rgba(0, 35, 69, 0.08), 0 2px 4px -2px rgba(0, 35, 69, 0.05);
  --shadow-lg:    0 10px 15px -3px rgba(0, 35, 69, 0.10);
  --shadow-xl:    0 20px 25px -5px rgba(0, 35, 69, 0.10);
  --shadow-focus: 0 0 0 3px rgba(0, 159, 227, 0.25);
  --shadow-cta:   0 4px 14px rgba(255, 56, 98, 0.25);
  --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.35);
  --shadow-panel: 0 10px 40px rgba(0, 0, 0, 0.6);

  /* Radius */
  --radius: 6px;
  --radius-input:  4px;
  --radius-btn:    5px;
  --radius-card:   6px;
  --radius-dialog: 7px;
  --radius-modal:  10px;
  --radius-pill:   999px;
}
```

- [ ] **Step 3: Replace .dark block (lines 169–224) with JUICT dark tokens**

Replace lines 169–224 in `globals.css`:

```css
/* JUICT Dark theme (default) */
.dark {
  --background:          #07101c;
  --foreground:          #eef2f8;
  --card:                #111d2e;
  --card-foreground:     #eef2f8;
  --primary:             #009fe3;
  --primary-foreground:  #07101c;
  --secondary:           #182a42;
  --secondary-foreground:#eef2f8;
  --muted:               #0c1624;
  --muted-foreground:    rgba(238, 242, 248, 0.65);
  --accent:              rgba(0, 159, 227, 0.12);
  --accent-foreground:   #009fe3;
  --destructive:         #ef4444;
  --destructive-foreground: #ffffff;
  --border:              rgba(255, 255, 255, 0.08);
  --input:               rgba(255, 255, 255, 0.08);
  --ring:                #009fe3;
  --sidebar:             #050b14;
  --sidebar-foreground:  #eef2f8;
  --popover:             #111d2e;
  --popover-foreground:  #eef2f8;
  --success:             #22c55e;
  --success-foreground:  #07101c;
  --success-light:       rgba(34, 197, 94, 0.15);
  --warning:             #f59e0b;
  --warning-foreground:  #07101c;
  --warning-light:       rgba(245, 158, 11, 0.15);
  --info:                #009fe3;
  --info-foreground:     #07101c;
  --info-light:          rgba(0, 159, 227, 0.15);
  --error:               #ef4444;
  --error-light:         rgba(239, 68, 68, 0.15);

  /* JUICT-specific extras */
  --bg-elev:        #0c1624;
  --surface:        #111d2e;
  --surface-hi:     #182a42;
  --border-strong:  rgba(255, 255, 255, 0.14);
  --text-dim:       rgba(238, 242, 248, 0.65);
  --text-mute:      rgba(238, 242, 248, 0.42);
  --primary-wash:   rgba(0, 159, 227, 0.12);
  --sidebar-border: rgba(255, 255, 255, 0.05);

  /* Shadows */
  --shadow-sm:    0 1px 2px 0 rgba(0, 0, 0, 0.6);
  --shadow-md:    0 4px 6px -1px rgba(0, 0, 0, 0.7);
  --shadow-lg:    0 10px 15px -3px rgba(0, 0, 0, 0.8);
  --shadow-xl:    0 20px 25px -5px rgba(0, 0, 0, 0.9);
  --shadow-focus: 0 0 0 2px rgba(0, 159, 227, 0.35);
  --shadow-cta:   0 4px 14px rgba(255, 56, 98, 0.25);
  --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.35);
  --shadow-panel: 0 10px 40px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 4: Delete all [data-theme="*"] blocks (lines 226–1033)**

Delete everything from line 226 (`/* ===...DUSK THEME...`) through line 1033 (the closing `}` of the `[data-theme="forest"].dark` block). Leave line 1034+ untouched (the `/* Base styles */` comment and everything after).

- [ ] **Step 5: Add JUICT animation utilities after the existing `.animate-pulse-subtle` class (after line 1034 equivalents)**

After the `/* Animation utility classes */` section, add:

```css
.animate-pulse-cyan {
  animation: pulse-cyan 2.4s ease-in-out infinite;
}

.animate-blink-cursor {
  animation: blink-cursor 1s step-end infinite;
}

.font-display {
  font-family: var(--font-display);
}

.bg-brand-gradient {
  background: var(--brand-gradient);
}

.text-brand-gradient {
  background: var(--brand-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.border-sidebar-border {
  border-color: var(--sidebar-border);
}
```

- [ ] **Step 6: Verify no [data-theme] blocks remain and file is valid**

```bash
grep -c "data-theme" apps/frontend/src/renderer/styles/globals.css
```
Expected output: `0`

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/renderer/styles/globals.css
git commit -m "feat: replace design tokens with JUICT brand system (navy/cyan/magenta)"
```

---

## Task 4: Simplify themes.ts and remove colorTheme from settings

**Files:**
- Modify: `apps/frontend/src/shared/constants/themes.ts`
- Modify: `apps/frontend/src/shared/types/settings.ts`
- Modify: `apps/frontend/src/shared/constants/config.ts`
- Modify: `apps/frontend/src/renderer/App.tsx`

- [ ] **Step 1: Replace themes.ts content**

Replace the entire content of `apps/frontend/src/shared/constants/themes.ts`:

```typescript
export const JUICT_BRAND = {
  navy:     '#002345',
  magenta:  '#ff3862',
  cyan:     '#009fe3',
  gradient: 'linear-gradient(25deg, #002345 0%, #002345 28%, #4a1252 62%, #ff3862 100%)',
} as const;

// Kept for backward-compatibility with any code that imports COLOR_THEMES.
// The array is empty — theme selection has been removed.
export const COLOR_THEMES: never[] = [];
```

- [ ] **Step 2: Narrow ColorTheme type in settings.ts**

In `apps/frontend/src/shared/types/settings.ts`, replace line 10:
```typescript
export type ColorTheme = 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest';
```
With:
```typescript
export type ColorTheme = 'default';
```

- [ ] **Step 3: Remove colorTheme from DEFAULT_APP_SETTINGS in config.ts**

In `apps/frontend/src/shared/constants/config.ts`, remove line 33:
```typescript
  colorTheme: 'default' as const,
```

- [ ] **Step 4: Remove colorTheme logic from App.tsx**

In `apps/frontend/src/renderer/App.tsx`:

4a. Remove `COLOR_THEMES` from the import on line 69 (the line that imports from `'../shared/constants'`). Change:
```typescript
import { COLOR_THEMES, UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_DEFAULT } from '../shared/constants';
```
To:
```typescript
import { UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_DEFAULT } from '../shared/constants';
```

4b. Remove the entire `// Apply color theme via data-theme attribute` block (lines 472–484):
```typescript
    // Apply color theme via data-theme attribute
    // Validate colorTheme against known themes, fallback to 'default' if invalid
    const validThemeIds = COLOR_THEMES.map((t) => t.id);
    const rawColorTheme = settings.colorTheme ?? 'default';
    const colorTheme: ColorTheme = validThemeIds.includes(rawColorTheme as ColorTheme)
      ? (rawColorTheme as ColorTheme)
      : 'default';

    if (colorTheme === 'default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', colorTheme);
    }
```
Delete those lines entirely.

4c. Remove `settings.colorTheme` from the dependency array on the `useEffect` (line 500). Change:
```typescript
  }, [settings.theme, settings.colorTheme]);
```
To:
```typescript
  }, [settings.theme]);
```

4d. Remove the `ColorTheme` import if it is imported in App.tsx. Search for:
```typescript
import type { ..., ColorTheme, ... }
```
and remove `ColorTheme` from that import.

- [ ] **Step 5: Run typecheck to verify no type errors**

```bash
npm run typecheck
```
Expected: no errors related to ColorTheme or COLOR_THEMES.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/shared/constants/themes.ts apps/frontend/src/shared/types/settings.ts apps/frontend/src/shared/constants/config.ts apps/frontend/src/renderer/App.tsx
git commit -m "feat: remove multi-theme system, JUICT brand is the only theme"
```

---

## Task 5: Simplify ThemeSelector + useSettings (remove color picker)

**Files:**
- Modify: `apps/frontend/src/renderer/components/settings/ThemeSelector.tsx`
- Modify: `apps/frontend/src/renderer/components/settings/hooks/useSettings.ts`

- [ ] **Step 1: Replace ThemeSelector.tsx content with mode-only version**

Replace the entire content of `apps/frontend/src/renderer/components/settings/ThemeSelector.tsx`:

```typescript
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Label } from '../ui/label';
import { useSettingsStore } from '../../stores/settings-store';
import type { AppSettings } from '../../../shared/types';

interface ThemeSelectorProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function ThemeSelector({ settings, onSettingsChange }: ThemeSelectorProps) {
  const updateStoreSettings = useSettingsStore((state) => state.updateSettings);

  const currentMode = settings.theme;

  const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
    onSettingsChange({ ...settings, theme: mode });
    updateStoreSettings({ theme: mode });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark':  return <Moon className="h-4 w-4" />;
      default:      return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>
          Appearance Mode
        </Label>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          Choose light, dark, or system preference
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-md pt-1">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                currentMode === mode
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50 text-muted-foreground'
              )}
            >
              {getModeIcon(mode)}
              <span className="text-sm font-medium capitalize">{mode}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove colorTheme from useSettings.ts**

In `apps/frontend/src/renderer/components/settings/hooks/useSettings.ts`:

2a. Remove the `colorTheme` field from the state interface (line 24):
```typescript
    colorTheme: AppSettings['colorTheme'];
```
Delete that line.

2b. Remove `colorTheme: currentSettings.colorTheme,` from the initial state (line 28). Delete that line.

2c. Remove `colorTheme: currentSettings.colorTheme,` from the sync effect (line 46). Delete that line.

2d. Remove `currentSettings.colorTheme` from the dependency array (line 49):
```typescript
  }, [currentSettings.colorTheme, currentSettings.theme, currentSettings.uiScale]);
```
Change to:
```typescript
  }, [currentSettings.theme, currentSettings.uiScale]);
```

2e. Remove `colorTheme: original.colorTheme,` from the handleReset function (line 100). Delete that line.

2f. Remove `colorTheme: settings.colorTheme,` from the handleApply function (line 112). Delete that line.

2g. Remove `settings.colorTheme` from the handleApply dependency array (line 115):
```typescript
  }, [settings.theme, settings.colorTheme, settings.uiScale]);
```
Change to:
```typescript
  }, [settings.theme, settings.uiScale]);
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/renderer/components/settings/ThemeSelector.tsx apps/frontend/src/renderer/components/settings/hooks/useSettings.ts
git commit -m "feat: simplify ThemeSelector to mode-only (dark/light/system)"
```

---

## Task 6: Create MeshMark SVG component

**Files:**
- Create: `apps/frontend/src/renderer/components/ui/MeshMark.tsx`

- [ ] **Step 1: Create MeshMark.tsx**

Create `apps/frontend/src/renderer/components/ui/MeshMark.tsx` with this exact content:

```typescript
interface MeshMarkProps {
  size?: number;
  stroke?: string;
  accent?: string;
  hubFill?: string;
  animate?: boolean;
  accentIndex?: number;
}

export function MeshMark({
  size = 24,
  stroke = '#ffffff',
  accent = '#009fe3',
  hubFill = '#002345',
  animate = false,
  accentIndex = 0,
}: MeshMarkProps) {
  const R = 22;
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    return { x: 32 + R * Math.cos(a), y: 32 + R * Math.sin(a) };
  });
  const sw = 1.5;

  const outer: [typeof nodes[0], typeof nodes[0]][] = [];
  for (let i = 0; i < 6; i++) outer.push([nodes[i], nodes[(i + 1) % 6]]);

  const cross: [typeof nodes[0], typeof nodes[0]][] = [];
  for (let i = 0; i < 3; i++) cross.push([nodes[i], nodes[i + 3]]);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {outer.map((p, i) => (
        <line
          key={`o${i}`}
          x1={p[0].x} y1={p[0].y}
          x2={p[1].x} y2={p[1].y}
          stroke={stroke} strokeOpacity="0.45" strokeWidth={sw * 0.75}
        />
      ))}
      {cross.map((p, i) => (
        <line
          key={`c${i}`}
          x1={p[0].x} y1={p[0].y}
          x2={p[1].x} y2={p[1].y}
          stroke={stroke} strokeOpacity="0.22" strokeWidth={sw * 0.6}
        />
      ))}
      {nodes.map((n, i) => (
        <line
          key={`s${i}`}
          x1="32" y1="32"
          x2={n.x} y2={n.y}
          stroke={stroke} strokeOpacity="0.85" strokeWidth={sw}
        />
      ))}
      <rect x="22" y="22" width="20" height="20" fill={hubFill} stroke={stroke} strokeWidth={sw} />
      <path
        d="M27 28 L33 32 L27 36"
        stroke={stroke} strokeWidth={sw * 1.4} strokeLinecap="square" fill="none"
      />
      <rect x="34" y="35" width="5" height="1.6" fill={accent} />
      {nodes.map((n, i) => {
        const isAccent = i === accentIndex;
        return (
          <circle key={i} cx={n.x} cy={n.y} r={isAccent ? 3.2 : 2.6} fill={isAccent ? accent : stroke}>
            {animate && (
              <animate
                attributeName="opacity"
                values="1;0.35;1"
                dur="2.4s"
                begin={`${i * 0.35}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/renderer/components/ui/MeshMark.tsx
git commit -m "feat: add MeshMark SVG component from design handoff"
```

---

## Task 7: Rewrite Sidebar.tsx JSX

**Files:**
- Modify: `apps/frontend/src/renderer/components/Sidebar.tsx`

The goal is to rewrite the JSX structure (lines 345–582) while keeping all TypeScript logic (lines 1–344: imports, types, state, effects, handlers, renderNavItem function) intact.

- [ ] **Step 1: Add MeshMark import and ThemeSwitch helper inside Sidebar.tsx**

After the existing imports block (after line 61, before `export type SidebarView`), add:

```typescript
import { MeshMark } from './ui/MeshMark';
import { saveSettings } from '../stores/settings-store';
```

Note: `saveSettings` is already imported — skip if it's already there.

- [ ] **Step 2: Replace the renderNavItem function (lines 293–343) with JUICT styling**

Replace lines 293–343 (the `renderNavItem` function) with:

```typescript
  const renderNavItem = (item: NavItem) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;

    const button = (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        disabled={!selectedProjectId}
        aria-keyshortcuts={item.shortcut}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: isCollapsed ? '8px 0' : '7px 8px',
          borderRadius: 6,
          background: isActive ? 'var(--primary-wash)' : 'transparent',
          color: isActive ? 'var(--primary)' : 'var(--text-dim)',
          cursor: 'pointer',
          border: 'none',
          position: 'relative',
          marginBottom: 1,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: 10,
          fontSize: 12.5,
          fontWeight: isActive ? 600 : 500,
          transition: 'background 0.15s, color 0.15s',
          opacity: !selectedProjectId ? 0.5 : 1,
          pointerEvents: !selectedProjectId ? 'none' : 'auto',
        }}
      >
        {isActive && !isCollapsed && (
          <span style={{
            position: 'absolute', left: 0, top: 6, bottom: 6,
            width: 2, background: 'var(--primary)', borderRadius: 1,
          }} />
        )}
        <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
        {!isCollapsed && (
          <>
            <span style={{ flex: 1, textAlign: 'left', fontFamily: 'var(--font-ui)' }}>
              {t(item.labelKey)}
            </span>
            {item.shortcut && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-mute)',
                background: 'var(--surface-hi)',
                padding: '1px 5px', borderRadius: 3,
              }}>
                {item.shortcut}
              </span>
            )}
          </>
        )}
      </button>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">
            <span>{t(item.labelKey)}</span>
            {item.shortcut && (
              <kbd className="ml-2 rounded border border-border bg-secondary px-1 font-mono text-[10px]">
                {item.shortcut}
              </kbd>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };
```

- [ ] **Step 3: Replace the return JSX (lines 345–582) with JUICT sidebar structure**

Replace everything from `return (` on line 345 through line 582 with:

```typescript
  const isDark = settings.theme !== 'light';
  const toggleTheme = () => saveSettings({ theme: isDark ? 'light' : 'dark' });
  const sidebarW = isCollapsed ? 60 : 232;

  return (
    <TooltipProvider>
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 200ms ease',
        fontFamily: 'var(--font-ui)',
        color: 'var(--foreground)',
        height: '100%',
      }}>

        {/* Header row: logo tile + wordmark + theme toggle */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center',
          padding: isCollapsed ? '0' : '0 14px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: 10,
          paddingTop: 20, // macOS traffic-light clearance
          flexShrink: 0,
        }} className="electron-drag">
          {/* Gradient logo tile */}
          <div
            className="electron-no-drag"
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--brand-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden', flexShrink: 0,
              cursor: 'pointer',
            }}
            onClick={toggleSidebar}
          >
            <MeshMark size={20} stroke="#fff" accent="#009fe3" hubFill="#002345" />
          </div>

          {!isCollapsed && (
            <div style={{ lineHeight: 1, flex: 1 }} className="electron-no-drag">
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 13, letterSpacing: '0.06em', color: 'var(--foreground)',
              }}>JUICT</div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 300,
                fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginTop: 2,
              }}>AGENTIC OS</div>
            </div>
          )}

          {/* Theme toggle */}
          {!isCollapsed ? (
            <button
              className="electron-no-drag"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light' : 'Switch to dark'}
              style={{
                display: 'flex', alignItems: 'center', padding: 2, borderRadius: 999,
                background: 'var(--surface)', border: '1px solid var(--border)',
                cursor: 'pointer', width: 48, height: 22, position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 1,
                left: isDark ? 1 : 25,
                width: 20, height: 18,
                background: 'var(--bg-elev)', border: '1px solid var(--border-strong)',
                borderRadius: 999,
                transition: 'left 0.18s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--foreground)',
              }}>
                {isDark ? (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13 9a5 5 0 01-6-6 5 5 0 106 6z"/></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="2.5"/><path d="M8 2v1.5M8 12.5V14M14 8h-1.5M3.5 8H2M12.5 3.5l-1 1M5.5 11.5l-1 1M12.5 12.5l-1-1M5.5 4.5l-1-1"/></svg>
                )}
              </div>
            </button>
          ) : (
            <button
              className="electron-no-drag"
              onClick={toggleTheme}
              style={{
                width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {isDark ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 9a5 5 0 01-6-6 5 5 0 106 6z"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M5.4 10.6l-1 1M12.6 12.6l-1-1M5.4 5.4l-1-1"/></svg>
              )}
            </button>
          )}
        </div>

        {/* Hairline divider */}
        <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 10px', flexShrink: 0 }} />

        {/* Workspace switcher */}
        {!isCollapsed && selectedProject && (
          <div style={{ padding: '10px 10px 4px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: 'pointer',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: 'var(--primary)',
                boxShadow: '0 0 6px var(--primary)',
              }} />
              <div style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedProject.name}
              </div>
              <div style={{ color: 'var(--text-mute)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                {gitStatus?.currentBranch ?? 'main'}
              </div>
              <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" fill="none" strokeWidth="1.5" style={{ color: 'var(--text-mute)', flexShrink: 0 }}>
                <path d="M2 4l3 3 3-3"/>
              </svg>
            </div>
          </div>
        )}

        {/* Nav */}
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: isCollapsed ? '8px 6px' : '8px 10px' }}>
            {!isCollapsed && (
              <div style={{
                fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'var(--text-mute)', padding: '8px 8px 4px',
                fontFamily: 'var(--font-mono)',
              }}>Workspace</div>
            )}
            <nav>
              {visibleNavItems.map(renderNavItem)}
            </nav>
          </div>
        </ScrollArea>

        {/* Rate limit card */}
        {!isCollapsed && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <RateLimitIndicator />
          </div>
        )}

        {/* Update banner */}
        <UpdateBanner />

        {/* Bottom block */}
        <div style={{
          padding: isCollapsed ? 6 : 10,
          borderTop: '1px solid var(--sidebar-border)',
          flexShrink: 0,
        }}>
          {/* Claude-code status */}
          {!isCollapsed && (
            <div style={{ marginBottom: 8 }}>
              <ClaudeCodeStatusBadge />
            </div>
          )}

          {/* Icon buttons row */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 8,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSettingsClick}
                  style={{
                    width: 28, height: 28, borderRadius: 5,
                    border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-dim)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? 'right' : 'top'}>{t('tooltips.settings')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => window.open('https://github.com/AndyMik90/Auto-Claude/issues', '_blank')}
                  style={{
                    width: 28, height: 28, borderRadius: 5,
                    border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-dim)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? 'right' : 'top'}>{t('tooltips.help')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => window.open('https://github.com/sponsors/AndyMik90', '_blank')}
                  style={{
                    width: 28, height: 28, borderRadius: 5,
                    border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-dim)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Heart className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? 'right' : 'top'}>{t('actions.sponsor')}</TooltipContent>
            </Tooltip>
          </div>

          {/* New task button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNewTaskClick}
                disabled={!selectedProjectId || !selectedProject?.autoBuildPath}
                style={{
                  width: '100%',
                  padding: isCollapsed ? '8px 0' : '9px 12px',
                  borderRadius: 6, border: 'none',
                  background: 'var(--brand-gradient)',
                  color: '#fff',
                  fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12,
                  cursor: (!selectedProjectId || !selectedProject?.autoBuildPath) ? 'not-allowed' : 'pointer',
                  opacity: (!selectedProjectId || !selectedProject?.autoBuildPath) ? 0.5 : 1,
                  position: 'relative', overflow: 'hidden',
                  boxShadow: 'var(--shadow-cta)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Plus style={{ width: 13, height: 13 }} />
                {!isCollapsed && (
                  <>
                    {t('actions.newTask')}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      opacity: 0.7, marginLeft: 4,
                      background: 'rgba(255,255,255,0.15)',
                      padding: '1px 4px', borderRadius: 2,
                    }}>Ctrl N</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">{t('actions.newTask')}</TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>

      {/* Dialogs — kept as-is */}
      <Dialog open={showInitDialog} onOpenChange={(open) => {
        if (!open && !isInitializing) handleSkipInit();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('dialogs:initialize.title')}
            </DialogTitle>
            <DialogDescription>{t('dialogs:initialize.description')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">{t('dialogs:initialize.willDo')}</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{t('dialogs:initialize.createFolder')}</li>
                <li>{t('dialogs:initialize.copyFramework')}</li>
                <li>{t('dialogs:initialize.setupSpecs')}</li>
              </ul>
            </div>
            {!settings.autoBuildPath && (
              <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-warning">{t('dialogs:initialize.sourcePathNotConfigured')}</p>
                    <p className="text-muted-foreground mt-1">{t('dialogs:initialize.sourcePathNotConfiguredDescription')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipInit} disabled={isInitializing}>{t('common:buttons.skip')}</Button>
            <Button onClick={handleInitialize} disabled={isInitializing || !settings.autoBuildPath}>
              {isInitializing ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />{t('common:labels.initializing')}</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />{t('common:buttons.initialize')}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddProjectModal open={showAddProjectModal} onOpenChange={setShowAddProjectModal} onProjectAdded={handleProjectAdded} />
      <GitSetupModal open={showGitSetupModal} onOpenChange={setShowGitSetupModal} project={selectedProject || null} gitStatus={gitStatus} onGitInitialized={handleGitInitialized} />
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```
Fix any TypeScript errors before committing.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/renderer/components/Sidebar.tsx
git commit -m "feat: rewrite Sidebar with JUICT design (logo tile, nav indicators, gradient New Task)"
```

---

## Task 8: Update ProjectTabBar + SortableProjectTab

**Files:**
- Modify: `apps/frontend/src/renderer/components/ProjectTabBar.tsx`
- Modify: `apps/frontend/src/renderer/components/SortableProjectTab.tsx`

- [ ] **Step 1: Update ProjectTabBar container div**

In `apps/frontend/src/renderer/components/ProjectTabBar.tsx`, replace the outer `<div>` on line 88:
```tsx
    <div className={cn(
      'flex items-center border-b border-border bg-background',
      'overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
      className
    )}>
```
With:
```tsx
    <div className={cn(
      'flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
      className
    )} style={{ height: 36, background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}>
```

- [ ] **Step 2: Update the right-side actions row in ProjectTabBar**

Replace lines 115–127 (the `<div className="flex items-center gap-2 px-2 py-1">` block) with:

```tsx
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', marginLeft: 'auto', flexShrink: 0,
      }}>
        <AuthStatusIndicator />
        <UsageIndicator />
        <button
          onClick={onAddProject}
          aria-label={t('projectTab.addProjectAriaLabel')}
          style={{
            width: 22, height: 22, borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-dim)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Plus style={{ width: 11, height: 11 }} />
        </button>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-mute)', display: 'flex', gap: 8,
          alignItems: 'center',
        }}>
          <span>4 agents running</span>
          <span>·</span>
          <span>12 tools connected</span>
        </div>
      </div>
```

- [ ] **Step 3: Update SortableProjectTab tab item styling**

In `apps/frontend/src/renderer/components/SortableProjectTab.tsx`, replace the inner `<div>` wrapper (line 72–88) that currently has className:

```tsx
          <div
            className={cn(
              'flex-1 flex items-center gap-1 sm:gap-2',
              'px-2 sm:px-3 md:px-4 py-2 sm:py-2.5',
              'text-xs sm:text-sm',
              'min-w-0 truncate hover:bg-muted/50 transition-colors',
              'border-b-2 border-transparent cursor-pointer',
              isActive && [
                'bg-background border-b-primary text-foreground',
                'hover:bg-background'
              ],
              !isActive && [
                'text-muted-foreground',
                'hover:text-foreground'
              ]
            )}
            onClick={onSelect}
          >
```

With:

```tsx
          <div
            onClick={onSelect}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 14px', cursor: 'pointer',
              fontSize: 12,
              color: isActive ? 'var(--foreground)' : 'var(--text-dim)',
              background: isActive ? 'var(--background)' : 'transparent',
              position: 'relative', height: 36,
              borderRight: '1px solid var(--border)',
              minWidth: 160,
              transition: 'color 0.15s',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 2, background: 'var(--primary)',
              }} />
            )}
```

After replacing, make sure the remaining content (status dot, project name, branch, close button) is still inside this div.

- [ ] **Step 4: Remove the drag handle div inside SortableProjectTab**

Delete the drag-handle `<div {...listeners} ...>` section (lines 90–99) since the new compact tab doesn't show a visible drag handle.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/renderer/components/ProjectTabBar.tsx apps/frontend/src/renderer/components/SortableProjectTab.tsx
git commit -m "feat: update TabBar to 36px JUICT style with cyan active indicator"
```

---

## Task 9: Update KanbanBoard toolbar and column headers

**Files:**
- Modify: `apps/frontend/src/renderer/components/KanbanBoard.tsx`

The goal is surgical: update the toolbar (view title + search + filter) and column header styles. The drag-and-drop logic, column state management, and task handling are untouched.

- [ ] **Step 1: Find the toolbar section in KanbanBoard.tsx**

Run:
```bash
grep -n "toolbar\|search\|Mine\|All\|Failed\|flex.*justify-between\|px-4.*py-3" apps/frontend/src/renderer/components/KanbanBoard.tsx | head -20
```

This identifies the toolbar div. It's typically the div containing the view title and filter buttons in the main KanbanBoard return JSX.

- [ ] **Step 2: Update the toolbar div**

Find the toolbar area in the KanbanBoard return statement. It contains the board title, task count, and filter controls. Replace its className/style with JUICT styling. The toolbar should have:

```tsx
{/* Toolbar */}
<div style={{
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
  flexShrink: 0,
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
    <span style={{
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
      color: 'var(--foreground)',
    }}>
      {t('kanban.title', 'Kanban')}
    </span>
    {/* Active runs chip — existing logic */}
  </div>

  {/* Search field */}
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 10px', borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: 12, color: 'var(--text-dim)',
  }}>
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/></svg>
    <span>Search</span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', background: 'var(--surface-hi)', padding: '1px 4px', borderRadius: 2 }}>Ctrl K</span>
  </div>

  {/* Mine/All/Failed segmented filter — keep existing filter logic, update styling */}
</div>
```

Apply JUICT token classes/styles to the segmented filter buttons:
- Active filter: `background: 'var(--primary-wash)', color: 'var(--primary)', border: '1px solid var(--primary)'`
- Inactive: `background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)'`

- [ ] **Step 3: Update column header in the DroppableColumn component**

Find the column header section inside `DroppableColumn` (around line 350–450). The column header contains the status label and task count. Update the header container:

```tsx
{/* Column header */}
<div style={{
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 12px 8px',
  flexShrink: 0,
}}>
  <span style={{
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--foreground)',
  }}>
    {TASK_STATUS_LABELS[status]}
  </span>
  <span style={{
    fontFamily: 'var(--font-mono)', fontSize: 10,
    color: 'var(--text-mute)',
  }}>
    {tasks.length}
  </span>
  {/* Pulsing cyan dot for running columns */}
  {status === 'in_progress' && tasks.length > 0 && (
    <div style={{
      width: 7, height: 7, borderRadius: 999,
      background: 'var(--primary)',
      animation: 'pulse-cyan 2.4s ease-in-out infinite',
      marginLeft: 'auto',
    }} />
  )}
</div>
```

- [ ] **Step 4: Update column container background**

The column container div (wrapping the header + tasks) should use JUICT surface colors:
```tsx
style={{
  background: 'var(--bg-elev)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  // keep existing width/height/overflow
}}
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/renderer/components/KanbanBoard.tsx
git commit -m "feat: update KanbanBoard toolbar and column headers to JUICT design"
```

---

## Task 10: Update TaskCard layout

**Files:**
- Modify: `apps/frontend/src/renderer/components/TaskCard.tsx`

- [ ] **Step 1: Locate the main card container in TaskCard.tsx**

Run:
```bash
grep -n "CardContent\|card-surface\|task-card\|border-l-2\|in_progress" apps/frontend/src/renderer/components/TaskCard.tsx | head -20
```

- [ ] **Step 2: Update the Card wrapper to apply JUICT card styling**

Find the `<Card>` or outer `<div>` that wraps the card content. Add/update its style:

```tsx
style={{
  background: 'var(--surface)',
  border: task.status === 'in_progress'
    ? '1px solid var(--border)'
    : '1px solid var(--border)',
  borderLeft: task.status === 'in_progress'
    ? '2px solid var(--primary)'
    : '1px solid var(--border)',
  borderRadius: 6,
  padding: '10px 12px',
  cursor: 'pointer',
  transition: 'background 0.15s',
}}
```

- [ ] **Step 3: Update priority dot styling**

Find where priority is displayed. Replace the existing priority indicator with:

```tsx
{/* Priority dot */}
<div style={{
  width: 6, height: 6, borderRadius: 999, flexShrink: 0,
  background: task.priority === 'high' ? 'var(--danger)'
    : task.priority === 'med' ? 'var(--warning)'
    : 'var(--text-mute)',
}} />
{/* Priority chip */}
<span style={{
  fontFamily: 'var(--font-mono)', fontSize: 9,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  background: task.priority === 'high' ? 'rgba(239,68,68,0.15)'
    : task.priority === 'med' ? 'rgba(245,158,11,0.15)'
    : 'var(--surface-hi)',
  color: task.priority === 'high' ? 'var(--danger)'
    : task.priority === 'med' ? 'var(--warning)'
    : 'var(--text-mute)',
  padding: '2px 6px', borderRadius: 999,
}}>
  {task.priority ?? 'low'}
</span>
```

- [ ] **Step 4: Update the progress bar for running tasks**

Find the progress bar section. Replace with:

```tsx
{task.status === 'in_progress' && typeof task.progress === 'number' && (
  <div style={{ marginTop: 8 }}>
    <div style={{ height: 3, background: 'var(--surface-hi)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 2,
        background: 'var(--brand-gradient)',
        width: `${task.progress}%`,
        transition: 'width 0.5s ease',
      }} />
    </div>
    <div style={{
      display: 'flex', justifyContent: 'space-between', marginTop: 3,
      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)',
    }}>
      <span>{task.progress}%</span>
      {task.etaSeconds && <span>ETA {Math.floor(task.etaSeconds / 60)}m</span>}
    </div>
  </div>
)}
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/renderer/components/TaskCard.tsx
git commit -m "feat: update TaskCard to JUICT design (cyan border, gradient progress bar, priority chips)"
```

---

## Task 11: Update TaskDetailModal scrim and panel

**Files:**
- Modify: `apps/frontend/src/renderer/components/task-detail/TaskDetailModal.tsx`

- [ ] **Step 1: Locate the Radix Dialog overlay and content in TaskDetailModal.tsx**

Run:
```bash
grep -n "DialogPrimitive\|overlay\|Overlay\|Content\|DialogContent" apps/frontend/src/renderer/components/task-detail/TaskDetailModal.tsx | head -20
```

- [ ] **Step 2: Update the Dialog overlay (scrim)**

Find the `DialogPrimitive.Overlay` usage. Replace its className with:

```tsx
<DialogPrimitive.Overlay
  style={{
    position: 'fixed', inset: 0,
    background: 'rgba(0, 35, 69, 0.55)',
    backdropFilter: 'blur(10px)',
    zIndex: 50,
  }}
/>
```

- [ ] **Step 3: Update the Dialog panel container**

Find `DialogPrimitive.Content` or the main panel div. Apply:

```tsx
style={{
  position: 'fixed',
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 900, maxWidth: '95vw', height: '88vh',
  background: 'var(--bg-elev)',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-modal)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 51,
}}
```

- [ ] **Step 4: Update the modal header row styling**

Find the header area (contains task ID, priority, status, elapsed, Pause/Abort buttons). Add:

```tsx
style={{
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '14px 20px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}}
```

Update the close button `×` to use:
```tsx
style={{ color: 'var(--text-mute)', cursor: 'pointer', background: 'none', border: 'none', fontSize: 18 }}
```

- [ ] **Step 5: Update the modal title typography**

Find the task title element. Apply Exo 2 display font:

```tsx
style={{
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
  color: 'var(--foreground)', lineHeight: 1.2,
}}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/renderer/components/task-detail/TaskDetailModal.tsx
git commit -m "feat: update TaskDetailModal with navy scrim, blur, JUICT panel styling"
```

---

## Task 12: Update TerminalGrid background and panel headers

**Files:**
- Modify: `apps/frontend/src/renderer/components/TerminalGrid.tsx`

- [ ] **Step 1: Find the root container and grid container in TerminalGrid.tsx**

Run:
```bash
grep -n "h-full\|flex-1\|grid\|bg-background\|bg-card\|terminal" apps/frontend/src/renderer/components/TerminalGrid.tsx | head -20
```

- [ ] **Step 2: Update the outer container background**

Find the root container `<div>` of TerminalGrid. Add:

```tsx
style={{ background: '#05080f', height: '100%', display: 'flex', flexDirection: 'column' }}
```
Remove any `bg-background` or `bg-card` Tailwind class from this element.

- [ ] **Step 3: Update each terminal panel header**

Find the header row inside each terminal panel (contains session name, branch). Update:

```tsx
style={{
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.04)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
}}
```

Status dot inside panel header:
```tsx
<div style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--success)', flexShrink: 0 }} />
```

Panel title in mono:
```tsx
style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(238,242,248,0.85)' }}
```

Branch in muted mono:
```tsx
style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(238,242,248,0.42)' }}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/renderer/components/TerminalGrid.tsx
git commit -m "feat: update TerminalGrid with #05080f background and JUICT panel headers"
```

---

## Task 13: Update Insights chat panel styling

**Files:**
- Modify: `apps/frontend/src/renderer/components/Insights.tsx`

- [ ] **Step 1: Find the message bubble rendering in Insights.tsx**

Run:
```bash
grep -n "user\|bot\|bubble\|message\|ChatMessage\|role.*user\|role.*assistant" apps/frontend/src/renderer/components/Insights.tsx | head -20
```

- [ ] **Step 2: Update user message bubbles**

Find where user messages are rendered (typically a condition like `message.role === 'user'`). Update the bubble container:

```tsx
{/* User message — right-aligned */}
<div style={{
  display: 'flex', justifyContent: 'flex-end', marginBottom: 12,
}}>
  <div style={{
    maxWidth: '75%',
    background: 'var(--primary-wash)',
    border: '1px solid rgba(0,159,227,0.25)',
    borderRadius: '10px 10px 2px 10px',
    padding: '10px 14px',
    fontSize: 13, color: 'var(--foreground)',
    lineHeight: 1.5,
  }}>
    {/* message content */}
  </div>
</div>
```

- [ ] **Step 3: Update orchestrator/assistant message bubbles**

Find where assistant messages are rendered. Update:

```tsx
{/* Orchestrator message — left-aligned */}
<div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
  <div style={{
    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
    background: 'var(--brand-gradient)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <MeshMark size={20} stroke="#fff" accent="#009fe3" hubFill="#002345" />
  </div>
  <div style={{
    maxWidth: '75%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px 10px 10px 2px',
    padding: '10px 14px',
    fontSize: 13, color: 'var(--foreground)',
    lineHeight: 1.5,
  }}>
    {/* message content */}
  </div>
</div>
```

Don't forget to add the MeshMark import at the top of Insights.tsx:
```typescript
import { MeshMark } from './ui/MeshMark';
```

- [ ] **Step 4: Update the chat panel header**

Find the header of the chat panel (title area). Update:

```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 16px', borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}}>
  <div style={{
    width: 28, height: 28, borderRadius: 7,
    background: 'var(--brand-gradient)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <MeshMark size={20} stroke="#fff" accent="#009fe3" hubFill="#002345" />
  </div>
  <span style={{
    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
    color: 'var(--foreground)',
  }}>Ask the Orchestrator</span>
</div>
```

- [ ] **Step 5: Update the send button to gradient**

Find the send button. Replace its background:

```tsx
style={{
  background: 'var(--brand-gradient)',
  border: 'none', borderRadius: 6,
  color: '#fff', cursor: 'pointer',
  padding: '8px 16px',
  display: 'flex', alignItems: 'center', gap: 6,
  fontWeight: 600, fontSize: 12,
  boxShadow: 'var(--shadow-cta)',
}}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/renderer/components/Insights.tsx
git commit -m "feat: update Insights chat bubbles and panel header to JUICT design"
```

---

## Task 14: Update Roadmap toolbar wrapper

**Files:**
- Modify: `apps/frontend/src/renderer/components/Roadmap.tsx`
- Modify: `apps/frontend/src/renderer/components/roadmap/RoadmapHeader.tsx`

- [ ] **Step 1: Update Roadmap.tsx outer container**

In `Roadmap.tsx`, find the root return div. Add JUICT styling:

```tsx
<div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
```

- [ ] **Step 2: Update RoadmapHeader.tsx styling**

In `apps/frontend/src/renderer/components/roadmap/RoadmapHeader.tsx`, find the header container. Update:

```tsx
style={{
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
}}
```

Update the heading typography:

```tsx
style={{
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
  color: 'var(--foreground)',
}}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/renderer/components/Roadmap.tsx apps/frontend/src/renderer/components/roadmap/RoadmapHeader.tsx
git commit -m "feat: apply JUICT tokens to Roadmap header and layout"
```

---

## Task 15: Update WelcomeScreen

**Files:**
- Modify: `apps/frontend/src/renderer/components/WelcomeScreen.tsx`

- [ ] **Step 1: Add MeshMark import**

At the top of `WelcomeScreen.tsx`, add:
```typescript
import { MeshMark } from './ui/MeshMark';
```

- [ ] **Step 2: Replace the hero section JSX (lines 44–62)**

Replace the entire hero `<div className="text-center mb-10">` section with:

```tsx
{/* Hero */}
<div style={{ textAlign: 'center', marginBottom: 40 }}>
  {/* Animated gradient logo tile */}
  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
    <div style={{
      width: 72, height: 72, borderRadius: 16,
      background: 'var(--brand-gradient)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 0 60px rgba(255,56,98,0.35)',
    }}>
      <MeshMark size={52} stroke="#fff" accent="#009fe3" hubFill="#002345" animate />
    </div>
  </div>
  <h1 style={{
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 42,
    color: 'var(--foreground)', lineHeight: 1.15,
    letterSpacing: '-0.01em',
  }}>
    {t('welcome:hero.title')}
  </h1>
  <p style={{ marginTop: 12, color: 'var(--text-dim)', fontSize: 15 }}>
    {t('welcome:hero.subtitle')}
  </p>
</div>
```

- [ ] **Step 3: Update the action buttons**

Replace the `<div className="flex gap-4 justify-center mb-10">` button area with:

```tsx
<div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
  <button
    onClick={onNewProject}
    style={{
      padding: '11px 24px', borderRadius: 6, border: 'none',
      background: 'var(--brand-gradient)',
      color: '#fff', fontWeight: 600, fontSize: 14,
      cursor: 'pointer', boxShadow: 'var(--shadow-cta)',
      fontFamily: 'var(--font-ui)',
    }}
  >
    {t('welcome:actions.openWorkspace', 'Open workspace')}
  </button>
  <button
    onClick={onOpenProject}
    style={{
      padding: '11px 24px', borderRadius: 6,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      color: 'var(--foreground)', fontWeight: 500, fontSize: 14,
      cursor: 'pointer', fontFamily: 'var(--font-ui)',
    }}
  >
    {t('welcome:actions.importFromGitHub', 'Import from GitHub')}
  </button>
</div>
```

- [ ] **Step 4: Add i18n keys to en/welcome.json**

In `apps/frontend/src/shared/i18n/locales/en/welcome.json`, add if not present:
```json
{
  "actions": {
    "openWorkspace": "Open workspace",
    "importFromGitHub": "Import from GitHub"
  }
}
```

- [ ] **Step 5: Update recent projects section styling**

Apply JUICT tokens to the project list items. Find each project card/row. Update to use:
- Background: `var(--surface)`
- Border: `var(--border)`
- Border-radius: `6px`
- Hover: `var(--surface-hi)` background

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/renderer/components/WelcomeScreen.tsx apps/frontend/src/shared/i18n/locales/en/welcome.json
git commit -m "feat: update WelcomeScreen with animated MeshMark hero and gradient CTA"
```

---

## Task 16: Update OnboardingWizard step layout

**Files:**
- Modify: `apps/frontend/src/renderer/components/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Add MeshMark import to OnboardingWizard.tsx**

```typescript
import { MeshMark } from '../ui/MeshMark';
```

- [ ] **Step 2: Locate and update the stepper panel (left side)**

Run:
```bash
grep -n "step\|Step\|stepper\|left.*260\|sidebar\|progress" apps/frontend/src/renderer/components/onboarding/OnboardingWizard.tsx | head -20
```

Find the left panel. Update its container:
```tsx
style={{
  width: 260, flexShrink: 0,
  background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)',
  display: 'flex', flexDirection: 'column',
  padding: '24px 20px',
}}
```

- [ ] **Step 3: Update the logo lockup inside the stepper**

Find the logo area at the top of the left panel. Replace with:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
  <div style={{
    width: 28, height: 28, borderRadius: 7,
    background: 'var(--brand-gradient)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <MeshMark size={20} stroke="#fff" accent="#009fe3" hubFill="#002345" />
  </div>
  <div style={{ lineHeight: 1 }}>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em' }}>JUICT</div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginTop: 2 }}>AGENTIC OS</div>
  </div>
</div>
```

- [ ] **Step 4: Update step list items in the stepper**

Find the step list rendering. Update each step item based on its state:

```tsx
{/* Past step */}
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
  <div style={{
    width: 14, height: 14, borderRadius: 999,
    background: 'var(--success)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 5l2.5 2.5L8 3"/></svg>
  </div>
  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{step.label}</span>
</div>

{/* Current step */}
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
  <div style={{
    width: 14, height: 14, borderRadius: 999,
    border: '2px solid var(--primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--primary)' }} />
  </div>
  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{step.label}</span>
</div>

{/* Future step */}
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
  <div style={{ width: 14, height: 14, borderRadius: 999, border: '1px solid var(--border)' }} />
  <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>{step.label}</span>
</div>
```

- [ ] **Step 5: Update Continue/Back buttons**

Find the footer buttons. Apply JUICT styling:

```tsx
{/* Continue */}
<button style={{
  padding: '9px 20px', borderRadius: 6, border: 'none',
  background: 'var(--brand-gradient)', color: '#fff',
  fontWeight: 600, fontSize: 12, cursor: 'pointer',
  boxShadow: 'var(--shadow-cta)',
}}>
  {t('onboarding:buttons.continue', 'Continue')}
</button>

{/* Back */}
<button style={{
  padding: '9px 20px', borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--foreground)',
  fontWeight: 500, fontSize: 12, cursor: 'pointer',
}}>
  {t('onboarding:buttons.back', 'Back')}
</button>
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/renderer/components/onboarding/OnboardingWizard.tsx
git commit -m "feat: update OnboardingWizard with JUICT step layout and MeshMark logo"
```

---

## Task 17: Update AppSettings — remove color picker

**Files:**
- Modify: `apps/frontend/src/renderer/components/settings/AppSettings.tsx`

- [ ] **Step 1: Find the ThemeSelector usage in AppSettings.tsx**

Run:
```bash
grep -n "ThemeSelector\|colorTheme\|Appearance\|theme" apps/frontend/src/renderer/components/settings/AppSettings.tsx | head -20
```

- [ ] **Step 2: Verify ThemeSelector is rendered**

Find where `<ThemeSelector />` is rendered in `AppSettings.tsx`. It should already only show the mode toggle (from Task 5). Verify the import is still present and the component renders without the color grid.

- [ ] **Step 3: Update the Appearance nav item label in settings sidebar**

Find where settings nav items are defined (typically an array of objects with label + component). Ensure the Appearance item shows only the theme mode toggle. If a "Color Theme" section exists separately, remove it.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/renderer/components/settings/AppSettings.tsx
git commit -m "feat: remove color theme picker from Settings, keep mode toggle only"
```

---

## Task 18: Final typecheck, lint, and validation

- [ ] **Step 1: Run full typecheck**

```bash
cd apps/frontend && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 2: Run linter**

```bash
cd apps/frontend && npm run lint
```
Fix any Biome lint errors.

- [ ] **Step 3: Start dev server and visually verify key screens**

```bash
cd apps/frontend && npm run dev
```

Open the app and verify:
- Sidebar shows JUICT logo tile + "JUICT / AGENTIC OS" wordmark
- Nav items have active indicator (2px left cyan bar)
- Rate limit card shows below nav
- "New task" button has gradient background
- TabBar is 36px high with active cyan top border
- Kanban column headers use Exo 2 font
- Welcome screen shows animated MeshMark

- [ ] **Step 4: Stop dev server**

```bash
npx kill-port 5173
```

- [ ] **Step 5: Commit any final lint fixes**

```bash
git add -A
git commit -m "fix: lint and typecheck fixes after JUICT UI redesign"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|-----------|
| Brand tokens (navy/cyan/magenta) | Task 3 |
| Exo 2 font | Task 2 |
| MeshMark component | Task 6 |
| Remove 7 themes → JUICT only | Tasks 3, 4, 5 |
| Sidebar logo tile + wordmark | Task 7 |
| Sidebar nav active indicator | Task 7 |
| Sidebar rate-limit card | Task 7 (RateLimitIndicator in JUICT position) |
| Sidebar gradient New Task | Task 7 |
| Sidebar theme toggle pill | Task 7 |
| TabBar 36px + cyan active border | Task 8 |
| Kanban toolbar (title + search + filter) | Task 9 |
| Kanban column headers (mono count + pulse dot) | Task 9 |
| TaskCard (priority chips, progress bar, cyan border) | Task 10 |
| TaskDetailModal (scrim, blur, panel) | Task 11 |
| TerminalGrid (#05080f bg) | Task 12 |
| Insights chat bubbles + MeshMark header | Task 13 |
| Roadmap header styling | Task 14 |
| WelcomeScreen hero + gradient CTA | Task 15 |
| OnboardingWizard step layout | Task 16 |
| Settings appearance section | Task 17 |

**Notes:**
- The Insights analytics cards (stat numbers, area chart) are not implemented — the existing component is a chat-only interface. The spec's analytics pane is out of scope per the "no new application logic" constraint.
- The Roadmap Gantt chart is not implemented — the existing component uses a kanban/feature card layout. Gantt is out of scope.
- `colorTheme` field stays in `AppSettings` type for schema backward-compatibility, but the UI no longer exposes it.
