## 2026-07-02 · change(nav): couple "Launch" opens the live personal website

Owner: "launch on customer event is their personal website." The couple
dashboard's top-level **Launch** entry (sidebar + Studio section sub-nav) now
navigates straight to the couple's live personal website at `/[slug]` instead of
the internal `/website/launch` preview + go-live page.

- `customer-nav-config.ts` (sidebar builder) + `customer-menu.ts` (mobile menu
  SSOT) — the `launch` item/child href now resolves to `/${slug}` when the event
  has a public slug, falling back to `/website/launch` (the go-live/setup surface)
  only when no slug exists yet, so a not-yet-published event can still publish.
- `slug` threaded through `buildCustomerNavGroups` / `buildCustomerMenuTree` and
  their consumers (`customer-sidebar.tsx`, `customer-section-subnav.tsx`), fed
  from a new `slug` column added to the event `fullSelect` in the dashboard
  `layout.tsx`.
- Safe pre-publish: `app/[slug]/page.tsx` already renders the full page for a
  signed-in host even while the site is `private` (host-gate), so a couple always
  lands on their own site regardless of publish state; guests still hit the
  private lock screen until it goes public.
- `/website/launch` page is UNCHANGED and still reachable (privacy page link +
  Save-the-Date studio) so the publish/schedule control is not stranded.

SPEC IMPACT: None — nav-destination change only; no schema/SKU/pricing/RLS change
(the `slug` column already exists on `events`; it was merely added to a SELECT).
