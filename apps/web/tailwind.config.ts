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
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
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
          50: '#fbf7ec',
          100: '#f4ecd8',
          200: '#e8d8b0',
          300: '#dbc488',
          400: '#cdb160',
          500: 'rgb(var(--color-terracotta) / <alpha-value>)',
          600: 'rgb(var(--color-terracotta-600) / <alpha-value>)',
          700: 'rgb(var(--color-terracotta-700) / <alpha-value>)',
          800: '#6c5125',
          900: '#4d3a1b',
        },
        mulberry: {
          DEFAULT: 'rgb(var(--color-mulberry) / <alpha-value>)',
          // Rich Mulberry tint ladder for CTA fills / hover states / soft
          // selection backgrounds. Raw hex for non-themed shades.
          50: '#fef6f8',
          100: '#f5e8ee',
          200: '#ecc8d5',
          300: '#b8889c',
          400: '#8e5675',
          500: 'rgb(var(--color-mulberry) / <alpha-value>)',
          600: 'rgb(var(--color-mulberry-600) / <alpha-value>)',
          700: 'rgb(var(--color-mulberry-700) / <alpha-value>)',
          800: '#2a1020',
          900: '#1a0814',
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
