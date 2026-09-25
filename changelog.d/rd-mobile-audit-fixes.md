## 2026-09-26 · fix(mobile): cookie banner stops covering routes' own bottom chrome, tap targets ≥40px, Event Hub stops truncating

A measured mobile audit (375/390/360/768) against production found no
overflow, no clipped text, and no sibling misalignment — the real problems
were all coverage and touch-target size:

- **Cookie consent banner** (`app/_components/cookie-consent-banner.tsx`): the
  old `fixed inset-x-3 bottom-3` floating card covered real content on every
  mobile route with bottom chrome of its own — the countdown on `/cale-ice`,
  listing prices on `/explore`, the sticky CTA on `/features`, the venue tip
  and pills, a supplier profile. It is now a compact edge-to-edge sheet below
  `sm` that (a) reserves body space while shown instead of floating over the
  page (same idiom as `stale-tab-notice.tsx`), and (b) measures whatever else
  is genuinely anchored to the route's own bottom edge and lifts itself above
  it via a `--cb-lift` CSS var. This also fixed the one 12px-gutter outlier
  the audit found on `/` — it was this banner's own `inset-x-3`, not a second
  page section. Guarded by `app/_components/cookie-banner-reserves-space.test.ts`.
- **Footer links** (`home-reskin.css` `.hr-foot-col a`/`.hr-foot-linkbtn`):
  17-20px tall site-wide → `min-h-[40px]`.
  Terms/"Stay signed in" checkbox row (`.hr-si-remember`, shared by `/signup`
  and `/login`): 15px hit area → 40px via the label, input untouched. Login's
  `✕` close button (`.hr-ov-x`): 34px → 40px.
- **Event Hub sub-pages**: the icon-only back link on `/cale-ice/pabuya` (26px),
  "Back to invitation" on `/cale-ice/find-seat` (28px) and `/cale-ice/everyone`
  (18px), and the venue/pabuya/find-seat "other rooms" pills (`room-footer.tsx`,
  32-34px) all → ≥40px.
- **Event Hub no longer truncates** (owner, 2026-09-26): the schedule
  (`schedule-widget.tsx`'s `compact` slice-to-3 + "All N moments") and the
  entourage ("See everyone — N more" → `/[slug]/everyone`) both showed
  previews on the guest Hub. Both callers on `/[slug]` (`hideable-widget-render.tsx`,
  `public-hideable-widget.tsx`, `site-body.tsx`) now render everything inline;
  `/[slug]/everyone` and the `compact`/`previewHref` props stay available for
  any other caller. Guarded by
  `app/[slug]/_components/the-event-hub-does-not-truncate.test.ts`.

SPEC IMPACT: None — mobile layout/tap-target fixes and a copy-parity change
(Event Hub no longer previews the schedule or the guest list), no schema or
pricing change.
