## 2026-09-29 · feat(themes): Modern and Cyber Neon are free themes, beside Classic

Owner, verbatim: *"Okay use modern and cyber FREE"* (DECISION_LOG "MODERN AND CYBER
NEON BECOME FREE THEMES (WITH CLASSIC)…", 2026-09-29).

- `lib/invite-themes.ts`: `galeriya` (Modern) and `cyber` (Cyber Neon) → `tier: 'free'`.
  New `FREE_THEMES` / `PRO_THEMES` / `themeNames()` — every sentence that counts or
  names the themes reads these, never a typed number or list.
- Pick / guest page / Apply: already keyed on `tier`, so a free couple picks, applies
  and shows Modern and Cyber Neon — any celebration, store shell included — exactly
  as Classic. Rustic, Cinderella, Luxe, Vintage, Whimsical, Regency and Great Gatsby
  stay Event Hub Pro, wedding fence unchanged for them.
- Prints: `isProPrint(theme)` (the registry's tier) is now the gate in `mayServe` and
  in `/api/hub-print`; `isThemedPrint` only names files. A free couple downloads
  Modern / Cyber Neon print-ready and unwatermarked (screen view unmarked too);
  Prints & Tickets says "Classic, Modern and Cyber Neon prints are free and
  print-ready" (from the registry) and offers no sample or Go Pro for them.
- The couple's OWN photo is Pro media on EVERY theme (owner 2026-09-29, "yes" —
  DECISION_LOG "A PRO COUPLE KEEPS THEIR OWN PHOTO/VIDEO BACKGROUND ON EVERY THEME"):
  `heroMayBePageGround(theme, ownsPro)` — Classic never; a Pro theme yes (already
  ownership-gated); Modern / Cyber Neon only while the event owns Event Hub Pro,
  measured as viewed (`websiteProActiveFor` / `printOwnsPro`). The page ground
  (Event Hub + RSVP), the invite-door photo and the print still all ask it; a free
  or lapsed couple on a free theme gets the theme's own loop/still.
- Copy: the Pro list item is `PRO_THEMES_ITEM` (`${PRO_THEMES.length} Event Hub
  themes, invite link included` — now 7), and its pitch names the Pro themes from
  the registry. No catalogue migration: the `COUPLE_WEBSITE_PRO` description names
  no count.
- Guard: `lib/free-themes-are-free.test.ts` (pick · apply · print unwatermarked ·
  own media stays Pro · no typed theme count anywhere).

SPEC IMPACT: DECISION_LOG.md — AS BUILT row for "MODERN AND CYBER NEON BECOME FREE
THEMES (WITH CLASSIC)" (what shipped, the owner question on a Pro couple's own photo
under a free theme, and the copy left for after PR #6091).
