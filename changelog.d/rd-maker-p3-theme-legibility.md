## 2026-09-25 · fix(event-hub): a theme never makes a word harder to read than House

Follow-up to #5968 (Event Hub Maker Phase 3, the ten themes), from the real-browser sweep of the guest
Event Hub in all ten themes (sample data, 375 and 1440, WCAG contrast of every visible text run).

- **`lib/hub-theme-tokens.ts` (new, pure)** — `hubThemePageTokens(theme)` derives each theme's page ink,
  eyebrow, gild and button fill from its registry palette by one rule: every muted `text-ink/40…/80` step
  at least as readable as House makes it (House's own ratio, capped at AA), and every accent used as text
  — eyebrow, gild, the button's `text-cream` label — at AA. The light themes' ink deepens a step (e.g.
  Cinderella `#253039` → `#171d23`); the dark themes keep the spec ink. Pale accents (Cinderella ice,
  Whimsical pink, Regency gilt) stop being used as text and fall back to the theme's heading.
- **`globals.css`** "THE TEN THEMES ON THE PAGE" regenerated from it; `lib/invite-themes.test.ts` now
  re-derives ink, plate ink, gild, eyebrow and button channel-for-channel; `lib/hub-theme-tokens.test.ts`
  holds the rule for all nine Pro themes.
- **`spotlight-card.tsx`** — the RSVP card took a literal `bg-white/70`, which on Luxe / Gatsby / Cyber put
  cream ink on a light card (1.7:1). It now takes the page's paper (`bg-cream/70`, identical on House).

Sweep result after the fix: across the landing page and ten fixed guest pages, no theme renders any text
below the ratio House renders it.

SPEC IMPACT: None — implements the Phase 3 acceptance rule ("readable for everyone") the plan already states.
