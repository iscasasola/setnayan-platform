## 2026-11-13 · copy(truth): retired names leave the shared app, admin, API and lib (truth sweep T3)

Owner, 13 Nov 2026: the site carries no retired names. This is the T3 slice — `app/_components`, `app/(shell)`,
`app/api`, `app/admin`, `app/dev`, `lib/**` (minus help, feature pages, SEO, llms.txt, blog, onboarding),
`scripts/`, `tests/e2e`, the tours and every ⓘ. The couple side (`app/dashboard`, `app/[slug]`, `app/onboarding`)
is #7605's.

- **"Event Hub Pro" → "Event Pro"** in copy and comments (the plan couples see is Free · Event Plus · Event Pro).
  SKU codes (`COUPLE_WEBSITE_PRO`, `EVENT_HUB_PRO`), file names and App Store ids are unchanged.
- **The retired token currency** is no longer called a "wallet" anywhere it is described.
- **The brand abbreviation** is gone from comments; the watermark tests still assert the full spelling.
- **We do not own the `.ph` domain** — `isSetnayanHost` stops treating it as ours, the admin action centre stops
  listing it, the R2 CORS note says only setnayan.com is ours.
- Tests that read couple-side source accept both spellings until #7605 merges (marked `⏳ TRANSITION #7605`), so
  either PR can merge first; they are tightened once it lands.

SPEC IMPACT: None — wording only; the plan's rename is already the owner's ruling of 13 Nov 2026.
