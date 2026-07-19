## 2026-07-14 · content(seo/geo): reposition the searchable surface to a wedding-first life-events collection

Owner directive: "update our SEO and GEO … no longer readable as a wedding app
alone nor an events app, but how we now run a life-event collection OS." Owner
picked **wedding-first, life-OS secondary** (protects the wedding-search equity;
matches the `Positioning_Family_Life_OS_2026-07-12` "wedge, not the whole"
discipline). Weddings stay the headline; the life-events collection becomes a
consistent secondary theme on the brand-entity + GEO surfaces so AI answer
engines + SERP cards stop grounding Setnayan as *only* a wedding app.

Edited the high-leverage fan-out surfaces (not the feature-specific service
pages — that would tip into a full pivot):

- `app/layout.tsx` — site-wide `baseMetadata.description` + OG/Twitter
  description + the **Organization JSON-LD** `description` (the entity Google
  Knowledge Graph + AI engines ground on): "wedding platform, built to grow into
  a life-events collection — plan it, capture it, keep it for life."
- `app/page.tsx` — home `description`, `keywords` (+3 collection/life-event
  terms), and the **SoftwareApplication JSON-LD** `description` + `featureList`
  (added the Alaala living-memory item + a "grows beyond the wedding" item).
- `public/llms.txt` — reframed the summary + About block; added a new
  **"What Setnayan is — and what it's becoming"** section that explicitly
  separates what is LIVE (a couple's own events, the wedding auto-creating its
  own recurring anniversary with a yearly reminder, the 0% marketplace, the
  Alaala archive) from the family-graph DIRECTION (children's milestones,
  godparents, faith rites — not shipped). Prices UNCHANGED (already current on
  `main`: AI ₱1,499 one-time, tokens ₱200); drift guard stays green.
- `public/manifest.json` — description now names both wedding + life-events.
- `lib/help.ts` — the shared `what-is-setnayan` brand blurb (fans out to the
  FAQPage JSON-LD on `/about`, `/tl/about`, `/help`) reframed to match; and the
  stale "Setnayan AI = per-cycle subscription" wording in three FAQ answers
  aligned to the one-time model (no figure — `help-no-hardcoded-prices` guard
  stays green), matching `llms.txt`.
- `app/about/page.tsx`, `app/our-story/page.tsx`, `app/alaala/page.tsx` — light
  secondary-theme touches.

Honesty guardrail held throughout: only shipped capabilities (verified against
`app/dashboard/(account)/year`, `lib/anniversary-dates.ts`,
`lib/event-anchor.ts`, the Alaala pages) are stated as live; the
multi-generational family/godparent graph is framed as direction only.

Guards green: `lib/llms-price-drift.test.ts` (8/8), `lib/help-no-hardcoded-prices.test.ts`.

SPEC IMPACT: None (net-new spec text) — this IMPLEMENTS the existing
`Positioning_Family_Life_OS_2026-07-12.md` on the app's public SEO/GEO surfaces.
A one-line note is added at the bottom of `DECISION_LOG.md` recording the
wedding-first-secondary altitude + the owner's ₱1,499 SEO/GEO display choice.
