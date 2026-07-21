import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';

// Locked breakpoints per kickoff brief — Tailwind defaults match the spec
// (sm 640 / md 768 / lg 1024 / xl 1280). Re-declared explicitly so a future
// theme override can't accidentally shift them.
//
// 2026-05-30 CLEAN EDITORIAL UNIFICATION (CLAUDE.md decision-log).
// Supersedes 2026-05-22 Facebook palette across app chrome.
//
//   - `darkMode: 'class'` so Tailwind respects the `dark` class on <html>
//     toggled by the ThemeProvider client component (light/dark/auto trio
//     retained from 2026-05-22 — only palette values flip).
//   - Legacy slot names (`cream`, `ink`, `terracotta`) PRESERVED. Token
//     values now remap to Clean Editorial palette per `app/globals.css`:
//       Light:  Alabaster #FBFBFA · Obsidian #1E2229 · Champagne #C5A059
//       Dark:   Obsidian #1E2229 · Alabaster #FBFBFA · Champagne #E0CCA0
//   - NEW `mulberry` color family added for CTAs (#5C2542 Rich Mulberry).
//     `.button-primary` in globals.css uses `bg-mulberry` so primary
//     actions read distinct from active-pill highlights (which stay
//     `bg-terracotta`=gold per Clean Editorial accent role).
//   - Static terracotta ladder (50–400, 800–900) flipped from Facebook
//     blue hex literals to champagne gold tints derived from #C5A059.
//   - Canonical semantic tokens (`accent`, `surface`, `surface-soft`,
//     `ink-soft`) carry forward unchanged at the Tailwind layer; their
//     CSS-var values flip per globals.css.
const config: Config = {
  darkMode: 'class',
  // `components/` is a second top-level component root alongside
  // `app/_components/` (owner directive 2026-05-28). It was missing from this
  // list, so any utility used ONLY under components/** was never generated —
  // silently a no-op at runtime. It looked fine only because the heavily-used
  // files there (skeletons, sd-loader) happen to share every class with some
  // app/** file; ManualCheckoutModal, which doesn't, rendered fully unstyled.
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      // Single radius source of truth — every `rounded-*` class resolves to the
      // --m-r-* token scale in globals.css (Approach B "softer corners", owner-
      // locked 2026-06-20 · UI_UX_Polish_Remediation_2026-06-20.md). Do NOT add
      // arbitrary rounded-[Npx] — the lint:radius guard forbids it.
      borderRadius: {
        none: '0px',
        sm: 'var(--m-r-xs)', // 4
        DEFAULT: 'var(--m-r-sm)', // 8
        md: 'var(--m-r-sm)', // 8
        lg: 'var(--m-r-md)', // 14
        xl: 'var(--m-r-md)', // 14
        '2xl': 'var(--m-r-lg)', // 22
        '3xl': 'var(--m-r-xl)', // 36
        full: 'var(--m-r-full)', // 999
        // Atelier-Glass kit radii (Glass PR-1, 2026-07-15). Named tokens so the
        // kit surface recipes use `rounded-tile`/`rounded-card` instead of the
        // lint:radius-forbidden arbitrary `rounded-[20px]`/`rounded-[18px]`.
        tile: '20px', // .sn-tile / .sn-tile-dark
        card: '18px', // .sn-card
      },
      colors: {
        // Themeable surface tokens — values resolve at runtime from CSS vars
        // defined in globals.css per mode. Light mode = Clean Editorial
        // Alabaster + Obsidian + Champagne; dark mode (html.dark) = Obsidian
        // bg + Alabaster text + brighter Champagne accent. Per CLAUDE.md
        // 2026-05-30 row "Clean Editorial unification".
        //
        // Legacy slots preserved so existing class-name call sites work:
        //   - `cream`      → page background (light: #FBFBFA / dark: #1E2229)
        //   - `ink`        → primary text   (light: #1E2229 / dark: #FBFBFA)
        //   - `terracotta` → ACCENT (Champagne Gold #C5A059 / dark #E0CCA0)
        //                     — eyebrows, active filter pills, borders,
        //                     selected-state highlights
        //   - `mulberry`   → NEW · CTA (#5C2542 / dark #B8889C lighter wash)
        //                     — primary action buttons via `.button-primary`
        // The slot names stay semantic ("accent / surface / ink / cta") not
        // literal — see CLAUDE.md 2026-05-30 row for the unification rationale.
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        // `paper` — surface slot used widely in dashboard editors
        // (`bg-paper` rows, `text-paper` on dark CTAs like the Build button).
        // It only ever existed as the `--m-paper` CSS var, NEVER as a Tailwind
        // color token, so `bg-paper` / `text-paper` / `border-paper` resolved to
        // NOTHING and broke those surfaces — most visibly the Build tab's primary
        // [Build] button rendered as a blank dark box (its `text-paper` label +
        // icon inherited the ambient ink color → invisible on `bg-ink`). Same
        // failure class as the `burgundy` slot below. Aliased to the canonical
        // cream surface channel (same Warm Alabaster value; flips correctly in
        // dark mode) so `<alpha-value>` modifiers like `text-paper/70` work too.
        paper: 'rgb(var(--color-cream) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
        },
        terracotta: {
          DEFAULT: 'rgb(var(--color-terracotta) / <alpha-value>)',
          // Champagne Gold tint ladder for fills / hover states / soft
          // pills. Kept as raw hex (not CSS-var) because these are
          // non-themed shades — they read fine on alabaster (light) and
          // obsidian (dark) surfaces alike.
          50: '#f9f5ec',
          100: '#f3ecdf',
          200: '#e4d4b4',
          300: '#cba766',
          400: '#b99456',
          500: 'rgb(var(--color-terracotta) / <alpha-value>)',
          600: 'rgb(var(--color-terracotta-600) / <alpha-value>)',
          700: 'rgb(var(--color-terracotta-700) / <alpha-value>)',
          800: '#5c4726',
          900: '#3f3019',
        },
        mulberry: {
          DEFAULT: 'rgb(var(--color-mulberry) / <alpha-value>)',
          // Rich Mulberry WINE tint ladder ("Energy, not skin" reskin 2026-07-09;
          // was the obsidian ladder under the 2026-05-29 lock). Raw hex for the
          // non-themed shades; 500/600/700 track the --color-mulberry vars.
          50: '#f9f5ec',
          100: '#f3ecdf',
          200: '#e4d4b4',
          300: '#cba766',
          400: '#b99456',
          500: 'rgb(var(--color-mulberry) / <alpha-value>)',
          600: 'rgb(var(--color-mulberry-600) / <alpha-value>)',
          700: 'rgb(var(--color-mulberry-700) / <alpha-value>)',
          800: '#5c4726',
          900: '#3f3019',
        },
        // `burgundy` — DEPRECATED pre-rebrand CTA name. It was never redefined
        // after the Clean Editorial rebrand, so `bg-burgundy` / `text-burgundy`
        // / `border-burgundy` resolved to NOTHING (transparent) and broke the
        // primary buttons on several dashboard editors (hero-photo, living-hero,
        // editorial, mood-board, panood…). Aliased to the canonical Mulberry CTA
        // so those surfaces render. Prefer `mulberry` in new code — this slot is
        // back-compat only. (The alpha placeholder covers `burgundy/NN` opacity.)
        burgundy: {
          DEFAULT: 'rgb(var(--color-mulberry) / <alpha-value>)',
          600: 'rgb(var(--color-mulberry-600) / <alpha-value>)',
          700: 'rgb(var(--color-mulberry-700) / <alpha-value>)',
        },
        // Canonical semantic tokens for new code. Older code referencing
        // `cream` / `ink` / `terracotta` continues to work via the slots above.
        accent: 'var(--accent)',
        'accent-deep': 'var(--accent-deep)',
        'accent-soft': 'var(--accent-soft)',
        surface: 'var(--surface)',
        'surface-soft': 'var(--surface-soft)',
        // ─────────────────────────────────────────────────────────────────
        // SEMANTIC STATUS FAMILIES (Wave-3 token swap · 2026-06-19)
        // ─────────────────────────────────────────────────────────────────
        // The app had ~2,600 untokenized `emerald` / `amber` / `rose` Tailwind
        // utility hits forming a de-facto status palette. They are now swapped
        // to these canonical, brand-derived families so success/warn/danger
        // states read as ONE intentional system instead of stock Tailwind
        // colors. Full 50→950 ramps (every shade the old utilities referenced
        // is defined here — an undefined shade would break the build).
        //
        // Hues are anchored to the locked Clean Editorial palette (globals.css
        // `--m-*` tokens) so they sit beside the brand, not jarring against it:
        //   - `success` ← sage green     (--m-sage #C5D2BD / --m-sage-deep #4F6B4A)
        //   - `warn`    ← champagne gold  (--m-orange #C5A059 / --m-orange-2 #A88340)
        //                  (50–400 reuse the existing terracotta gold ladder verbatim)
        //   - `danger`  ← blush/terracotta(--m-blush #F4D7C9 / --m-blush-deep #B65A3A)
        // Raw hex (not CSS-vars) — these are status accents, not themed
        // surfaces, and read correctly on both alabaster (light) and obsidian
        // (dark) backgrounds, same as the terracotta/mulberry ladders above.
        success: {
          50: '#f3f7f1',
          100: '#e3ece0',
          200: '#c5d2bd', // --m-sage
          300: '#a3b89a',
          400: '#7d9873',
          500: '#5f7d55',
          600: '#4f6b4a', // --m-sage-deep
          700: '#41573d',
          800: '#364632',
          900: '#2c392a',
          950: '#172013',
        },
        warn: {
          50: '#f9f5ec',
          100: '#f3ecdf',
          200: '#e4d4b4',
          300: '#cba766',
          400: '#b99456',
          500: '#a9834b', // --m-orange (kit gold-500)
          600: '#8a6b39', // --m-orange-2 (kit gold-700)
          700: '#7a5e32',
          800: '#5c4726',
          900: '#3f3019',
          950: '#2a200f',
        },
        danger: {
          50: '#fdf4f0',
          100: '#f4d7c9', // --m-blush
          200: '#eab8a2',
          300: '#dd9477',
          400: '#cd7252',
          500: '#bf5d3f',
          600: '#b65a3a', // --m-blush-deep
          700: '#974930',
          800: '#783b28',
          900: '#5f3021',
          950: '#34170f',
        },
        // `info` ← INFO-SLATE (Atelier-Glass kit `--sn-info` #4E6C82). The
        // sanctioned NEUTRAL semantic — for outcomes that are neither success
        // nor danger (e.g. a dispute resolved for the couple, or a high skill
        // tier). Added 2026-07-15 to retire the last raw `violet` one-offs on the
        // vendor surface (kit: gold + info-slate + warm semantics only).
        info: {
          50: '#f2f5f7',
          100: '#e2eaef', // --sn-info-soft
          200: '#c5d3dd',
          300: '#9fb4c3',
          400: '#7292a8',
          500: '#547690',
          600: '#4e6c82', // --sn-info
          700: '#405767',
          800: '#374a57',
          900: '#2f3e49',
          950: '#1e2831',
        },
      },
      fontFamily: {
        // Brand typography wired via `next/font/google` in `app/layout.tsx`
        // (--font-sans / --font-display / --font-mono CSS variables). Defaults
        // fall back to the system stack so SSR HTML and a font-load failure
        // both keep rendering instead of going blank.
        //
        // Use `font-sans` for body / buttons / nav (Manrope).
        // Use `font-display` (or its `font-serif` alias) for h1/h2 hero +
        //   section titles (Cormorant Garamond — editorial serif).
        // Use `font-mono` for brand eyebrows + accent labels (DM Mono).
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-display)', ...defaultTheme.fontFamily.serif],
        serif: ['var(--font-display)', ...defaultTheme.fontFamily.serif],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
        // Extra display faces (already loaded as CSS vars on <html> in
        // app/layout.tsx) — used by the Save-the-Date film themes for genuine
        // font variety. All readable display faces; the script font is reserved
        // for accents only (too ornate for body/date text).
        playfair: ['var(--font-playfair)', ...defaultTheme.fontFamily.serif],
        caslon: ['var(--font-libre-caslon)', ...defaultTheme.fontFamily.serif],
        vidaloka: ['var(--font-vidaloka)', ...defaultTheme.fontFamily.serif],
        script: ['var(--font-script)', 'cursive'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
