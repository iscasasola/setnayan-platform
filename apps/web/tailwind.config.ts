import type { Config } from 'tailwindcss';

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
        // System fallback in Sprint 0. Cormorant Garamond + Manrope + DM Mono
        // are queued for iteration 0015 (main marketing site).
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
