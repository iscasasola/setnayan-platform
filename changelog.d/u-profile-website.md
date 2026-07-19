# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(u-profile): the account's public /u/[user-slug] page is now a designed personal website

Owner (2026-07-04): the couple had no proper screen for picking among their events "where it will also stand as their website." Decision (owner-confirmed): **keep the signed-in landing exactly as-is** (auto-jump to the primary event; the internal `(account)` picker stays a simple screen) and **upgrade the PUBLIC `/u/[user-slug]` surface** — the same page a signed-out visitor uses to pick among a couple's celebrations — into a real, designed web presence.

- **`app/u/[userSlug]/page.tsx`**: replaced the thin inline-styled `<ul>` stub with an editorial gallery. Dispatch logic is **unchanged** (1 ongoing public event → redirect into it · 2+ → gallery · 0 → published stories · else empty-state), as is the `noindex` metadata and both visibility/website-surface gates.
  - Each celebration renders as a card carrying the couple's **real monogram mark** (`EventMonogram`, reused from the dashboard chrome) — or a **hero-image cover** when `landing_page_hero_image_url` is set. The `SELECT` now pulls `landing_page_hero_image_url` + the `monogram_*` fields (all already present on `events`, verified against prod; same columns the `/[slug]` page selects).
  - Header uses the Instrument Serif marketing display (`.m-serif`) for the account name with a single champagne-gold hairline accent; two-column responsive grid ≥640px; hover lift + gold border; "Made with Setnayan" footer link.
  - Palette-compliant (`--m-*` Clean Editorial tokens only). Per the site-wide no-eyebrow-kicker rule, the stub's uppercase "SETNAYAN" kicker and the mono "CELEBRATIONS / STORIES" section label were dropped — the title + subtitle carry the context.

SPEC IMPACT: None — presentational upgrade to the already-shipped `/u/[user-slug]` surface (slug-routing program). No schema, no pricing, no routing/dispatch change; the signed-in login-landing rule (locked 2026-05-20) is untouched.
