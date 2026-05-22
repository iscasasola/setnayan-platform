import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';

// Locked breakpoints per kickoff brief — Tailwind defaults match the spec
// (sm 640 / md 768 / lg 1024 / xl 1280). Re-declared explicitly so a future
// theme override can't accidentally shift them.
//
// 2026-05-22 BRAND PIVOT (CLAUDE.md decision-log):
//   - `darkMode: 'class'` so Tailwind respects the `dark` class on <html>
//     toggled by the ThemeProvider client component.
//   - Legacy slot names (`cream`, `ink`, `terracotta`) are PRESERVED but their
//     CSS-variable values now remap to Facebook white/blue palette per
//     `app/globals.css`. This keeps hundreds of existing class-name call sites
//     working without a codebase-wide rename.
//   - New canonical tokens (`accent`, `surface`, `surface-soft`, `ink-soft`)
//     are exposed alongside for new code that wants semantic names.
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
        // defined in globals.css per mode. Light mode = Facebook white +
        // ink; dark mode (html.dark) = Facebook dark + light ink.
        //
        // Legacy slots preserved so existing class-name call sites work:
        //   - `cream`      → page background (light: #FFFFFF / dark: #18191A)
        //   - `ink`        → primary text  (light: #050505 / dark: #E4E6EB)
        //   - `terracotta` → accent / CTA (Facebook blue #1877F2 / dark variant)
        // The slot names are semantic ("accent / surface / ink") not literal —
        // see CLAUDE.md 2026-05-22 row for the brand pivot rationale.
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
        },
        terracotta: {
          DEFAULT: 'rgb(var(--color-terracotta) / <alpha-value>)',
          // Static facebook-blue tint ladder for fills / hover states. Kept as
          // raw hex (not CSS-var) because these are non-themed shades that
          // read fine in both light and dark mode.
          50: '#e7f3ff',
          100: '#cfe4ff',
          200: '#9fc8ff',
          300: '#6fadff',
          400: '#4791f5',
          500: 'rgb(var(--color-terracotta) / <alpha-value>)',
          600: 'rgb(var(--color-terracotta-600) / <alpha-value>)',
          700: 'rgb(var(--color-terracotta-700) / <alpha-value>)',
          800: '#0a4399',
          900: '#063170',
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
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
