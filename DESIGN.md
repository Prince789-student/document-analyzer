# DocStudio — Design System & Visual Specification (DESIGN.md)
<!-- Generated via .agents/skills/ui-ux-pro-max, .agents/skills/hallmark & .agents/skills/open-design -->
<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 -->

## 1. Architectural Philosophy & Style Archetype
- **Archetype**: Minimalism & Swiss Precision (Enterprise Document Engine)
- **Core Directive**: 100% Client-Side Privacy, Zero Server Retention, Clean Spatial Geometry, Anti-AI-Slop.
- **Visual Stance**: Subtle elevations, razor-sharp hairline borders, high typography contrast, no fake browser chrome or fabricated metrics.

---

## 2. Locked Design Tokens

```css
:root {
  /* Brand & Core Semantic Colors */
  --color-primary: #1E293B;         /* Slate 800 - Primary Brand */
  --color-on-primary: #FFFFFF;
  --color-secondary: #334155;       /* Slate 700 - Secondary */
  --color-on-secondary: #FFFFFF;
  --color-accent: #2563EB;          /* Royal Scan Blue - Primary CTA */
  --color-accent-hover: #1D4ED8;
  --color-on-accent: #FFFFFF;

  /* Surfaces & Backgrounds (Light Default) */
  --color-background: #F8FAFC;      /* Canvas Surface */
  --color-surface-1: #FFFFFF;       /* Card & Container Surface */
  --color-surface-2: #F1F5F9;       /* Secondary Surface & Input BG */
  --color-surface-hover: #E2E8F0;   /* Hover State */
  
  /* Text & Foreground */
  --color-foreground: #0F172A;      /* High-contrast Text (14.2:1 contrast) */
  --color-muted-foreground: #475569;/* Body & Secondary Text (6.8:1 contrast) */
  --color-subtle-foreground: #64748B;/* Meta & Timestamps (4.6:1 contrast) */

  /* Hairlines, Borders & Rings */
  --color-border: #E2E8F0;          /* Clean Subtle Hairline */
  --color-border-hover: #CBD5E1;
  --color-ring: rgba(37, 99, 235, 0.2);

  /* Functional Status */
  --color-success: #10B981;         /* Pro Badge / Verification */
  --color-warning: #F59E0B;         /* Quota / Alert */
  --color-destructive: #EF4444;     /* Error / Delete */

  /* Typography Scale */
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px (Base) */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 2rem;      /* 32px */
  --font-size-4xl: 2.5rem;    /* 40px */

  /* Spacing Scale (8pt Grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Elevations & Shadows (Restrained) */
  --elevation-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --elevation-md: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --elevation-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03);
  --elevation-modal: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06);

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-normal: 250ms cubic-bezier(0.16, 1, 0.3, 1);
  --border-radius-sm: 6px;
  --border-radius-md: 10px;
  --border-radius-lg: 14px;
  --border-radius-pill: 9999px;
}

[data-theme="dark"] {
  --color-background: #0B0F17;
  --color-surface-1: #111827;
  --color-surface-2: #1F2937;
  --color-surface-hover: #374151;
  --color-foreground: #F8FAFC;
  --color-muted-foreground: #94A3B8;
  --color-subtle-foreground: #64748B;
  --color-border: #1F2937;
  --color-border-hover: #374151;
}
```

---

## 3. Hallmark Anti-Slop Quality Gates Verification

| Gate | Requirement | Status | Implementation Check |
|---|---|---|---|
| **Gate 34** | Zero Horizontal Overflow | ✅ Verified | `overflow-x: clip` applied to root `html` and `body` |
| **Gate 38a** | Typography Purity | ✅ Verified | All display headings use `font-style: normal; font-weight: 700`. Zero fake AI italic headers. |
| **Gate 46** | Honest Copy & Metrics | ✅ Verified | Real metrics: 30 Client-side tools, ₹5 Daily / ₹100 Monthly / ₹1,000 Yearly. Zero fake "+47% speed" or "50,000+ teams" claims. |
| **Gate 47** | No Fake Chrome | ✅ Verified | Clean modern modal dialogs and native HTML dropzones; no hand-drawn fake browser URL bars or mock traffic-light dots. |
| **Gate 48** | Locked Tokens | ✅ Verified | All components declare styles via CSS variables (`var(--color-accent)`, `var(--space-4)`). |
| **Gate 49** | No Multi-line Buttons | ✅ Verified | Buttons enforce `white-space: nowrap;` and responsive text collapsing (`.btn-text-responsive`). |
| **Gate 50** | Grid Track Safety | ✅ Verified | Tool directory grid uses `minmax(0, 1fr)` and `repeat(auto-fill, minmax(min(100%, 280px), 1fr))`. |
| **Touch Targets** | Accessibility Minimum | ✅ Verified | Minimum touch targets 44×44px with ≥8px spacing. |

---

## 4. UI/UX Pro Max Component Specifications

### 4.1 Header & Responsive Navigation
- **Tool Tabs Collapse Rule**: On viewports `< 1280px`, individual quick tool links (`.nav-tab-quick`) collapse into the adjacent "ALL PDF TOOLS" dropdown, leaving the search input wide (`min-width: 220px`) and preventing button crowding.
- **Search Bar**: Centered, instant live filter with clear button (`Esc` shortcut supported).

### 4.2 Pro Subscription & Fast UPI Payment Drawer
- **Plan**: Singular **DocStudio PRO** tier with 3 explicit duration selector cards:
  1. **Daily Pass**: ₹5 / 1 day
  2. **Monthly Pro**: ₹100 / month (Standard / Featured)
  3. **Yearly Pro**: ₹1,000 / year (Best ROI)
- **Fast UPI Drawer**:
  - Registered UPI ID: `apnacollegebihar@slc` with 1-click clipboard copy
  - Official QR image (`/upi-qr.png`)
  - Deep link for 1-click launch on mobile (`upi://pay?pa=apnacollegebihar@slc&pn=DocStudio&am=100...`)
  - Optional UTR reference input and instant Pro activation button.

### 4.3 Google Authentication Dialog
- Exclusive passwordless Google sign-in modal with pinned Super Admin (`prince86944@gmail.com`), personal user option, and custom `@gmail.com` entry.

### 4.4 Legal, Compliance & Support Center
- Multi-pane tabbed view (`#/privacy`, `#/terms`, `#/refund`, `#/about`, `#/contact`) detailing the client-side WebAssembly zero-server-retention architecture. Interactive support message form connected to `/api/contact/submit`.
