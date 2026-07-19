## 2026-06-20 · feat(website): wedding page is private until the couple launches their Save-the-Date

Owner ruling 2026-06-20: the `/[slug]` wedding page must be PRIVATE by default and go public only when the couple launches their Save-the-Date. Reuses the existing `events.landing_page_visibility` primitive (the `'private'` branch already shows strangers a lock screen while letting the couple preview + invited guests through) — the page was public only because the column defaulted to `'public'` and "launching" never flipped it.

- **Migration `20270206705422`** — `landing_page_visibility` default flips to `'private'`; adds `std_launched_at TIMESTAMPTZ`; backfills existing public, not-yet-launched pages to `'private'` (owner ruling) while keeping the `is_sample` showcase event public. **NOT auto-applied** — owner go-live step (`supabase db push`).
- **`studio/save-the-date/actions.ts`** — new `launchSaveTheDate(eventId)`: flips `landing_page_visibility='public'`, stamps `std_launched_at`, and `revalidatePath('/${slug}')` (the dashboard-only `revalidate()` helper never touched the public page). **`_components/launch-std-button.tsx`** (new) — explicit "Launch my Save-the-Date" control with an inline confirm + a launched/"View your page" state; mounted in the studio page.
- **`app/[slug]/page.tsx`** — NULL/legacy visibility now coalesces to `'private'` (fail safe). The existing private gate + noindex are unchanged.
- **`wizard-actions.ts`** — the create-website task's unspecified-visibility fallback flips `'public'` → `'private'`.
- **Closed three side-door leaks** the audit caught: `find-seat`, `find-my-table`, and `recap` rendered couple names/venue/date gated only on "is a wedding" — no visibility check. New shared **`lib/slug-access.ts` `canViewSlugEvent()`** (mirrors the page's gate: public/unlisted open; private → matching guest cookie or signed-in host) now guards all three; strangers bounce to `/[slug]`. (`welcome` already hard-requires a matching guest cookie; no `live-wall` route exists.)
- **`lib/showcase-db.ts`** — defense-in-depth: `/realstories` + the admin candidate queue exclude `landing_page_visibility='private'`, so a private page can never leak via the showcase or sitemap.

Access matrix unchanged for legit viewers: couple/members preview via the live render (hosts pass the gate); invited guests reach it post-launch via their personal-link cookie; the accountless join flow is untouched (the `?invite=` redeem fires before the gate). Only delta: a stranger on a not-yet-launched page sees the lock screen (with the couple's name + date, per owner choice) instead of the full page.

Safe to merge ahead of the migration — until it applies, new events keep the old `'public'` DB default (no regression) and the launch button + gates are inert/no-op; the feature activates fully when the migration lands. tsc clean.

SPEC IMPACT: 0024 Save-the-Date launch = the publish event for the 0002/0015 couple page. Logged in `DECISION_LOG.md`.
