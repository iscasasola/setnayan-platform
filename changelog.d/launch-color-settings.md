## 2026-07-24 · feat(website): Background + Button color settings (PR-C)

Two NET-NEW couple-facing website settings — **Background colour** and **Button
colour** — shipped as part of the Website Pro bundle (Launch settings-first
design · `Design_Launch_Settings_2026-07-24` §4.4). Until now the guest-site
colour came only from the Mood Board `role_palette`; these let a couple who owns
Website Pro override the page background and CTA/button colour directly.

- **Migration `20270930244819_events_site_custom_colors.sql`** — adds two
  nullable `TEXT` columns to `public.events`: `site_bg_color` + `site_button_color`
  (`#rrggbb` hex or NULL). Idempotent (`ADD COLUMN IF NOT EXISTS`) + COMMENTs.
  NULL = inert (today's palette behaviour).
- **New editor `/dashboard/[eventId]/website/colors`** (page + actions + a small
  `color-field` client picker) — host-gated (`getHostUserId` / `requireHostMembership`);
  validates each field as strict hex or empty (=clear). **Pro-gated** on
  `eventCoupleWebsiteProActive`: a non-Pro couple sees a locked upsell to
  `/dashboard/[eventId]/studio/website-pro` (no grandfathered content — these are
  net-new settings, so the gate is purely Pro).
- **Guest-site application** — `lib/site-palette.ts` gains `buildCustomSiteColorVars`
  (bg → `--color-cream`, button → `--color-mulberry` + `-600`/`-700`). `loadMedia`
  resolves `siteColorVars` ONLY when the event owns active Website Pro AND a column
  is set; `InvitationShell` layers it OVER the Mood-Board palette. When inert
  (NULL columns OR non-Pro) the merge is a no-op → the render is byte-identical to
  today. Verified: `site-body-plan` goldens green (12/12).

Deferred: re-pointing the redesigned Launch page's `bg-color` / `button-color`
Pro cards to `/website/colors` — PR-A's launch rebuild isn't in `origin/main`
yet, so those cards don't exist to re-point. PR-A should point them at the new
`/website/colors` route when it lands (a one-line href).

SPEC IMPACT: 2 new columns `public.events.site_bg_color` + `site_button_color`
(nullable `#rrggbb` hex, Website-Pro-gated guest-site colour overrides). Corpus:
`Design_Launch_Settings_2026-07-24` §4.4 is the source; DECISION_LOG note owed
for the Website-Pro colour settings landing.
