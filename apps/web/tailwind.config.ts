import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';

// Locked breakpoints per kickoff brief — Tailwind defaults match the spec
// (sm 640 / md 768 / lg 1024 / xl 1280). Re-declared explicitly so a future
// theme override can't accidentally shift them.
const config: Config = {
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
        // defined in globals.css per `[data-theme]` block. The default theme
        // (Setnayan) keeps cream/ink/terracotta; Victorian/Classy/iOS swap.
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        terracotta: {
          DEFAULT: 'rgb(var(--color-terracotta) / <alpha-value>)',
          50: '#FBF1EA',
          100: '#F4DBC9',
          200: '#E8B68F',
          300: '#DC9166',
          400: '#D08654',
          500: 'rgb(var(--color-terracotta) / <alpha-value>)',
          600: 'rgb(var(--color-terracotta-600) / <alpha-value>)',
          700: 'rgb(var(--color-terracotta-700) / <alpha-value>)',
          800: '#5C341D',
          900: '#371F11',
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
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
