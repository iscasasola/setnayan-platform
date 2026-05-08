import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Filipino Heritage typography (per design tokens in mockup 17)
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-manrope)", "Manrope", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "DM Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Filipino Heritage palette — values map to CSS custom properties
        // declared in globals.css. Keep both in sync.
        "page-bg": "var(--page-bg)",
        "page-bg-soft": "var(--page-bg-soft)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-deep": "var(--accent-deep)",
        rule: "var(--rule)",
        "rule-strong": "var(--rule-strong)",
        surface: "var(--surface)",
        "surface-soft": "var(--surface-soft)",

        // Side coding (bride / groom / both)
        bride: "var(--bride)",
        "bride-soft": "var(--bride-soft)",
        "bride-ink": "var(--bride-ink)",
        groom: "var(--groom)",
        "groom-soft": "var(--groom-soft)",
        "groom-ink": "var(--groom-ink)",
        both: "var(--both)",
        "both-soft": "var(--both-soft)",
        "both-ink": "var(--both-ink)",

        // RSVP statuses
        "rsvp-attending": "var(--rsvp-attending)",
        "rsvp-attending-soft": "var(--rsvp-attending-soft)",
        "rsvp-attending-ink": "var(--rsvp-attending-ink)",
        "rsvp-declined": "var(--rsvp-declined)",
        "rsvp-declined-soft": "var(--rsvp-declined-soft)",
        "rsvp-declined-ink": "var(--rsvp-declined-ink)",
        "rsvp-pending": "var(--rsvp-pending)",
        "rsvp-pending-soft": "var(--rsvp-pending-soft)",
        "rsvp-pending-ink": "var(--rsvp-pending-ink)",
        "rsvp-maybe": "var(--rsvp-maybe)",
        "rsvp-maybe-soft": "var(--rsvp-maybe-soft)",
        "rsvp-maybe-ink": "var(--rsvp-maybe-ink)",

        // Role-coded chips (extracted from mockup tag.role-* classes)
        "role-sponsor-bg": "var(--role-sponsor-bg)",
        "role-sponsor-ink": "var(--role-sponsor-ink)",
        "role-entourage-bg": "var(--role-entourage-bg)",
        "role-entourage-ink": "var(--role-entourage-ink)",
        "role-bearer-bg": "var(--role-bearer-bg)",
        "role-bearer-ink": "var(--role-bearer-ink)",
      },
      boxShadow: {
        "tayo-sm": "0 2px 8px rgba(26, 26, 26, 0.04)",
        "tayo-md": "0 12px 32px rgba(26, 26, 26, 0.08)",
        "tayo-lg": "0 28px 72px rgba(26, 26, 26, 0.12)",
      },
      letterSpacing: {
        "label-tight": "0.04em",
        "label-mid": "0.1em",
        "label-wide": "0.14em",
        "label-extra": "0.16em",
      },
    },
  },
  plugins: [],
};

export default config;
